import React, { useState, useEffect, useCallback } from "react";
import { aterioPaivalle, lisaaAteria, paivitaAteria, poistaAteria } from "../db.js";
import { kasitteleKuva } from "../image.js";
import { tanaan, siirraPaiva, kaunisPaiva, nytKello } from "../dates.js";
import {
  C, kortti, kentta, paanappi, haamunappi, pikkunappi, navinappi,
  Summa, Lukukentta, Virheruutu,
} from "../ui.jsx";
import Analyysi from "./Analyysi.jsx";

export default function Paiva({ apiAvain, malli, onAvaaAsetukset }) {
  const [pvm, setPvm] = useState(tanaan);
  const [ateriat, setAteriat] = useState([]);
  const [lataa, setLataa] = useState(true);
  const [virhe, setVirhe] = useState("");
  const [lisatieto, setLisatieto] = useState("");
  const [odottava, setOdottava] = useState(null);
  const [kasittelee, setKasittelee] = useState(false);
  const [muokattava, setMuokattava] = useState(null);

  const lataaAteriat = useCallback(async (paiva) => {
    try {
      setAteriat(await aterioPaivalle(paiva));
    } catch (e) {
      setVirhe("Aterioiden lukeminen epäonnistui.");
    } finally {
      setLataa(false);
    }
  }, []);

  useEffect(() => {
    setLataa(true);
    setMuokattava(null);
    lataaAteriat(pvm);
  }, [pvm, lataaAteriat]);

  async function valitseKuva(ev) {
    const tiedosto = ev.target.files && ev.target.files[0];
    ev.target.value = ""; // sama tiedosto pitää voida valita uudelleen
    if (!tiedosto) return;
    setVirhe("");
    setKasittelee(true);
    try {
      const kuva = await kasitteleKuva(tiedosto);
      // id toimii Analyysin key-arvona: uusi kuva pakottaa uuden analyysin
      // eikä jää näyttämään edellisen tulosta.
      setOdottava({ ...kuva, id: `${Date.now()}`, lisatieto: lisatieto.trim() });
      setLisatieto("");
    } catch (e) {
      setVirhe(e.message || "Kuvan käsittely epäonnistui.");
    } finally {
      setKasittelee(false);
    }
  }

  async function kirjaa(tulos, kcal, proteiini) {
    try {
      await lisaaAteria({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pvm,
        aika: nytKello(),
        nimi: tulos.nimi,
        kcal: Math.max(0, Math.round(Number(kcal) || 0)),
        proteiini: Math.max(0, Math.round(Number(proteiini) || 0)),
        // Mallin alkuperäinen arvio talteen aina erikseen: näin näkee
        // myöhemmin kuinka systemaattisesti arviot heittävät.
        aiKcal: tulos.kcal,
        aiProteiini: tulos.proteiini,
        varmuus: tulos.varmuus,
        kuva: odottava.pikkukuva,
        malli: tulos.malli,
        sisaanTokenit: tulos.sisaanTokenit,
        ulosTokenit: tulos.ulosTokenit,
      });
      setOdottava(null);
      await lataaAteriat(pvm);
    } catch (e) {
      setVirhe("Aterian tallennus epäonnistui.");
    }
  }

  async function poista(id) {
    try {
      await poistaAteria(id);
      await lataaAteriat(pvm);
    } catch (e) {
      setVirhe("Poisto epäonnistui.");
    }
  }

  async function tallennaMuokkaus() {
    const alkuperainen = ateriat.find((a) => a.id === muokattava.id);
    if (!alkuperainen) {
      setMuokattava(null);
      return;
    }
    try {
      await paivitaAteria({
        ...alkuperainen,
        nimi: muokattava.nimi.trim() || alkuperainen.nimi,
        kcal: Math.max(0, Math.round(Number(muokattava.kcal) || 0)),
        proteiini: Math.max(0, Math.round(Number(muokattava.proteiini) || 0)),
      });
      setMuokattava(null);
      await lataaAteriat(pvm);
    } catch (e) {
      setVirhe("Muutoksen tallennus epäonnistui.");
    }
  }

  const kcalSumma = ateriat.reduce((s, a) => s + a.kcal, 0);
  const proteiiniSumma = ateriat.reduce((s, a) => s + a.proteiini, 0);
  const tama = tanaan();

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <button onClick={() => setPvm(siirraPaiva(pvm, -1))} aria-label="Edellinen päivä" style={navinappi}>
          &lsaquo;
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{kaunisPaiva(pvm)}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{pvm === tama ? "tänään" : pvm}</div>
        </div>
        <button
          onClick={() => setPvm(siirraPaiva(pvm, 1))}
          disabled={pvm >= tama}
          aria-label="Seuraava päivä"
          style={{ ...navinappi, opacity: pvm >= tama ? 0.3 : 1 }}
        >
          &rsaquo;
        </button>
      </div>

      <div style={{ ...kortti, display: "flex", padding: 0, overflow: "hidden" }}>
        <Summa otsikko="kilokaloria" arvo={kcalSumma} />
        <div style={{ width: 1, background: C.line }} />
        <Summa otsikko="grammaa proteiinia" arvo={proteiiniSumma} korostus />
      </div>

      {!apiAvain ? (
        <div style={{ ...kortti, marginTop: 14, fontSize: 14, lineHeight: 1.55 }}>
          Analyysi tarvitsee Anthropicin API-avaimen.
          <button onClick={onAvaaAsetukset} style={{ ...paanappi, marginTop: 12 }}>
            Lisää avain asetuksista
          </button>
        </div>
      ) : (
        <div style={{ ...kortti, marginTop: 14 }}>
          <input
            value={lisatieto}
            onChange={(e) => setLisatieto(e.target.value)}
            placeholder="Lisätieto, esim. 150 g kanaa (valinnainen)"
            style={kentta}
          />
          {/* Ei capture-määrettä: näin kuvan voi ottaa tai valita kirjastosta. */}
          <label
            style={{
              ...paanappi,
              marginTop: 10,
              display: "block",
              textAlign: "center",
              position: "relative",
              opacity: kasittelee ? 0.6 : 1,
            }}
          >
            {kasittelee ? "Käsitellään…" : "Ota kuva ateriasta"}
            <input
              type="file"
              accept="image/*"
              onChange={valitseKuva}
              disabled={kasittelee}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
            />
          </label>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            Lisätieto annoskoosta parantaa arviota enemmän kuin mikään muu yksittäinen keino.
          </div>
        </div>
      )}

      <Virheruutu viesti={virhe} />

      {odottava && (
        <Analyysi
          key={odottava.id}
          odottava={odottava}
          apiAvain={apiAvain}
          malli={malli}
          onKirjaa={kirjaa}
          onHylkaa={() => setOdottava(null)}
          onAvaaAsetukset={onAvaaAsetukset}
        />
      )}

      <div style={{ marginTop: 20 }}>
        {lataa ? (
          <div style={{ color: C.muted, fontSize: 14, padding: "8px 2px" }}>Ladataan…</div>
        ) : ateriat.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 14, padding: "8px 2px", lineHeight: 1.5 }}>
            Ei vielä aterioita tälle päivälle. Ota kuva, niin arvio ilmestyy tähän.
          </div>
        ) : (
          ateriat.map((a) => (
            <div key={a.id} style={{ ...kortti, marginBottom: 8, padding: "12px 14px" }}>
              {muokattava && muokattava.id === a.id ? (
                <>
                  <input
                    value={muokattava.nimi}
                    onChange={(e) => setMuokattava({ ...muokattava, nimi: e.target.value })}
                    style={kentta}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <Lukukentta
                      otsikko="kcal"
                      arvo={muokattava.kcal}
                      onChange={(v) => setMuokattava({ ...muokattava, kcal: v })}
                    />
                    <Lukukentta
                      otsikko="proteiini (g)"
                      arvo={muokattava.proteiini}
                      onChange={(v) => setMuokattava({ ...muokattava, proteiini: v })}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={tallennaMuokkaus} style={{ ...paanappi, flex: 1 }}>
                      Tallenna
                    </button>
                    <button onClick={() => setMuokattava(null)} style={haamunappi}>
                      Peruuta
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 12, color: C.muted, width: 38, flexShrink: 0 }}>{a.aika}</div>
                  <Pikkukuva blob={a.kuva} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{a.nimi}</div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
                      {a.kcal} kcal &middot; {a.proteiini} g proteiinia
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setMuokattava({ id: a.id, nimi: a.nimi, kcal: a.kcal, proteiini: a.proteiini })
                    }
                    style={pikkunappi}
                  >
                    muokkaa
                  </button>
                  <button onClick={() => poista(a.id)} style={{ ...pikkunappi, color: C.red }}>
                    poista
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <p style={{ fontSize: 12, color: C.muted, marginTop: 16, lineHeight: 1.6 }}>
        Arviot ovat suuntaa-antavia. Annoskoon päättely kuvasta heittää tyypillisesti 20&ndash;30 %,
        joten korjaa lukuja vapaasti ennen kirjaamista.
      </p>
    </>
  );
}

function Pikkukuva({ blob }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return undefined;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 5, flexShrink: 0 }}
    />
  );
}
