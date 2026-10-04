"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import PlaceInput from "@/components/PlaceInput";
import UserSwitcher from "@/components/UserSwitcher";
import GuidedNav from "@/components/GuidedNav";
import DestinationPreview from "@/components/DestinationPreview";
import {
  deleteSavedRoute,
  getAlerts,
  getSavedRoutes,
  planRoutes,
  saveRoute,
  simulateDelay,
  type Alert,
  type Itinerary,
  type Place,
  type SavedRoute,
} from "@/lib/api";
import {
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Loader2,
  Trash2,
  Play,
  X,
  ListOrdered,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TransitMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
      <Loader2 className="animate-spin mr-2" /> Initializing Map Engine...
    </div>
  ),
});

function formatDuration(sec?: number) {
  if (!sec) return "--";
  const totalMinutes = Math.round(sec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function Home() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [preference, setPreference] = useState("balanced");
  const [routes, setRoutes] = useState<Itinerary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const selectedItinerary = routes.find((r) => r.id === selectedId) || null;

  async function loadSideData() {
    try {
      const [saved, alertData] = await Promise.all([getSavedRoutes(), getAlerts()]);
      setSavedRoutes(saved);
      setAlerts(alertData);
    } catch (e) {
      console.error("Failed to load side data", e);
    }
  }

  useEffect(() => {
    loadSideData();
    const interval = setInterval(loadSideData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handlePlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!origin || !destination) {
      setError("Please select both source and destination.");
      return;
    }

    setLoading(true);
    setSelectedId(null);
    setIsNavigating(false);

    try {
      const res = await planRoutes({ origin, destination, preference });

      if (res.itineraries && res.itineraries.length > 0) {
        setRoutes(res.itineraries);
        setSelectedId(res.itineraries[0].id);
      } else {
        setRoutes([]);
        setError("No routes found for this combination.");
      }

      await loadSideData();
    } catch (err: any) {
      console.error("API Error:", err);
      setError(err.message || "Failed to fetch routes. Is backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(itinerary: Itinerary) {
    if (!origin || !destination) return;
    try {
      await saveRoute({
        title: `${origin.name} → ${destination.name}`,
        origin,
        destination,
        itinerary,
      });
      await loadSideData();
      alert("Route saved successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to save route.");
    }
  }

  async function handleDeleteSaved(id: number) {
    if (!confirm("Delete this saved route?")) return;
    try {
      await deleteSavedRoute(id);
      await loadSideData();
    } catch (err: any) {
      alert(err.message || "Failed to delete saved route.");
    }
  }

  async function handleSimulateDelay() {
    try {
      await simulateDelay();
      await loadSideData();
    } catch (err: any) {
      alert(err.message || "Failed to simulate delay.");
    }
  }

  function loadSavedRoute(saved: SavedRoute) {
    setOrigin({ name: saved.origin_name, lat: saved.origin_lat, lng: saved.origin_lng });
    setDestination({ name: saved.destination_name, lat: saved.destination_lat, lng: saved.destination_lng });
    setRoutes([saved.payload]);
    setSelectedId(saved.payload.id);
    setIsNavigating(false);
  }

  return (
    <main className="min-h-screen app-bg flex flex-col lg:flex-row overflow-hidden relative">
      {/* ================= GLASS SIDEBAR ================= */}
      <aside
        className={`w-full lg:w-[420px] glass-panel border-r border-white/40 flex flex-col h-screen overflow-y-auto shrink-0 z-20 transition-all duration-300 ${
          isNavigating ? "lg:w-[320px]" : ""
        }`}
      >
        <header className="p-6 border-b border-white/40 sticky top-0 bg-white/40 backdrop-blur-xl z-10">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/30">
                <Zap className="text-white w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Smart Planner</h1>
            </div>
            <UserSwitcher />
          </div>
          <p className="text-xs text-slate-600 ml-1">AI-Assisted Urban Mobility System</p>
        </header>

        <div className="p-6 space-y-6 flex-1">
          {!isNavigating && (
            <form onSubmit={handlePlan} className="space-y-4">
              <PlaceInput label="From" value={origin} onChange={setOrigin} placeholder="Choose location or search" />

              <div className="flex justify-center -my-2 relative z-0 pointer-events-none">
                <div className="glass-chip p-1 rounded-full shadow-sm">
                  <ArrowRight className="w-4 h-4 rotate-90 text-slate-500" />
                </div>
              </div>

              <PlaceInput label="To" value={destination} onChange={setDestination} placeholder="Where are you going?" />

              {destination && <DestinationPreview place={destination} />}

              <select
                value={preference}
                onChange={(e) => setPreference(e.target.value)}
                className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-slate-800 appearance-none cursor-pointer"
              >
                <option value="balanced">⚖️ Balanced</option>
                <option value="fastest">🚀 Fastest</option>
                <option value="fewest_transfers">🔄 Fewest Transfers</option>
                <option value="least_walking">🚶 Least Walking</option>
                <option value="accessible">♿ Accessible</option>
              </select>

              {error && (
                <div className="rounded-xl border border-red-200/70 bg-red-100/60 backdrop-blur-md p-3 text-xs text-red-700 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading || !origin || !destination}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  Find Best Routes
                </button>

                <button
                  type="button"
                  onClick={handleSimulateDelay}
                  className="glass-chip px-3 py-3 rounded-xl text-amber-700 hover:bg-amber-100/60 transition-colors"
                  title="Simulate Delay"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {!isNavigating && alerts.length > 0 && (
            <div className="bg-amber-100/50 backdrop-blur-md border border-amber-200/60 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4" /> Live Service Alerts
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                {alerts.map((a) => (
                  <div key={a.id} className="text-xs text-amber-900 leading-relaxed pl-2 border-l-2 border-amber-400/60">
                    {a.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isNavigating && routes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-blue-500" /> Available Options ({routes.length})
                </h3>
              </div>

              <div className="space-y-3 pb-4">
                {routes.map((route, idx) => {
                  const isSelected = selectedId === route.id;

                  return (
                    <motion.div
                      key={route.id}
                      layoutId={`route-${route.id}`}
                      onClick={() => setSelectedId(route.id)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`cursor-pointer group relative glass-card p-4 transition-all duration-200 ${
                        isSelected
                          ? "ring-2 ring-blue-500 border-blue-400/60 bg-white/60 shadow-xl shadow-blue-500/10"
                          : "hover:bg-white/55 hover:shadow-md"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">Option {idx + 1}</span>
                            {idx === 0 && (
                              <span className="text-[10px] bg-emerald-400/20 backdrop-blur-sm text-emerald-700 border border-emerald-300/50 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                Best Match
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 mt-1 line-clamp-1">{route.recommendation_reason}</div>
                        </div>

                        <div className="text-right shrink-0 ml-2">
                          <div className="text-lg font-black text-slate-800 leading-none">
                            {formatDuration(route.duration_sec)}
                          </div>
                          <div className="text-[10px] text-slate-600 font-medium mt-1">
                            {route.transfers} transfer{route.transfers !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        {route.fare != null && (
                          <span className="glass-chip inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 px-2 py-1 rounded-lg">
                            ₹{route.fare.toFixed(0)} Fare
                          </span>
                        )}
                        <span className="glass-chip inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 px-2 py-1 rounded-lg">
                          🚶 {(route.walk_distance_m / 1000).toFixed(1)}km Walk
                        </span>
                      </div>

                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-white/50"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsNavigating(true);
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-[0.98] text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
                          >
                            <Play className="w-4 h-4 fill-current" /> Start Navigation
                          </button>

                          <div className="mt-2 flex justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSave(route);
                              }}
                              className="text-xs text-slate-600 hover:text-blue-600 underline decoration-dotted underline-offset-2 transition-colors"
                            >
                              Save this commute
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {!isNavigating && !loading && routes.length === 0 && origin && destination && (
            <div className="p-4 bg-red-100/60 backdrop-blur-md border border-red-200/70 rounded-xl text-xs text-red-700">
              No routes found. Check Backend Logs.
            </div>
          )}

          {!isNavigating && savedRoutes.length > 0 && (
            <div className="pt-6 border-t border-white/40">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Recent Commutes
              </h3>
              <div className="space-y-2">
                {savedRoutes.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="group flex items-center justify-between p-3 rounded-xl bg-white/40 hover:bg-white/60 backdrop-blur-md border border-white/50 cursor-pointer transition-all"
                    onClick={() => loadSavedRoute(s)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-700 truncate">{s.title}</div>
                      <div className="text-[10px] text-slate-500">
                        Saved {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSaved(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-100/60 rounded-md transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-white/40 bg-white/30 backdrop-blur-md">
          <Link
            href="/admin"
            className="block w-full text-center text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors uppercase tracking-wide"
          >
            Admin Dashboard →
          </Link>
        </footer>
      </aside>

      {/* ================= MAP AREA ================= */}
      <section className="flex-1 relative bg-slate-200 h-screen overflow-hidden">
        <TransitMap
          key={selectedItinerary?.id ?? "no-route"}
          origin={origin}
          destination={destination}
          itinerary={selectedItinerary}
          isNavigating={isNavigating}
        />

        {isNavigating && (
          <button
            onClick={() => setIsNavigating(false)}
            className="absolute top-4 left-4 z-[1000] glass-panel p-2 rounded-full hover:bg-red-100/70 hover:text-red-600 transition-colors"
            title="Exit Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <AnimatePresence>
          {isNavigating && selectedItinerary && (
            <GuidedNav
              itinerary={selectedItinerary}
              onComplete={() => {
                alert("Navigation Complete!");
                setIsNavigating(false);
              }}
            />
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}