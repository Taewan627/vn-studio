import type { Express } from 'express';
import { createSharedAiLimiter } from './sharedAiLimit.js';

export function installApiProtection(app: Express, hosted: boolean) {
  // Conference default: instance-local fuse only. Distributed limits require
  // explicit opt-in; provider key credit caps are the independent spending cap.
  const shared = process.env.AI_SHARED_LIMIT_ENABLED === 'true' ? createSharedAiLimiter() : null;
  let active = 0, requests = 0, windowStart = Date.now();
  const resetWindow = () => {
    if (Date.now() - windowStart >= 60_000) { requests = 0; windowStart = Date.now(); }
  };
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  // Compatibility for already-open clients; no code or cookie is required/issued.
  app.get('/api/access', (_req, res) => { res.json({ required: false, authorized: true }); });
  app.post('/api/access', (_req, res) => { res.json({ authorized: true }); });
  app.use('/api/gemini', async (req, res, next) => {
    if (!hosted) { next(); return; }
    if (req.method !== 'POST' || !req.is('application/json')) { res.status(415).json({ error: 'POST application/json required.' }); return; }
    if (!process.env.OPENROUTER_API_KEY?.trim()) { res.status(503).json({ error: 'Missing server setting: OPENROUTER_API_KEY.' }); return; }
    resetWindow();
    if (requests >= 12 || active >= 3) { res.setHeader('Retry-After', '60'); res.status(429).json({ error: 'AI is busy. Please try again shortly.' }); return; }
    active++;
    let released = false;
    const release = () => { if (!released) { released = true; active--; } };
    let admission: Awaited<ReturnType<ReturnType<typeof createSharedAiLimiter>['acquire']>>;
    try { admission = shared ? await shared.acquire() : { allowed: true, release: async () => {} }; }
    catch {
      release(); res.setHeader('Retry-After', '5');
      res.status(503).json({ error: 'Shared AI capacity is unavailable. Retry later or use the sample.' }); return;
    }
    if (admission.allowed === false) {
      release(); res.setHeader('Retry-After', String(admission.retryAfter));
      res.status(429).json({ error: 'AI is busy. Please try again shortly.' }); return;
    }
    requests++;
    // A disconnected client must not free capacity while its upstream request is still running.
    const expiry = setTimeout(release, 270_000);
    expiry.unref();
    res.once('finish', () => { clearTimeout(expiry); release(); });
    // Finish cleanup before ending the response: Vercel can freeze a function
    // immediately afterwards. A disconnected client alone never frees a lease.
    const end = res.end.bind(res);
    const lease = admission;
    let ending = false;
    res.end = ((...args: any[]) => {
      if (!ending) {
        ending = true;
        void lease.release().finally(() => { clearTimeout(expiry); release(); end(...args); });
      }
      return res;
    }) as typeof res.end;
    // Base64 image responses must also fit below the platform's 4.5 MB payload cap.
    const json = res.json.bind(res);
    res.json = ((body: unknown) => {
      const serialized = JSON.stringify(body);
      if (Buffer.byteLength(serialized ?? '') > 4_000_000) {
        res.status(413); return json({ error: 'Generated result exceeds the hosted payload limit. Use the local Full Studio for large images.' });
      }
      return json(body);
    }) as typeof res.json;
    next();
  });
}
