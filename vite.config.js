import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" pitää polut suhteellisina, jotta appi toimii myös
// GitHub Pagesin alipolussa (esim. /ruokapaivakirja/).
export default defineConfig({
  base: "./",
  plugins: [react()],
});
