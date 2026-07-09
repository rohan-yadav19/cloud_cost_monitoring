import Resource from "../models/resource.js";
import CostRecord from "../models/costRecord.js";
import UtilizationRecord from "../models/utilizationRecord.js";
import Recommendation from "../models/recommendation.js";
import ResourceChange from "../models/resourceChange.js";
import { seedMockData } from "../services/mockDataService.js";
import {
  buildSizingPreview,
  getUtilizationAdjustment,
} from "../services/recommendationSizingService.js";

const IDLE_CPU_THRESHOLD = 5; // %
const OVERUSE_WARNING_THRESHOLD = 80; // %
const IDLE_DAYS_WINDOW = 7;
const OVERUSE_DAYS_WINDOW = 3;
const SAVINGS_FACTOR = 0.3; // 30% of current monthly cost
const APPLY_COOLDOWN_HOURS = 24;

function suggestedActionFor(issueType) {
  if (issueType === "idle_ec2") return "Scale down";
  if (issueType === "unused_ebs") return "Terminate";
  if (issueType === "overused_ec2") return "Scale up";
  return "Review";
}

function issueLabelFor(issueType) {
  if (issueType === "idle_ec2") return "Idle EC2";
  if (issueType === "unused_ebs") return "Unused EBS";
  if (issueType === "overused_ec2") return "Overutilized EC2";
  return issueType;
}

function getWindowStart(days) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

async function getCostMap(resourceIds) {
  const costAgg = await CostRecord.aggregate([
    { $match: { resourceId: { $in: resourceIds } } },
    {
      $group: {
        _id: "$resourceId",
        monthlyCost: { $sum: "$cost" },
      },
    },
  ]);

  return Object.fromEntries(
    costAgg.map((item) => [item._id, Number(item.monthlyCost.toFixed(2))]),
  );
}

async function getRecentlyAppliedResourceIds() {
  const cooldownStart = new Date(Date.now() - APPLY_COOLDOWN_HOURS * 60 * 60 * 1000);
  const recentChanges = await ResourceChange.find({
    appliedAt: { $gte: cooldownStart },
  })
    .select("resourceId")
    .lean();

  return new Set(recentChanges.map((change) => change.resourceId));
}

function computeOpenRecommendations(resources, idleCpuMap, overuseCpuMap, costMap, skipResourceIds) {
  const newRecs = [];

  resources.forEach((resource) => {
    if (skipResourceIds.has(resource.resourceId)) {
      return;
    }

    const monthlyCost = costMap[resource.resourceId] || 0;

    if (resource.type === "EC2" && resource.status === "running") {
      const avgCpu = idleCpuMap[resource.resourceId];
      if (avgCpu != null && avgCpu < IDLE_CPU_THRESHOLD) {
        newRecs.push({
          resourceId: resource.resourceId,
          issueType: "idle_ec2",
          suggestedAction: "Scale down",
          message: `EC2 instance has average CPU ${avgCpu}% over last ${IDLE_DAYS_WINDOW} days. Consider stopping or rightsizing.`,
          estimatedSavings: Number((monthlyCost * SAVINGS_FACTOR).toFixed(2)),
          status: "open",
        });
      }

      const overuseCpu = overuseCpuMap[resource.resourceId];
      if (overuseCpu != null) {
        const exceedsLimit =
          resource.capacityLimit != null && overuseCpu > resource.capacityLimit;
        const exceedsWarning = overuseCpu > OVERUSE_WARNING_THRESHOLD;

        if (exceedsLimit || exceedsWarning) {
          const threshold = exceedsLimit
            ? resource.capacityLimit
            : OVERUSE_WARNING_THRESHOLD;

          newRecs.push({
            resourceId: resource.resourceId,
            issueType: "overused_ec2",
            suggestedAction: "Scale up",
            message: exceedsLimit
              ? `EC2 instance is running at ${overuseCpu}% CPU, above its ${threshold}% capacity limit over the last ${OVERUSE_DAYS_WINDOW} days. Scale up this instance to handle the load.`
              : `EC2 instance has average CPU ${overuseCpu}% over the last ${OVERUSE_DAYS_WINDOW} days. Scale up this instance to handle increased load.`,
            estimatedSavings: 0,
            status: "open",
          });
        }
      }
    }

    if (resource.type === "EBS" && resource.status === "unattached") {
      newRecs.push({
        resourceId: resource.resourceId,
        issueType: "unused_ebs",
        suggestedAction: "Terminate",
        message:
          "EBS volume is unattached. Consider snapshotting and deleting to save storage cost.",
        estimatedSavings: Number((monthlyCost * SAVINGS_FACTOR).toFixed(2)),
        status: "open",
      });
    }
  });

  return newRecs;
}

