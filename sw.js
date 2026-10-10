const CACHE = 'icpc-studio-v6';
const SHELL = ['/index.html','/wordbook.html','/notes.html','/base.css','/studio.css','/home.css','/styles.css','/notes.css','/display-init.js','/common.js','/i18n.js','/data-client.js','/api.js','/home.js','/app.js','/notes.js','/config.example.js','/assets/mark.svg','/vendor/marked.min.js','/vendor/purify.min.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  // Never store user records. Cache only the public application shell.
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(url.pathname==='/'?'/index.html':url.pathname,response.clone());}return response;}).catch(()=>caches.match(url.pathname==='/'?'/index.html':url.pathname)));
    return;
  }
  if(!/\.(?:js|css|svg)$/.test(url.pathname))return;
  const refresh=fetch(event.request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());}return response;});
  event.waitUntil(refresh.catch(()=>{}));
  event.respondWith(caches.match(event.request).then(cached=>cached||refresh));
});
