import React, { useState, useEffect } from "react";
import { aterioValilta, kaikkiAteriat } from "../db.js";
import { viimeisetPaivat } from "../dates.js";
import { C, kortti, haamunappi, serif, Otsikko, Rivi, Virheruutu } from "../ui.jsx";

function keskiarvot(ateriat) {
  const paivat = new Map();
  for (const a of ateriat) {
    const p = paivat.get(a.pvm) || { kcal: 0, proteiini: 0 };
    p.kcal += a.kcal;
    p.proteiini += a.proteiini;
    paivat.set(a.pvm, p);
  }
  const n = paivat.size;
  if (n === 0) return { paivia: 0, kcal: 0, proteiini: 0 };
  let kcal = 0;
  let proteiini = 0;
  for (const p of paivat.values()) {
    kcal += p.kcal;
    proteiini += p.proteiini;
  }
  return { paivia: n, kcal: Math.round(kcal / n), proteiini: Math.round(proteiini / n) };
}

// Tämä on prototyypin tärkein mittaus: kuinka systemaattisesti mallin arvio
// heittää käyttäjän korjaamasta arvosta ja mihin suuntaan.
function poikkeama(ateriat) {
  const otos = ateriat.filter((a) => Number.isFinite(a.aiKcal) && a.aiKcal > 0);
  if (otos.length === 0) return null;
  const kcalEro = otos.reduce((s, a) => s + (a.kcal - a.aiKcal), 0) / otos.length;
  const suhde = otos.reduce((s, a) => s + (a.kcal - a.aiKcal) / a.aiKcal, 0) / otos.length;
  const protOtos = otos.filter((a) => Number.isFinite(a.aiProteiini));
  const protEro = protOtos.length
    ? protOtos.reduce((s, a) => s + (a.proteiini - a.aiProteiini), 0) / protOtos.length
    : null;
  return {
    n: otos.length,
    kcalEro: Math.round(kcalEro),
    prosentti: Math.round(suhde * 100),
    protEro: protEro === null ? null : Math.round(protEro),
  };
}

// Byte order mark, jotta Excel tunnistaa tiedoston UTF-8:ksi eikä riko ääkkösiä.
const BOM = "﻿";

function csvKentta(arvo) {
  return `"${String(arvo == null ? "" : arvo).replace(/"/g, '""')}"`;
}

function lataaTiedosto(sisalto, nimi, tyyppi) {
  const blob = new Blob([sisalto], { type: tyyppi });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nimi;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Historia() {
  const [viikko, setViikko] = useState(null);
  const [kuukausi, setKuukausi] = useState(null);
  const [ero, setEro] = useState(null);
  const [lataa, setLataa] = useState(true);
  const [virhe, setVirhe] = useState("");

  useEffect(() => {
    let peruttu = false;
    (async () => {
      try {
        const v7 = viimeisetPaivat(7);
        const v30 = viimeisetPaivat(30);
        const [seiseman, kolmekymmenta, kaikki] = await Promise.all([
          aterioValilta(v7.alku, v7.loppu),
          aterioValilta(v30.alku, v30.loppu),
          kaikkiAteriat(),
        ]);
        if (peruttu) return;
        setViikko(keskiarvot(seiseman));
        setKuukausi(keskiarvot(kolmekymmenta));
        setEro(poikkeama(kaikki));
      } catch (e) {
        if (!peruttu) setVirhe("Historian lukeminen epäonnistui.");
      } finally {
        if (!peruttu) setLataa(false);
      }
    })();
    return () => {
      peruttu = true;
    };
  }, []);

  async function vieCsv() {
    setVirhe("");
    try {
      const kaikki = await kaikkiAteriat();
      const rivit = [
        ["pvm", "aika", "ruoka", "kcal", "proteiini_g", "ai_kcal", "ai_proteiini_g"].join(","),
        ...kaikki.map((a) =>
          [
            a.pvm,
            a.aika,
            csvKentta(a.nimi),
            a.kcal,
            a.proteiini,
            a.aiKcal == null ? "" : a.aiKcal,
            a.aiProteiini == null ? "" : a.aiProteiini,
          ].join(",")
        ),
      ].join("\n");
      lataaTiedosto(BOM + rivit, "ruokapaivakirja.csv", "text/csv;charset=utf-8");
    } catch (e) {
      setVirhe("Vienti epäonnistui.");
    }
  }

  if (lataa) {
    return <div style={{ color: C.muted, fontSize: 14, padding: "8px 2px" }}>Ladataan…</div>;
  }

  return (
    <>
      <Otsikko teksti="Viimeiset 7 päivää" />
      <div style={kortti}>
        {viikko.paivia === 0 ? (
          <div style={{ fontSize: 14, color: C.muted }}>Ei kirjauksia.</div>
        ) : (
          <>
            <Rivi nimi="Kilokaloria / päivä" arvo={viikko.kcal} />
            <Rivi nimi="Proteiinia / päivä" arvo={`${viikko.proteiini} g`} />
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
              keskiarvo {viikko.paivia} kirjatulta päivältä
            </div>
          </>
        )}
      </div>

      <Otsikko teksti="Viimeiset 30 päivää" />
      <div style={kortti}>
        {kuukausi.paivia === 0 ? (
          <div style={{ fontSize: 14, color: C.muted }}>Ei kirjauksia.</div>
        ) : (
          <>
            <Rivi nimi="Kilokaloria / päivä" arvo={kuukausi.kcal} />
            <Rivi nimi="Proteiinia / päivä" arvo={`${kuukausi.proteiini} g`} />
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
              keskiarvo {kuukausi.paivia} kirjatulta päivältä
            </div>
          </>
        )}
      </div>

      <Otsikko teksti="Arvion tarkkuus" />
      <div style={kortti}>
        {!ero ? (
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
            Ei vielä tarpeeksi dataa. Vertailu ilmestyy, kun olet kirjannut aterioita.
          </div>
        ) : (
          <>
            <div
              style={{
                fontFamily: serif,
                fontSize: 30,
                lineHeight: 1.1,
                color: ero.kcalEro >= 0 ? C.amber : C.pine,
              }}
            >
              {ero.kcalEro >= 0 ? "+" : ""}
              {ero.kcalEro} kcal
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
              {ero.kcalEro >= 0 ? "Malli aliarvioi" : "Malli yliarvioi"} keskimäärin{" "}
              {Math.abs(ero.kcalEro)} kcal per ateria ({ero.prosentti >= 0 ? "+" : ""}
              {ero.prosentti} %), {ero.n} aterian perusteella.
            </div>
            {ero.protEro !== null && (
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>
                Proteiini: {ero.protEro >= 0 ? "+" : ""}
                {ero.protEro} g per ateria.
              </div>
            )}
            <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
              Luku perustuu siihen, kuinka paljon olet korjannut mallin arvioita ennen kirjaamista.
            </div>
          </>
        )}
      </div>

      <Virheruutu viesti={virhe} />

      <button onClick={vieCsv} style={{ ...haamunappi, width: "100%", marginTop: 22 }}>
        Vie kaikki tiedot CSV-tiedostona
      </button>
    </>
  );
}
