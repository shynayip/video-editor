import {defineConfig} from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/build/**"],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5174",
        changeOrigin: true,
      },
    },
  },
});
