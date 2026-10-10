const CACHE_PREFIX='travel-buddy-v1-';
const CACHE='travel-buddy-v1-0.10.10-bxpink-xxviii-build-test-20261009';
const PRECACHE=['./','./index.html','./manifest.webmanifest','./styles.css','./app.js','./product-art.js','./db.js','./logic.js','./country-data.js','./sw.js','./travel-buddy-pink-180.png','./travel-buddy-pink-192.png','./travel-buddy-pink-512.png'];
const OFFLINE_HTML="<!doctype html><html lang=\"en-AU\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><meta name=\"theme-color\" content=\"#120912\"><title>Travel Buddy Offline</title><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#120912;color:#fff5fa;font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Display\",\"Segoe UI\",sans-serif}body{display:grid;place-items:center;padding:24px}.card{width:min(100%,420px);border:1.5px solid #7e465f;border-top-color:#ef82b5;border-radius:24px;background:linear-gradient(150deg,#21131d,#100a10 82%);padding:26px;text-align:center}.mark{width:76px;height:76px;margin:0 auto 14px;border:1.5px solid #98516f;border-radius:22px;background:#120912;display:grid;place-items:center;color:#ff92c4;font-size:36px}.eyebrow{margin:0 0 6px;color:#f08fbc;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:0 0 10px;font-size:28px}p{margin:0;color:#d2b5c3;line-height:1.5}</style><body><main class=\"card\"><div class=\"mark\">\u2726</div><p class=\"eyebrow\">Travel Buddy</p><h1>You\u2019re offline</h1><p>Travel Buddy could not load this screen from the offline cache. Reopen the app when the connection is available.</p></main></body></html>";
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
      if(event.request.mode==='navigate')return (await cache.match('./index.html'))||new Response(OFFLINE_HTML,{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
      return new Response('',{status:503,statusText:'Offline'});
    }
  })());
});
