import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["resource_overuse"],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["warning", "critical"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "resolved"],
      default: "active",
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    currentUsage: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    thresholdValue: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

notificationSchema.index(
  { userId: 1, resourceId: 1, type: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
