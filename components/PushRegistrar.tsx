"use client";

import { useEffect } from "react";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const LS_KEY = "push-registered";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

export default function PushRegistrar() {
  useEffect(() => {
    if (!PUBLIC_VAPID_KEY) return;
    if (!("PushManager" in window)) return;
    if (localStorage.getItem(LS_KEY)) return;

    void (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        const reg = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          localStorage.setItem(LS_KEY, "denied");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY) as BufferSource,
        });
        const json = sub.toJSON();
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          }),
        });
        if (res.ok) localStorage.setItem(LS_KEY, "1");
      } catch (err) {
        console.warn("[push-registrar]", err);
      }
    })();
  }, []);

  return null;
}
