const CACHE='pccc-td-v3';
const ASSETS=[
  "./",
  "fonts/baloo-2-latin-500-normal.woff2",
  "fonts/baloo-2-latin-600-normal.woff2",
  "fonts/baloo-2-latin-700-normal.woff2",
  "fonts/baloo-2-latin-800-normal.woff2",
  "fonts/baloo-2-latin-ext-500-normal.woff2",
  "fonts/baloo-2-latin-ext-600-normal.woff2",
  "fonts/baloo-2-latin-ext-700-normal.woff2",
  "fonts/baloo-2-latin-ext-800-normal.woff2",
  "fonts/baloo-2-vietnamese-500-normal.woff2",
  "fonts/baloo-2-vietnamese-600-normal.woff2",
  "fonts/baloo-2-vietnamese-700-normal.woff2",
  "fonts/baloo-2-vietnamese-800-normal.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "index.html",
  "manifest.webmanifest",
  "vendor/CopyShader.js",
  "vendor/EffectComposer.js",
  "vendor/LuminosityHighPassShader.js",
  "vendor/RenderPass.js",
  "vendor/ShaderPass.js",
  "vendor/UnrealBloomPass.js",
  "vendor/three.min.js",
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{if(res.ok&&new URL(e.request.url).origin===location.origin){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}return res;}).catch(()=>caches.match('./'))));});
