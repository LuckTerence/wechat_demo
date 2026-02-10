import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig({
  plugins: [uni()],
  cacheDir: "node_modules/.vite-uni",
  server: {
    warmup: {
      clientFiles: ["./src/pages/index/index.vue"],
    },
  },
  build: {
    sourcemap: false,
    reportCompressedSize: false,
  },
});
