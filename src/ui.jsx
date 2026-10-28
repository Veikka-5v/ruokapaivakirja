import React from "react";

// Paletti. Viileä harmaa pohja, jolta valkoiset kortit erottuvat, ja yksi
// aksentti (mänty). Proteiini on aksenttivärillä, koska sitä appi on
// ensisijaisesti tehty seuraamaan.
export const C = {
  bg: "#ECEEF1",
  surface: "#FFFFFF",
  ink: "#1E2126",
  muted: "#666C76", // 5,3:1 valkoista vasten
  faint: "#9AA0A9",
  line: "#DFE2E7",
  pine: "#2F6F5E",
  pineSoft: "#E3EFEA",
  amber: "#B45309",
  red: "#9F3A38",
  redSoft: "#F6E6E5",
};

// Numerot serifillä: summat ovat näkymän tärkein asia ja ainoa paikka, jossa
// typografia saa näkyä.
export const serif = "Georgia, 'Iowan Old Style', serif";

export const kortti = {
  background: C.surface,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  padding: 16,
};

export const kentta = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "11px 12px",
  fontSize: 16, // alle 16px saa iOS:n zoomaamaan kenttään
  color: C.ink,
  background: "#FFF",
  outlineColor: C.pine,
  fontFamily: "inherit",
};

// boxSizing on pakollinen, koska näitä tyylejä käytetään myös <label>-
// elementeissä (tiedostosyötteen kuori). <button> saa border-boxin
// selaimelta, <label> ei — ilman tätä width:100% + padding menee yli.
// minHeight 44 px: Applen suositus kosketuskohteen minimikooksi.
export const paanappi = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 46,
  background: C.pine,
  color: "#FFF",
  border: "none",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 15,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
};

export const haamunappi = {
  boxSizing: "border-box",
  minHeight: 46,
  background: "#FFF",
  color: C.ink,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "12px 16px",
  fontSize: 14,
  fontFamily: "inherit",
  cursor: "pointer",
};

export const pikkunappi = {
  background: "none",
  border: "none",
  color: C.muted,
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer",
  padding: "8px 4px",
};

export const navinappi = {
  background: C.surface,
  border: `1px solid ${C.line}`,
  borderRadius: 999,
  width: 40,
  height: 40,
  fontSize: 20,
  lineHeight: 1,
  color: C.ink,
  cursor: "pointer",
  flexShrink: 0,
};

export function Summa({ otsikko, arvo, korostus }) {
  return (
    <div style={{ flex: 1, padding: "22px 12px 4px", textAlign: "center" }}>
      <div
        style={{
          fontFamily: serif,
          fontSize: 44,
          lineHeight: 1,
          letterSpacing: -0.5,
          color: korostus ? C.pine : C.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {arvo}
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>{otsikko}</div>
    </div>
  );
}

export function Lukukentta({ otsikko, arvo, onChange, yksikko, placeholder, autoFocus }) {
  return (
    <label style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 5 }}>{otsikko}</div>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={arvo}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...kentta, paddingRight: yksikko ? 44 : 12, fontVariantNumeric: "tabular-nums" }}
        />
        {yksikko && (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
              color: C.faint,
              pointerEvents: "none",
            }}
          >
            {yksikko}
          </span>
        )}
      </div>
    </label>
  );
}

// Kahden tai useamman vaihtoehdon valitsin. Valittu saa pohjavärin eikä
// pelkkää alleviivausta, jotta tila näkyy myös vilkaisulla.
export function Segmentti({ vaihtoehdot, arvo, onChange }) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        background: C.bg,
        borderRadius: 9,
        padding: 3,
        gap: 3,
      }}
    >
      {vaihtoehdot.map((v) => {
        const valittu = v.id === arvo;
        return (
          <button
            key={v.id}
            role="tab"
            aria-selected={valittu}
            onClick={() => onChange(v.id)}
            style={{
              flex: 1,
              minHeight: 38,
              border: "none",
              borderRadius: 7,
              background: valittu ? C.surface : "transparent",
              boxShadow: valittu ? "0 1px 2px rgba(30,33,38,0.12)" : "none",
              color: valittu ? C.ink : C.muted,
              fontSize: 14,
              fontWeight: valittu ? 600 : 500,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {v.nimi}
          </button>
        );
      })}
    </div>
  );
}

export function Virheruutu({ viesti, children }) {
  if (!viesti) return null;
  return (
    <div
      style={{
        ...kortti,
        marginTop: 12,
        background: C.redSoft,
        borderColor: "transparent",
        color: C.red,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      {viesti}
      {children}
    </div>
  );
}

export function Otsikko({ teksti, oikealla }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        margin: "26px 2px 10px",
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600, color: C.ink, margin: 0 }}>{teksti}</h2>
      {oikealla && <div style={{ fontSize: 13, color: C.muted }}>{oikealla}</div>}
    </div>
  );
}

export function Rivi({ nimi, arvo, vihje }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        padding: "7px 0",
      }}
    >
      <div style={{ fontSize: 14, minWidth: 0 }}>
        {nimi}
        {vihje && (
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>{vihje}</div>
        )}
      </div>
      <div style={{ fontFamily: serif, fontSize: 17, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {arvo}
      </div>
    </div>
  );
}
