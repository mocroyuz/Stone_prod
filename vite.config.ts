import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  // Expose only VITE_* variables to the frontend. `PUBLIC_*` is intentionally
  // not used to avoid leaking non-public configuration to the browser.
  envPrefix: ["VITE_"],

  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
