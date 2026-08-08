-- Sebelumnya hanya Owner/Management/Leader yang boleh menambah/mengubah
-- Keputusan dan Action Items rapat (walau bukan peserta rapatnya). Sekarang:
-- siapa pun yang bisa membuka rapat itu (peserta terpilih, pembuat, atau
-- Management/Owner -- lihat can_view_meeting di 0026) juga boleh
-- menambah/mengubah/menghapus Keputusan dan Action Items-nya. Notulen tetap
-- dibatasi leader/admin/superadmin -- tidak diminta ikut dilonggarkan.
--
-- decisions & action_items dipakai juga oleh forum (thread_id) -- bagian itu
-- TIDAK berubah, tetap leader/admin/superadmin.
--
-- Upload gambar rapat (meeting_images) TIDAK perlu migration: policy
-- "meeting_images_write" (0026) sudah mengizinkan created_by = auth.uid(),
-- yang otomatis benar untuk siapa pun yang upload atas namanya sendiri.
-- Yang membatasinya selama ini murni tombol di UI (canEditNotulen), sudah
-- diperbaiki di sisi frontend.

drop policy if exists "decisions_write_leader_admin" on decisions;
create policy "decisions_write_meeting_participant" on decisions
  for all using (
    (meeting_id is not null and can_view_meeting(meeting_id, auth.uid()))
    or (
      thread_id is not null
      and get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
      and can_view_thread(thread_id, auth.uid())
    )
    or (
      meeting_id is null and thread_id is null
      and get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
    )
  )
  with check (
    (meeting_id is not null and can_view_meeting(meeting_id, auth.uid()))
    or (
      thread_id is not null
      and get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
      and can_view_thread(thread_id, auth.uid())
    )
    or (
      meeting_id is null and thread_id is null
      and get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
    )
  );

drop policy if exists "action_items_write_leader_admin" on action_items;
create policy "action_items_write_meeting_participant" on action_items
  for all using (
    (meeting_id is not null and can_view_meeting(meeting_id, auth.uid()))
    or (meeting_id is null and get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader'))
  )
  with check (
    (meeting_id is not null and can_view_meeting(meeting_id, auth.uid()))
    or (meeting_id is null and get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader'))
  );
-- action_items_update_own_assignee (assignee boleh update task-nya sendiri)
-- tetap tidak berubah, jalan berdampingan dengan policy di atas.
