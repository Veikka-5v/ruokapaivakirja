import React, { useState, useEffect, useRef, useCallback } from "react";
import { analysoiKuva, hintaDollareina } from "../api.js";
import { C, kortti, paanappi, haamunappi, Lukukentta } from "../ui.jsx";

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

  return (
    <div style={{ ...kortti, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <img
          src={odottava.esikatselu}
          alt=""
          style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {ladataa && <div style={{ fontSize: 15, color: C.muted }}>Arvioidaan&hellip;</div>}

          {virhe && (
            <div style={{ fontSize: 14, color: C.red, lineHeight: 1.5 }}>{virhe.message}</div>
          )}

          {tulos && (
            <>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{tulos.nimi}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
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

      {tulos && tulos.ainesosat.length > 0 && (
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
          {tulos.ainesosat.map((a, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {a.aine}
              {a.maara_g ? ` ${a.maara_g} g` : ""}
            </span>
          ))}
        </div>
      )}

      {tulos && (
        <>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Lukukentta otsikko="kcal" arvo={kcal} onChange={setKcal} />
            <Lukukentta otsikko="proteiini (g)" arvo={proteiini} onChange={setProteiini} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={tallenna} disabled={tallentaa} style={{ ...paanappi, flex: 1, opacity: tallentaa ? 0.6 : 1 }}>
              {tallentaa ? "Tallennetaan…" : "Kirjaa ateria"}
            </button>
            <button onClick={onHylkaa} style={haamunappi}>
              Hylkää
            </button>
          </div>

          <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
            {tulos.sisaanTokenit + tulos.ulosTokenit} tokenia &middot;{" "}
            {hintaDollareina(tulos.malli, tulos.sisaanTokenit, tulos.ulosTokenit)
              .toFixed(4)
              .replace(".", ",")}{" "}
            $ &middot; {tulos.malli}
          </div>
        </>
      )}

      {virhe && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={suorita} disabled={ladataa} style={{ ...paanappi, flex: 1, opacity: ladataa ? 0.6 : 1 }}>
            Yritä uudelleen
          </button>
          {virhe.avainOngelma && (
            <button onClick={onAvaaAsetukset} style={haamunappi}>
              Asetukset
            </button>
          )}
          <button onClick={onHylkaa} style={haamunappi}>
            Hylkää
          </button>
        </div>
      )}
    </div>
  );
}
