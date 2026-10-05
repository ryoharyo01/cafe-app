# ☕ Cafe POS

Aplikasi POS (Point of Sale) kafe berbasis web: pelanggan pesan sendiri dari meja lewat scan QR, dapur lihat pesanan masuk realtime, admin kelola menu & meja.

Dibangun dengan **Next.js 16 (App Router)** + **Supabase** + **Tailwind CSS 4**.

---

## Daftar Isi

- [Fitur](#fitur)
- [Arsitektur Singkat](#arsitektur-singkat)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Setup Database](#setup-database)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Alur Pemakaian](#alur-pemakaian)
- [Referensi API](#referensi-api)
- [Struktur Database](#struktur-database)
- [Testing dari HP (Tunnel)](#testing-dari-hp-tunnel)
- [Catatan Keamanan](#catatan-keamanan)
- [Troubleshooting](#troubleshooting)

---

## Fitur

### Sisi Pelanggan (akses via scan QR meja)

- **Menu digital** — daftar menu per kategori, tampil harga & deskripsi.
- **Modifier / opsi** — pilih ukuran, level gula, level es, topping, extra. Tampil sebagai tombol besar 2 kolom; grup wajib ditandai `*wajib`, grup multi-pilih punya limit.
- **Keranjang** — ubah jumlah, catatan per item, subtotal otomatis.
- **AI barista** — chat rekomendasi menu (OpenAI-compatible, bisa diarahkan ke endpoint lokal).
- **Status pesanan realtime** — pelanggan lihat pesanannya berubah status tanpa refresh.
- **QR per meja** — tiap meja punya token unik; scan langsung masuk halaman meja itu.

### Sisi Kasir (POS)

- **Halaman `/pos`** — layar kasir khusus (admin & kasir). Katalog menu + pencarian + filter kategori, keranjang, tombol **Bayar Tunai**.
- **Pembayaran tunai atomik** — order walk-in (`table_id = NULL`) dibuat dan langsung ditandai `paid`/`cash` dalam satu transaksi RPC, lengkap dengan hitungan kembalian dan usulan pecahan uang.
- **Anti-race** — pembayaran mengunci baris order (`FOR UPDATE`); bayar dua kali ditolak `409`. Kalau pelunasan gagal, order otomatis dibatalkan.

### Sisi Dapur (KDS)

- **Layar dapur** — pesanan masuk realtime, tombol ubah status (`paid` → `preparing` → `ready` → `completed`).

### Sisi Admin

- **Overview** — ringkasan keadaan kafe.
- **Master Menu** — CRUD menu **plus kelola modifier langsung di dalam form yang sama**:
  - pilih grup modifier mana yang nempel ke menu ini,
  - bikin grup baru inline (otomatis terpasang ke menu itu),
  - tambah/edit/hapus opsi grup beserta harga tambahannya,
  - satu tombol Simpan menyimpan menu + grup sekaligus.
- **Master QR** — tambah/hapus meja, lihat QR tiap meja, **print per-meja** (bukan print semua sekaligus), ganti base URL QR (untuk tunnel).
- **Orders** — daftar & detail pesanan.

---

## Arsitektur Singkat

```
Pelanggan (HP)                Dapur              Admin/Kasir
     │                          │                  │
     │ scan QR                  │                  │
     ▼                          ▼                  ▼
┌──────────────────────────────────────────────────────┐
│                  Next.js App Router                  │
│  /table/[token]  /kds  /pos  /admin  /login          │
│                                                      │
│  API Routes (/api/*)  ← validasi harga di server     │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   Supabase     │  Postgres + RLS
              │  (lokal/cloud) │  Realtime (status pesanan)
              └────────────────┘
```

**Prinsip penting:** harga **tidak pernah dipercaya dari client**. `POST /api/orders` mengambil `base_price` dari `menu_items` berdasarkan `menu_item_id`, lalu menghitung ulang `unit_price`, `item_total`, dan `subtotal` di server. Item yang tidak ada atau sedang sold out ditolak.

---

## Prasyarat

| Kebutuhan | Versi |
|---|---|
| Node.js | 20+ |
| npm | 10+ |
| Supabase CLI | opsional, untuk stack lokal |
| Docker Desktop | untuk Supabase lokal |

---

## Instalasi

```bash
git clone https://github.com/ryoharyo01/cafe-app.git
cd cafe-app
npm install
```

---

## Konfigurasi Environment

Salin template lalu isi nilainya:

```bash
cp .env.example .env.local
```

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon/public key (aman di browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **rahasia** — hanya server. Jangan sampai bocor ke client. |
| `JWT_SECRET` | ✅ | string acak untuk menandatangani sesi admin |
| `NEXT_PUBLIC_BASE_URL` | ✅ | URL publik app (dipakai callback pembayaran) |
| `OPENAI_API_KEY` | ⬜ | key untuk fitur AI chat |
| `OPENAI_BASE_URL` | ⬜ | endpoint OpenAI-compatible (default: `https://api.openai.com/v1`) |
| `OPENAI_MODEL` | ⬜ | model AI chat (default: `gpt-4o-mini`) |
| `MIDTRANS_SERVER_KEY` | ⬜ | key pembayaran Midtrans (sandbox) |
| `MIDTRANS_CLIENT_KEY` | ⬜ | key client Midtrans (sandbox) |

Generate `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Kalau Docker Desktop mati**, app tetap jalan tapi semua query Supabase akan timeout. Nyalakan Docker dulu.

---

## Setup Database

Pilih salah satu opsi.

### Opsi A — Supabase lokal (rekomendasi untuk development)

```bash
# butuh Docker Desktop menyala
supabase start          # nyalakan stack lokal
supabase db reset       # apply migration dari supabase/
```

Atau terapkan skema tunggal secara manual:

```bash
supabase start
docker exec -i supabase_db_cafe-app psql -U postgres -d postgres < supabase-schema.sql
```

Ambil kredensial yang dihasilkan:

```bash
supabase status         # catat API URL, anon key, service_role key
```

### Opsi B — Supabase cloud

1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel isi `supabase-schema.sql`, lalu jalankan.
3. Ambil URL + anon key + service_role key dari **Project Settings → API**.

Skema membuat 13 tabel dan **3 akun admin default**:

| Role | PIN default |
|---|---|
| `admin` | `111111` |
| `kasir` | `222222` |
| `dapur` | `333333` |

> Ganti PIN ini sebelum dipakai di lingkungan nyata.

---

## Menjalankan Aplikasi

```bash
npm run dev
```

Default Next.js di port **3000**. Untuk memaksa port lain (misalnya 3111):

```bash
npx next dev -p 3111
```

Build produksi:

```bash
npm run build
npm start
```

---

## Alur Pemakaian

### Pelanggan

1. Scan QR di meja → terbuka `/table/<token>`.
2. Pilih menu → atur modifier → masukkan ke keranjang.
3. Checkout → dapat `/order/<id>/status` untuk memantau status.

### Staf

1. Buka `/login`, masukkan PIN sesuai role.
2. **Admin** → `/admin` (Kasir POS, Overview, Master Menu, Master QR, Orders).
3. **Kasir** → `/pos` (layar kasir: buat order walk-in + bayar tunai).
4. **Dapur** → `/kds` untuk memproses pesanan.

Status pesanan: `pending` → `paid` → `preparing` → `ready` → `completed`.

---

## Referensi API

### Publik

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/menu` | Daftar kategori + menu yang tersedia |
| `GET` | `/api/tables/validate?token=<token>` | Validasi token QR meja |
| `POST` | `/api/orders` | Buat pesanan (harga dihitung ulang di server) |
| `GET` | `/api/orders/[id]` | Detail pesanan + item (dipakai halaman status) |
| `GET` | `/api/orders/[id]/status` | Status pesanan saja |
| `POST` | `/api/ai/chat` | Chat AI rekomendasi menu |

### Kasir / POS (butuh sesi `admin` atau `kasir`)

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/pos/menu` | Katalog menu ringkas untuk layar kasir |
| `POST` | `/api/pos/orders` | Buat order walk-in (harga dihitung ulang di DB) |
| `POST` | `/api/pos/orders/[id]/pay` | Bayar tunai (atomik, hitung kembalian) |
| `POST` | `/api/pos/orders/[id]/cancel` | Batalkan order walk-in yang belum dibayar |

### Auth

| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/auth/login` | Login pakai PIN → set cookie `admin_session` |
| `POST` | `/api/auth/logout` | Hapus sesi |
| `GET` | `/api/auth/session` | Info sesi aktif (nama + role) |

### Admin (butuh sesi)

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` `POST` `PATCH` `DELETE` | `/api/admin/menu` | CRUD menu |
| `GET` `PUT` | `/api/admin/menu/[id]/modifiers` | Grup modifier yang menempel ke satu menu |
| `GET` `POST` | `/api/admin/modifier-groups` | Daftar / buat grup |
| `PATCH` `DELETE` | `/api/admin/modifier-groups/[id]` | Ubah / hapus grup |
| `POST` | `/api/admin/modifier-groups/[id]/options` | Tambah opsi ke grup |
| `PATCH` `DELETE` | `/api/admin/modifier-options/[id]` | Ubah / hapus opsi |
| `GET` `POST` `DELETE` | `/api/admin/tables` | Daftar / tambah / hapus meja |

### Pembayaran

| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/payment/create` | Buat transaksi Midtrans |
| `POST` | `/api/payment/webhook` | Callback notifikasi Midtrans |

---

## Struktur Database

| Tabel | Isi |
|---|---|
| `admin_users` | Akun staf (PIN bcrypt, role: `admin`/`kasir`/`dapur`) |
| `categories` | Kategori menu |
| `menu_items` | Item menu (harga dasar, stok, `is_available`) |
| `modifier_groups` | Grup opsi (Ukuran, Level Gula, …) + `is_required`, `max_select` |
| `modifier_options` | Opsi dalam grup + `price_add` |
| `menu_item_modifiers` | Relasi menu ↔ grup modifier |
| `tables` | Meja + `qr_token` unik |
| `orders` | Pesanan (status, subtotal, tipe order) |
| `order_items` | Item dalam pesanan + modifier terpilih |
| `inventory` | Stok bahan |
| `menu_item_ingredients` | Resep: menu ↔ bahan |
| `login_attempts` | Rate limiting login PIN |
| `ai_chat_limits` | Rate limiting chat AI |

---

## Testing dari HP (Tunnel)

Windows Firewall sering memblokir akses LAN ke dev server (`ERR_CONNECTION_TIMED_OUT`). Cara paling mulus: tunnel.

```bash
npm i -g cloudflared
cloudflared tunnel --url http://localhost:3111
```

Salin URL yang diberikan, lalu isi itu sebagai **Base URL** di tab **Master QR** supaya QR mengarah ke sana. Kalau URL tunnel berubah, cukup ganti Base URL — tidak perlu generate ulang QR.

**Catatan:** log `/_next/hmr ... 401 Unauthorized` saat memakai tunnel itu normal — itu WebSocket hot-reload Next.js yang tidak didukung tunnel. API tetap berfungsi.

---

## Catatan Keamanan

- **Jangan commit `.env.local`** — sudah masuk `.gitignore`.
- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di server (route API), tidak pernah dikirim ke browser.
- `supabase/.temp/` berisi secret asli — sudah di-ignore.
- Harga selalu dihitung ulang di server; input harga dari client diabaikan.
- Login PIN dibatasi lewat tabel `login_attempts`.
- Ganti PIN default (`111111`/`222222`/`333333`) sebelum dipakai sungguhan.

---

## Troubleshooting

| Gejala | Penyebab / Solusi |
|---|---|
| Semua query DB timeout | Docker Desktop mati → nyalakan, lalu `supabase start` |
| HP tidak bisa buka dev server lewat IP LAN | Windows Firewall blokir profil Public → pakai tunnel `cloudflared` |
| QR mengarah ke alamat salah | URL tunnel berubah → perbarui Base URL di tab Master QR |
| Log `/_next/hmr 401` spam | Normal saat lewat tunnel (hot-reload), abaikan |
| Login gagal "PIN salah" | Cek tabel `admin_users`, atau jalankan ulang `supabase-schema.sql` |
| AI chat error 401 | `OPENAI_API_KEY` kosong/dummy, atau `OPENAI_BASE_URL` salah |
| Pembayaran tidak lanjut ke `paid` | Key Midtrans masih placeholder — isi key sandbox asli |
| Kasir tidak bisa buka `/pos` | Login dengan PIN kasir (`222222`); role `dapur` memang ditolak di `/pos` |
| Bayar tunai ditolak `409` | Pesanan sudah dibayar/dibatalkan orang lain — tarik ulang daftar |

---

## Lisensi

Proyek privat. Semua hak dipegang pemilik repositori.
