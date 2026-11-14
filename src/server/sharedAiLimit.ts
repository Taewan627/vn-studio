import { randomUUID } from 'node:crypto';

// One atomic admission across every function instance using the same Redis DB.
// TIME uses the store's clock. Members are random request IDs, never user data.
export const ADMIT_AI_LUA = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 60000)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
local wait = 0
if redis.call('ZCARD', KEYS[1]) >= 12 then
  local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  wait = math.max(wait, tonumber(first[2]) + 60000 - now)
end
if redis.call('ZCARD', KEYS[2]) >= 3 then
  local first = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
  wait = math.max(wait, tonumber(first[2]) - now)
end
if wait > 0 then return {0, math.max(1, math.ceil(wait / 1000))} end
redis.call('ZADD', KEYS[1], now, ARGV[1])
redis.call('EXPIRE', KEYS[1], 60)
redis.call('ZADD', KEYS[2], now + 270000, ARGV[1])
redis.call('EXPIRE', KEYS[2], 270)
return {1, 0}
`;

type Admission = { allowed: false; retryAfter: number } | { allowed: true; release: () => Promise<void> };
type Fetcher = typeof fetch;

export function createSharedAiLimiter(env: NodeJS.ProcessEnv = process.env, send: Fetcher = (input, init) => fetch(input, init)) {
  const endpoint = env.UPSTASH_REDIS_REST_URL || '';
  const token = env.UPSTASH_REDIS_REST_TOKEN || '';
  let validEndpoint = false;
  try {
    const url = new URL(endpoint);
    validEndpoint = url.protocol === 'https:' && url.hostname.endsWith('.upstash.io') &&
      !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  } catch {}
  const project = env.VERCEL_PROJECT_ID || 'local';
  const environment = env.VERCEL_ENV || 'local';
  // Redis hash tag keeps both keys in one slot. Preview and Production separate;
  // deployment IDs are deliberately omitted so rolling deployments share limits.
  const namespace = `ibis2026:{${project}:${environment}}`;
  const rateKey = namespace + ':ai:minute';
  const leaseKey = namespace + ':ai:active';

  async function command(args: string[]) {
    if (!validEndpoint || !token.trim() || !/^[a-zA-Z0-9_-]+$/.test(project) || !/^[a-zA-Z0-9_-]+$/.test(environment)) {
      throw new Error('Shared AI capacity configuration missing or invalid');
    }
    const response = await send(endpoint, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), redirect: 'error', signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('Shared AI capacity unavailable'); }
    const envelope = await response.json();
    if (envelope.error || !Object.hasOwn(envelope, 'result')) throw new Error('Shared AI capacity unavailable');
    return envelope.result;
  }

  return {
    async acquire(): Promise<Admission> {
      const id = randomUUID();
      const result = await command(['EVAL', ADMIT_AI_LUA, '2', rateKey, leaseKey, id]);
      if (!Array.isArray(result) || result.length !== 2 || ![0, 1].includes(result[0]) ||
          !Number.isInteger(result[1]) || result[1] < 0 || result[1] > 270 ||
          (result[0] === 0 && result[1] < 1) || (result[0] === 1 && result[1] !== 0)) {
        throw new Error('Shared AI capacity unavailable');
      }
      if (result[0] === 0) return { allowed: false, retryAfter: result[1] };
      let released = false;
      return { allowed: true, async release() {
        if (released) return;
        released = true;
        // Cleanup failure keeps the lease until its TTL; never open capacity on
        // an uncertain store result. No raw store error or secret is logged.
        try { await command(['ZREM', leaseKey, id]); } catch {}
      } };
    },
  };
}
