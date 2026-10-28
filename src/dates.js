const PAIVAT = ["sunnuntai", "maanantai", "tiistai", "keskiviikko", "torstai", "perjantai", "lauantai"];
const KUUKAUDET = ["tammikuuta", "helmikuuta", "maaliskuuta", "huhtikuuta", "toukokuuta", "kesäkuuta",
  "heinäkuuta", "elokuuta", "syyskuuta", "lokakuuta", "marraskuuta", "joulukuuta"];

export function isoPvm(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function tanaan() {
  return isoPvm(new Date());
}

export function nytKello() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

export function siirraPaiva(pvm, delta) {
  const [y, m, d] = pvm.split("-").map(Number);
  return isoPvm(new Date(y, m - 1, d + delta));
}

export function kaunisPaiva(pvm) {
  const [y, m, d] = pvm.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${PAIVAT[dt.getDay()]} ${d}. ${KUUKAUDET[m - 1]}`;
}

// Päivänäkymän otsikko kahdessa osassa: "Keskiviikko" ja "28. lokakuuta".
// Eiliselle ja tälle päivälle sana, koska niitä selataan eniten.
export function paivanOtsikko(pvm) {
  const [y, m, d] = pvm.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const t = tanaan();
  let suhteellinen = "";
  if (pvm === t) suhteellinen = "Tänään";
  else if (pvm === siirraPaiva(t, -1)) suhteellinen = "Eilen";
  const viikonpaiva = PAIVAT[dt.getDay()];
  return {
    paa: suhteellinen || viikonpaiva.charAt(0).toUpperCase() + viikonpaiva.slice(1),
    ala: suhteellinen ? `${viikonpaiva} ${d}. ${KUUKAUDET[m - 1]}` : `${d}. ${KUUKAUDET[m - 1]} ${y}`,
  };
}

// Viimeiset n päivää tämä päivä mukaan lukien, ISO-merkkijonoina.
// ISO-päivämäärät järjestyvät merkkijonoina oikein, joten näitä voi
// käyttää suoraan IndexedDB:n avainvälinä.
export function viimeisetPaivat(n, loppu = tanaan()) {
  return { alku: siirraPaiva(loppu, -(n - 1)), loppu };
}
