"use client";

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";

type Props = {
  lat: number;
  lng: number;
};

/**
 * A small, non-interactive map snapshot.
 * Uses the same OSM tiles as the main map, so it ALWAYS loads.
 */
export default function MiniMap({ lat, lng }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <CircleMarker
        center={[lat, lng]}
        radius={7}
        pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.9, weight: 2 }}
      />
    </MapContainer>
  );
}