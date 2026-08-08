-- Reminder rapat (H-1 hari & H-1 jam) dan reminder tenggat action item
-- (H-1 hari). Vercel yang dipakai project ini plan Hobby -- Vercel Cron di
-- plan itu dibatasi maksimal sekali sehari, tidak cukup untuk reminder
-- "1 jam sebelum" -- jadi dijadwalkan lewat pg_cron di database Supabase
-- sendiri, jalan tiap 15 menit, independen dari Vercel.
--
-- CATATAN SETUP: kalau "create extension pg_cron" di bawah gagal karena izin,
-- aktifkan dulu extension "pg_cron" lewat Supabase Dashboard -> Database ->
-- Extensions, baru jalankan ulang file ini.

create extension if not exists pg_cron with schema extensions;

-- Penanda "sudah diingatkan" supaya cron yang jalan tiap 15 menit tidak
-- mengirim notifikasi dobel untuk rapat/action item yang sama.
alter table meetings
  add column if not exists reminded_1d_at timestamptz,
  add column if not exists reminded_1h_at timestamptz;

alter table action_items
  add column if not exists reminded_at timestamptz;

create or replace function send_meeting_and_deadline_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- Rapat: H-1 hari
  for r in
    select m.id, m.title, m.scheduled_at
    from meetings m
    where m.reminded_1d_at is null
      and m.status <> 'cancelled'
      and (m.scheduled_at at time zone 'Asia/Jakarta')::date
        = ((now() at time zone 'Asia/Jakarta')::date + 1)
  loop
    insert into notifications (user_id, title, body, link, kind, created_by)
    select
      mp.user_id,
      'Besok ada rapat: ' || r.title,
      to_char(r.scheduled_at at time zone 'Asia/Jakarta', 'DD Mon YYYY, HH24:MI') || ' WIB',
      '/meeting/' || r.id,
      'meeting',
      mp.user_id
    from meeting_participants mp
    where mp.meeting_id = r.id;

    update meetings set reminded_1d_at = now() where id = r.id;
  end loop;

  -- Rapat: H-1 jam (jendela 65 menit ke depan supaya tidak kelewat walau
  -- cron jalan tiap 15 menit, bukan tepat tiap jam)
  for r in
    select m.id, m.title, m.scheduled_at
    from meetings m
    where m.reminded_1h_at is null
      and m.status <> 'cancelled'
      and m.scheduled_at > now()
      and m.scheduled_at <= now() + interval '65 minutes'
  loop
    insert into notifications (user_id, title, body, link, kind, created_by)
    select
      mp.user_id,
      'Sejam lagi rapat: ' || r.title,
      to_char(r.scheduled_at at time zone 'Asia/Jakarta', 'HH24:MI') || ' WIB',
      '/meeting/' || r.id,
      'meeting',
      mp.user_id
    from meeting_participants mp
    where mp.meeting_id = r.id;

    update meetings set reminded_1h_at = now() where id = r.id;
  end loop;

  -- Action item rapat: tenggat H-1 hari, hanya yang punya PIC & belum selesai
  for r in
    select ai.id, ai.title, ai.assignee_id, ai.meeting_id, ai.due_date
    from action_items ai
    where ai.reminded_at is null
      and ai.assignee_id is not null
      and ai.status not in ('done')
      and ai.due_date = (now() at time zone 'Asia/Jakarta')::date + 1
  loop
    insert into notifications (user_id, title, body, link, kind, created_by)
    values (
      r.assignee_id,
      'Tenggat besok: ' || r.title,
      'Jatuh tempo ' || to_char(r.due_date, 'DD Mon YYYY'),
      case when r.meeting_id is not null then '/meeting/' || r.meeting_id else null end,
      'action_item',
      r.assignee_id
    );

    update action_items set reminded_at = now() where id = r.id;
  end loop;
end;
$$;

-- Idempotent: buang jadwal lama dengan nama sama kalau file ini dijalankan
-- ulang, baru pasang lagi.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'meeting-deadline-reminders') then
    perform cron.unschedule('meeting-deadline-reminders');
  end if;
end $$;

select cron.schedule(
  'meeting-deadline-reminders',
  '*/15 * * * *',
  $$select send_meeting_and_deadline_reminders();$$
);
