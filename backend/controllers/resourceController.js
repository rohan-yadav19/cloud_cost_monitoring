import Resource from "../models/resource.js";
import CostRecord from "../models/costRecord.js";
import UtilizationRecord from "../models/utilizationRecord.js";
import { seedMockData } from "../services/mockDataService.js";

export const getResources = async (req, res) => {
  try {
    await seedMockData();

    const resources = await Resource.find().sort({ launchDate: -1 }).lean();
    const resourceIds = resources.map((item) => item.resourceId);

    const [costAgg, utilizationAgg] = await Promise.all([
      CostRecord.aggregate([
        { $match: { resourceId: { $in: resourceIds } } },
        {
          $group: {
            _id: "$resourceId",
            monthlyCost: { $sum: "$cost" },
          },
        },
      ]),
      UtilizationRecord.aggregate([
        { $match: { resourceId: { $in: resourceIds } } },
        {
          $group: {
            _id: "$resourceId",
            avgCpuPercent: { $avg: "$cpuPercent" },
          },
        },
      ]),
    ]);

    const costMap = Object.fromEntries(
      costAgg.map((item) => [item._id, Number(item.monthlyCost.toFixed(2))]),
    );
    const utilizationMap = Object.fromEntries(
      utilizationAgg.map((item) => [item._id, Number(item.avgCpuPercent.toFixed(2))]),
    );

    const enriched = resources.map((resource) => ({
      ...resource,
      monthlyCost: costMap[resource.resourceId] || 0,
      avgCpuPercent: utilizationMap[resource.resourceId] ?? null,
    }));

    res.status(200).json({
      success: true,
      count: enriched.length,
      resources: enriched,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
