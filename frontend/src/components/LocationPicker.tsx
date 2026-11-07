"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Tap the map to set your approximate area. */
export default function LocationPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = [lat ?? 23.7805, lng ?? 90.4];
  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-64 w-full rounded-md">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      {lat != null && lng != null && (
        <CircleMarker center={[lat, lng]} radius={9} pathOptions={{ color: "#fff", weight: 2, fillColor: "#B3261E", fillOpacity: 1 }} />
      )}
    </MapContainer>
  );
}
