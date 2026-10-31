"use client";

import { useEffect, useRef, useState } from "react";
import { api, getToken, wsUrl } from "./api";
import type { MapSnapshot } from "./types";

/**
 * Live map data: WebSocket first, polling every 3 s if the socket drops.
 * Also ticks the countdown locally every second.
 */
export function useRequestMap(requestId: number, enabled = true) {
  const [snap, setSnap] = useState<MapSnapshot | null>(null);
  const [live, setLive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const deadline = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const apply = (s: MapSnapshot) => {
      setSnap(s);
      deadline.current = s.wave_deadline ? new Date(s.wave_deadline).getTime() : null;
      setSecondsLeft(s.seconds_left);
    };

    const startPolling = () => {
      if (poll) return;
      const tick = () => api<MapSnapshot>(`/requests/${requestId}/map`).then(apply).catch(() => {});
      tick();
      poll = setInterval(tick, 3000);
    };

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl(`/ws/requests/${requestId}?token=${encodeURIComponent(getToken() || "")}`));
      } catch {
        startPolling();
        return;
      }
      ws.onopen = () => {
        setLive(true);
        if (poll) {
          clearInterval(poll);
          poll = null;
        }
      };
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (!data.error) apply(data);
      };
      ws.onclose = () => {
        setLive(false);
        if (closed) return;
        startPolling();
        retry = setTimeout(connect, 5000);
      };
    };

    connect();
    const clock = setInterval(() => {
      if (deadline.current) setSecondsLeft(Math.max(0, Math.round((deadline.current - Date.now()) / 1000)));
    }, 1000);

    return () => {
      closed = true;
      ws?.close();
      if (poll) clearInterval(poll);
      if (retry) clearTimeout(retry);
      clearInterval(clock);
    };
  }, [requestId, enabled]);

  return { snap, live, secondsLeft };
}
