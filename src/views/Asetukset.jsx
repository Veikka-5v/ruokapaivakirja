import React, { useState, useEffect } from "react";
import { kaikkiAteriat, korvaaKaikkiAteriat } from "../db.js";
import { MALLIT, OLETUSMALLI, hintaDollareina } from "../api.js";
import { C, kortti, kentta, paanappi, haamunappi, serif, Otsikko, Rivi, Virheruutu } from "../ui.jsx";

function naytaAvain(avain) {
  if (!avain) return "";
  if (avain.length <= 12) return "…";
  return `${avain.slice(0, 8)}…${avain.slice(-4)}`;
}

function dollareina(arvo, desimaalit = 3) {
  return arvo.toFixed(desimaalit).replace(".", ",");
}

export default function Asetukset({ apiAvain, malli, onVaihdaAvain, onVaihdaMalli }) {
  const [luonnos, setLuonnos] = useState("");
  const [viesti, setViesti] = useState("");
  const [virhe, setVirhe] = useState("");
  const [kaytto, setKaytto] = useState(null);

  useEffect(() => {
    let peruttu = false;
    (async () => {
      try {
        const kaikki = await kaikkiAteriat();
        if (peruttu) return;
        const analysoidut = kaikki.filter((a) => a.sisaanTokenit || a.ulosTokenit);
        const summa = analysoidut.reduce(
          (s, a) => s + hintaDollareina(a.malli || OLETUSMALLI, a.sisaanTokenit, a.ulosTokenit),
          0
        );
        setKaytto({ n: analysoidut.length, summa, ateriat: kaikki.length });
      } catch (e) {
        if (!peruttu) setVirhe("Käyttötietojen lukeminen epäonnistui.");
      }
    })();
    return () => {
      peruttu = true;
    };
  }, []);

  async function tallennaAvain() {
    const puhdas = luonnos.trim();
    if (!puhdas) return;
    setVirhe("");
    try {
      await onVaihdaAvain(puhdas);
      setLuonnos("");
      setViesti("Avain tallennettu tälle laitteelle.");
    } catch (e) {
      setVirhe("Avaimen tallennus epäonnistui.");
    }
  }

  async function poistaAvain() {
    setVirhe("");
    try {
      await onVaihdaAvain("");
      setViesti("Avain poistettu.");
    } catch (e) {
      setVirhe("Avaimen poisto epäonnistui.");
    }
  }

  async function vieData() {
    setVirhe("");
    try {
      const kaikki = await kaikkiAteriat();
      // Pikkukuvat jätetään pois: ne ovat Blobeja eivätkä kuulu JSONiin.
      const ilmanKuvia = kaikki.map(({ kuva, ...loput }) => loput);
      const sisalto = JSON.stringify(
        { versio: 1, viety: new Date().toISOString(), ateriat: ilmanKuvia },
        null,
        2
      );
      const blob = new Blob([sisalto], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ruokapaivakirja-varmuuskopio.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setViesti(`${ilmanKuvia.length} ateriaa viety.`);
    } catch (e) {
      setVirhe("Vienti epäonnistui.");
    }
  }

  async function tuoData(ev) {
    const tiedosto = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!tiedosto) return;
    setVirhe("");
    setViesti("");
    try {
      const teksti = await tiedosto.text();
      const data = JSON.parse(teksti);
      const lista = Array.isArray(data) ? data : data.ateriat;
      if (!Array.isArray(lista)) throw new Error("muoto");
      const kelvolliset = lista.filter((a) => a && a.id && a.pvm);
      if (kelvolliset.length === 0) throw new Error("tyhjä");
      if (
        !window.confirm(
          `Tuodaan ${kelvolliset.length} ateriaa. Tämä korvaa kaikki nykyiset kirjaukset. Jatketaanko?`
        )
      ) {
        return;
      }
      await korvaaKaikkiAteriat(kelvolliset);
      setViesti(`${kelvolliset.length} ateriaa tuotu. Päivitä näkymä välilehdeltä.`);
    } catch (e) {
      setVirhe("Tuonti epäonnistui. Tarkista että tiedosto on tämän sovelluksen varmuuskopio.");
    }
  }

  return (
    <>
      <Otsikko teksti="API-avain" />
      <div style={kortti}>
        {apiAvain ? (
          <>
            <div style={{ fontSize: 14 }}>
              Avain tallennettu:{" "}
              <span style={{ fontFamily: "ui-monospace, monospace", color: C.muted }}>
                {naytaAvain(apiAvain)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                type="password"
                value={luonnos}
                onChange={(e) => setLuonnos(e.target.value)}
                placeholder="Vaihda avain"
                autoComplete="off"
                style={{ ...kentta, flex: 1 }}
              />
              <button onClick={tallennaAvain} disabled={!luonnos.trim()} style={{ ...haamunappi, opacity: luonnos.trim() ? 1 : 0.5 }}>
                Vaihda
              </button>
            </div>
            <button onClick={poistaAvain} style={{ ...haamunappi, width: "100%", marginTop: 8, color: C.red }}>
              Poista avain laitteelta
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 12 }}>
              Liitä Anthropicin API-avain. Se tallennetaan vain tämän laitteen selaimeen eikä
              lähde mihinkään muualle kuin Anthropicin rajapintaan.
            </div>
            <input
              type="password"
              value={luonnos}
              onChange={(e) => setLuonnos(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              style={kentta}
            />
            <button onClick={tallennaAvain} disabled={!luonnos.trim()} style={{ ...paanappi, marginTop: 10, opacity: luonnos.trim() ? 1 : 0.5 }}>
              Tallenna avain
            </button>
          </>
        )}
        <div style={{ fontSize: 12, color: C.muted, marginTop: 12, lineHeight: 1.55 }}>
          Avain on luettavissa tämän laitteen selaimen kehitystyökaluilla. Luo appia varten oma
          workspace ja sille oma avain, jolle asetat kulutusrajan Anthropicin konsolissa &mdash;
          se on ainoa asia, joka oikeasti rajoittaa vahinkoa.
        </div>
      </div>

      <Otsikko teksti="Malli" />
      <div style={kortti}>
        {Object.entries(MALLIT).map(([id, m]) => (
          <label
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 0",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="malli"
              checked={malli === id}
              onChange={() => onVaihdaMalli(id)}
              style={{ accentColor: C.pine }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14 }}>
                {m.nimi}{" "}
                <span style={{ color: C.muted, fontSize: 12 }}>({m.kuvaus})</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {m.sisaan} $ / {m.ulos} $ per miljoona tokenia
              </div>
            </div>
          </label>
        ))}
      </div>

      <Otsikko teksti="Kulutus" />
      <div style={kortti}>
        {!kaytto ? (
          <div style={{ fontSize: 14, color: C.muted }}>Ladataan…</div>
        ) : kaytto.n === 0 ? (
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
            Ei vielä analyysejä. Todellinen hinta näkyy tässä ensimmäisen kuvan jälkeen.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.1 }}>
              {dollareina(kaytto.summa)} $
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
              yhteensä {kaytto.n} analyysistä
            </div>
            {kaytto.summa > 0 && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
                <Rivi
                  nimi="Keskihinta / analyysi"
                  arvo={`${dollareina(kaytto.summa / kaytto.n, 4)} $`}
                />
                <Rivi
                  nimi="Analyysejä 5 $:lla"
                  arvo={`noin ${Math.round(5 / (kaytto.summa / kaytto.n))}`}
                  vihje="oman toteutuneen keskihintasi mukaan"
                />
              </div>
            )}
          </>
        )}
      </div>

      <Otsikko teksti="Data" />
      <div style={kortti}>
        <button onClick={vieData} style={{ ...haamunappi, width: "100%" }}>
          Vie varmuuskopio (JSON)
        </button>
        <label
          style={{
            ...haamunappi,
            width: "100%",
            boxSizing: "border-box",
            marginTop: 8,
            display: "block",
            textAlign: "center",
            position: "relative",
          }}
        >
          Tuo varmuuskopio
          <input
            type="file"
            accept="application/json,.json"
            onChange={tuoData}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
          />
        </label>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.55 }}>
          Varmuuskopio sisältää kirjaukset mutta ei pikkukuvia. Tuonti korvaa kaikki nykyiset
          kirjaukset.
        </div>
      </div>

      {viesti && (
        <div style={{ ...kortti, marginTop: 12, fontSize: 14, color: C.pine }}>{viesti}</div>
      )}
      <Virheruutu viesti={virhe} />

      <p style={{ fontSize: 12, color: C.muted, marginTop: 20, lineHeight: 1.6 }}>
        Kaikki data on tässä selaimessa. Selaimen tietojen tyhjentäminen poistaa myös kirjaukset,
        joten ota varmuuskopio silloin tällöin.
      </p>
    </>
  );
}