function enrichRecommendation(rec, resources, costMap, changeMap = new Map()) {
  const resource = resources.find((item) => item.resourceId === rec.resourceId);
  const monthlyCost = costMap[rec.resourceId] || 0;
  const action = rec.suggestedAction || suggestedActionFor(rec.issueType);

  let currentConfig = null;
  let recommendedConfig = null;
  let changeSummary = null;

  if (rec.status === "open" && resource) {
    try {
      const preview = buildSizingPreview(resource, action, monthlyCost);
      currentConfig = preview.currentConfig;
      recommendedConfig = preview.recommendedConfig;
      changeSummary = preview.summaryLabel;
    } catch {
      // Unsupported combo — leave configs null
    }
  }

  if (rec.status === "resolved" && rec.appliedChangeId) {
    const change = changeMap.get(rec.appliedChangeId.toString());
    if (change) {
      currentConfig = change.previousConfig;
      recommendedConfig = change.newConfig;
      changeSummary = change.summary;
    }
  }

  return {
    id: rec._id.toString(),
    resourceId: rec.resourceId,
    type: resource?.type,
    region: resource?.region,
    status: rec.status,
    resourceStatus: resource?.status,
    issueType: rec.issueType,
    issueLabel: issueLabelFor(rec.issueType),
    suggestedAction: action,
    message: rec.message,
    estimatedSavings: rec.estimatedSavings,
    createdAt: rec.createdAt,
    resolvedAt: rec.resolvedAt,
    currentConfig,
    recommendedConfig,
    changeSummary,
  };
}

async function syncOpenRecommendations() {
  const resources = await Resource.find().lean();
  const resourceIds = resources.map((r) => r.resourceId);
  const now = new Date();
  const idleWindowStart = getWindowStart(IDLE_DAYS_WINDOW);
  const overuseWindowStart = getWindowStart(OVERUSE_DAYS_WINDOW);

  const [idleCpuAgg, overuseCpuAgg, costMap, skipResourceIds] = await Promise.all([
    UtilizationRecord.aggregate([
      {
        $match: {
          resourceId: { $in: resourceIds },
          date: { $gte: idleWindowStart, $lte: now },
        },
      },
      {
        $group: {
          _id: "$resourceId",
          avgCpuPercent: { $avg: "$cpuPercent" },
        },
      },
    ]),
    UtilizationRecord.aggregate([
      {
        $match: {
          resourceId: { $in: resourceIds },
          date: { $gte: overuseWindowStart, $lte: now },
        },
      },
      {
        $group: {
          _id: "$resourceId",
          avgCpuPercent: { $avg: "$cpuPercent" },
        },
      },
    ]),
    getCostMap(resourceIds),
    getRecentlyAppliedResourceIds(),
  ]);

  const idleCpuMap = Object.fromEntries(
    idleCpuAgg.map((item) => [item._id, Number(item.avgCpuPercent.toFixed(2))]),
  );
  const overuseCpuMap = Object.fromEntries(
    overuseCpuAgg.map((item) => [item._id, Number(item.avgCpuPercent.toFixed(2))]),
  );

  const newRecs = computeOpenRecommendations(
    resources,
    idleCpuMap,
    overuseCpuMap,
    costMap,
    skipResourceIds,
  );

  await Recommendation.deleteMany({ status: "open" });
  if (newRecs.length) {
    await Recommendation.insertMany(newRecs);
  }

  return { resources, costMap };
}

