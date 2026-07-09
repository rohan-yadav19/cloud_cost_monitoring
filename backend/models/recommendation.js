import mongoose from "mongoose";

const recommendationSchema = new mongoose.Schema(
  {
    resourceId: {
      type: String,
      required: true,
      index: true,
    },
    issueType: {
      type: String,
      enum: ["idle_ec2", "unused_ebs", "overused_ec2"],
      required: true,
    },
    suggestedAction: {
      type: String,
      enum: ["Scale down", "Terminate", "Scale up", "Review"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    estimatedSavings: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
  },
  { timestamps: true },
);

const Recommendation = mongoose.model("Recommendation", recommendationSchema);

export default Recommendation;
