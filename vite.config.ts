import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/auspost-barcode/",
  plugins: [react()],
});
