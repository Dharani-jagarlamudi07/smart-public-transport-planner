export type Place = {
  name: string;
  lat: number;
  lng: number;
  address?: string;
};

export type Point = {
  name: string;
  lat: number;
  lng: number;
};

export type Leg = {
  mode: string;
  from: Point;
  to: Point;
  start_time?: string;
  end_time?: string;
  duration_sec: number;
  distance_m: number;
  route_short_name?: string;
  geometry: [number, number][];
};

export type Itinerary = {
  id: string;
  duration_sec: number;
  walk_distance_m: number;
  transfers: number;
  fare?: number;
  score?: number;
  recommendation_reason?: string;
  legs: Leg[];
};

export type SavedRoute = {
  id: number;
  title: string;
  origin_name: string;
  destination_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  created_at: string;
  payload: Itinerary;
};

export type Alert = {
  id: number;
  message: string;
  route_ref?: string;
  severity: string;
  active: boolean;
  created_at: string;
};

export type Vehicle = {
  id: string;
  mode: string;
  route?: string;
  lat: number;
  lng: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  return res.json() as Promise<T>;
}

export const searchPlaces = (q: string) =>
  request<Place[]>(`/places?q=${encodeURIComponent(q)}`);

export const planRoutes = (payload: {
  origin: Place;
  destination: Place;
  departure_time?: string;
  preference?: string;
}) =>
  request<{ itineraries: Itinerary[] }>("/routes", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getVehicles = () => request<Vehicle[]>("/vehicles");

export const getSavedRoutes = () => request<SavedRoute[]>("/saved-routes");

export const saveRoute = (payload: {
  title?: string;
  origin: Place;
  destination: Place;
  itinerary: Itinerary;
}) =>
  request<{ id: number; ok: boolean }>("/saved-routes", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteSavedRoute = (id: number) =>
  request<{ ok: boolean }>(`/saved-routes/${id}`, {
    method: "DELETE",
  });

export const getAlerts = () => request<Alert[]>("/alerts");

export const simulateDelay = () =>
  request<Alert>("/admin/simulate-delay", {
    method: "POST",
  });

export const createAlert = (payload: {
  message: string;
  route_ref?: string;
  severity?: string;
}) =>
  request<Alert>("/admin/alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const seedDemoData = () =>
  request<{ ok: boolean; seeded_searches: number; seeded_alerts: number }>(
    "/admin/seed-demo",
    { method: "POST" }
  );

export const getAnalytics = () => request<any>("/analytics/summary");