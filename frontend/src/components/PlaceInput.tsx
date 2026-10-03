"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces, type Place } from "@/lib/api";

type Props = {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder: string;
};

export default function PlaceInput({ label, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value?.name || "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value?.name || "");
  }, [value]);

  async function fetchResults(q: string) {
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const r = await searchPlaces(q);
      setResults(r);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleInput(v: string) {
    setQuery(v);
    onChange(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetchResults(v);
    }, 350);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: Place = {
          name: "Current location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: "Device GPS location",
        };
        onChange(p);
        setQuery(p.name);
        setResults([]);
        setOpen(false);
      },
      () => {
        alert("Unable to fetch your location.");
      }
    );
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={useMyLocation}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          title="Use current location"
        >
          GPS
        </button>
      </div>
      {loading && <div className="mt-1 text-xs text-slate-500">Searching places...</div>}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((r, idx) => (
            <li
              key={`${r.name}-${idx}`}
              onMouseDown={() => {
                onChange(r);
                setQuery(r.name);
                setResults([]);
                setOpen(false);
              }}
              className="cursor-pointer border-b border-slate-100 px-3 py-2 text-sm hover:bg-blue-50 last:border-b-0"
            >
              <div className="font-medium text-slate-800">{r.name}</div>
              {r.address && <div className="truncate text-xs text-slate-500">{r.address}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}