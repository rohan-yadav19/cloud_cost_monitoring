import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cloudApi } from "../api/api";
import RecommendationActionModal from "../components/RecommendationActionModal";
import { useAuth } from "../context/AuthContext";
import {
  actionColor,
  badgeColor,
  groupRecommendations,
  impactLabel,
  issueLabel,
  suggestedActionFor,
  summarizeRecommendations,
} from "../utils/recommendations";
import { downloadRecommendationsReport } from "../utils/exportRecommendationsReport";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function RecommendationTable({ items, emptyMessage, onTagClick, clickable = true }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Resource
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Type
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Region
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Issue
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Suggestion
            </th>
            <th className="px-3 py-2 text-right font-medium text-slate-500">
              Est. Impact
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-slate-500" colSpan={7}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            items.map((rec) => {
              const action = suggestedActionFor(rec);

              return (
                <tr key={rec.id}>
                  <td className="px-3 py-2 text-slate-800">{rec.resourceId}</td>
                  <td className="px-3 py-2 text-slate-600">{rec.type}</td>
                  <td className="px-3 py-2 text-slate-600">{rec.region}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor(
                        rec.issueType,
                      )}`}
                    >
                      {rec.issueLabel || issueLabel(rec.issueType)}
                    </span>
                    <div className="mt-1 text-xs text-slate-600">{rec.message}</div>
                  </td>
                  <td className="px-3 py-2">
                    {clickable && onTagClick ? (
                      <button
                        type="button"
                        onClick={() => onTagClick(rec)}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition hover:ring-2 hover:ring-offset-1 ${actionColor(
                          action,
                        )} ${
                          action === "Scale down"
                            ? "hover:ring-indigo-300"
                            : action === "Scale up"
                              ? "hover:ring-emerald-300"
                              : action === "Terminate"
                                ? "hover:ring-rose-300"
                                : "hover:ring-slate-300"
                        }`}
                      >
                        {action}
                      </button>
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColor(
                          action,
                        )}`}
                      >
                        {action}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-800">
                    {impactLabel(rec, currency)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {rec.createdAt
                      ? new Date(rec.createdAt).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function AppliedChangesTable({ items, emptyMessage }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Resource
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Action
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Change Summary
            </th>
            <th className="px-3 py-2 text-right font-medium text-slate-500">
              Est. Impact
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">
              Applied
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-slate-500" colSpan={5}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            items.map((rec) => {
              const action = suggestedActionFor(rec);

              return (
                <tr key={rec.id}>
                  <td className="px-3 py-2 text-slate-800">{rec.resourceId}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColor(
                        action,
                      )}`}
                    >
                      {action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {rec.changeSummary || rec.message}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-800">
                    {impactLabel(rec, currency)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {rec.resolvedAt
                      ? new Date(rec.resolvedAt).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Recommendations() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [appliedItems, setAppliedItems] = useState([]);
  const [summary, setSummary] = useState({
    scaleDown: 0,
    terminate: 0,
    scaleUp: 0,
  });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedRec, setSelectedRec] = useState(null);
  const [preview, setPreview] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [applying, setApplying] = useState(false);

  const loadRecommendations = useCallback(async () => {
    const data = await cloudApi.getRecommendations();
    const recs = data.recommendations || [];
    setItems(recs);
    setAppliedItems(data.appliedRecommendations || []);
    setSummary(data.summary || summarizeRecommendations(recs));
    return data;
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        await loadRecommendations();
      } catch (err) {
        if (!active) return;
        setError(err.message || "Failed to load recommendations.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [loadRecommendations]);

  const { scaleUp, costOptimization } = useMemo(
    () => groupRecommendations(items),
    [items],
  );

  const handleTagClick = async (rec) => {
    setSelectedRec(rec);
    setPreview(null);
    setModalError("");
    setModalLoading(true);

    try {
      const data = await cloudApi.previewRecommendation(rec.id);
      setPreview(data.preview);
    } catch (err) {
      setModalError(err.message || "Failed to load preview.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    if (applying) return;
    setSelectedRec(null);
    setPreview(null);
    setModalError("");
    setModalLoading(false);
  };

  const handleApprove = async () => {
    if (!selectedRec) return;

    try {
      setApplying(true);
      setModalError("");
      const data = await cloudApi.applyRecommendation(selectedRec.id);
      const summaryText = data.change?.summary || "Change applied successfully.";
      setSuccessMessage(`${selectedRec.resourceId}: ${summaryText}`);
      setSelectedRec(null);
      setPreview(null);
      setModalError("");
      setModalLoading(false);
      await loadRecommendations();
    } catch (err) {
      setModalError(err.message || "Failed to apply recommendation.");
    } finally {
      setApplying(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      setDownloading(true);
      setError("");
      const costData = await cloudApi.getCostSummary();
      downloadRecommendationsReport(items, costData.summary || {});
    } catch (err) {
      setError(err.message || "Failed to download report.");
    } finally {
      setDownloading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
            </div>
            <span className="text-lg font-semibold text-slate-900">
              CloudCost
            </span>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden gap-4 text-sm font-medium text-slate-600 sm:flex">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="text-slate-600 hover:text-slate-900"
              >
                Dashboard
              </button>
              <span className="text-sky-700">Recommendations</span>
            </nav>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-medium text-sky-700">
                {initials}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Optimization Recommendations
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cost-saving opportunities for underutilized resources and scale-up
              guidance for overutilized workloads.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={loading || downloading || items.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
              />
            </svg>
            {downloading ? "Downloading..." : "Download PDF Report"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              className="shrink-0 text-emerald-600 hover:text-emerald-800"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {!loading && (
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Scale down</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.scaleDown}
              </p>
              <p className="mt-1 text-xs text-slate-400">Idle EC2 instances</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Terminate</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.terminate}
              </p>
              <p className="mt-1 text-xs text-slate-400">Unused EBS volumes</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Scale up</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.scaleUp}
              </p>
              <p className="mt-1 text-xs text-slate-400">Overutilized EC2 instances</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Scale Up Recommendations
                </h2>
                <p className="mt-1 text-slate-500">
                  Overutilized EC2 instances that need more capacity
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                {loading ? "..." : summary.scaleUp}
              </span>
            </div>

            {loading ? (
              <div className="text-sm text-slate-500">Loading scale-up recommendations...</div>
            ) : (
              <RecommendationTable
                items={scaleUp}
                emptyMessage="No scale-up recommendations right now."
                onTagClick={handleTagClick}
              />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Cost Optimization Recommendations
                </h2>
                <p className="mt-1 text-slate-500">
                  Idle EC2 instances and unused EBS volumes to reduce spend
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {loading ? "..." : costOptimization.length}
              </span>
            </div>

            {loading ? (
              <div className="text-sm text-slate-500">Loading cost optimization recommendations...</div>
            ) : (
              <RecommendationTable
                items={costOptimization}
                emptyMessage="No cost optimization recommendations right now."
                onTagClick={handleTagClick}
              />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Applied Changes
                </h2>
                <p className="mt-1 text-slate-500">
                  Resources that were scaled or terminated from approved recommendations
                </p>
              </div>
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                {loading ? "..." : appliedItems.length}
              </span>
            </div>

            {loading ? (
              <div className="text-sm text-slate-500">Loading applied changes...</div>
            ) : (
              <AppliedChangesTable
                items={appliedItems}
                emptyMessage="No changes applied yet. Click a suggestion tag to review and approve."
              />
            )}
          </div>
        </div>
      </main>

      <RecommendationActionModal
        open={Boolean(selectedRec)}
        preview={preview}
        loading={modalLoading}
        applying={applying}
        error={modalError}
        onClose={handleCloseModal}
        onApprove={handleApprove}
      />
    </div>
  );
}
