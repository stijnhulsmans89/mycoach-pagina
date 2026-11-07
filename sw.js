// Service worker: houdt de bestanden van de pagina op de gsm, zodat ze ook zonder verbinding opent.
// Eerst het netwerk (zo komt een nieuwe versie meteen binnen), anders de bewaarde kopie.
// Alleen de eigen bestanden: verzoeken naar intervals.icu (met je sleutel) gaan er nooit door en worden nooit bewaard.
const KAS = "mycoach-pagina";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  e.respondWith((async () => {
    const kas = await caches.open(KAS);
    try {
      const antwoord = await fetch(e.request, { cache: "no-cache" });
      if (antwoord.ok) await kas.put(e.request, antwoord.clone());
      return antwoord;
    } catch {
      return (await kas.match(e.request, { ignoreSearch: true })) ?? Response.error();
    }
  })());
});
