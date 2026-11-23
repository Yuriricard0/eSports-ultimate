self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    try{await cache.addAll(ASSETS.map(path=>new Request(path,{cache:'reload'})));}
    catch(error){await caches.delete(CACHE);throw error;}
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys()){
      if(key.startsWith('uem-offline-')&&key!==CACHE)await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const page=event.request.mode==='navigate'&&['/','/index.html'].includes(url.pathname);
  if(!page&&!ASSETS.includes(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    return await cache.match(page?'/index.html':url.pathname)??fetch(event.request);
  })());
});
