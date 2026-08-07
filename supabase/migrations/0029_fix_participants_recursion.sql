-- Perbaiki "infinite recursion detected in policy for relation meetings"
-- (dan masalah yang sama di forum_threads).
--
-- PENYEBAB
--   0026 memberi meetings sebuah SELECT policy yang mengecek
--   meeting_participants, dan sekaligus memberi meeting_participants sebuah
--   policy "FOR ALL". Policy FOR ALL ikut dievaluasi saat SELECT, dan isinya
--   membaca meetings. Jadi: baca meetings -> cek meeting_participants ->
--   baca meetings -> ... Postgres memutusnya dengan error rekursi, sehingga
--   rapat sama sekali tidak bisa dibaca, dibuat, diubah, atau dihapus.
--   forum_thread_participants punya pola yang persis sama.
--
-- PERBAIKAN
--   Pemeriksaan "apakah saya pembuatnya" dipindah ke fungsi SECURITY DEFINER
--   sehingga pembacaan meetings/forum_threads di dalamnya tidak memicu RLS
--   lagi, dan policy FOR ALL dipecah jadi INSERT/UPDATE/DELETE saja supaya
--   jalur SELECT hanya memakai policy select yang sudah aman.
--
-- Aman dijalankan berkali-kali.

-- ---------------------------------------------------------------------------
-- Fungsi bantu
-- ---------------------------------------------------------------------------

create or replace function is_meeting_creator(p_meeting_id uuid, p_uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from meetings where id = p_meeting_id and created_by = p_uid
  );
$$;

create or replace function is_thread_creator(p_thread_id uuid, p_uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from forum_threads where id = p_thread_id and created_by = p_uid
  );
$$;

grant execute on function is_meeting_creator(uuid, uuid) to authenticated;
grant execute on function is_thread_creator(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- meeting_participants
-- ---------------------------------------------------------------------------

drop policy if exists "meeting_participants_write_creator" on meeting_participants;

drop policy if exists "meeting_participants_insert_creator" on meeting_participants;
create policy "meeting_participants_insert_creator" on meeting_participants
  for insert with check (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or is_meeting_creator(meeting_id, auth.uid())
  );

drop policy if exists "meeting_participants_update_creator" on meeting_participants;
create policy "meeting_participants_update_creator" on meeting_participants
  for update using (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or is_meeting_creator(meeting_id, auth.uid())
  );

drop policy if exists "meeting_participants_delete_creator" on meeting_participants;
create policy "meeting_participants_delete_creator" on meeting_participants
  for delete using (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or is_meeting_creator(meeting_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- forum_thread_participants
-- ---------------------------------------------------------------------------

drop policy if exists "forum_thread_participants_write_creator" on forum_thread_participants;

drop policy if exists "forum_thread_participants_insert_creator" on forum_thread_participants;
create policy "forum_thread_participants_insert_creator" on forum_thread_participants
  for insert with check (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or is_thread_creator(thread_id, auth.uid())
  );

drop policy if exists "forum_thread_participants_update_creator" on forum_thread_participants;
create policy "forum_thread_participants_update_creator" on forum_thread_participants
  for update using (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or is_thread_creator(thread_id, auth.uid())
  );

drop policy if exists "forum_thread_participants_delete_creator" on forum_thread_participants;
create policy "forum_thread_participants_delete_creator" on forum_thread_participants
  for delete using (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or is_thread_creator(thread_id, auth.uid())
  );
