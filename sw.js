/* Wordbook offline PWA shell v3.11. Never cache credentials, Supabase API
 * responses, private words, login codes, or Google Translate requests.
 * Private words live ONLY in per-user IndexedDB, cleared on explicit logout.
 */
const CACHE = 'wordbook-public-shell-v3.11';
const PUBLIC_FILES = [
  './','./index.html','./styles.css','./app.js','./cloud.js','./sync-policy.js',
  './catalog.js','./audio-pack.js','./site-config.js',
  './manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png',
  './voice-test.html','./assets/voice-test.mp3'
];
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.74.0';

self.addEventListener('install', event => event.waitUntil((async()=>{
  const cache = await caches.open(CACHE);
  // A missing local file must fail installation rather than claim offline-ready.
  await cache.addAll(PUBLIC_FILES);
  // Script is third-party no-cors and returns an opaque Response; Cache.put
  // supports it. This permits offline reload without modifying the app vendor.
  try {
    const request = new Request(SUPABASE_CDN,{mode:'no-cors',cache:'reload'});
    const response = await fetch(request);
    await cache.put(request,response);
  }catch(error){console.warn('CDN not yet pre-cached; retry on online visit',error);}
  await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith('wordbook-public-shell-')&&n!==CACHE)
    .map(n=>caches.delete(n)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  if(url.href===SUPABASE_CDN){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const match=await cache.match(req,{ignoreSearch:true});
      if(match)return match;
      try{
        const response=await fetch(req);
        // An opaque response is valid to cache (but not safe to inspect).
        if(response.ok||response.type==='opaque')await cache.put(req,response.clone());
        return response;
      }catch(error){throw error;}
    })());
    return;
  }

  if(url.origin!==self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  // The SW handles only explicitly enumerated PUBLIC assets.
  const isShell=PUBLIC_FILES.some(path=>new URL(path,self.registration.scope).pathname===url.pathname);
  if(!isShell)return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(req);
      if(response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(new URL(url.pathname,self.location.origin).href,response.clone());
      }
      return response;
    }catch(error){
      const saved=await caches.match(req,{ignoreSearch:true});
      if(saved)return saved;
      throw error;
    }
  })());
});
