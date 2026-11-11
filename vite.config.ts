
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  // Autorise l'accès aux variables VITE_* et PUBLIC_*
  // depuis le frontend via import.meta.env.
  envPrefix: ["VITE_", "PUBLIC_"],

  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
