// Only cache public app assets; NEVER cache Supabase API responses, auth URLs or private words.
const CACHE='wordbook-public-shell-v3.5';
const PUBLIC_FILES=['./','./index.html','./styles.css','./app.js','./cloud.js','./catalog.js','./audio-pack.js','./site-config.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./voice-test.html','./assets/voice-test.mp3'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PUBLIC_FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 e.respondWith(fetch(req).then(response=>{
   if(response.ok&&PUBLIC_FILES.some(path=>new URL(path,self.registration.scope).href===req.url)){
     caches.open(CACHE).then(c=>c.put(req,response.clone())).catch(()=>{});
   }
   return response;
 }).catch(()=>caches.match(req)));
});
