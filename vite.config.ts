import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages sirve la app en /santafe-app/.
export default defineConfig({
  base: "/santafe-app/",
  plugins: [react()],
});
