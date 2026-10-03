"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap, ZoomControl } from "react-leaflet";
import type { Itinerary, Place } from "@/lib/api";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Check, Navigation2, Clock, Ruler } from "lucide-react";

// Fix Leaflet Default Icon Issues in Next.js/Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type Props = {
  origin: Place | null;
  destination: Place | null;
  itinerary: Itinerary | null;
  isNavigating?: boolean;
};

/**
 * Helper to fly to bounds when route changes OR when navigation starts
 */
function FlyToRoute({ bounds, isNavigating }: { bounds: L.LatLngBoundsExpression | null, isNavigating: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;
    
    // Smooth animation to fit route
    if (isNavigating) {
       map.flyToBounds(bounds, { padding: [80, 80], maxZoom: 16, duration: 1 });
    } else {
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    }
  }, [bounds, isNavigating, map]);

  return null;
}

function modeColor(mode: string) {
  const m = mode.toUpperCase();
  if (m === "WALK") return "#64748b"; 
  if (m === "BUS" || m === "TRAM") return "#2563eb"; 
  if (m === "METRO" || m === "SUBWAY") return "#dc2626"; 
  if (m === "TRAIN" || m === "RAIL") return "#9333ea"; 
  return "#059669"; 
}

export default function TransitMap({ origin, destination, itinerary, isNavigating = false }: Props) {
  // State for Map Layer: 'standard' or 'satellite'
  const [activeLayer, setActiveLayer] = useState<"standard" | "satellite">("standard");
  const [showLayersMenu, setShowLayersMenu] = useState(false);

  // Calculate Bounds for Auto-Zoom
  const bounds: L.LatLngBoundsExpression | null = (() => {
    const points: [number, number][] = [];
    if (origin) points.push([origin.lat, origin.lng]);
    if (destination) points.push([destination.lat, destination.lng]);
    if (itinerary?.legs) {
      itinerary.legs.forEach(leg => {
        leg.geometry.forEach(pt => points.push([pt[0], pt[1]]));
      });
    }
    if (points.length === 0) return null;
    return L.latLngBounds(points);
  })();

  const defaultCenter: [number, number] = [12.9716, 77.5946];
  const currentCenter = origin ? [origin.lat, origin.lng] : defaultCenter;

  // Helper to calculate total distance safely
  const getTotalDistanceKm = () => {
    if (!itinerary) return "0.0";
    if ((itinerary as any).total_distance_m) {
      return ((itinerary as any).total_distance_m / 1000).toFixed(1);
    }
    const sum = itinerary.legs.reduce((acc, l) => acc + l.distance_m, 0);
    return (sum / 1000).toFixed(1);
  };

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden border border-slate-200 shadow-lg bg-white">
      
      <MapContainer
        center={currentCenter}
        zoom={isNavigating ? 16 : 13}
        scrollWheelZoom={!isNavigating}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
        zoomControl={false} // Disable default controls to avoid conflicts
      >
        {/* STABLE TILE LAYER IMPLEMENTATION */}
        {/* Instead of dynamic components, we conditionally render two separate TileLayers */}
        {/* This prevents React/Turbopack from trying to mutate the same DOM node aggressively */}
        
        {activeLayer === "standard" && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        
        {activeLayer === "satellite" && (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        <FlyToRoute bounds={bounds} isNavigating={isNavigating} />
        
        {!isNavigating && <ZoomControl position="topleft" />}

        {/* Draw Route Legs */}
        {itinerary?.legs.map((leg, idx) => {
          if (!leg.geometry || leg.geometry.length < 2) return null;
          
          const color = modeColor(leg.mode);
          const isWalk = leg.mode.toUpperCase() === "WALK";

          return (
            <motion.div 
              key={`route-leg-${idx}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Polyline
                positions={leg.geometry}
                pathOptions={{
                  color: color,
                  weight: isNavigating ? 8 : 6,
                  opacity: 0.9,
                  dashArray: isWalk ? "10, 10" : undefined,
                }}
              >
                {!isNavigating && (
                  <Popup>
                    <div className="font-medium text-sm">{leg.from.name} → {leg.to.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{Math.round(leg.duration_sec / 60)} mins</div>
                  </Popup>
                )}
              </Polyline>
            </motion.div>
          );
        })}

        {/* Origin Marker */}
        {origin && (
          <CircleMarker
            center={[origin.lat, origin.lng]}
            radius={isNavigating ? 6 : 8}
            pathOptions={{ color: "#16a34a", fillColor: "#22c55e", fillOpacity: 0.9, weight: 2 }}
          >
             {!isNavigating && <Popup><strong>Start:</strong> {origin.name}</Popup>}
          </CircleMarker>
        )}

        {/* Destination Marker */}
        {destination && (
          <CircleMarker
            center={[destination.lat, destination.lng]}
            radius={isNavigating ? 6 : 8}
            pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.9, weight: 2 }}
          >
             {!isNavigating && <Popup><strong>End:</strong> {destination.name}</Popup>}
          </CircleMarker>
        )}
      </MapContainer>

      {/* LAYER SELECTOR UI (Manual Implementation for Stability) */}
      {!isNavigating && (
        <div className="absolute top-4 right-4 z-[1000]">
          <button 
            onClick={() => setShowLayersMenu(!showLayersMenu)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg shadow-lg border border-slate-200 transition-all font-medium text-sm"
          >
            <Layers className="w-4 h-4" />
            <span>{activeLayer === "standard" ? "Standard" : "Satellite"}</span>
          </button>
          
          <AnimatePresence>
            {showLayersMenu && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-[999]" onClick={() => setShowLayersMenu(false)} />
                
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-[1001] overflow-hidden"
                >
                  <button
                    onClick={() => {
                      setActiveLayer("standard");
                      setShowLayersMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-blue-50 transition-colors ${
                      activeLayer === "standard" ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'
                    }`}
                  >
                    <span>Standard</span>
                    {activeLayer === "standard" && <Check className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={() => {
                      setActiveLayer("satellite");
                      setShowLayersMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-blue-50 transition-colors ${
                      activeLayer === "satellite" ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'
                    }`}
                  >
                    <span>Satellite</span>
                    {activeLayer === "satellite" && <Check className="w-4 h-4" />}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* FLOATING JOURNEY SUMMARY CARD (Normal View) */}
      <AnimatePresence>
        {itinerary && !isNavigating && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute bottom-6 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-200 z-[1000]"
          >
            <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-2">
               <div>
                 <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Journey Summary</h3>
                 <p className="text-sm font-semibold text-slate-800 mt-1 truncate">
                   {origin?.name} → {destination?.name}
                 </p>
               </div>
               <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold">
                 Ready
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Time</div>
                  <div className="text-lg font-black text-slate-800 leading-none">
                    {Math.round(itinerary.duration_sec / 60)} min
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Distance</div>
                  <div className="text-lg font-black text-slate-800 leading-none">
                    {getTotalDistanceKm()} km
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <Navigation2 className="w-3 h-3" />
              <span>{itinerary.transfers} Transfer{itinerary.transfers !== 1 ? 's' : ''} • {(itinerary.walk_distance_m / 1000).toFixed(1)}km Walk</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAVIGATION MODE OVERLAY (When Start is Clicked) */}
      <AnimatePresence>
        {isNavigating && itinerary && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-[1000]"
          >
            <div className="flex justify-between items-start mb-2">
               <div>
                 <h3 className="text-lg font-bold leading-tight">Navigate to {destination?.name}</h3>
                 <p className="text-xs text-slate-300 mt-1">Follow the highlighted path</p>
               </div>
               <div className="text-right">
                 <div className="text-xl font-mono font-bold text-emerald-400">
                   {Math.round(itinerary.duration_sec / 60)} min
                 </div>
                 <div className="text-[10px] text-slate-400 uppercase tracking-wider">Remaining</div>
               </div>
            </div>
            
            <div className="w-full bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-emerald-500 h-full w-1/4 animate-pulse"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}