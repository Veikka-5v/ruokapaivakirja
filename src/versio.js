// Kumpi versio on käynnissä ja onko palvelimella uudempi.
//
// Service worker tarjoilee sovelluskuoren välimuistista ja hakee päivityksen
// vasta taustalla, joten uusi julkaisu näkyy vasta seuraavalla avauksella.
// Ilman näkyvää versiotietoa ei mitenkään tiedä, kumpaa versiota katsoo.

// Vite korvaa nämä käännösaikana (ks. vite.config.js).
export const VERSIO = typeof __VERSIO__ === "string" ? __VERSIO__ : "dev";
export const KAANNETTY = typeof __KAANNETTY__ === "string" ? __KAANNETTY__ : "";

export function muotoileAika(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} klo ${p(d.getHours())}.${p(
    d.getMinutes()
  )}`;
}

// Hakee palvelimella olevan version. sw.js ohittaa versio.json:n, joten tämä
// menee aina verkkoon eikä välimuistiin.
export async function haePalvelimenVersio() {
  const vastaus = await fetch("./versio.json", { cache: "no-store" });
  if (!vastaus.ok) throw new Error(`versio.json ${vastaus.status}`);
  const data = await vastaus.json();
  return { versio: String(data.versio || ""), kaannetty: String(data.kaannetty || "") };
}

// Tyhjentää sovelluskuoren välimuistin ja lataa sivun uudelleen, jolloin uusi
// versio tulee käyttöön heti eikä vasta seuraavalla avauksella. Kirjauksiin
// tämä ei koske: ne ovat IndexedDB:ssä, eri paikassa kuin Cache Storage.
export async function paivitaNyt() {
  if ("caches" in window) {
    const avaimet = await caches.keys();
    await Promise.all(avaimet.map((k) => caches.delete(k)));
  }
  if ("serviceWorker" in navigator) {
    const rekisterointi = await navigator.serviceWorker.getRegistration();
    if (rekisterointi) await rekisterointi.update();
  }
  window.location.reload();
}
