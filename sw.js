/* Run For Ăn · service worker v1.63
   Lưu sẵn file app trên máy để mở tức thì. Mỗi lần mở: hiện bản đã lưu ngay, đồng thời tải bản mới từ GitHub;
   nếu file app khác bản đã lưu thì báo cho app hiện dòng "Có bản cập nhật mới".
   Không đụng tới dữ liệu (máy chủ Google Apps Script luôn được gọi trực tiếp). */
const CACHE = 'rfa-app';
const FONT_CACHE = 'rfa-font';
let updated = false; // đã thấy bản mới trong lần mở này (app hỏi lại khi vừa chạy xong)
self.addEventListener('message', e => { if (e.data && e.data.rfaAsk && updated) { updated = false; e.source && e.source.postMessage({ rfaUpdate: 1 }); } });

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Phông chữ Google: lấy từ máy nếu đã có
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  e.respondWith(caches.open(CACHE).then(async c => {
    const key = isPage ? new URL('./', self.registration.scope).href : req;
    const hit = await c.match(key);
    const hitCopy = hit && isPage ? hit.clone() : null; // bản sao để so sánh (bản gốc trả về cho app)
    // Trang chính: gọi lại bằng địa chỉ (không dùng lại yêu cầu điều hướng) để luôn hỏi GitHub bản mới nhất
    const net = fetch(isPage ? url.href : req, { cache: 'no-cache', credentials: 'same-origin' }).then(async r => {
      if (r.ok) {
        if (isPage && hitCopy) {
          const [a, b] = await Promise.all([hitCopy.text(), r.clone().text()]);
          if (a !== b) {
            await c.put(key, r.clone());
            updated = true;
            const cs = await self.clients.matchAll({ type: 'window' });
            cs.forEach(cl => cl.postMessage({ rfaUpdate: 1 }));
            return r;
          }
        }
        await c.put(key, r.clone());
      }
      return r;
    }).catch(() => hit);
    if (hit) { e.waitUntil(net); return hit; }
    return net;
  }));
});
