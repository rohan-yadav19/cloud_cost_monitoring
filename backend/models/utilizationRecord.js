import mongoose from "mongoose";

const utilizationRecordSchema = new mongoose.Schema(
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
    cpuPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true },
);

const UtilizationRecord = mongoose.model(
  "UtilizationRecord",
  utilizationRecordSchema,
);

export default UtilizationRecord;
