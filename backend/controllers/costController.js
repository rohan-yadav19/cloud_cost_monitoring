import CostRecord from "../models/costRecord.js";
import Resource from "../models/resource.js";
import { seedMockData } from "../services/mockDataService.js";

export const getCostSummary = async (req, res) => {
  try {
    await seedMockData();

    const [trendAgg, totalAgg, resources] = await Promise.all([
      CostRecord.aggregate([
        {
          $group: {
            _id: "$date",
            total: { $sum: "$cost" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      CostRecord.aggregate([
        {
          $group: {
            _id: null,
            totalMonthlySpend: { $sum: "$cost" },
          },
        },
      ]),
      Resource.find().select("resourceId type").lean(),
    ]);

    const trend = trendAgg.map((item) => ({
      date: item._id,
      total: Number(item.total.toFixed(2)),
    }));

    const totalMonthlySpend = Number(
      (totalAgg[0]?.totalMonthlySpend || 0).toFixed(2),
    );

    const byType = { EC2: 0, EBS: 0, S3: 0 };
    const resourceTypeMap = Object.fromEntries(
      resources.map((resource) => [resource.resourceId, resource.type]),
    );

    const costsByResource = await CostRecord.aggregate([
      {
        $group: {
          _id: "$resourceId",
          total: { $sum: "$cost" },
        },
      },
    ]);

    costsByResource.forEach((item) => {
      const type = resourceTypeMap[item._id];
      if (type) {
        byType[type] += item.total;
      }
    });

    Object.keys(byType).forEach((type) => {
      byType[type] = Number(byType[type].toFixed(2));
    });

    res.status(200).json({
      success: true,
      summary: {
        totalMonthlySpend,
        trend,
        byType,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
