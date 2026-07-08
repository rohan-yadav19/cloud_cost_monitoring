import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cloudApi } from "../api/api";
import { useAuth } from "../context/AuthContext";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function badgeColor(issueType) {
  if (issueType === "idle_ec2") return "bg-amber-100 text-amber-800";
  if (issueType === "unused_ebs") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function actionColor(action) {
  if (action === "Terminate") return "bg-rose-100 text-rose-800";
  if (action === "Scale down") return "bg-indigo-100 text-indigo-800";
  return "bg-slate-100 text-slate-700";
}

export default function Recommendations() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await cloudApi.getRecommendations();
        if (!active) return;
        setItems(data.recommendations || []);
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
  }, []);

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
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Optimization Recommendations
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Underutilized EC2 instances and unused EBS volumes that you can
              terminate or scale down.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              {loading
                ? "Loading recommendations..."
                : `${items.length} potential savings opportunities found`}
            </span>
          </div>

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
                    Est. Monthly Savings
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={7}>
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={7}>
                      No optimization recommendations yet.
                    </td>
                  </tr>
                ) : (
                  items.map((rec) => (
                    <tr key={rec.id}>
                      <td className="px-3 py-2 text-slate-800">
                        {rec.resourceId}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{rec.type}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {rec.region}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor(
                            rec.issueType,
                          )}`}
                        >
                          {rec.issueType === "idle_ec2"
                            ? "Idle EC2"
                            : rec.issueType === "unused_ebs"
                              ? "Unused EBS"
                              : rec.issueType}
                        </span>
                        <div className="mt-1 text-xs text-slate-600">
                          {rec.message}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColor(
                            rec.suggestedAction,
                          )}`}
                        >
                          {rec.suggestedAction || "Review"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {currency.format(rec.estimatedSavings || 0)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {rec.createdAt
                          ? new Date(rec.createdAt).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

