"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createAlert,
  getAlerts,
  getAnalytics,
  seedDemoData,
  simulateDelay,
  type Alert,
} from "@/lib/api";

function formatDuration(sec?: number) {
  if (!sec) return "--";
  const totalMinutes = Math.round(sec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AdminPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [message, setMessage] = useState("");
  const [routeRef, setRouteRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [a, al] = await Promise.all([getAnalytics(), getAlerts()]);
      setAnalytics(a);
      setAlerts(al);
    } catch (err: any) {
      setError(err.message || "Failed to load admin data.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSeed() {
    setLoading(true);
    setError(null);
    try {
      await seedDemoData();
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to seed demo data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    try {
      await simulateDelay();
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to simulate delay.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createAlert({ message, route_ref: routeRef || undefined, severity: "warning" });
      setMessage("");
      setRouteRef("");
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to create alert.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-slate-500">Manage alerts and view public transport usage insights.</p>
          </div>
          <Link href="/" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Back to Planner
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mb-6 flex flex-wrap gap-3">
          <button onClick={handleSeed} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            Seed Demo Analytics
          </button>
          <button onClick={handleSimulate} disabled={loading} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60">
            Simulate Delay
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Total Searches</div>
            <div className="mt-1 text-3xl font-bold">{analytics?.total_searches ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Avg Journey Time</div>
            <div className="mt-1 text-3xl font-bold">{formatDuration(analytics?.average_duration_sec)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Saved Routes</div>
            <div className="mt-1 text-3xl font-bold">{analytics?.total_saved_routes ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Active Alerts</div>
            <div className="mt-1 text-3xl font-bold">{analytics?.active_alerts ?? 0}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Top origins</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2">Origin</th>
                  <th className="py-2 text-right">Searches</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.top_origins || []).map((row: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2 text-right font-medium">{row.count}</td>
                  </tr>
                ))}
                {!analytics?.top_origins?.length && (
                  <tr><td colSpan={2} className="py-4 text-slate-500">No data yet. Click “Seed Demo Analytics”.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Top destinations</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2">Destination</th>
                  <th className="py-2 text-right">Searches</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.top_destinations || []).map((row: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2 text-right font-medium">{row.count}</td>
                  </tr>
                ))}
                {!analytics?.top_destinations?.length && (
                  <tr><td colSpan={2} className="py-4 text-slate-500">No data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Recent searches</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2">From</th>
                  <th className="py-2">To</th>
                  <th className="py-2">Duration</th>
                  <th className="py-2">Transfers</th>
                  <th className="py-2">Mode</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.recent_searches || []).map((row: any) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2">{row.origin_name}</td>
                    <td className="py-2">{row.destination_name}</td>
                    <td className="py-2">{formatDuration(row.duration_sec)}</td>
                    <td className="py-2">{row.transfers ?? "--"}</td>
                    <td className="py-2">{row.selected_mode ?? "--"}</td>
                    <td className="py-2 text-slate-500">{row.created_at ? new Date(row.created_at).toLocaleString() : "--"}</td>
                  </tr>
                ))}
                {!analytics?.recent_searches?.length && (
                  <tr><td colSpan={6} className="py-4 text-slate-500">No recent searches.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Active alerts</h2>
            <div className="space-y-3">
              {alerts.map((a) => (
                <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-medium">{a.message}</div>
                  <div className="mt-1 text-xs text-amber-700">{a.route_ref || "General"} • {a.severity} • {new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))}
              {!alerts.length && <p className="text-sm text-slate-500">No active alerts.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Create alert</h2>
            <form onSubmit={handleCreateAlert} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Example: Metro Line 1 delayed by 10 minutes." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Route reference optional</label>
                <input value={routeRef} onChange={(e) => setRouteRef(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="METRO_LINE_1" />
              </div>
              <button type="submit" disabled={loading} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
                Publish Alert
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}