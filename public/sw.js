const CACHE='ds-balance-v1';
const ASSETS=['/','/index.html','/manifest.json','/icon-192.png','/icon-512.png'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  // never cache api
  if(url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      const fetched = fetch(e.request).then(r=>{
        if(r.ok) caches.open(CACHE).then(c=>c.put(e.request, r.clone()));
        return r;
      }).catch(()=>cached);
      return cached || fetched;
    })
  );
});
