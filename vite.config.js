import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Buildin tunniste: lyhyt commit-hash, tai "dev" jos gitiä ei ole käytettävissä
// (esim. purettu zip). Actions-ajossa checkout tuo HEADin, joten tämä toimii
// myös fetch-depth 1:llä.
function commitTunnus() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch (e) {
    return "dev";
  }
}

const VERSIO = commitTunnus();
const KAANNETTY = new Date().toISOString();

// Sama versiotieto kahteen paikkaan: bundleen (mitä appi nyt ajaa) ja erilliseen
// versio.json-tiedostoon (mitä palvelimella on). Asetusnäkymä vertaa näitä, ja
// ero tarkoittaa että päivitys odottaa.
function versiotiedosto() {
  return {
    name: "versiotiedosto",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "versio.json",
        source: JSON.stringify({ versio: VERSIO, kaannetty: KAANNETTY }),
      });
    },
  };
}

// base: "./" pitää polut suhteellisina, jotta appi toimii myös
// GitHub Pagesin alipolussa (esim. /ruokapaivakirja/).
export default defineConfig({
  base: "./",
  plugins: [react(), versiotiedosto()],
  define: {
    __VERSIO__: JSON.stringify(VERSIO),
    __KAANNETTY__: JSON.stringify(KAANNETTY),
  },
});
