const { bad, env, hdr, json, rest, requireAdmin, fail } = require('../lib/sb');
const CATS = ['decor', 'clean', 'home', 'store', 'kitchen', 'cook'];
const map = (r) => ({ id: String(r.id), name: r.name, price: Number(r.price), cat: r.cat, img: r.img || '', stock: r.stock });

async function upload(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw bad('الصورة غير صالحة');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 1.5 * 1024 * 1024) throw bad('الصورة كبيرة، اختار صورة أصغر');
  const e = env();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  const r = await fetch(`${e.url}/storage/v1/object/products/${name}`, {
    method: 'POST',
    headers: hdr(e.sec, { 'Content-Type': `image/${m[1]}`, 'x-upsert': 'true' }),
    body: buf,
  });
  if (!r.ok) throw new Error('storage upload failed: ' + (await r.text()));
  return `${e.url}/storage/v1/object/public/products/${name}`;
}

function clean(b, partial) {
  const o = {};
  if (!partial || b.name !== undefined) {
    const n = String(b.name || '').trim();
    if (!n || n.length > 150) throw bad('اسم المنتج غير صالح');
    o.name = n;
  }
  if (!partial || b.price !== undefined) {
    const p = Number(b.price);
    if (!(p > 0) || p > 10000000) throw bad('السعر غير صالح');
    o.price = p;
  }
  if (!partial || b.cat !== undefined) {
    if (!CATS.includes(b.cat)) throw bad('القسم غير صالح');
    o.cat = b.cat;
  }
  if (b.stock !== undefined) o.stock = !!b.stock;
  return o;
}

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;
    const qs = event.queryStringParameters || {};

    if (method === 'GET') {
      const all = !!qs.all;
      if (all && !(await requireAdmin(event))) return json(401, { error: 'غير مصرح' });
      const rows = await rest(`products?select=id,name,price,cat,img,stock&order=created_at.desc${all ? '' : '&stock=eq.true'}`);
      return json(200, { products: rows.map(map) }, all ? {} : { 'Cache-Control': 'public, max-age=20' });
    }

    if (!(await requireAdmin(event))) return json(401, { error: 'غير مصرح' });
    const body = event.body ? JSON.parse(event.body) : {};

    if (method === 'POST') {
      const o = clean(body, false);
      if (body.imageData) o.img = await upload(body.imageData);
      if (o.stock === undefined) o.stock = true;
      const rows = await rest('products', { method: 'POST', body: o, prefer: 'return=representation' });
      return json(201, { product: map(rows[0]) });
    }

    if (method === 'PUT') {
      const id = parseInt(body.id, 10);
      if (!(id > 0)) throw bad('المنتج غير موجود');
      const o = clean(body, true);
      if (body.imageData) o.img = await upload(body.imageData);
      if (!Object.keys(o).length) throw bad('مفيش تغييرات');
      const rows = await rest(`products?id=eq.${id}`, { method: 'PATCH', body: o, prefer: 'return=representation' });
      if (!rows || !rows.length) throw bad('المنتج غير موجود', 404);
      return json(200, { product: map(rows[0]) });
    }

    if (method === 'DELETE') {
      const id = parseInt(qs.id, 10);
      if (!(id > 0)) throw bad('المنتج غير موجود');
      await rest(`products?id=eq.${id}`, { method: 'DELETE' });
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) { return fail(err); }
};
