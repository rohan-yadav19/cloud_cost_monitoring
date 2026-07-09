import mongoose from "mongoose";

const configSnapshotSchema = new mongoose.Schema(
  {
    instanceType: { type: String, default: null },
    status: { type: String, default: null },
    volumeSizeGb: { type: Number, default: null },
    region: { type: String, default: null },
    monthlyCost: { type: Number, default: null },
  },
  { _id: false },
);

const resourceChangeSchema = new mongoose.Schema(
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
    recommendationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recommendation",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["Scale down", "Scale up", "Terminate"],
      required: true,
    },
    previousConfig: {
      type: configSnapshotSchema,
      required: true,
    },
    newConfig: {
      type: configSnapshotSchema,
      required: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

const ResourceChange = mongoose.model("ResourceChange", resourceChangeSchema);

export default ResourceChange;
