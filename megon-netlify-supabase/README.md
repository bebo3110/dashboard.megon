# Megon — متجر + لوحة إدارة (Netlify + Supabase)

- public/index.html      المتجر
- public/dashboard.html  لوحة الإدارة
- netlify/functions/     الـ API (auth, products, orders)
- supabase.sql           إنشاء الجداول (يتشغل مرة واحدة في Supabase)
- netlify.toml           إعدادات Netlify

متغيرات البيئة المطلوبة في Netlify:
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, ADMIN_EMAIL
