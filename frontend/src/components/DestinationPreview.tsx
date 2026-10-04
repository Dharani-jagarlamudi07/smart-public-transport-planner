"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Camera, Map as MapIcon } from "lucide-react";
import type { Place } from "@/lib/api";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-200 animate-pulse" />,
});

type Props = {
  place: Place;
};

/**
 * Destination Preview Card
 * Layer 1: Real photo from Wikipedia (free, no API key)
 * Layer 2: Live mini-map fallback (always works)
 */
export default function DestinationPreview({ place }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPhoto(null);
    setPhotoFailed(false);

    // Convert place name to a Wikipedia title format
    const title = place.name.trim().replace(/\s+/g, "_");

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) {
          setPhoto(data?.thumbnail?.source ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setPhoto(null);
      });

    return () => {
      cancelled = true;
    };
  }, [place.name, place.lat, place.lng]);

  const showPhoto = !!photo && !photoFailed;

  return (
    <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200 shadow-md bg-slate-100">
      {/* Layer 1: Real photo (if found) */}
      {showPhoto ? (
        <img
          src={photo!}
          alt={place.name}
          onError={() => setPhotoFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        /* Layer 2: Live mini-map fallback (never fails) */
        <MiniMap lat={place.lat} lng={place.lng} />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none"></div>

      {/* Type badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-white bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md">
        {showPhoto ? <Camera className="w-3 h-3" /> : <MapIcon className="w-3 h-3" />}
        {showPhoto ? "Photo" : "Live Map Preview"}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none">
        <span className="text-sm font-bold text-white drop-shadow-md truncate">{place.name}</span>
        <span className="text-[10px] text-slate-200 font-mono bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
          {place.lat.toFixed(3)}, {place.lng.toFixed(3)}
        </span>
      </div>
    </div>
  );
}