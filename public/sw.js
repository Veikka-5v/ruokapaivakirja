// Sovelluskuori välimuistiin, jotta appi aukeaa ja vanha data näkyy ilman verkkoa.
// API-kutsut menevät aina suoraan verkkoon: ne ovat toiseen originiin eikä
// niitä koskaan tallenneta.

const CACHE = "ruokapaivakirja-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const avaimet = await caches.keys();
      await Promise.all(avaimet.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // api.anthropic.com ohittaa sw:n

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const osuma = await cache.match(req);

      const verkosta = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);

      // Vanha versio heti, päivitys taustalla (stale-while-revalidate).
      if (osuma) {
        e.waitUntil(verkosta);
        return osuma;
      }

      const res = await verkosta;
      if (res) return res;

      // Offline eikä välimuistissa: navigointi saa sovelluskuoren.
      if (req.mode === "navigate") {
        const kuori = (await cache.match("./index.html")) || (await cache.match("./"));
        if (kuori) return kuori;
      }
      return new Response("Ei verkkoyhteyttä", { status: 503, statusText: "Offline" });
    })()
  );
});
