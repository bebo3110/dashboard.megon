// أدوات مشتركة للتعامل مع Supabase من السيرفر
const bad = (m, status = 400) => Object.assign(new Error(m), { status, client: true });

function env() {
  const e = {
    url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    pub: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    sec: process.env.SUPABASE_SECRET_KEY || '',
    admin: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  };
  if (!e.url || !e.pub || !e.sec || !e.admin) throw new Error('missing env vars');
  return e;
}

// المفاتيح الجديدة (sb_...) بتتبعت في apikey بس، والقديمة (JWT) كمان في Authorization
const hdr = (key, extra = {}) => {
  const h = { apikey: key, ...extra };
  if (key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key;
  return h;
};

const json = (status, body, extra = {}) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  body: JSON.stringify(body),
});

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const e = env();
  const r = await fetch(`${e.url}/rest/v1/${path}`, {
    method,
    headers: hdr(e.sec, { 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}
  if (!r.ok) {
    const err = new Error((data && data.message) || 'db error');
    err.code = data && data.code;
    err.dbStatus = r.status;
    throw err;
  }
  return data;
}

// يتأكد إن الطلب جاي من الأدمن (توكن Supabase صالح + الإيميل هو ADMIN_EMAIL)
async function requireAdmin(event) {
  const e = env();
  const h = event.headers.authorization || event.headers.Authorization || '';
  const token = h.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${e.url}/auth/v1/user`, { headers: { apikey: e.pub, Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u.email && u.email.toLowerCase() === e.admin ? u : null;
}

function fail(err) {
  console.error(err);
  if (err.client) return json(err.status || 400, { error: err.message });
  return json(500, { error: 'حصل خطأ في الخادم، حاول مرة أخرى.' });
}

module.exports = { bad, env, hdr, json, rest, requireAdmin, fail };
