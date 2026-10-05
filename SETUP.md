# Setup cafe-app

Proyek cafe table-ordering (Next.js App Router + Supabase + Midtrans).
Semua config lewat `.env.local` — template ada di `.env.example`.

```bash
npm install
copy .env.example .env.local   # lalu isi nilainya
npm run dev                   # http://localhost:3000
```

## 1. Supabase

1. Buka https://supabase.com → **New project** (pilih region + password database).
2. **Project Settings → API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon** (public) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY`
3. Jalankan skema: **SQL Editor → New query** → paste seluruh isi `supabase-schema.sql` → **Run**.
   Ini bikin tabel: `tables`, `categories`, `menu_items`, `modifier_groups`,
   `modifier_options`, `menu_item_modifiers`, `orders`, `order_items` +
   function `deduct_stock_if_limited()`.
4. (Opsional, cepat) insert data awal: beberapa row `categories` + `menu_items`,
   dan 1 row di `tables` (karena QR token dibangkitkan otomatis saat bikin
   table lewat `POST /api/admin/tables`).

> Kalau env Supabase belum diisi, semua API yang butuh database balikin
> `503 {"error":"Supabase belum dikonfigurasi: ..."}` — bukan crash.

## 2. Midtrans (payment)

1. Daftar/ambil akun di https://midtrans.com → **Account**.
2. **Account → API Keys** → pastikan tombol **Sandbox** aktif.
3. Salin:
   - **Server key** (`SB-M...`) → `MIDTRANS_SERVER_KEY`
   - **Client key** (`SB-CS...`) → `MIDTRANS_CLIENT_KEY`
4. `NEXT_PUBLIC_BASE_URL` harus bisa dijangkau Midtrans untuk callback
   `POST /api/payment/webhook` — di dev lokal pakai tunnel (ngrok/cloudflared)
   atau biarkan sandbox (notifikasi webhook manual bisa di-trigger dari
   halaman API Explorer Midtrans).

> Kalau key belum diisi, `POST /api/payment/create` balikin
> `503 {"error":"Midtrans belum dikonfigurasi: ..."}`.

## 3. Isi .env.local

```bash
copy .env.example .env.local
```

Edit `.env.local`:

| Variabel | Asal |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → service_role (secret) |
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `OPENAI_BASE_URL` | opsional, default OpenAI resmi |
| `OPENAI_MODEL` | opsional, default `gpt-4o-mini` |
| `MIDTRANS_SERVER_KEY` | Midtrans → API Keys (Sandbox) |
| `MIDTRANS_CLIENT_KEY` | Midtrans → API Keys (Sandbox) |
| `NEXT_PUBLIC_BASE_URL` | URL app (dev: `http://localhost:3000`) |

Semua variabel wajib kecuali `OPENAI_BASE_URL` / `OPENAI_MODEL` (ada default).
`SUPABASE_SERVICE_ROLE_KEY` jangan pernah commit ke git (`.gitignore` sudah
meng-cover `.env.local`).

## Catatan: tes AI chat lokal via 9Router

`src/app/api/ai/chat/route.ts` pakai client OpenAI-compatible, jadi bisa
diarahkan ke 9Router tanpa kode tambahan:

```env
OPENAI_BASE_URL=http://127.0.0.1:20128/v1
OPENAI_MODEL=khodam-jawa
OPENAI_API_KEY=your-9router-api-key # API key 9Router (bukan dummy), jangan dikosongin!
```

(Kalau `OPENAI_BASE_URL` kosong, default `https://api.openai.com/v1` dan
model `gpt-4o-mini`.)

## Halaman & route

- `/` — landing
- `/table/[token]` — menu per meja (dari QR token)
- `/order/[id]/status` — status order + hasil bayar
- `/kds` — kitchen display system
- `/admin` — kelola menu + table (QR token)
- API: `/api/menu`, `/api/orders`, `/api/orders/[id]/status`,
  `/api/tables/validate`, `/api/ai/chat`,
  `/api/payment/create`, `/api/payment/webhook`,
  `/api/admin/menu`, `/api/admin/tables`