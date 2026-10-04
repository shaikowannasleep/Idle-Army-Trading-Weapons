import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` inlines every asset into one HTML file (playable-ad networks).
export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: 'es2020',
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    chunkSizeWarningLimit: 2000,
  },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
}));
