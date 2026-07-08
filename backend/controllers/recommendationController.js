import Resource from "../models/resource.js";
import CostRecord from "../models/costRecord.js";
import UtilizationRecord from "../models/utilizationRecord.js";
import Recommendation from "../models/recommendation.js";
import { seedMockData } from "../services/mockDataService.js";

const IDLE_CPU_THRESHOLD = 5; // %
const DAYS_WINDOW = 7;
const SAVINGS_FACTOR = 0.3; // 30% of current monthly cost

function suggestedActionFor(issueType) {
  if (issueType === "idle_ec2") return "Scale down";
  if (issueType === "unused_ebs") return "Terminate";
  return "Review";
}

export const getRecommendations = async (req, res) => {
  try {
    await seedMockData();

    const resources = await Resource.find().lean();
    const resourceIds = resources.map((r) => r.resourceId);

    const now = new Date();
    const windowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - DAYS_WINDOW + 1,
    );
    windowStart.setHours(0, 0, 0, 0);

    const [cpuAgg, costAgg] = await Promise.all([
      UtilizationRecord.aggregate([
        {
          $match: {
            resourceId: { $in: resourceIds },
            date: { $gte: windowStart, $lte: now },
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

    const cpuMap = Object.fromEntries(
      cpuAgg.map((item) => [item._id, Number(item.avgCpuPercent.toFixed(2))]),
    );
    const costMap = Object.fromEntries(
      costAgg.map((item) => [item._id, Number(item.monthlyCost.toFixed(2))]),
    );

    const newRecs = [];

    resources.forEach((resource) => {
      const monthlyCost = costMap[resource.resourceId] || 0;

      if (resource.type === "EC2") {
        const avgCpu = cpuMap[resource.resourceId];
        if (avgCpu != null && avgCpu < IDLE_CPU_THRESHOLD) {
          newRecs.push({
            resourceId: resource.resourceId,
            issueType: "idle_ec2",
            message: `EC2 instance has average CPU ${avgCpu}% over last ${DAYS_WINDOW} days. Consider stopping or rightsizing.`,
            estimatedSavings: Number((monthlyCost * SAVINGS_FACTOR).toFixed(2)),
            status: "open",
          });
        }
      }

      if (resource.type === "EBS" && resource.status === "unattached") {
        newRecs.push({
          resourceId: resource.resourceId,
          issueType: "unused_ebs",
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
        suggestedAction: suggestedActionFor(rec.issueType),
        message: rec.message,
        estimatedSavings: rec.estimatedSavings,
        createdAt: rec.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      count: recsWithResource.length,
      recommendations: recsWithResource,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
