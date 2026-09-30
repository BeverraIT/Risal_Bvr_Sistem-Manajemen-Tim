# Sistem Internal Operasional

Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage, RLS). Aplikasi manajemen tim internal: Tugas & Poin, Evaluasi & Retro, Forum, Manajemen Rapat (rekaman + notulen AI), Alur Kerja/SOP, Catatan & Job List, pengaturan karyawan/divisi.

Role: `superadmin` (Owner) > `admin` (Management) > `leader` (Lead Team) > `staff`. Hak akses utama ditegakkan oleh RLS di database; cek di server action/route hanyalah lapisan tambahan.

## Setup

1. Buat project di [supabase.com](https://supabase.com) (atau pakai project yang sudah ada).
2. Copy `.env.local.example` ke `.env.local`, isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` dari dashboard Supabase (Project Settings → API).
3. Link & push migrasi:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   > Catatan: Docker tidak tersedia di environment ini, jadi `supabase start` (stack lokal) tidak dipakai — migrasi langsung ditarget ke project cloud via `db push`.

4. Jalankan seed (setelah konfirmasi nama divisi di `supabase/seed.sql`):

   ```bash
   npx supabase db execute -f supabase/seed.sql
   ```

5. Buat user pertama (superadmin) lewat Supabase Auth dashboard, lalu insert manual ke `user_roles`:

   ```sql
   insert into user_roles (user_id, role) values ('<uid-user>', 'superadmin');
   insert into profiles (id, full_name) values ('<uid-user>', 'Nama Owner');
   ```

6. Install & jalankan dev server:

   ```bash
   npm install
   npm run dev
   ```

## Struktur

- `proxy.ts` — auth gate (Next.js 16 renamed `middleware.ts` → `proxy.ts`). User belum login diarahkan ke `/login`; request `/api/*` mendapat 401 JSON. Pengecualian: link bagikan poster `/api/meeting/[id]/visual-notes?token=...`.
- `src/lib/supabase/` — client browser/server/admin + helper proxy
- `src/lib/auth.ts` — `getCurrentUser()`, baca role dari `user_roles`
- `src/lib/meeting-ai.ts` — parsing & penyimpanan hasil AI notulen (dipakai route rekaman & tempel-catatan)
- `src/app/(app)/<modul>/` — halaman yang butuh login; `actions.ts` = server actions per modul
- `src/app/api/meeting/[meetingId]/` — rekaman (chunk upload → pipeline AI via `after()`), gambar, notes-from-text, poster visual
- `supabase/migrations/` — skema SQL, urut sesuai nomor file (jalankan dengan `scripts/apply-migration.mjs`)

## Batasan yang perlu diketahui

- Vercel Hobby: `maxDuration` route rekaman maks 300 detik — rekaman sangat panjang bisa timeout di tahap AI.
- Reminder rapat/tenggat berjalan lewat `pg_cron` (migrasi 0032), bukan Vercel Cron.
- Tanpa `GEMINI_API_KEY` (atau `OPENAI_API_KEY` + `ANTHROPIC_API_KEY`) pipeline rekaman jalan dalam **mode simulasi** dan mengisi notulen contoh.
- Notifikasi WhatsApp hanya aktif bila `FONNTE_TOKEN` **dan** `FONNTE_TARGET` diisi.
- Belum ada test otomatis; verifikasi minimal: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
