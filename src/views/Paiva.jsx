import React, { useState, useEffect, useCallback } from "react";
import { aterioPaivalle, lisaaAteria, paivitaAteria, poistaAteria } from "../db.js";
import { kasitteleKuva } from "../image.js";
import { MALLIT, arvioiHinta } from "../api.js";
import { tanaan, siirraPaiva, paivanOtsikko, nytKello } from "../dates.js";
import {
  C, serif, kortti, kentta, paanappi, haamunappi, pikkunappi, navinappi,
  Summa, Lukukentta, Segmentti, Otsikko, Virheruutu,
} from "../ui.jsx";
import Analyysi from "./Analyysi.jsx";

const TILAT = [
  { id: "kuva", nimi: "Kuvasta" },
  { id: "kasin", nimi: "Käsin" },
];

const TYHJA_KASIN = { nimi: "", kcal: "", proteiini: "" };

function uusiId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function luku(arvo) {
  return Math.max(0, Math.round(Number(arvo) || 0));
}

function dollareina(arvo) {
  return arvo.toFixed(3).replace(".", ",");
}

export default function Paiva({ apiAvain, malli, onAvaaAsetukset }) {
  const [pvm, setPvm] = useState(tanaan);
  const [ateriat, setAteriat] = useState([]);
  const [lataa, setLataa] = useState(true);
  const [virhe, setVirhe] = useState("");

  const [tila, setTila] = useState("kuva");

  // Kuvan kulku kolmessa vaiheessa: valittu kuva odottaa esikatselussa
  // (kuva), Analysoi-painallus siirtää sen analysoitavaksi, ja vasta silloin
  // Analyysi-komponentti liitetään ja API-kutsu lähtee. Kuvan valinta ei
  // maksa mitään.
  const [kuva, setKuva] = useState(null);
  const [lisatieto, setLisatieto] = useState("");
  const [kasittelee, setKasittelee] = useState(false);
  const [analysoitava, setAnalysoitava] = useState(null);

  const [kasin, setKasin] = useState(TYHJA_KASIN);
  const [tallentaaKasin, setTallentaaKasin] = useState(false);

  const [muokattava, setMuokattava] = useState(null);
  const [vahvistaPoisto, setVahvistaPoisto] = useState(false);

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
      setKuva(await kasitteleKuva(tiedosto));
    } catch (e) {
      setVirhe(e.message || "Kuvan käsittely epäonnistui.");
    } finally {
      setKasittelee(false);
    }
  }

  function analysoi() {
    // id toimii Analyysin key-arvona: jokainen painallus on oma analyysinsä.
    setAnalysoitava({ ...kuva, id: uusiId(), lisatieto: lisatieto.trim() });
  }

  function tyhjennaKuva() {
    setKuva(null);
    setAnalysoitava(null);
    setLisatieto("");
  }

  // Hylkäys tuloksen jälkeen palauttaa esikatseluun, ei tyhjään: kuvan voi
  // analysoida uudelleen tarkemmalla lisätiedolla ottamatta uutta kuvaa.
  function palaaEsikatseluun() {
    setAnalysoitava(null);
  }

  async function kirjaaAnalyysi(tulos, kcal, proteiini) {
    try {
      await lisaaAteria({
        id: uusiId(),
        pvm,
        aika: nytKello(),
        nimi: tulos.nimi,
        kcal: luku(kcal),
        proteiini: luku(proteiini),
        lahde: "kuva",
        // Mallin alkuperäinen arvio talteen aina erikseen: näin näkee
        // myöhemmin kuinka systemaattisesti arviot heittävät.
        aiKcal: tulos.kcal,
        aiProteiini: tulos.proteiini,
        varmuus: tulos.varmuus,
        kuva: analysoitava.pikkukuva,
        malli: tulos.malli,
        sisaanTokenit: tulos.sisaanTokenit,
        ulosTokenit: tulos.ulosTokenit,
      });
      tyhjennaKuva();
      await lataaAteriat(pvm);
    } catch (e) {
      setVirhe("Aterian tallennus epäonnistui.");
    }
  }

  const kasinKelpaa =
    kasin.nimi.trim() !== "" && (luku(kasin.kcal) > 0 || luku(kasin.proteiini) > 0);

  async function kirjaaKasin(ev) {
    ev.preventDefault();
    if (!kasinKelpaa) return;
    setTallentaaKasin(true);
    setVirhe("");
    try {
      // Ei aiKcal/aiProteiini-kenttiä: käsin kirjattu ei ole arvio, joten
      // Historian tarkkuuslaskenta ohittaa sen automaattisesti.
      await lisaaAteria({
        id: uusiId(),
        pvm,
        aika: nytKello(),
        nimi: kasin.nimi.trim(),
        kcal: luku(kasin.kcal),
        proteiini: luku(kasin.proteiini),
        lahde: "kasin",
      });
      setKasin(TYHJA_KASIN);
      await lataaAteriat(pvm);
    } catch (e) {
      setVirhe("Aterian tallennus epäonnistui.");
    } finally {
      setTallentaaKasin(false);
    }
  }

  function avaaMuokkaus(a) {
    setVahvistaPoisto(false);
    setMuokattava(
      muokattava && muokattava.id === a.id
        ? null
        : { id: a.id, nimi: a.nimi, kcal: String(a.kcal), proteiini: String(a.proteiini) }
    );
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
        kcal: luku(muokattava.kcal),
        proteiini: luku(muokattava.proteiini),
      });
      setMuokattava(null);
      await lataaAteriat(pvm);
    } catch (e) {
      setVirhe("Muutoksen tallennus epäonnistui.");
    }
  }

  async function poista(id) {
    try {
      await poistaAteria(id);
      setMuokattava(null);
      setVahvistaPoisto(false);
      await lataaAteriat(pvm);
    } catch (e) {
      setVirhe("Poisto epäonnistui.");
    }
  }

  const kcalSumma = ateriat.reduce((s, a) => s + a.kcal, 0);
  const proteiiniSumma = ateriat.reduce((s, a) => s + a.proteiini, 0);
  const tama = tanaan();
  const otsikko = paivanOtsikko(pvm);

  return (
    <>
      {/* Päivän valinta */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setPvm(siirraPaiva(pvm, -1))} aria-label="Edellinen päivä" style={navinappi}>
          &lsaquo;
        </button>
        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 650, margin: 0, lineHeight: 1.2 }}>{otsikko.paa}</h1>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
            {otsikko.ala}
            {pvm !== tama && (
              <>
                {" "}
                <button
                  onClick={() => setPvm(tama)}
                  style={{ ...pikkunappi, padding: "0 2px", color: C.pine, fontWeight: 600 }}
                >
                  takaisin tähän päivään
                </button>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => setPvm(siirraPaiva(pvm, 1))}
          disabled={pvm >= tama}
          aria-label="Seuraava päivä"
          style={{ ...navinappi, opacity: pvm >= tama ? 0.3 : 1, cursor: pvm >= tama ? "default" : "pointer" }}
        >
          &rsaquo;
        </button>
      </div>

      {/* Päivän summat */}
      <div style={{ ...kortti, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex" }}>
          <Summa otsikko="kilokaloria" arvo={kcalSumma} />
          <div style={{ width: 1, background: C.line, margin: "18px 0 6px" }} />
          <Summa otsikko="g proteiinia" arvo={proteiiniSumma} korostus />
        </div>
        <div style={{ fontSize: 12, color: C.faint, textAlign: "center", padding: "10px 0 16px" }}>
          {lataa ? " " : ateriat.length === 0 ? "ei aterioita" : `${ateriat.length} ${ateriat.length === 1 ? "ateria" : "ateriaa"}`}
        </div>
      </div>

      {/* Kirjaus */}
      {analysoitava ? (
        <Analyysi
          key={analysoitava.id}
          odottava={analysoitava}
          apiAvain={apiAvain}
          malli={malli}
          onKirjaa={kirjaaAnalyysi}
          onHylkaa={palaaEsikatseluun}
          onAvaaAsetukset={onAvaaAsetukset}
        />
      ) : (
        <div style={{ ...kortti, marginTop: 14 }}>
          <Segmentti vaihtoehdot={TILAT} arvo={tila} onChange={setTila} />

          {tila === "kuva" && (
            <div style={{ marginTop: 14 }}>
              {!apiAvain ? (
                <>
                  <div style={{ fontSize: 14, lineHeight: 1.55 }}>
                    Kuva-analyysi tarvitsee Anthropicin API-avaimen. Käsin kirjaus toimii ilman.
                  </div>
                  <button onClick={onAvaaAsetukset} style={{ ...paanappi, marginTop: 12 }}>
                    Lisää avain asetuksista
                  </button>
                </>
              ) : !kuva ? (
                <KuvanValinta kasittelee={kasittelee} onValitse={valitseKuva} />
              ) : (
                <Esikatselu
                  kuva={kuva}
                  lisatieto={lisatieto}
                  onLisatieto={setLisatieto}
                  malli={malli}
                  kasittelee={kasittelee}
                  onVaihda={valitseKuva}
                  onAnalysoi={analysoi}
                  onPeru={tyhjennaKuva}
                />
              )}
            </div>
          )}

          {tila === "kasin" && (
            <form onSubmit={kirjaaKasin} style={{ marginTop: 14 }}>
              <label style={{ display: "block" }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 5 }}>Ruoka</div>
                <input
                  value={kasin.nimi}
                  onChange={(e) => setKasin({ ...kasin, nimi: e.target.value })}
                  placeholder="esim. Maitorahka 250 g"
                  enterKeyHint="next"
                  style={kentta}
                />
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Lukukentta
                  otsikko="Energia"
                  yksikko="kcal"
                  arvo={kasin.kcal}
                  onChange={(v) => setKasin({ ...kasin, kcal: v })}
                />
                <Lukukentta
                  otsikko="Proteiini"
                  yksikko="g"
                  arvo={kasin.proteiini}
                  onChange={(v) => setKasin({ ...kasin, proteiini: v })}
                />
              </div>
              <button
                type="submit"
                disabled={!kasinKelpaa || tallentaaKasin}
                style={{
                  ...paanappi,
                  marginTop: 14,
                  opacity: !kasinKelpaa || tallentaaKasin ? 0.45 : 1,
                  cursor: kasinKelpaa ? "pointer" : "default",
                }}
              >
                {tallentaaKasin ? "Tallennetaan…" : "Kirjaa ateria"}
              </button>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                Pakkauksen ravintosisältö tai punnittu annos. Ei maksa mitään.
              </div>
            </form>
          )}
        </div>
      )}

      <Virheruutu viesti={virhe} />

      {/* Ateriat */}
      <Otsikko teksti="Ateriat" />
      {lataa ? (
        <div style={{ color: C.muted, fontSize: 14, padding: "4px 2px" }}>Ladataan…</div>
      ) : ateriat.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 14, padding: "4px 2px", lineHeight: 1.55 }}>
          Ei vielä kirjauksia tälle päivälle. Kirjaa ateria kuvasta tai käsin yllä.
        </div>
      ) : (
        <div style={{ ...kortti, padding: 0, overflow: "hidden" }}>
          {ateriat.map((a, i) => {
            const auki = muokattava && muokattava.id === a.id;
            return (
              <div key={a.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                <button
                  onClick={() => avaaMuokkaus(a)}
                  aria-expanded={auki}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "12px 16px",
                    background: auki ? C.bg : "none",
                    border: "none",
                    textAlign: "left",
                    fontFamily: "inherit",
                    color: C.ink,
                    cursor: "pointer",
                  }}
                >
                  <Pikkukuva blob={a.kuva} nimi={a.nimi} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {a.nimi}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {a.aika}
                      {a.lahde === "kasin" && " · käsin"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    <div style={{ fontSize: 15 }}>
                      {a.kcal}
                      <span style={{ fontSize: 12, color: C.muted }}> kcal</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.pine, marginTop: 1 }}>
                      {a.proteiini}
                      <span style={{ fontSize: 12 }}> g</span>
                    </div>
                  </div>
                </button>

                {auki && (
                  <div style={{ padding: "4px 16px 16px", background: C.bg }}>
                    <input
                      value={muokattava.nimi}
                      onChange={(e) => setMuokattava({ ...muokattava, nimi: e.target.value })}
                      aria-label="Ruoka"
                      style={kentta}
                    />
                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                      <Lukukentta
                        otsikko="Energia"
                        yksikko="kcal"
                        arvo={muokattava.kcal}
                        onChange={(v) => setMuokattava({ ...muokattava, kcal: v })}
                      />
                      <Lukukentta
                        otsikko="Proteiini"
                        yksikko="g"
                        arvo={muokattava.proteiini}
                        onChange={(v) => setMuokattava({ ...muokattava, proteiini: v })}
                      />
                    </div>
                    {Number.isFinite(a.aiKcal) && (
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
                        Mallin alkuperäinen arvio: {a.aiKcal} kcal, {a.aiProteiini} g proteiinia
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={tallennaMuokkaus} style={{ ...paanappi, flex: 1 }}>
                        Tallenna
                      </button>
                      <button onClick={() => setMuokattava(null)} style={haamunappi}>
                        Peruuta
                      </button>
                    </div>
                    {/* Kaksivaiheinen poisto: rivin napautus avaa muokkauksen,
                        joten vahingossa osunut sormi ei saa poistaa mitään. */}
                    <div style={{ marginTop: 10, textAlign: "center" }}>
                      {vahvistaPoisto ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => poista(a.id)}
                            style={{ ...haamunappi, flex: 1, color: "#FFF", background: C.red, borderColor: C.red }}
                          >
                            Poista pysyvästi
                          </button>
                          <button onClick={() => setVahvistaPoisto(false)} style={haamunappi}>
                            Älä poista
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setVahvistaPoisto(true)} style={{ ...pikkunappi, color: C.red }}>
                          Poista ateria
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function KuvanValinta({ kasittelee, onValitse }) {
  return (
    <>
      {/* Ei capture-määrettä: näin kuvan voi ottaa tai valita kirjastosta. */}
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          minHeight: 112,
          boxSizing: "border-box",
          border: `1.5px dashed ${C.line}`,
          borderRadius: 10,
          background: C.bg,
          position: "relative",
          cursor: kasittelee ? "default" : "pointer",
          opacity: kasittelee ? 0.6 : 1,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: C.pine }}>
          {kasittelee ? "Käsitellään kuvaa…" : "Ota tai valitse kuva"}
        </span>
        <span style={{ fontSize: 12, color: C.muted }}>Analyysi käynnistyy vasta kun painat Analysoi</span>
        <input
          type="file"
          accept="image/*"
          onChange={onValitse}
          disabled={kasittelee}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
        />
      </label>
    </>
  );
}

function Esikatselu({ kuva, lisatieto, onLisatieto, malli, kasittelee, onVaihda, onAnalysoi, onPeru }) {
  const hinta = arvioiHinta(malli, kuva.leveys, kuva.korkeus);
  const malliNimi = (MALLIT[malli] && MALLIT[malli].nimi) || malli;

  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <img
          src={kuva.esikatselu}
          alt="Valittu kuva"
          style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
        />
        <label style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 5 }}>Lisätieto (valinnainen)</div>
          <input
            value={lisatieto}
            onChange={(e) => onLisatieto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAnalysoi();
            }}
            placeholder="esim. 150 g kanaa, puolet syöty"
            enterKeyHint="go"
            style={kentta}
          />
        </label>
      </div>

      <button onClick={onAnalysoi} style={{ ...paanappi, marginTop: 14 }}>
        Analysoi
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <div style={{ fontSize: 12, color: C.muted }}>
          noin {dollareina(hinta)} $ · {malliNimi}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <label
            style={{
              ...pikkunappi,
              display: "inline-block",
              position: "relative",
              overflow: "hidden",
              opacity: kasittelee ? 0.5 : 1,
            }}
          >
            Vaihda kuva
            <input
              type="file"
              accept="image/*"
              onChange={onVaihda}
              disabled={kasittelee}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
            />
          </label>
          <button onClick={onPeru} style={pikkunappi}>
            Peru
          </button>
        </div>
      </div>
    </>
  );
}

// Kuvallisille aterioille pikkukuva, käsin kirjatuille nimen alkukirjain
// samankokoisessa ruudussa, jotta rivit pysyvät linjassa.
function Pikkukuva({ blob, nimi }) {
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

  const koko = { width: 44, height: 44, borderRadius: 8, flexShrink: 0 };

  if (!url) {
    return (
      <div
        aria-hidden="true"
        style={{
          ...koko,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.pineSoft,
          color: C.pine,
          fontFamily: serif,
          fontSize: 20,
        }}
      >
        {(nimi || "?").trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  return <img src={url} alt="" style={{ ...koko, objectFit: "cover" }} />;
}
