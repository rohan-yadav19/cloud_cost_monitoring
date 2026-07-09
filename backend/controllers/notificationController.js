import Notification from "../models/notification.js";

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user._id,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications: notifications.map((notification) => ({
        id: notification._id.toString(),
        resourceId: notification.resourceId,
        type: notification.type,
        severity: notification.severity,
        title: notification.title,
        message: notification.message,
        recommendedAction: notification.recommendedAction || "Scale up",
        currentUsage: notification.currentUsage,
        thresholdValue: notification.thresholdValue,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { isRead: true } },
      { new: true },
    ).lean();

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({
      success: true,
      notification: {
        id: notification._id.toString(),
        isRead: notification.isRead,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
