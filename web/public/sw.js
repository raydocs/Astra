self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", () => {
  // Intentionally minimal for the first scaffold:
  // keep the PWA shell installable without claiming offline parity yet.
})
