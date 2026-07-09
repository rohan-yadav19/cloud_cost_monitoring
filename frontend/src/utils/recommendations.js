export const OVERUSE_WARNING_THRESHOLD = 80;

export function suggestedActionFor(rec) {
  if (rec?.suggestedAction) return rec.suggestedAction;
  if (rec?.issueType === "idle_ec2") return "Scale down";
  if (rec?.issueType === "unused_ebs") return "Terminate";
  if (rec?.issueType === "overused_ec2") return "Scale up";
  return "Review";
}

export function suggestionForResource(resource) {
  if (resource?.type === "EC2" && resource.avgCpuPercent != null) {
    if (resource.avgCpuPercent < 5) return "Scale down";

    const exceedsLimit =
      resource.capacityLimit != null &&
      resource.avgCpuPercent > resource.capacityLimit;
    const exceedsWarning = resource.avgCpuPercent > OVERUSE_WARNING_THRESHOLD;
    if (exceedsLimit || exceedsWarning) return "Scale up";
  }

  if (resource?.type === "EBS" && resource.status === "unattached") {
    return "Terminate";
  }

  return null;
}

export function summarizeRecommendations(recommendations = []) {
  const summary = { scaleDown: 0, terminate: 0, scaleUp: 0 };

  recommendations.forEach((rec) => {
    const action = suggestedActionFor(rec);
    if (action === "Scale down") summary.scaleDown += 1;
    if (action === "Terminate") summary.terminate += 1;
    if (action === "Scale up") summary.scaleUp += 1;
  });

  return summary;
}

export function groupRecommendations(recommendations = []) {
  const scaleUp = [];
  const costOptimization = [];

  recommendations.forEach((rec) => {
    if (rec.issueType === "overused_ec2" || suggestedActionFor(rec) === "Scale up") {
      scaleUp.push(rec);
      return;
    }
    costOptimization.push(rec);
  });

  return { scaleUp, costOptimization };
}

export function issueLabel(issueType) {
  if (issueType === "idle_ec2") return "Idle EC2";
  if (issueType === "unused_ebs") return "Unused EBS";
  if (issueType === "overused_ec2") return "Overutilized EC2";
  return issueType;
}

export function badgeColor(issueType) {
  if (issueType === "idle_ec2") return "bg-amber-100 text-amber-800";
  if (issueType === "unused_ebs") return "bg-rose-100 text-rose-800";
  if (issueType === "overused_ec2") return "bg-orange-100 text-orange-800";
  return "bg-slate-100 text-slate-700";
}

export function actionColor(action) {
  if (action === "Terminate") return "bg-rose-100 text-rose-800";
  if (action === "Scale down") return "bg-indigo-100 text-indigo-800";
  if (action === "Scale up") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-700";
}

export function impactLabel(rec, currency) {
  if (rec.issueType === "overused_ec2") {
    return "Improved availability";
  }
  return currency.format(rec.estimatedSavings || 0);
}

export function approveButtonLabel(action) {
  if (action === "Scale down") return "Approve scale down";
  if (action === "Scale up") return "Approve scale up";
  if (action === "Terminate") return "Approve terminate";
  return "Approve";
}

function configsEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.instanceType === b.instanceType &&
    a.status === b.status &&
    a.volumeSizeGb === b.volumeSizeGb &&
    a.monthlyCost === b.monthlyCost
  );
}

export function hasEffectiveChange(preview) {
  if (!preview?.currentConfig || !preview?.recommendedConfig) return false;
  return !configsEqual(preview.currentConfig, preview.recommendedConfig);
}

export function noChangeReason(preview) {
  const action = preview?.action;
  if (action === "Scale down") return "Already at minimum instance size.";
  if (action === "Scale up") return "Already at maximum instance size.";
  return "No change available for this resource.";
}

export function formatConfigChange(preview, currency) {
  if (!preview?.currentConfig || !preview?.recommendedConfig) return [];

  const { action, currentConfig, recommendedConfig } = preview;
  const lines = [];

  if (action === "Terminate") {
    lines.push({
      label: "Status",
      before: currentConfig.status,
      after: recommendedConfig.status,
    });
  } else if (action === "Scale down" || action === "Scale up") {
    lines.push({
      label: "Instance type",
      before: currentConfig.instanceType || "—",
      after: recommendedConfig.instanceType || "—",
    });
  }

  if (currentConfig.monthlyCost != null && recommendedConfig.monthlyCost != null) {
    const delta = recommendedConfig.monthlyCost - currentConfig.monthlyCost;
    lines.push({
      label: "Monthly cost",
      before: currency.format(currentConfig.monthlyCost),
      after: currency.format(recommendedConfig.monthlyCost),
      delta: delta !== 0 ? currency.format(Math.abs(delta)) : null,
      deltaDirection: delta < 0 ? "savings" : delta > 0 ? "increase" : null,
    });
  }

  return lines;
}
