-- Policy Storage untuk seluruh bucket.
--
-- MASALAH YANG DIPERBAIKI
--   RLS aktif di storage.objects tetapi tidak ada satu pun policy, sehingga
--   setiap operasi lewat client ber-sesi (anon/authenticated) ditolak. Di
--   project Supabase lama policy-nya pernah dibuat lewat dashboard dan tidak
--   pernah ikut tercatat sebagai migrasi, jadi ketika database dibangun ulang
--   dari nol semuanya hilang. Akibatnya unggah gambar rapat gagal diam-diam
--   (route-nya memakai client ber-sesi), dan lampiran tugas mustahil dibuat.
--
--   Rekaman rapat kebetulan tetap jalan karena route-nya memakai service role
--   yang melewati RLS -- itu menutupi masalahnya selama ini.
--
-- Aman dijalankan berkali-kali.

-- ---------------------------------------------------------------------------
-- meeting-images (bucket publik: dibaca siapa saja, ditulis yang login)
-- ---------------------------------------------------------------------------

drop policy if exists "meeting_images_read" on storage.objects;
create policy "meeting_images_read" on storage.objects
  for select using (bucket_id = 'meeting-images');

drop policy if exists "meeting_images_insert" on storage.objects;
create policy "meeting_images_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meeting-images' and owner = auth.uid());

drop policy if exists "meeting_images_delete" on storage.objects;
create policy "meeting_images_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meeting-images'
    and (owner = auth.uid() or get_user_role(auth.uid()) in ('superadmin', 'admin'))
  );

-- ---------------------------------------------------------------------------
-- meeting-recordings (privat)
-- ---------------------------------------------------------------------------
-- Rekaman diunggah dan dibaca lewat route server; policy ini supaya jalurnya
-- tetap berfungsi kalau suatu saat tidak lagi memakai service role.

drop policy if exists "meeting_recordings_read" on storage.objects;
create policy "meeting_recordings_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'meeting-recordings');

drop policy if exists "meeting_recordings_insert" on storage.objects;
create policy "meeting_recordings_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meeting-recordings' and owner = auth.uid());

drop policy if exists "meeting_recordings_delete" on storage.objects;
create policy "meeting_recordings_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meeting-recordings'
    and (owner = auth.uid() or get_user_role(auth.uid()) in ('superadmin', 'admin'))
  );

-- ---------------------------------------------------------------------------
-- task-attachments (privat)
-- ---------------------------------------------------------------------------
-- Semua karyawan boleh melihat lampiran tugas -- pm_tasks sendiri memang
-- terbuka untuk semua yang login. Menghapus hanya pengunggah atau atasan.

drop policy if exists "task_attachments_read" on storage.objects;
create policy "task_attachments_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-attachments');

drop policy if exists "task_attachments_insert" on storage.objects;
create policy "task_attachments_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-attachments' and owner = auth.uid());

drop policy if exists "task_attachments_delete" on storage.objects;
create policy "task_attachments_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-attachments'
    and (owner = auth.uid() or get_user_role(auth.uid()) in ('superadmin', 'admin'))
  );

-- Daftar bucket perlu bisa dibaca supaya klien tahu bucket-nya ada.
drop policy if exists "buckets_read_authenticated" on storage.buckets;
create policy "buckets_read_authenticated" on storage.buckets
  for select to authenticated using (true);
