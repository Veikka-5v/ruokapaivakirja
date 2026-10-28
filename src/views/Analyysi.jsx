import React, { useState, useEffect, useRef, useCallback } from "react";
import { analysoiKuva, hintaDollareina, MALLIT } from "../api.js";
import { C, kortti, paanappi, haamunappi, Lukukentta } from "../ui.jsx";

// Liitetään vasta kun käyttäjä painaa Analysoi, ja kutsu lähtee heti
// liittämisen jälkeen. Kuvan valinta yksinään ei koskaan käynnistä tätä.
export default function Analyysi({ odottava, apiAvain, malli, onKirjaa, onHylkaa, onAvaaAsetukset }) {
  const [tulos, setTulos] = useState(null);
  const [virhe, setVirhe] = useState(null);
  const [ladataa, setLadataa] = useState(true);
  const [kcal, setKcal] = useState("");
  const [proteiini, setProteiini] = useState("");
  const [tallentaa, setTallentaa] = useState(false);

  // Estää tuplakutsun: React StrictMode ajaa efektin kehityksessä kahdesti,
  // ja jokainen kutsu maksaa oikeaa rahaa.
  const kaynnistetty = useRef(false);
  const kesken = useRef(false);

  const suorita = useCallback(async () => {
    if (kesken.current) return;
    kesken.current = true;
    setLadataa(true);
    setVirhe(null);
    try {
      const t = await analysoiKuva({
        base64: odottava.base64,
        lisatieto: odottava.lisatieto,
        avain: apiAvain,
        malli,
      });
      setTulos(t);
      setKcal(String(t.kcal));
      setProteiini(String(t.proteiini));
    } catch (e) {
      // Kuva säilyy tilassa, joten uudelleenyritys ei vaadi uutta kuvaa.
      setVirhe(e);
    } finally {
      setLadataa(false);
      kesken.current = false;
    }
  }, [odottava, apiAvain, malli]);

  useEffect(() => {
    if (kaynnistetty.current) return;
    kaynnistetty.current = true;
    suorita();
  }, [suorita]);

  async function tallenna() {
    setTallentaa(true);
    try {
      await onKirjaa(tulos, kcal, proteiini);
    } finally {
      setTallentaa(false);
    }
  }

  const malliNimi = (MALLIT[malli] && MALLIT[malli].nimi) || malli;

  return (
    <div style={{ ...kortti, marginTop: 14 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <img
          src={odottava.esikatselu}
          alt=""
          style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {ladataa && (
            <>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Analysoidaan&hellip;</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
                {malliNimi}
                {odottava.lisatieto ? ` · ${odottava.lisatieto}` : ""}
              </div>
            </>
          )}

          {virhe && (
            <div style={{ fontSize: 14, color: C.red, lineHeight: 1.5 }}>{virhe.message}</div>
          )}

          {tulos && (
            <>
              <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.3 }}>{tulos.nimi}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                arvion varmuus: {tulos.varmuus}
              </div>
              {tulos.huomio && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
                  {tulos.huomio}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Erittely riveittäin, ei yhtenä pötkönä: kokonaisluvut ovat näiden summa,
          joten väärä rivi kertoo suoraan mikä arviossa meni pieleen. */}
      {tulos && tulos.ainesosat.length > 0 && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}` }}>
          {tulos.ainesosat.map((a, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                padding: "9px 0",
                borderBottom: `1px solid ${C.line}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>
                  {a.aine}
                  {a.maara_g ? <span style={{ color: C.muted }}> {a.maara_g} g</span> : null}
                  {a.lahde === "pakkausmerkintä" && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        color: C.pine,
                        background: C.pineSoft,
                        borderRadius: 4,
                        padding: "1px 5px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      pakkauksesta
                    </span>
                  )}
                </div>
                {a.peruste && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>
                    {a.peruste}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  textAlign: "right",
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.45,
                }}
              >
                {a.kcal} <span style={{ color: C.muted, fontSize: 12 }}>kcal</span>
                <br />
                <span style={{ color: C.pine }}>
                  {a.proteiini} <span style={{ fontSize: 12 }}>g</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tulos && (
        <>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Lukukentta otsikko="Energia" yksikko="kcal" arvo={kcal} onChange={setKcal} />
            <Lukukentta otsikko="Proteiini" yksikko="g" arvo={proteiini} onChange={setProteiini} />
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            Korjaa luvut ennen kirjaamista, jos tiedät paremmin. Alkuperäinen arvio tallentuu
            erikseen tarkkuuden seurantaa varten.
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={tallenna}
              disabled={tallentaa}
              style={{ ...paanappi, flex: 1, opacity: tallentaa ? 0.6 : 1 }}
            >
              {tallentaa ? "Tallennetaan…" : "Kirjaa ateria"}
            </button>
            <button onClick={onHylkaa} style={haamunappi}>
              Takaisin
            </button>
          </div>

          <div style={{ fontSize: 11, color: C.faint, marginTop: 10 }}>
            {tulos.sisaanTokenit + tulos.ulosTokenit} tokenia &middot;{" "}
            {hintaDollareina(tulos.malli, tulos.sisaanTokenit, tulos.ulosTokenit)
              .toFixed(4)
              .replace(".", ",")}{" "}
            $ &middot; {malliNimi}
          </div>
        </>
      )}

      {virhe && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={suorita}
            disabled={ladataa}
            style={{ ...paanappi, flex: 1, opacity: ladataa ? 0.6 : 1 }}
          >
            Yritä uudelleen
          </button>
          {virhe.avainOngelma && (
            <button onClick={onAvaaAsetukset} style={haamunappi}>
              Asetukset
            </button>
          )}
          <button onClick={onHylkaa} style={haamunappi}>
            Takaisin
          </button>
        </div>
      )}
    </div>
  );
}
