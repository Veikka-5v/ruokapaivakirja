import React, { useState, useEffect, useCallback } from "react";
import { haeAsetus, tallennaAsetus, poistaAsetus } from "./db.js";
import { OLETUSMALLI } from "./api.js";
import { C } from "./ui.jsx";
import Paiva from "./views/Paiva.jsx";
import Historia from "./views/Historia.jsx";
import Asetukset from "./views/Asetukset.jsx";

const VALILEHDET = [
  { id: "paiva", nimi: "Päivä" },
  { id: "historia", nimi: "Historia" },
  { id: "asetukset", nimi: "Asetukset" },
];

export default function App() {
  const [valmis, setValmis] = useState(false);
  const [nakyma, setNakyma] = useState("paiva");
  const [apiAvain, setApiAvain] = useState("");
  const [malli, setMalli] = useState(OLETUSMALLI);
  const [dbVirhe, setDbVirhe] = useState("");

  useEffect(() => {
    let peruttu = false;
    (async () => {
      try {
        const [avain, tallennettuMalli] = await Promise.all([
          haeAsetus("apiAvain", ""),
          haeAsetus("malli", OLETUSMALLI),
        ]);
        if (peruttu) return;
        setApiAvain(avain || "");
        setMalli(tallennettuMalli || OLETUSMALLI);
        // Ensimmäisellä käynnistyksellä ohjataan suoraan avaimen syöttöön.
        if (!avain) setNakyma("asetukset");
      } catch (e) {
        if (!peruttu) {
          setDbVirhe("Tietokantaa ei voitu avata. Selaimen yksityinen tila voi estää tallennuksen.");
        }
      } finally {
        if (!peruttu) setValmis(true);
      }
    })();
    return () => {
      peruttu = true;
    };
  }, []);

  const vaihdaAvain = useCallback(async (uusi) => {
    setApiAvain(uusi);
    if (uusi) await tallennaAsetus("apiAvain", uusi);
    else await poistaAsetus("apiAvain");
  }, []);

  const vaihdaMalli = useCallback(async (uusi) => {
    setMalli(uusi);
    await tallennaAsetus("malli", uusi);
  }, []);

  if (!valmis) {
    return (
      <div style={{ ...runko, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.muted, fontSize: 14 }}>Ladataan…</div>
      </div>
    );
  }

  return (
    <div style={runko}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 96px" }}>
        {dbVirhe && (
          <div
            style={{
              background: "#FFF",
              border: `1px solid ${C.red}`,
              color: C.red,
              borderRadius: 10,
              padding: 14,
              fontSize: 14,
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            {dbVirhe}
          </div>
        )}

        {/* Päivänäkymä pysyy liitettynä, jotta kesken oleva analyysi ei katoa
            välilehteä vaihtaessa. */}
        <div style={{ display: nakyma === "paiva" ? "block" : "none" }}>
          <Paiva
            apiAvain={apiAvain}
            malli={malli}
            onAvaaAsetukset={() => setNakyma("asetukset")}
          />
        </div>

        {nakyma === "historia" && <Historia />}

        {nakyma === "asetukset" && (
          <Asetukset
            apiAvain={apiAvain}
            malli={malli}
            onVaihdaAvain={vaihdaAvain}
            onVaihdaMalli={vaihdaMalli}
          />
        )}
      </div>

      <nav style={navi}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex" }}>
          {VALILEHDET.map((v) => {
            const aktiivinen = nakyma === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setNakyma(v.id)}
                aria-current={aktiivinen ? "page" : undefined}
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  borderTop: `2px solid ${aktiivinen ? C.pine : "transparent"}`,
                  padding: "14px 4px",
                  fontSize: 13,
                  fontWeight: aktiivinen ? 600 : 400,
                  color: aktiivinen ? C.pine : C.muted,
                  cursor: "pointer",
                }}
              >
                {v.nimi}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

const runko = {
  background: C.bg,
  color: C.ink,
  minHeight: "100%",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const navi = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  background: C.surface,
  borderTop: `1px solid ${C.line}`,
  paddingBottom: "env(safe-area-inset-bottom)",
};
