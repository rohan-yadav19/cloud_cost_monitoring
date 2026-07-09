import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    resourceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["EC2", "EBS", "S3"],
      required: true,
    },
    region: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    launchDate: {
      type: Date,
      required: true,
    },
    capacityLimit: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    instanceType: {
      type: String,
      trim: true,
      default: null,
    },
    volumeSizeGb: {
      type: Number,
      min: 1,
      default: null,
    },
  },
  { timestamps: true },
);

const Resource = mongoose.model("Resource", resourceSchema);

export default Resource;
