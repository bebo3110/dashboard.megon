const { bad, json, rest, requireAdmin, fail } = require('../lib/sb');
const STATUSES = ['new', 'confirmed', 'shipping', 'delivered', 'cancelled'];
const toDash = (r) => ({
  id: r.code, name: r.name, phone: r.phone, gov: r.gov, addr: r.addr, note: r.note || '',
  status: r.status, t: Date.parse(r.created_at),
  items: (r.items || []).map((i) => [i.n, Number(i.p), Number(i.q)]),
});

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;

    // إنشاء طلب جديد: مفتوح للعملاء، والأسعار بتتحسب هنا من قاعدة البيانات مش من المتصفح
    if (method === 'POST') {
      const b = JSON.parse(event.body || '{}');
      const name = String(b.name || '').trim(), phone = String(b.phone || '').trim();
      const gov = String(b.gov || '').trim(), addr = String(b.addr || '').trim(), note = String(b.note || '').trim();
      if (!name || name.length > 100) throw bad('الاسم غير صالح');
      if (!/^01[0125]\d{8}$/.test(phone)) throw bad('رقم الموبايل غير صالح');
      if (!gov || gov.length > 40) throw bad('المحافظة غير صالحة');
      if (!addr || addr.length > 300) throw bad('العنوان غير صالح');
      if (note.length > 300) throw bad('الملاحظات طويلة');
      if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50) throw bad('السلة فارغة');

      const want = new Map();
      for (const i of b.items) {
        const id = parseInt(i.id, 10), q = parseInt(i.q, 10);
        if (!(id > 0) || !(q >= 1 && q <= 99)) throw bad('بيانات المنتجات غير صالحة');
        want.set(id, (want.get(id) || 0) + q);
      }
      const rows = await rest(`products?select=id,name,price,stock&id=in.(${[...want.keys()].join(',')})`);
      if (rows.length !== want.size || rows.some((r) => !r.stock)) throw bad('بعض المنتجات لم تعد متاحة، حدّث الصفحة وحاول تاني');
      const items = rows.map((r) => ({ n: r.name, p: Number(r.price), q: Math.min(99, want.get(r.id)) }));
      const total = items.reduce((s, i) => s + i.p * i.q, 0);

      for (let k = 0; k < 4; k++) {
        const code = 'MG' + (100000 + Math.floor(Math.random() * 900000));
        try {
          await rest('orders', { method: 'POST', body: { code, name, phone, gov, addr, note, items, total, status: 'new' } });
          return json(201, { ok: true, code });
        } catch (e) {
          if (e.code === '23505' && k < 3) continue;
          throw e;
        }
      }
    }

    if (!(await requireAdmin(event))) return json(401, { error: 'غير مصرح' });

    if (method === 'GET') {
      const rows = await rest('orders?select=*&order=created_at.desc&limit=500');
      return json(200, { orders: rows.map(toDash) });
    }

    if (method === 'PATCH') {
      const b = JSON.parse(event.body || '{}');
      if (!/^MG\d{6}$/.test(String(b.code))) throw bad('رقم الطلب غير صالح');
      if (!STATUSES.includes(b.status)) throw bad('الحالة غير صالحة');
      await rest(`orders?code=eq.${b.code}`, { method: 'PATCH', body: { status: b.status } });
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) { return fail(err); }
};
