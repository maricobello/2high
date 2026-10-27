// Guarda o jogo para abrir sem internet. O build troca __CACHE__ por um nome
// novo a cada versão, e a versão antiga é apagada ao ativar.
const CACHE = "__CACHE__";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icons/icon-192.png", "icons/icon-512.png", "privacidade.html", "suporte.html", "paginas.css"];

self.addEventListener("install", (e) => {
  // cache: "reload" ignora o cache HTTP: a versão nova nunca guarda o jogo antigo
  const fresh = FILES.map((f) => new Request(f, { cache: "reload" }));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