export const getRecommendations = async (req, res) => {
  try {
    await seedMockData();

    const { resources, costMap } = await syncOpenRecommendations();

    const allRecs = await Recommendation.find().sort({ createdAt: -1 }).lean();
    const changeIds = allRecs
      .filter((rec) => rec.appliedChangeId)
      .map((rec) => rec.appliedChangeId);

    const changes = changeIds.length
      ? await ResourceChange.find({ _id: { $in: changeIds } }).lean()
      : [];
    const changeMap = new Map(changes.map((change) => [change._id.toString(), change]));

    const recsWithResource = allRecs.map((rec) =>
      enrichRecommendation(rec, resources, costMap, changeMap),
    );

    const openRecs = recsWithResource.filter((rec) => rec.status === "open");
    const appliedRecs = recsWithResource.filter((rec) => rec.status === "resolved");

    const summary = {
      scaleDown: openRecs.filter((rec) => rec.suggestedAction === "Scale down").length,
      terminate: openRecs.filter((rec) => rec.suggestedAction === "Terminate").length,
      scaleUp: openRecs.filter((rec) => rec.suggestedAction === "Scale up").length,
    };

    const scaleUpRecommendations = openRecs.filter(
      (rec) => rec.issueType === "overused_ec2",
    );
    const costOptimizationRecommendations = openRecs.filter(
      (rec) => rec.issueType !== "overused_ec2",
    );

    res.status(200).json({
      success: true,
      count: openRecs.length,
      summary,
      recommendations: openRecs,
      scaleUpRecommendations,
      costOptimizationRecommendations,
      appliedRecommendations: appliedRecs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const previewRecommendation = async (req, res) => {
  try {
    await seedMockData();

    const recommendation = await Recommendation.findById(req.params.id).lean();
    if (!recommendation) {
      return res.status(404).json({ success: false, message: "Recommendation not found" });
    }

    if (recommendation.status !== "open") {
      return res.status(400).json({ success: false, message: "Recommendation is already resolved" });
    }

    const resource = await Resource.findOne({ resourceId: recommendation.resourceId }).lean();
    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    const costMap = await getCostMap([resource.resourceId]);
    const monthlyCost = costMap[resource.resourceId] || 0;
    const action = recommendation.suggestedAction || suggestedActionFor(recommendation.issueType);
    const preview = buildSizingPreview(resource, action, monthlyCost);

    res.status(200).json({
      success: true,
      preview: {
        recommendationId: recommendation._id.toString(),
        resourceId: recommendation.resourceId,
        action,
        issueType: recommendation.issueType,
        message: recommendation.message,
        estimatedSavings: recommendation.estimatedSavings,
        ...preview,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function adjustUtilizationAfterApply(resourceId, action) {
  const adjustment = getUtilizationAdjustment(action);
  if (!adjustment) {
    return;
  }

  const records = await UtilizationRecord.find({ resourceId }).lean();
  if (!records.length) {
    return;
  }

  const writes = records.map((record) => ({
    updateOne: {
      filter: { _id: record._id },
      update: {
        $set: {
          cpuPercent: Number(
            Math.min(99, Math.max(1, record.cpuPercent * adjustment.factor)).toFixed(2),
          ),
        },
      },
    },
  }));

  await UtilizationRecord.bulkWrite(writes, { ordered: false });
}

export const applyRecommendation = async (req, res) => {
  try {
    await seedMockData();

    const recommendation = await Recommendation.findById(req.params.id);
    if (!recommendation) {
      return res.status(404).json({ success: false, message: "Recommendation not found" });
    }

    if (recommendation.status !== "open") {
      return res.status(400).json({ success: false, message: "Recommendation is already resolved" });
    }

    const resource = await Resource.findOne({ resourceId: recommendation.resourceId });
    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    const costMap = await getCostMap([resource.resourceId]);
    const monthlyCost = costMap[resource.resourceId] || 0;
    const action = recommendation.suggestedAction || suggestedActionFor(recommendation.issueType);
    const preview = buildSizingPreview(resource.toObject(), action, monthlyCost);

    const change = await ResourceChange.create({
      userId: req.user._id,
      resourceId: resource.resourceId,
      recommendationId: recommendation._id,
      action,
      previousConfig: preview.currentConfig,
      newConfig: preview.recommendedConfig,
      summary: preview.summaryLabel,
    });

    Object.assign(resource, preview.resourceUpdates);
    await resource.save();

    if (resource.type === "EC2") {
      await adjustUtilizationAfterApply(resource.resourceId, action);
    }

    recommendation.status = "resolved";
    recommendation.resolvedAt = new Date();
    recommendation.appliedChangeId = change._id;
    await recommendation.save();

    res.status(200).json({
      success: true,
      change: {
        id: change._id.toString(),
        resourceId: change.resourceId,
        action: change.action,
        summary: change.summary,
        previousConfig: change.previousConfig,
        newConfig: change.newConfig,
        appliedAt: change.appliedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
