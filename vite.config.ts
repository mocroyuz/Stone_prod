import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  // Expose only VITE_* variables to the frontend. `PUBLIC_*` is intentionally
  // not used to avoid leaking non-public configuration to the browser.
  envPrefix: ["VITE_"],

  plugins: [react(), tailwindcss()],

  // Same-origin proxy so the HttpOnly refresh cookie works in local development too.
  server: {
    proxy: {
      "/api": {
        target: "https://stone-serv.onrender.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
