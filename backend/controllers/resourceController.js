import Resource from "../models/resource.js";
import CostRecord from "../models/costRecord.js";
import UtilizationRecord from "../models/utilizationRecord.js";
import Notification from "../models/notification.js";
import { seedMockData } from "../services/mockDataService.js";

const OVERUSE_WARNING_THRESHOLD = 80;
const OVERUSE_WINDOW_DAYS = 3;

function getWindowStart(days) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

async function syncMockOveruseNotifications({ userId, resources, utilizationMap }) {
  const writes = [];

  resources.forEach((resource) => {
    if (resource.type !== "EC2") {
      return;
    }

    const avgCpuPercent = utilizationMap[resource.resourceId];
    if (avgCpuPercent == null) {
      return;
    }

    const exceedsLimit =
      resource.capacityLimit != null && avgCpuPercent > resource.capacityLimit;
    const exceedsWarning = avgCpuPercent > OVERUSE_WARNING_THRESHOLD;

    if (exceedsLimit || exceedsWarning) {
      const severity = exceedsLimit ? "critical" : "warning";
      const thresholdValue = exceedsLimit
        ? resource.capacityLimit
        : OVERUSE_WARNING_THRESHOLD;

      writes.push({
        updateOne: {
          filter: {
            userId,
            resourceId: resource.resourceId,
            type: "resource_overuse",
            status: "active",
          },
          update: {
            $set: {
              severity,
              title: exceedsLimit ? "Capacity exceeded" : "High utilization",
              message: exceedsLimit
                ? `CPU usage is ${avgCpuPercent}% which is above the resource limit (${resource.capacityLimit}%).`
                : `CPU usage is ${avgCpuPercent}% which is above the warning threshold (${OVERUSE_WARNING_THRESHOLD}%).`,
              recommendedAction: "Scale up",
              currentUsage: avgCpuPercent,
              thresholdValue,
              resolvedAt: null,
            },
            $setOnInsert: {
              isRead: false,
            },
          },
          upsert: true,
        },
      });
    } else {
      writes.push({
        updateOne: {
          filter: {
            userId,
            resourceId: resource.resourceId,
            type: "resource_overuse",
            status: "active",
          },
          update: {
            $set: {
              status: "resolved",
              resolvedAt: new Date(),
            },
          },
        },
      });
    }
  });

  if (writes.length) {
    await Notification.bulkWrite(writes, { ordered: false });
  }
}

export const getResources = async (req, res) => {
  try {
    await seedMockData();

    const resources = await Resource.find().sort({ launchDate: -1 }).lean();
    const resourceIds = resources.map((item) => item.resourceId);
    const windowStart = getWindowStart(OVERUSE_WINDOW_DAYS);
    const now = new Date();

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
    ]);

    const costMap = Object.fromEntries(
      costAgg.map((item) => [item._id, Number(item.monthlyCost.toFixed(2))]),
    );
    const utilizationMap = Object.fromEntries(
      utilizationAgg.map((item) => [item._id, Number(item.avgCpuPercent.toFixed(2))]),
    );

    await syncMockOveruseNotifications({
      userId: req.user._id,
      resources,
      utilizationMap,
    });

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
