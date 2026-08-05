-- Safety-net: user masih melihat error
-- "new row violates row-level security policy for table \"forum_threads\""
-- saat membuat thread baru. 0015/0016 seharusnya sudah memperbaiki ini, tapi
-- kalau migrasi 0015-0023 belum pernah dijalankan di database production
-- (atau sempat gagal di tengah jalan), forum_threads bisa saja masih tanpa
-- INSERT policy sama sekali (default-deny Postgres RLS).
--
-- Migrasi ini menegakkan ulang state akhir yang benar secara atomic & aman
-- dijalankan berkali-kali, dari kondisi awal apa pun.

do $$
begin
  execute 'drop policy if exists "forum_threads_insert_authenticated" on forum_threads';
  execute 'drop policy if exists "forum_threads_insert_public"        on forum_threads';
  execute 'drop policy if exists "forum_threads_insert_private"       on forum_threads';
  execute 'drop policy if exists "forum_threads_insert_own"           on forum_threads';

  execute '
    create policy "forum_threads_insert_own" on forum_threads
      for insert with check (
        auth.role() = ''authenticated'' and created_by = auth.uid()
      )
  ';
end $$;

-- Pastikan grant dasar juga ada -- RLS policy tidak berlaku kalau role
-- "authenticated" bahkan tidak punya privilege INSERT di tabel ini.
grant select, insert, update, delete on forum_threads, forum_posts to authenticated;

-- Verifikasi (muncul di log migrasi): harus ada tepat satu INSERT policy.
select policyname, cmd, with_check
from pg_policies
where tablename = 'forum_threads' and cmd = 'INSERT';
