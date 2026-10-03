"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import PlaceInput from "@/components/PlaceInput";
import UserSwitcher from "@/components/UserSwitcher";
import GuidedNav from "@/components/GuidedNav"; 
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
  BookmarkPlus,
  Navigation2,
  Play,
  X,
  ListOrdered,
  Camera,
  Ruler
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Dynamic import for SSR safety - prevents Leaflet window errors
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
  
  // Store the ID of the selected route instead of the object to avoid reference issues
  const [selectedId, setSelectedId] = useState<string | null>(null); 
  
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoDetectStatus, setAutoDetectStatus] = useState<"idle" | "requesting" | "success" | "denied">("idle");
  const [isNavigating, setIsNavigating] = useState(false);

  // Derived State: Get the actual itinerary object based on ID
  const selectedItinerary = routes.find(r => r.id === selectedId) || null;

  // 1. Auto-Detect Location
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      setAutoDetectStatus("requesting");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const current: Place = {
            name: "Current Location",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: "Detected via GPS",
          };
          setOrigin(current);
          setAutoDetectStatus("success");
        },
        (err) => {
          console.warn("Geolocation failed:", err.message);
          setAutoDetectStatus("denied");
          setOrigin({ name: "Central Station (Demo)", lat: 12.9716, lng: 77.5946, address: "Default" });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      setOrigin({ name: "Central Station (Demo)", lat: 12.9716, lng: 77.5946, address: "Default" });
    }
  }, []);

  // 2. Load Side Data
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

  // 3. Handle Route Planning - ROBUST SELECTION
  async function handlePlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    if (!origin || !destination) {
      setError("Please select both source and destination.");
      return;
    }

    setLoading(true);
    setSelectedId(null); // Clear previous selection
    setIsNavigating(false); 
    
    try {
      const res = await planRoutes({ origin, destination, preference });
      
      if (res.itineraries && res.itineraries.length > 0) {
        setRoutes(res.itineraries);
        
        // CRITICAL FIX: Force select the FIRST route immediately by ID
        const firstRouteId = res.itineraries[0].id;
        setSelectedId(firstRouteId);
        
        console.log("✅ Routes Loaded. Selected ID:", firstRouteId);
      } else {
        setRoutes([]);
        setError("No routes found for this combination.");
        console.warn("⚠️ No itineraries returned from backend.");
      }
      
      await loadSideData();
    } catch (err: any) {
      console.error("❌ API Error:", err);
      setError(err.message || "Failed to fetch routes. Is backend running?");
    } finally {
      setLoading(false);
    }
  }

  // 4. Handlers (Save, Delete, Delay, Load Saved)
  async function handleSave(itinerary: Itinerary) {
    if (!origin || !destination) return;
    try {
      await saveRoute({ title: `${origin.name} → ${destination.name}`, origin, destination, itinerary });
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
    setSelectedId(saved.payload.id); // Set ID directly
    setIsNavigating(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col lg:flex-row overflow-hidden relative">
      
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className={`w-full lg:w-[420px] bg-white border-r border-slate-200 flex flex-col h-screen overflow-y-auto shrink-0 z-20 shadow-xl lg:shadow-none transition-all duration-300 ${isNavigating ? 'lg:w-[320px]' : ''}`}>
        
        <header className="p-6 border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm">
                <Zap className="text-white w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Smart Planner</h1>
            </div>
            <UserSwitcher />
          </div>
          <p className="text-xs text-slate-500 ml-1">AI-Assisted Urban Mobility System</p>
        </header>

        <div className="p-6 space-y-6 flex-1">
          
          {!isNavigating && (
            <form onSubmit={handlePlan} className="space-y-4">
              <div className="relative">
                <PlaceInput label="From" value={origin} onChange={setOrigin} placeholder="Search or use GPS" />
                {autoDetectStatus === "requesting" && (
                  <div className="absolute right-2 top-8 flex items-center gap-1 text-xs text-blue-600 font-medium animate-pulse">
                    <Navigation2 className="w-3 h-3" /> Detecting...
                  </div>
                )}
              </div>
              
              <div className="flex justify-center -my-2 relative z-0 pointer-events-none">
                <div className="bg-slate-100 p-1 rounded-full border border-white shadow-sm">
                  <ArrowRight className="w-4 h-4 rotate-90 text-slate-400" />
                </div>
              </div>

              <PlaceInput label="To" value={destination} onChange={setDestination} placeholder="Where are you going?" />

              {/* DESTINATION PREVIEW CARD - FIXED WITH STATIC MAP SNAPSHOT */}
              {destination && (
                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200 shadow-md group bg-slate-100">
                  {/* 
                    Using OSM Static Map Service (free, no key required for low volume)
                    Format: https://staticmap.openstreetmap.de/staticmap.php?center=LAT,LNG&zoom=15&size=300x200&markers=LAT,LNG,red
                  */}
                  <img 
                    src={`https://staticmap.openstreetmap.de/staticmap.php?center=${destination.lat},${destination.lng}&zoom=15&size=400x200&markers=${destination.lat},${destination.lng},red-pushpin`}
                    alt={`${destination.name} Location Preview`}
                    onError={(e) => {
                      // Fallback if static map service is down
                      e.currentTarget.src = "https://placehold.co/400x200/e2e8f0/64748b?text=Map+Preview+Unavailable";
                    }}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  {/* Info Badge */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <MapPin className="w-4 h-4 text-red-400 fill-red-400" />
                      <span className="text-sm font-bold drop-shadow-md">{destination.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                      {destination.lat.toFixed(3)}, {destination.lng.toFixed(3)}
                    </div>
                  </div>
                </div>
              )}

              <select 
                value={preference} 
                onChange={(e) => setPreference(e.target.value)} 
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
              >
                <option value="balanced">⚖️ Balanced</option>
                <option value="fastest">🚀 Fastest</option>
                <option value="fewest_transfers">🔄 Fewest Transfers</option>
                <option value="least_walking">🚶 Least Walking</option>
                <option value="accessible">♿ Accessible</option>
              </select>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={loading || !origin || !destination}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  Find Best Routes
                </button>
                
                <button 
                  type="button"
                  onClick={handleSimulateDelay}
                  className="px-3 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {!isNavigating && alerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4" /> Live Service Alerts
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                {alerts.map(a => (
                  <div key={a.id} className="text-xs text-amber-900 leading-relaxed pl-2 border-l-2 border-amber-300">
                    {a.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Route Results List */}
          {!isNavigating && routes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-blue-500" /> Available Options ({routes.length})
                </h3>
              </div>
              
              <div className="space-y-3 pb-4">
                {routes.map((route, idx) => {
                  // Compare IDs for selection status
                  const isSelected = selectedId === route.id;
                  
                  return (
                    <motion.div 
                      key={route.id}
                      layoutId={`route-${route.id}`}
                      onClick={() => {
                        setSelectedId(route.id); 
                        console.log("Selected ID:", route.id);
                      }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`cursor-pointer group relative rounded-xl border p-4 transition-all duration-200 ${
                        isSelected 
                          ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500 shadow-lg" 
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">Option {idx + 1}</span>
                            {idx === 0 && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                Best Match
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                            {route.recommendation_reason}
                          </div>
                        </div>
                        
                        <div className="text-right shrink-0 ml-2">
                          <div className="text-lg font-black text-slate-800 leading-none">
                            {formatDuration(route.duration_sec)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium mt-1">
                            {route.transfers} transfer{route.transfers !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                         {route.fare != null && (
                           <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-md border border-slate-200">
                             ₹{route.fare.toFixed(0)} Fare
                           </span>
                         )}
                         <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-md border border-slate-200">
                           🚶 {(route.walk_distance_m / 1000).toFixed(1)}km Walk
                         </span>
                      </div>

                      {/* START BUTTON - GUARANTEED VISIBILITY IF SELECTED */}
                      {isSelected && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-slate-200"
                        >
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setIsNavigating(true); 
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 rounded-lg shadow-md transition-all transform active:scale-95"
                          >
                            <Play className="w-4 h-4 fill-current" /> Start Navigation
                          </button>
                          
                          <div className="mt-2 flex justify-center">
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleSave(route); 
                              }}
                              className="text-xs text-slate-500 hover:text-blue-600 underline decoration-dotted underline-offset-2 transition-colors"
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
             <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
               No routes found. Check Backend Logs.
             </div>
          )}

          {!isNavigating && savedRoutes.length > 0 && (
            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Recent Commutes
              </h3>
              <div className="space-y-2">
                {savedRoutes.slice(0, 3).map(s => (
                  <div 
                    key={s.id} 
                    className="group flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 cursor-pointer transition-all"
                    onClick={() => loadSavedRoute(s)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-700 truncate">{s.title}</div>
                      <div className="text-[10px] text-slate-400">Saved {new Date(s.created_at).toLocaleDateString()}</div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteSaved(s.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <footer className="p-4 border-t border-slate-100 bg-slate-50/50">
           <Link href="/admin" className="block w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wide">
             Admin Dashboard →
           </Link>
        </footer>
      </aside>

      {/* ================= RIGHT MAIN AREA (MAP) ================= */}
      <section className="flex-1 relative bg-slate-200 h-screen overflow-hidden">
        <TransitMap 
          origin={origin} 
          destination={destination} 
          itinerary={selectedItinerary} 
          isNavigating={isNavigating}
        />
        
        {isNavigating && (
          <button 
            onClick={() => setIsNavigating(false)}
            className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-md p-2 rounded-full shadow-lg border border-slate-200 hover:bg-red-50 hover:text-red-600 transition-colors"
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