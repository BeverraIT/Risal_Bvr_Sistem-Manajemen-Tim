-- Hasil audit RLS (30 Sep 2026) terhadap database produksi. Jalankan SETELAH
-- 0030_meeting_participant_contribute.sql -- migrasi itu ternyata belum
-- pernah diterapkan di produksi (policy action_items/decisions masih versi
-- 0006), padahal UI sudah mengizinkan peserta rapat mengubah keputusan &
-- action item.
--
-- Semua penulisan rekaman/transkrip/notulen AI di aplikasi memakai service
-- role (bypass RLS), jadi policy tulis untuk user biasa di tabel/bucket itu
-- tidak dibutuhkan dan justru membuka celah.

-- ---------------------------------------------------------------------------
-- 1. profiles: user bisa mengubah division_id miliknya sendiri.
-- get_user_division() membaca profiles.division_id, jadi siapa pun bisa
-- "pindah" ke divisi lain lalu melihat alur/forum/rapat divisi itu, dan
-- Leader bisa mengedit data divisi lain. Aplikasi tidak pernah memakai
-- policy ini (edit profil lewat admin client di Pengaturan > Karyawan).
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_update_self" on profiles;

-- ---------------------------------------------------------------------------
-- 2. Storage meeting-recordings: SEMUA user login bisa mengunduh rekaman
-- audio SEMUA rapat, termasuk rapat privat. Aplikasi hanya mengakses bucket
-- ini lewat service role -- cabut semua akses user biasa.
-- ---------------------------------------------------------------------------
drop policy if exists "meeting_recordings_read" on storage.objects;
drop policy if exists "meeting_recordings_insert" on storage.objects;
drop policy if exists "meeting_recordings_delete" on storage.objects;

