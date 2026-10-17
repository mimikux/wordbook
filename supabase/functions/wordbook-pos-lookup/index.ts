import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

// Wordbook POS service: only the one authenticated Wordbook owner may query.
// No user vocabulary, translation, or private notes are transmitted to dictionary sites.
const ALLOWED_ORIGIN = 'https://mimikux.github.io';
const ALLOWED_PARTS = ['noun', 'verb', 'adjective', 'adverb'];
const posMapping = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb' };
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'Vary': 'Origin',
  'X-Content-Type-Options': 'nosniff',
};
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: CORS });
const cache = new Map();
const normalize = x => String(x || '').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const sortPos = raw => {
  const set = new Set(raw.map(x => posMapping[String(x).trim().toLowerCase()] || '').filter(Boolean));
  return ALLOWED_PARTS.filter(x => set.has(x));
};
async function dictionaryApi(word) {
  const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word);
  const res = await fetch(url, { signal: AbortSignal.timeout(4700), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('dictionary_http_' + res.status);
  const records = await res.json();
  const labels = Array.isArray(records) ? records.flatMap(x => (Array.isArray(x.meanings) ? x.meanings : []).map(m => m.partOfSpeech)) : [];
  const pos = sortPos(labels);
  if (!pos.length) throw new Error('dictionary_empty');
  return { pos, source: 'dictionaryapi.dev' };
}
async function datamuse(word) {
  // Datamuse md=p returns noun/verb/adjective/adverb tags; use exact matches only.
  const url = 'https://api.datamuse.com/words?sp=' + encodeURIComponent(word) + '&md=p&max=25';
  const res = await fetch(url, { signal: AbortSignal.timeout(5700), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('datamuse_http_' + res.status);
  const records = await res.json();
  const exact = Array.isArray(records) ? records.filter(x => normalize(x.word) === word) : [];
  const pos = sortPos(exact.flatMap(x => Array.isArray(x.tags) ? x.tags : []));
  if (!pos.length) throw new Error('datamuse_empty');
  return { pos, source: 'datamuse.com' };
}
async function reliablePOS(word) {
  if (word.includes(' ')) return { pos: ['phrase'], source: 'phrase-rule' };
  const cached = cache.get(word);
  if (cached && cached.until > Date.now()) return cached.result;
  let result;
  try {
    // The fastest reliable source wins. A failed source never blocks the other.
    result = await Promise.any([dictionaryApi(word), datamuse(word)]);
  } catch (_e) {
    result = { pos: [], source: 'not-found' };
  }
  if (cache.size >= 350) cache.delete(cache.keys().next().value);
  cache.set(word, { until: Date.now() + (result.pos.length ? 12 * 3600000 : 600000), result });
  return result;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  const origin = req.headers.get('origin');
  if (origin && origin !== ALLOWED_ORIGIN) return response({ error: 'origin_not_allowed' }, 403);
  const jwt = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return response({ error: 'login_required' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return response({ error: 'server_unavailable' }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth?.user?.id || !auth.user.email_confirmed_at) return response({ error: 'invalid_session' }, 401);
  const { data: allowed, error: allowError } = await admin.from('wordbook_owner_allowlist').select('email').eq('singleton', true).maybeSingle();
  if (allowError || !allowed?.email) return response({ error: 'server_unavailable' }, 503);
  if (normalize(auth.user.email) !== normalize(allowed.email)) return response({ error: 'not_authorized' }, 403);

  const body = await req.json().catch(() => null);
  const word = normalize(body?.word);
  if (!word || word.length > 140 || !/^[a-z][a-z '\-]*$/.test(word)) return response({ error: 'invalid_word' }, 400);
  const result = await reliablePOS(word);
  return response({ ok: true, word, ...result });
});
