import mongoose from "mongoose";

const costRecordSchema = new mongoose.Schema(
  {
    resourceId: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true },
);

const CostRecord = mongoose.model("CostRecord", costRecordSchema);

export default CostRecord;
