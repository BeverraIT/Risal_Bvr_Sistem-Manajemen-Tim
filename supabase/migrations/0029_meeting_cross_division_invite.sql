-- Leader hanya bisa SELECT profiles di divisinya sendiri (0001), padahal form
-- rapat mendukung memilih peserta lintas divisi, dan staff sama sekali tidak
-- bisa membuat rapat -- keduanya bikin fitur undang lintas tim gagal diam-diam
-- (RLS cuma menyaring baris, tidak melempar error). Selaraskan dengan policy
-- "divisions_select_authenticated": semua user yang login boleh baca daftar
-- profiles (read-only), sama seperti mereka sudah boleh baca semua divisi.
drop policy if exists "profiles_select_leader_own_division" on profiles;

create policy "profiles_select_authenticated" on profiles
  for select using (auth.role() = 'authenticated');

-- meetings_insert_leader_admin (0012) membatasi pembuatan rapat hanya untuk
-- superadmin/admin/leader -- staff tidak bisa buat rapat sama sekali, jadi
-- daftar peserta jadi tidak relevan buat mereka. Izinkan semua user login
-- membuat rapat atas namanya sendiri; hapus rapat tetap dibatasi
-- (meetings_delete_admin, 0020) jadi tidak ada regresi di sisi itu.
drop policy if exists "meetings_insert_leader_admin" on meetings;
create policy "meetings_insert_authenticated" on meetings
  for insert with check (created_by = auth.uid());
