import {
  actionColor,
  approveButtonLabel,
  formatConfigChange,
  hasEffectiveChange,
  noChangeReason,
} from "../utils/recommendations";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function RecommendationActionModal({
  open,
  preview,
  loading,
  applying,
  error,
  onClose,
  onApprove,
}) {
  if (!open) return null;

  const action = preview?.action;
  const canApprove = preview && hasEffectiveChange(preview) && !applying;
  const changeLines = preview ? formatConfigChange(preview, currency) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close modal"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Recommendation Preview
            </h2>
            {action && (
              <span
                className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColor(
                  action,
                )}`}
              >
                {action}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <p className="text-sm text-slate-500">Loading preview...</p>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Resource</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {preview.resourceId}
                </p>
                {preview.currentConfig?.region && (
                  <p className="mt-0.5 text-sm text-slate-600">
                    Region: {preview.currentConfig.region}
                  </p>
                )}
              </div>

              {preview.summaryLabel && (
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {preview.summaryLabel}
                </div>
              )}

              {preview.message && (
                <p className="text-sm text-slate-600">{preview.message}</p>
              )}

              {changeLines.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Setting
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Current
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Recommended
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {changeLines.map((line) => (
                        <tr key={line.label}>
                          <td className="px-3 py-2 font-medium text-slate-700">
                            {line.label}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{line.before}</td>
                          <td className="px-3 py-2 text-slate-800">
                            {line.after}
                            {line.delta && (
                              <span
                                className={`ml-2 text-xs ${
                                  line.deltaDirection === "savings"
                                    ? "text-emerald-600"
                                    : "text-amber-600"
                                }`}
                              >
                                {line.deltaDirection === "savings"
                                  ? `save ${line.delta}/mo`
                                  : `+${line.delta}/mo`}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.estimatedSavings > 0 && (
                <p className="text-sm text-emerald-700">
                  Estimated savings: {currency.format(preview.estimatedSavings)}/month
                </p>
              )}

              {!hasEffectiveChange(preview) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {noChangeReason(preview)}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={!canApprove}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {applying ? "Applying..." : approveButtonLabel(action)}
          </button>
        </div>
      </div>
    </div>
  );
}
