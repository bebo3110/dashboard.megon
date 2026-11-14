-- الصق الملف ده كله في Supabase ← SQL Editor ← Run

create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 150),
  price numeric(10,2) not null check (price > 0),
  cat text not null check (cat in ('decor','clean','home','store','kitchen','cook')),
  img text,
  stock boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  phone text not null,
  gov text not null,
  addr text not null,
  note text,
  items jsonb not null,
  total numeric(12,2) not null,
  status text not null default 'new'
    check (status in ('new','confirmed','shipping','delivered','cancelled')),
  created_at timestamptz not null default now()
);

-- تفعيل الحماية: من غير سياسات، محدش يقدر يوصل للجداول مباشرة.
-- الوصول بيتم بس من السيرفر (Netlify Functions) بالمفتاح السري.
alter table public.products enable row level security;
alter table public.orders enable row level security;

-- مخزن صور المنتجات (عام للقراءة)
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;
