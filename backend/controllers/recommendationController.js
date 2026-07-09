import Resource from "../models/resource.js";
import CostRecord from "../models/costRecord.js";
import UtilizationRecord from "../models/utilizationRecord.js";
import Recommendation from "../models/recommendation.js";
import { seedMockData } from "../services/mockDataService.js";

const IDLE_CPU_THRESHOLD = 5; // %
const OVERUSE_WARNING_THRESHOLD = 80; // %
const IDLE_DAYS_WINDOW = 7;
const OVERUSE_DAYS_WINDOW = 3;
const SAVINGS_FACTOR = 0.3; // 30% of current monthly cost

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

export const getRecommendations = async (req, res) => {
  try {
    await seedMockData();

    const resources = await Resource.find().lean();
    const resourceIds = resources.map((r) => r.resourceId);

    const now = new Date();
    const idleWindowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - IDLE_DAYS_WINDOW + 1,
    );
    idleWindowStart.setHours(0, 0, 0, 0);

    const overuseWindowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - OVERUSE_DAYS_WINDOW + 1,
    );
    overuseWindowStart.setHours(0, 0, 0, 0);

    const [idleCpuAgg, overuseCpuAgg, costAgg] = await Promise.all([
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
      CostRecord.aggregate([
        { $match: { resourceId: { $in: resourceIds } } },
        {
          $group: {
            _id: "$resourceId",
            monthlyCost: { $sum: "$cost" },
          },
        },
      ]),
    ]);

    const idleCpuMap = Object.fromEntries(
      idleCpuAgg.map((item) => [item._id, Number(item.avgCpuPercent.toFixed(2))]),
    );
    const overuseCpuMap = Object.fromEntries(
      overuseCpuAgg.map((item) => [item._id, Number(item.avgCpuPercent.toFixed(2))]),
    );
    const costMap = Object.fromEntries(
      costAgg.map((item) => [item._id, Number(item.monthlyCost.toFixed(2))]),
    );

    const newRecs = [];

    resources.forEach((resource) => {
      const monthlyCost = costMap[resource.resourceId] || 0;

      if (resource.type === "EC2") {
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

    await Recommendation.deleteMany({});
    const inserted = await Recommendation.insertMany(newRecs);

    const recsWithResource = inserted.map((rec) => {
      const resource = resources.find(
        (r) => r.resourceId === rec.resourceId,
      );
      return {
        id: rec._id.toString(),
        resourceId: rec.resourceId,
        type: resource?.type,
        region: resource?.region,
        status: resource?.status,
        issueType: rec.issueType,
        issueLabel: issueLabelFor(rec.issueType),
        suggestedAction: rec.suggestedAction || suggestedActionFor(rec.issueType),
        message: rec.message,
        estimatedSavings: rec.estimatedSavings,
        createdAt: rec.createdAt,
      };
    });

    const summary = {
      scaleDown: recsWithResource.filter((rec) => rec.suggestedAction === "Scale down").length,
      terminate: recsWithResource.filter((rec) => rec.suggestedAction === "Terminate").length,
      scaleUp: recsWithResource.filter((rec) => rec.suggestedAction === "Scale up").length,
    };

    const scaleUpRecommendations = recsWithResource.filter(
      (rec) => rec.issueType === "overused_ec2",
    );
    const costOptimizationRecommendations = recsWithResource.filter(
      (rec) => rec.issueType !== "overused_ec2",
    );

    res.status(200).json({
      success: true,
      count: recsWithResource.length,
      summary,
      recommendations: recsWithResource,
      scaleUpRecommendations,
      costOptimizationRecommendations,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
