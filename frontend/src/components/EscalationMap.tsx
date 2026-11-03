"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import type { DonorDotStatus, MapSnapshot } from "@/lib/types";

export const DOT_COLOR: Record<DonorDotStatus, string> = {
  waiting: "#8C6A1F",
  accepted: "#186D33",
  declined: "#857371",
  no_reply: "#D8C2BF",
  closed: "#C9CFCB",
};

const hospitalIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:12px;background:#B3261E;color:#fff;display:grid;place-items:center;font-weight:500;font-size:20px;box-shadow:0 1px 3px 1px rgba(0,0,0,.15),0 1px 2px rgba(0,0,0,.3)">+</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const bankIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;transform:rotate(45deg);background:#392E2C;border:2px solid #fff"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitToRing({ lat, lng, km }: { lat: number; lng: number; km: number }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLng(lat, lng).toBounds(km * 2000 * 1.1), { animate: true });
  }, [map, lat, lng, km]);
  return null;
}

export default function EscalationMap({ snap }: { snap: MapSnapshot }) {
  const { lat, lng } = snap.hospital;
  if (lat == null || lng == null) return null;
  const active = snap.rings.find((r) => r.state === "active");
  const reached = [...snap.rings].reverse().find((r) => r.state !== "pending");
  const focusKm = active?.radius_km ?? reached?.radius_km ?? 5;

  return (
    <MapContainer center={[lat, lng]} zoom={13} scrollWheelZoom={false} className="h-full w-full" attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToRing lat={lat} lng={lng} km={focusKm} />
      {snap.rings.map((r) => (
        <Circle
          key={r.wave}
          center={[lat, lng]}
          radius={r.radius_km * 1000}
          className={r.state === "active" ? "ring-active" : undefined}
          pathOptions={{
            color: "#B3261E",
            weight: r.state === "active" ? 3 : 1.5,
            opacity: r.state === "pending" ? 0.25 : 0.9,
            dashArray: r.state === "done" ? "6 6" : undefined,
            fillColor: "#B3261E",
            fillOpacity: r.state === "active" ? 0.06 : 0,
          }}
        />
      ))}
      <Marker position={[lat, lng]} icon={hospitalIcon}>
        <Tooltip>{snap.hospital.name}</Tooltip>
      </Marker>
      {snap.donors.map((d) => (
        <CircleMarker
          key={d.label}
          center={[d.lat, d.lng]}
          radius={d.status === "accepted" ? 10 : 7}
          pathOptions={{ color: "#fff", weight: 2, fillColor: DOT_COLOR[d.status], fillOpacity: 1 }}
        >
          <Tooltip>
            {d.label}, wave {d.wave}, about {d.distance_km} km
          </Tooltip>
        </CircleMarker>
      ))}
      {snap.blood_banks.map((b) => (
        <Marker key={b.id} position={[b.lat, b.lng]} icon={bankIcon}>
          <Tooltip>{b.name}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
