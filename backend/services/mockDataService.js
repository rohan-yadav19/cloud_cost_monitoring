import Resource from "../models/resource.js";
import CostRecord from "../models/costRecord.js";
import UtilizationRecord from "../models/utilizationRecord.js";

const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-south-1"];
const DAYS = 30;

const randomBetween = (min, max) =>
  Number((Math.random() * (max - min) + min).toFixed(2));

const pick = (values) => values[Math.floor(Math.random() * values.length)];

const EC2_INSTANCE_TYPES = ["t3.small", "t3.medium", "t3.large", "t3.xlarge"];

function buildResources() {
  const resources = [];
  const now = new Date();

  for (let i = 1; i <= 8; i += 1) {
    resources.push({
      resourceId: `i-0ec2${String(i).padStart(4, "0")}`,
      type: "EC2",
      region: pick(REGIONS),
      status: "running",
      launchDate: new Date(now.getTime() - (60 + i * 3) * 24 * 60 * 60 * 1000),
      capacityLimit: i === 3 ? 90 : 80,
      instanceType: i === 3 ? "t3.large" : EC2_INSTANCE_TYPES[i % EC2_INSTANCE_TYPES.length],
    });
  }

  for (let i = 1; i <= 6; i += 1) {
    resources.push({
      resourceId: `vol-0ebs${String(i).padStart(4, "0")}`,
      type: "EBS",
      region: pick(REGIONS),
      status: i <= 3 ? "unattached" : "in-use",
      launchDate: new Date(now.getTime() - (40 + i * 5) * 24 * 60 * 60 * 1000),
      volumeSizeGb: 50 + i * 20,
    });
  }

  for (let i = 1; i <= 4; i += 1) {
    resources.push({
      resourceId: `s3-bucket-${String(i).padStart(3, "0")}`,
      type: "S3",
      region: pick(REGIONS),
      status: "active",
      launchDate: new Date(now.getTime() - (90 + i * 7) * 24 * 60 * 60 * 1000),
    });
  }

  return resources;
}

function buildCostRecords(resources) {
  const now = new Date();
  const records = [];

  resources.forEach((resource) => {
    for (let i = DAYS - 1; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);

      let costRange = [0.1, 0.8];
      if (resource.type === "EC2") costRange = [0.6, 4.8];
      if (resource.type === "EBS") costRange = [0.2, 1.6];

      records.push({
        resourceId: resource.resourceId,
        date,
        cost: randomBetween(costRange[0], costRange[1]),
      });
    }
  });

  return records;
}

function buildUtilizationRecords(resources) {
  const now = new Date();
  const records = [];
  const lowCpuResourceIds = new Set(["i-0ec20001", "i-0ec20002"]);
  const highCpuResourceIds = new Set(["i-0ec20003"]);

  resources
    .filter((resource) => resource.type === "EC2")
    .forEach((resource) => {
      for (let i = DAYS - 1; i >= 0; i -= 1) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const range = lowCpuResourceIds.has(resource.resourceId)
          ? [1, 4.2]
          : highCpuResourceIds.has(resource.resourceId)
            ? [88, 97]
            : [12, 78];

        records.push({
          resourceId: resource.resourceId,
          date,
          cpuPercent: randomBetween(range[0], range[1]),
        });
      }
    });

  return records;
}

export async function seedMockData({ force = false } = {}) {
  const existingCount = await Resource.countDocuments();
  if (!force && existingCount > 0) {
    return { seeded: false, resources: existingCount };
  }

  if (force) {
    await Promise.all([
      Resource.deleteMany({}),
      CostRecord.deleteMany({}),
      UtilizationRecord.deleteMany({}),
    ]);
  }

  const resources = buildResources();
  const costRecords = buildCostRecords(resources);
  const utilizationRecords = buildUtilizationRecords(resources);

  await Resource.insertMany(resources);
  await CostRecord.insertMany(costRecords);
  await UtilizationRecord.insertMany(utilizationRecords);

  return {
    seeded: true,
    resources: resources.length,
    costRecords: costRecords.length,
    utilizationRecords: utilizationRecords.length,
  };
}
