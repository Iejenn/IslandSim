import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/, so asset URLs need that prefix.
  base: '/IslandSim/',
  build: {
    // three.js alone is ~650 kB minified; splitting it buys nothing for a one-page game.
    chunkSizeWarningLimit: 800,
  },
});
