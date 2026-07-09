const INSTANCE_LADDER = ["t3.small", "t3.medium", "t3.large", "t3.xlarge"];

const INSTANCE_COST_MULTIPLIER = {
  "t3.small": 0.6,
  "t3.medium": 1,
  "t3.large": 1.6,
  "t3.xlarge": 2.4,
};

function stepInstanceType(currentType, direction) {
  const normalized = currentType || "t3.medium";
  const index = INSTANCE_LADDER.indexOf(normalized);
  const currentIndex = index === -1 ? 1 : index;

  if (direction === "down") {
    return INSTANCE_LADDER[Math.max(0, currentIndex - 1)];
  }

  return INSTANCE_LADDER[Math.min(INSTANCE_LADDER.length - 1, currentIndex + 1)];
}

export function buildConfigSnapshot(resource, monthlyCost = 0) {
  return {
    instanceType: resource.instanceType ?? null,
    status: resource.status ?? null,
    volumeSizeGb: resource.volumeSizeGb ?? null,
    region: resource.region ?? null,
    monthlyCost: Number(monthlyCost.toFixed(2)),
  };
}

export function estimateMonthlyCost(baseCost, instanceType) {
  const baseType = "t3.medium";
  const baseMultiplier = INSTANCE_COST_MULTIPLIER[baseType];
  const targetMultiplier = INSTANCE_COST_MULTIPLIER[instanceType] || baseMultiplier;
  return Number(((baseCost / baseMultiplier) * targetMultiplier).toFixed(2));
}

export function buildSizingPreview(resource, action, monthlyCost = 0) {
  const currentConfig = buildConfigSnapshot(resource, monthlyCost);

  if (action === "Terminate" && resource.type === "EBS") {
    const recommendedConfig = {
      ...currentConfig,
      status: "terminated",
      monthlyCost: 0,
    };

    return {
      currentConfig,
      recommendedConfig,
      summaryLabel: `${resource.resourceId}: unattached → terminated`,
      resourceUpdates: { status: "terminated" },
    };
  }

  if (resource.type === "EC2" && (action === "Scale down" || action === "Scale up")) {
    const direction = action === "Scale down" ? "down" : "up";
    const currentType = resource.instanceType || "t3.medium";
    const recommendedType = stepInstanceType(currentType, direction);
    const estimatedCost = estimateMonthlyCost(monthlyCost, recommendedType);

    const recommendedConfig = {
      ...currentConfig,
      instanceType: recommendedType,
      monthlyCost: estimatedCost,
    };

    const verb = action === "Scale down" ? "Scaled down" : "Scaled up";

    return {
      currentConfig,
      recommendedConfig,
      summaryLabel: `${verb} from ${currentType} to ${recommendedType}`,
      resourceUpdates: { instanceType: recommendedType },
    };
  }

  throw new Error(`Unsupported sizing action "${action}" for resource type ${resource.type}`);
}

export function getUtilizationAdjustment(action) {
  if (action === "Scale up") {
    return { factor: 0.75, description: "reduce" };
  }
  if (action === "Scale down") {
    return { factor: 1.25, description: "increase" };
  }
  return null;
}
