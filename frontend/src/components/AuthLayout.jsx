import { Link } from "react-router-dom";

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-900 p-12 lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <span className="text-xl font-semibold text-white">CloudCost</span>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight text-white">
            Monitor your cloud spend in real time
          </h1>
          <p className="mt-4 text-lg text-blue-100">
            Track costs across AWS, Azure, and GCP. Get alerts before bills spike.
          </p>
        </div>

        <p className="text-sm text-blue-200">© 2026 CloudCost Monitoring</p>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-slate-900">CloudCost</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="mt-2 text-slate-500">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
