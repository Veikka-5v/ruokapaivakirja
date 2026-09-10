import React from "react";

export const C = {
  bg: "#F2F3F5",
  surface: "#FFFFFF",
  ink: "#22252A",
  muted: "#767C86",
  line: "#DEE1E6",
  pine: "#2F6F5E",
  amber: "#B45309",
  red: "#9F3A38",
};

export const serif = "Georgia, 'Iowan Old Style', serif";

export const kortti = {
  background: C.surface,
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  padding: 14,
};

export const kentta = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 16, // alle 16px saa iOS:n zoomaamaan kenttään
  color: C.ink,
  background: "#FFF",
  outlineColor: C.pine,
};

// boxSizing on pakollinen, koska näitä tyylejä käytetään myös <label>-
// elementeissä (tiedostosyötteen kuori). <button> saa border-boxin
// selaimelta, <label> ei — ilman tätä width:100% + padding menee yli.
export const paanappi = {
  width: "100%",
  boxSizing: "border-box",
  background: C.pine,
  color: "#FFF",
  border: "none",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};

export const haamunappi = {
  boxSizing: "border-box",
  background: "#FFF",
  color: C.ink,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "12px 16px",
  fontSize: 14,
  cursor: "pointer",
};

export const pikkunappi = {
  background: "none",
  border: "none",
  color: C.muted,
  fontSize: 12,
  cursor: "pointer",
  padding: "4px 2px",
};

export const navinappi = {
  background: "#FFF",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  width: 38,
  height: 38,
  fontSize: 20,
  lineHeight: 1,
  color: C.ink,
  cursor: "pointer",
};

export function Summa({ otsikko, arvo, korostus }) {
  return (
    <div style={{ flex: 1, padding: "18px 16px", textAlign: "center" }}>
      <div
        style={{
          fontFamily: serif,
          fontSize: 38,
          lineHeight: 1,
          color: korostus ? C.pine : C.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {arvo}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{otsikko}</div>
    </div>
  );
}

export function Lukukentta({ otsikko, arvo, onChange }) {
  return (
    <label style={{ flex: 1 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{otsikko}</div>
      <input
        type="number"
        inputMode="numeric"
        value={arvo}
        onChange={(e) => onChange(e.target.value)}
        style={kentta}
      />
    </label>
  );
}

export function Virheruutu({ viesti, children }) {
  if (!viesti) return null;
  return (
    <div
      style={{
        ...kortti,
        marginTop: 12,
        borderColor: C.red,
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

export function Otsikko({ teksti }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: C.muted,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        margin: "22px 2px 8px",
      }}
    >
      {teksti}
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
