import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cloudApi } from "../api/api";
import { useAuth } from "../context/AuthContext";
import {
  actionColor,
  groupRecommendations,
  suggestionForResource,
  summarizeRecommendations,
} from "../utils/recommendations";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const TYPE_COLORS = {
  EC2: "#0ea5e9",
  EBS: "#8b5cf6",
  S3: "#f59e0b",
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [resources, setResources] = useState([]);
  const [summary, setSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationSummary, setRecommendationSummary] = useState({
    scaleDown: 0,
    terminate: 0,
    scaleUp: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        const [resourcesData, summaryData, notificationsData, recommendationsData] =
          await Promise.all([
          cloudApi.getResources(),
          cloudApi.getCostSummary(),
          cloudApi.getNotifications(),
          cloudApi.getRecommendations(),
        ]);

        if (!active) return;

        setResources(resourcesData.resources || []);
        setSummary(summaryData.summary || null);
        setNotifications(notificationsData.notifications || []);

        const recs = recommendationsData.recommendations || [];
        setRecommendations(recs);
        setRecommendationSummary(
          recommendationsData.summary || summarizeRecommendations(recs),
        );
      } catch (err) {
        if (!active) return;
        setError(err.message || "Failed to load dashboard data.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const overuseNotifications = useMemo(
    () => notifications.filter((notification) => notification.type === "resource_overuse"),
    [notifications],
  );

  const criticalAlerts = useMemo(
    () => overuseNotifications.filter((notification) => notification.severity === "critical"),
    [overuseNotifications],
  );

  const recommendationByResourceId = useMemo(() => {
    const grouped = groupRecommendations(recommendations);
    const merged = [...grouped.costOptimization, ...grouped.scaleUp];

    return Object.fromEntries(merged.map((rec) => [rec.resourceId, rec]));
  }, [recommendations]);

  const handleMarkRead = async (id) => {
    try {
      await cloudApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id
            ? { ...notification, isRead: true }
            : notification,
        ),
      );
    } catch (err) {
      setError(err.message || "Failed to mark notification as read.");
    }
  };

  const stats = useMemo(() => {
    const byType = summary?.byType || {};
    return [
      {
        label: "Monthly Spend",
        value: currency.format(summary?.totalMonthlySpend || 0),
        change: "Last 30 days",
        icon: "💰",
      },
      {
        label: "Resources",
        value: String(resources.length),
        change: "EC2, EBS, S3",
        icon: "🧩",
      },
      {
        label: "EC2 Spend",
        value: currency.format(byType.EC2 || 0),
        change: "Last 30 days",
        icon: "⚡",
      },
      {
        label: "S3 Spend",
        value: currency.format(byType.S3 || 0),
        change: "Last 30 days",
        icon: "🪣",
      },
    ];
  }, [resources.length, summary]);

  const trendChartData = useMemo(
    () =>
      (summary?.trend || []).map((point) => ({
        date: new Date(point.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        total: Number(point.total || 0),
      })),
    [summary],
  );

  const typeChartData = useMemo(() => {
    const byType = summary?.byType || {};
    return Object.entries(byType).map(([name, value]) => ({
      name,
      value: Number(value || 0),
    }));
  }, [summary]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-slate-900">CloudCost</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-medium text-sky-700">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="mt-1 text-slate-500">
            Here&apos;s your cloud cost monitoring overview for your AWS environment
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && overuseNotifications.length > 0 && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 ${
              criticalAlerts.length > 0
                ? "border-rose-200 bg-rose-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">
              {criticalAlerts.length > 0
                ? `${criticalAlerts.length} critical alert${criticalAlerts.length > 1 ? "s" : ""} detected`
                : `${overuseNotifications.length} high utilization alert${overuseNotifications.length > 1 ? "s" : ""} detected`}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Review affected resources and consider scaling out to maintain
              performance and availability.
            </p>
          </div>
        )}

        {!loading && (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Scale down</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {recommendationSummary.scaleDown}
              </p>
              <p className="mt-1 text-xs text-slate-400">Idle EC2 instances</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Terminate</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {recommendationSummary.terminate}
              </p>
              <p className="mt-1 text-xs text-slate-400">Unused EBS volumes</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Scale up</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {recommendationSummary.scaleUp}
              </p>
              <p className="mt-1 text-xs text-slate-400">Overutilized EC2 instances</p>
            </div>
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">{stat.label}</span>
                <span className="text-lg">{stat.icon}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-400">{stat.change}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">Cost Overview</h2>
            <p className="mt-1 text-sm text-slate-500">Last 30 days</p>
            <div className="mt-4 h-72 w-full">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading cost chart...
                </div>
              ) : trendChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => currency.format(value)} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#0ea5e9"
                      strokeWidth={3}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No cost trend available yet.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Cost by Resource Type</h2>
              <p className="mt-1 text-sm text-slate-500">Monthly distribution</p>
              <div className="mt-3 h-64 w-full">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Loading breakdown...
                  </div>
                ) : typeChartData.some((item) => item.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {typeChartData.map((entry) => (
                          <Cell key={entry.name} fill={TYPE_COLORS[entry.name] || "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => currency.format(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No type breakdown available yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Alerts</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Resources exceeding utilization thresholds
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {overuseNotifications.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="text-sm text-slate-500">Loading alerts...</div>
                ) : overuseNotifications.length > 0 ? (
                  overuseNotifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={`rounded-lg border p-3 ${
                        notification.severity === "critical"
                          ? "border-rose-200 bg-rose-50"
                          : "border-amber-200 bg-amber-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {notification.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-700">
                            {notification.resourceId} · {notification.currentUsage}% usage
                            {" "}vs {notification.thresholdValue}% threshold
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-xs font-medium text-emerald-700">
                            Recommended action: {notification.recommendedAction || "Scale up"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMarkRead(notification.id)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                            notification.isRead
                              ? "bg-white/60 text-slate-500"
                              : "bg-white text-slate-700 shadow-sm"
                          }`}
                        >
                          {notification.isRead ? "Read" : "Mark read"}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">
                    No active alerts right now.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                AWS Resources
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                EC2, EBS and S3 inventory with monthly cost and utilization.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/recommendations")}
              className="hidden rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 sm:inline-flex"
            >
              View Optimization Recommendations
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            EC2, EBS and S3 inventory with monthly cost and utilization
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Resource ID</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Region</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">30d Cost</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Avg CPU</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Usage</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Suggestion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={8}>
                      Loading resources...
                    </td>
                  </tr>
                ) : (
                  resources.slice(0, 10).map((resource) => (
                    <tr key={resource.resourceId}>
                      <td className="px-3 py-2 text-slate-800">{resource.resourceId}</td>
                      <td className="px-3 py-2 text-slate-600">{resource.type}</td>
                      <td className="px-3 py-2 text-slate-600">{resource.region}</td>
                      <td className="px-3 py-2 text-slate-600">{resource.status}</td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {currency.format(resource.monthlyCost || 0)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {resource.avgCpuPercent == null
                          ? "-"
                          : `${resource.avgCpuPercent}%`}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {resource.type === "EC2" &&
                        resource.avgCpuPercent != null ? (
                          resource.avgCpuPercent < 5 ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                              Idle
                            </span>
                          ) : resource.capacityLimit != null &&
                            resource.avgCpuPercent > resource.capacityLimit ? (
                            <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">
                              Overused
                            </span>
                          ) : resource.avgCpuPercent > 80 ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                              Warning
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                              Active
                            </span>
                          )
                        ) : resource.type === "EBS" &&
                          resource.status === "unattached" ? (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">
                            Unused
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-left">
                        {(() => {
                          const suggestion =
                            recommendationByResourceId[resource.resourceId]
                              ?.suggestedAction ?? suggestionForResource(resource);

                          return suggestion ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColor(
                                suggestion,
                              )}`}
                            >
                              {suggestion}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
                {!loading && resources.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={8}>
                      No resources found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
