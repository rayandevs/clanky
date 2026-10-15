import { cpSync, createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Serves folders that live outside the dashboard: the bot's Twemoji icons
 * (shared with the image cards) and, in demo mode, sample card images.
 */
function mount(folders: Record<string, string>): Plugin {
  let outDir = 'dist';
  return {
    name: 'clanky-mount',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]!;
        for (const [prefix, dir] of Object.entries(folders)) {
          if (!url.startsWith(`/${prefix}/`)) continue;
          const file = path.join(dir, path.basename(url));
          if (!existsSync(file)) break;
          res.setHeader('Content-Type', file.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
          createReadStream(file).pipe(res);
          return;
        }
        next();
      });
    },
    closeBundle() {
      for (const [prefix, dir] of Object.entries(folders)) cpSync(dir, path.resolve(outDir, prefix), { recursive: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  const folders: Record<string, string> = { icons: path.resolve(import.meta.dirname, '../assets/icons') };
  if (demo) folders.demo = path.resolve(import.meta.dirname, 'demo');
  return {
    plugins: [react(), tailwindcss(), mount(folders)],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    // Demo builds run inside a preview iframe, so assets must be relative.
    base: demo ? './' : '/',
    build: { outDir: demo ? 'dist-demo' : 'dist', emptyOutDir: true },
    server: {
      port: 5173,
      proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
    },
  };
});
