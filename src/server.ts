import express from 'express';
import path from 'node:path';
import { createApiApp } from './server/app';

async function startServer() {
  const app = createApiApp();
  // Apply the same restrictive policy used in the offline validation baseline.
  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'none'; connect-src 'self'; frame-src 'none'; form-action 'none'; base-uri 'none'");
    next();
  });
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { dotfiles: 'deny' }));
    app.get('*all', (req, res) => {
      // Missing optional assets remain real 404s; never fabricate their content.
      if (path.extname(req.path)) { res.sendStatus(404); return; }
      // A controlled relative file/root works in this hidden private directory.
      res.sendFile('index.html', { root: distPath, dotfiles: 'deny' });
    });
  }
  app.listen(Number(process.env.PORT) || 3000, '127.0.0.1', () => { console.log('VN Studio server ready'); });
}
startServer().catch(() => { console.error('Server startup failed (details omitted)'); process.exitCode = 1; });
