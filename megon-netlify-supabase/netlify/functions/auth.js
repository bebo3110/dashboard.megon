const { env, json, fail } = require('../lib/sb');

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') return json(200, { ok: true });
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const e = env();
    const b = JSON.parse(event.body || '{}');
    let path, payload;
    if (b.action === 'login') {
      path = 'token?grant_type=password';
      payload = { email: String(b.email || '').trim(), password: String(b.password || '') };
    } else if (b.action === 'refresh') {
      path = 'token?grant_type=refresh_token';
      payload = { refresh_token: String(b.refresh_token || '') };
    } else return json(400, { error: 'طلب غير صالح' });

    const r = await fetch(`${e.url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: e.pub, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      return json(401, { error: b.action === 'login' ? 'البريد أو كلمة المرور غير صحيحة.' : 'انتهت الجلسة، سجّل الدخول من جديد.' });
    }
    const email = ((d.user && d.user.email) || '').toLowerCase();
    if (email !== e.admin) return json(403, { error: 'الحساب ده غير مصرح له بدخول لوحة الإدارة.' });
    return json(200, { access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in, email });
  } catch (err) { return fail(err); }
};
