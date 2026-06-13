/* トリアージ訓練 スマホ版 PWA Service Worker */
/* アプリ更新時は CACHE_VERSION を上げること（古いキャッシュを自動削除します） */
const CACHE_VERSION = 'triage-v1';

/* オフラインで動かすために事前キャッシュするファイル */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

/* インストール時：必要ファイルをキャッシュ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      /* アイコン未配置でも失敗させないため個別に追加 */
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

/* 有効化時：古いバージョンのキャッシュを削除 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* 取得時の戦略 */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  /* GET 以外（結果送信の POST など）はキャッシュせずネットワークへ */
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* 別オリジン（Googleスプレッドシート送信など）はネットワーク優先 */
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  /* 同一オリジン：キャッシュ優先＋裏で更新（stale-while-revalidate） */
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
