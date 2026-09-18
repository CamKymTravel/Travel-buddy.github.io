const CACHE_PREFIX='travel-buddy-v1-';
const CACHE='travel-buddy-v1-0.9.2';
const PRECACHE=['./','./index.html','./manifest.webmanifest','./styles.css','./app.js','./db.js','./logic.js','./country-data.js','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const hit=await cache.match(event.request);
    if(hit)return hit;
    try{
      const res=await fetch(event.request);
      if(res&&res.status===200&&res.type!=='opaque')cache.put(event.request,res.clone());
      return res;
    }catch{
      if(event.request.mode==='navigate')return (await cache.match('./index.html'))||new Response('Travel Buddy is unavailable offline.',{status:503,headers:{'Content-Type':'text/plain'}});
      return new Response('',{status:503,statusText:'Offline'});
    }
  })());
});
