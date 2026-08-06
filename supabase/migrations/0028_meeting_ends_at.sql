-- Rapat punya waktu selesai, bukan cuma waktu mulai (form "Jadwalkan Rapat
-- Baru" memisahkan Mulai & Selesai).
--
-- Hak akses rapat TIDAK disentuh di sini: itu sepenuhnya urusan
-- can_view_meeting di 0026, yang menggabungkan divisi + meeting_participants.
-- Aman dijalankan berkali-kali.

alter table meetings add column if not exists ends_at timestamptz;

-- ---------------------------------------------------------------------------
-- Kembalikan policy meeting_attendees ke bentuk aslinya (0012).
--
-- Sempat ada percobaan memindahkan hak akses rapat ke meeting_attendees;
-- pendekatan itu ditinggalkan karena peserta per-orang sudah ditangani
-- meeting_participants sejak 0026. Blok ini membereskan sisa percobaan itu
-- supaya database yang dibangun dari nol identik dengan yang sudah jalan.
-- ---------------------------------------------------------------------------

drop policy if exists "meeting_attendees_insert_self_or_organizer" on meeting_attendees;
drop policy if exists "meeting_attendees_delete_organizer" on meeting_attendees;

drop policy if exists "meeting_attendees_upsert_own" on meeting_attendees;
create policy "meeting_attendees_upsert_own" on meeting_attendees
  for insert with check (
    user_id = auth.uid() and can_view_meeting(meeting_id, auth.uid())
  );
