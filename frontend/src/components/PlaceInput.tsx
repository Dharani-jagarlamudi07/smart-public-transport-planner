"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Navigation, Clock, MapPin, Loader2 } from "lucide-react";
import type { Place } from "@/lib/api";

type Props = {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder?: string;
};

export default function PlaceInput({ label, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [recent, setRecent] = useState<Place[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("recent_places");
      if (stored) setRecent(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const saveRecent = (place: Place) => {
    setRecent((prev) => {
      const updated = [place, ...prev.filter((r) => r.name !== place.name)].slice(0, 5);
      try {
        localStorage.setItem("recent_places", JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  };

  const selectPlace = (place: Place) => {
    onChange(place);
    saveRecent(place);
    setQuery("");
    setOpen(false);
  };

  const useCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        selectPlace({
          name: "Your Current Location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: "Detected via GPS",
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert("Unable to detect your location. Please search for a place instead.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const typedQuery = query.trim();

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
        {label}
      </label>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={open ? query : value?.name ?? ""}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder || "Search or choose an option"}
          className="glass-input w-full rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-500"
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute z-50 mt-1 w-full glass-panel rounded-xl overflow-hidden"
          >
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-emerald-800 bg-emerald-400/15 hover:bg-emerald-400/25 transition-colors border-b border-white/40"
            >
              {locating ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
              ) : (
                <Navigation className="w-4 h-4 text-emerald-700" />
              )}
              {locating ? "Detecting your location..." : "Your Current Location"}
            </button>

            {typedQuery.length < 2 && recent.length > 0 && (
              <div className="py-1">
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Recent Places
                </div>
                {recent.map((r, i) => (
                  <button
                    key={`${r.name}-${i}`}
                    type="button"
                    onClick={() => selectPlace(r)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/40 transition-colors"
                  >
                    <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                      {r.address && <div className="text-[11px] text-slate-500 truncate">{r.address}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {typedQuery.length >= 2 && (
              <div className="py-1 max-h-56 overflow-y-auto">
                {searching ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-600">
                    <Loader2 className="w-4 h-4 animate-spin" /> Searching places...
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-600">No places found.</div>
                ) : (
                  results.map((r, i) => (
                    <button
                      key={`${r.name}-${i}`}
                      type="button"
                      onClick={() => selectPlace(r)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/40 transition-colors"
                    >
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                        {r.address && <div className="text-[11px] text-slate-500 truncate">{r.address}</div>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {typedQuery.length < 2 && recent.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-600">
                Type a place name to search, or use your current location above.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}