-- Storage meeting-images (bucket publik): siapa pun bisa mengunggah file apa
-- pun ke path mana pun. Batasi ke folder rapat yang bisa dia lihat.
drop policy if exists "meeting_images_insert" on storage.objects;
create policy "meeting_images_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meeting-images'
    and owner = auth.uid()
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and can_view_meeting(((storage.foldername(name))[1])::uuid, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. transcripts: policy "for all" leader/admin juga berlaku untuk SELECT,
-- jadi setiap Leader bisa membaca transkrip lengkap rapat privat mana pun.
-- Select lama juga memakai meeting_attendees (tabel lama, tidak dipakai UI).
-- Samakan dengan notulen: boleh dibaca siapa pun yang bisa melihat rapatnya.
-- ---------------------------------------------------------------------------
drop policy if exists "transcripts_write_admin_leader" on transcripts;
drop policy if exists "transcripts_select_participant_or_admin" on transcripts;
create policy "transcripts_select_visible" on transcripts
  for select using (
    exists (
      select 1 from meeting_recordings mr
      where mr.id = transcripts.recording_id
        and can_view_meeting(mr.meeting_id, auth.uid())
    )
  );

drop policy if exists "recordings_write_admin_leader" on meeting_recordings;
drop policy if exists "recordings_update_admin_leader" on meeting_recordings;
drop policy if exists "recordings_select_participant_or_admin" on meeting_recordings;
create policy "recordings_select_visible" on meeting_recordings
  for select using (can_view_meeting(meeting_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Hapus rapat / thread: Leader mana pun bisa menghapus rapat atau thread
-- privat yang bahkan tidak bisa dia lihat.
-- ---------------------------------------------------------------------------
drop policy if exists "meetings_delete_leader_admin" on meetings;
create policy "meetings_delete_leader_admin" on meetings
  for delete using (
    get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
    and can_view_meeting(id, auth.uid())
  );

drop policy if exists "forum_threads_delete_leader_admin" on forum_threads;
create policy "forum_threads_delete_leader_admin" on forum_threads
  for delete using (
    get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
    and can_view_thread(id, auth.uid())
  );

-- meeting_images: Leader bisa menambah/menghapus gambar di rapat privat mana
-- pun; user biasa bisa menempelkan gambar ke rapat yang tidak dia lihat.
drop policy if exists "meeting_images_write" on meeting_images;
create policy "meeting_images_write" on meeting_images
  for all using (
    can_view_meeting(meeting_id, auth.uid())
    and (
      get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
      or created_by = auth.uid()
    )
  )
  with check (
    can_view_meeting(meeting_id, auth.uid())
    and (
      get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
      or created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. pm_tasks: pelaksana (assignee) boleh UPDATE seluruh kolom tugasnya --
-- lewat API langsung dia bisa menaikkan poin sendiri, memindah divisi, atau
-- melompati persetujuan (idea -> done). Aplikasi hanya mengizinkan ubah
-- status sesuai ASSIGNEE_NEXT_STATUS (src/lib/pm.ts); tegakkan di database.
-- ---------------------------------------------------------------------------
create or replace function guard_pm_task_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
begin
  -- Service role / cron: tanpa auth.uid(), tidak dibatasi.
  if auth.uid() is null then
    return new;
  end if;

  v_role := get_user_role(auth.uid());
  if v_role in ('superadmin', 'admin') then
    return new;
  end if;
  if v_role = 'leader' and old.division_id = get_user_division(auth.uid()) then
    return new;
  end if;

  -- Selain reviewer: hanya status & progress yang boleh berubah.
  if (to_jsonb(new) - array['status', 'progress', 'updated_at'])
     is distinct from (to_jsonb(old) - array['status', 'progress', 'updated_at']) then
    raise exception 'Hanya status dan progres tugas yang boleh diubah oleh pelaksana.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not (
       (old.status = 'todo' and new.status = 'in_progress')
    or (old.status = 'in_progress' and new.status in ('in_review', 'todo'))
    or (old.status = 'in_review' and new.status in ('done', 'in_progress'))
  ) then
    raise exception 'Perubahan status tugas ini tidak diizinkan.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pm_tasks_guard on pm_tasks;
create trigger trg_pm_tasks_guard
  before update on pm_tasks
  for each row execute function guard_pm_task_update();

-- ---------------------------------------------------------------------------
-- 6. notifications: siapa pun bisa mengirim notifikasi ke siapa pun dengan
-- link bebas -- bisa dipakai phishing (link ke situs luar di lonceng
-- notifikasi). Batasi link ke path internal.
-- ---------------------------------------------------------------------------
drop policy if exists "notifications_insert_authenticated" on notifications;
create policy "notifications_insert_authenticated" on notifications
  for insert with check (
    auth.role() = 'authenticated'
    and created_by = auth.uid()
    and (link is null or (link like '/%' and link not like '//%' and link not like '%\\%'))
  );

-- ---------------------------------------------------------------------------
-- 7. Fungsi SECURITY DEFINER bisa dipanggil tanpa login lewat
-- /rest/v1/rpc/... (Supabase advisor 0028). Helper policy tetap perlu
-- EXECUTE untuk authenticated (dipakai di dalam policy), tapi tidak untuk
-- anon. Fungsi cron & event trigger tidak boleh dipanggil user sama sekali.
-- ---------------------------------------------------------------------------
revoke execute on function get_user_role(uuid) from public, anon;
revoke execute on function get_user_division(uuid) from public, anon;
revoke execute on function can_view_meeting(uuid, uuid) from public, anon;
revoke execute on function can_view_thread(uuid, uuid) from public, anon;
revoke execute on function can_edit_division(uuid) from public, anon;
revoke execute on function can_view_division(uuid) from public, anon;
revoke execute on function is_meeting_creator(uuid, uuid) from public, anon;
revoke execute on function is_thread_creator(uuid, uuid) from public, anon;
grant execute on function get_user_role(uuid) to authenticated;
grant execute on function get_user_division(uuid) to authenticated;
grant execute on function can_view_meeting(uuid, uuid) to authenticated;
grant execute on function can_view_thread(uuid, uuid) to authenticated;
grant execute on function can_edit_division(uuid) to authenticated;
grant execute on function can_view_division(uuid) to authenticated;
grant execute on function is_meeting_creator(uuid, uuid) to authenticated;
grant execute on function is_thread_creator(uuid, uuid) to authenticated;

revoke execute on function send_meeting_and_deadline_reminders() from public, anon, authenticated;
revoke execute on function rls_auto_enable() from public, anon, authenticated;
revoke execute on function guard_pm_task_update() from public, anon, authenticated;
