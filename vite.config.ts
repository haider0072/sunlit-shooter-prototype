import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0"
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/")) return "three";
          if (id.includes("node_modules/postprocessing/")) return "postprocessing";
          if (id.includes("node_modules/peerjs/")) return "peerjs";
          if (id.includes("node_modules/three-mesh-bvh/")) return "bvh";
          if (id.includes("node_modules/")) return "vendor";
          return undefined;
        }
      }
    }
  }
});
