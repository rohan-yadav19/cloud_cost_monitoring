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
