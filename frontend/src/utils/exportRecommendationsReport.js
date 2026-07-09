import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  impactLabel,
  issueLabel,
  suggestedActionFor,
  summarizeRecommendations,
} from "./recommendations";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function categorizeRecommendations(recommendations = []) {
  const scaleDown = [];
  const terminate = [];
  const scaleUp = [];

  recommendations.forEach((rec) => {
    const action = suggestedActionFor(rec);
    if (action === "Scale up") {
      scaleUp.push(rec);
    } else if (action === "Terminate") {
      terminate.push(rec);
    } else if (action === "Scale down") {
      scaleDown.push(rec);
    }
  });

  return { scaleDown, terminate, scaleUp };
}

export function calculateTotalSavings(recommendations = []) {
  return recommendations.reduce((sum, rec) => {
    const action = suggestedActionFor(rec);
    if (action === "Scale down" || action === "Terminate") {
      return sum + Number(rec.estimatedSavings || 0);
    }
    return sum;
  }, 0);
}

function recommendationTableRows(recommendations) {
  return recommendations.map((rec) => [
    rec.resourceId,
    rec.type,
    rec.region,
    rec.status,
    rec.issueLabel || issueLabel(rec.issueType),
    suggestedActionFor(rec),
    rec.message,
    impactLabel(rec, currency),
    rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : "-",
  ]);
}

function addRecommendationSection(doc, title, recommendations, startY) {
  const headers = [
    "Resource ID",
    "Type",
    "Region",
    "Status",
    "Issue",
    "Suggestion",
    "Details",
    "Est. Impact",
    "Created",
  ];

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, startY);

  autoTable(doc, {
    startY: startY + 4,
    head: [headers],
    body:
      recommendations.length > 0
        ? recommendationTableRows(recommendations)
        : [["No recommendations in this category", "", "", "", "", "", "", "", ""]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [14, 165, 233] },
    margin: { left: 14, right: 14 },
  });

  return doc.lastAutoTable.finalY + 10;
}

export function buildRecommendationsReportPdf(recommendations = [], costSummary = {}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const summary = summarizeRecommendations(recommendations);
  const { scaleDown, terminate, scaleUp } = categorizeRecommendations(recommendations);
  const totalMonthlySpend = Number(costSummary.totalMonthlySpend || 0);
  const totalSavings = calculateTotalSavings(recommendations);
  const projectedSpend = Math.max(totalMonthlySpend - totalSavings, 0);
  const generatedAt = new Date().toLocaleString("en-US");

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("CloudCost Optimization Report", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${generatedAt}`, 14, 26);
  doc.text("Period: Last 30 days", 14, 32);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Financial Summary", 14, 42);

  autoTable(doc, {
    startY: 46,
    head: [["Metric", "Amount"]],
    body: [
      ["Total Monthly Spend", currency.format(totalMonthlySpend)],
      ["Estimated Monthly Savings (Scale Down + Terminate)", currency.format(totalSavings)],
      ["Projected Spend After Recommendations", currency.format(projectedSpend)],
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60 },
    },
    margin: { left: 14, right: 14 },
  });

  let currentY = doc.lastAutoTable.finalY + 8;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Recommendation Summary", 14, currentY);

  autoTable(doc, {
    startY: currentY + 4,
    head: [["Category", "Count"]],
    body: [
      ["Scale Down (Idle EC2)", String(summary.scaleDown)],
      ["Terminate (Unused EBS)", String(summary.terminate)],
      ["Scale Up (Overutilized EC2)", String(summary.scaleUp)],
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42] },
    margin: { left: 14, right: 14 },
  });

  currentY = doc.lastAutoTable.finalY + 10;
  currentY = addRecommendationSection(
    doc,
    "Scale Down Recommendations",
    scaleDown,
    currentY,
  );

  if (currentY > 170) {
    doc.addPage();
    currentY = 20;
  }

  currentY = addRecommendationSection(
    doc,
    "Terminate Recommendations (Unused Resources)",
    terminate,
    currentY,
  );

  if (currentY > 170) {
    doc.addPage();
    currentY = 20;
  }

  addRecommendationSection(doc, "Scale Up Recommendations", scaleUp, currentY);

  return doc;
}

export function downloadRecommendationsReport(recommendations = [], costSummary = {}) {
  const doc = buildRecommendationsReportPdf(recommendations, costSummary);
  const dateStamp = new Date().toISOString().slice(0, 10);
  doc.save(`cloudcost-recommendations-report-${dateStamp}.pdf`);
}
