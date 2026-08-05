-- Fase 13: peserta per-orang, notifikasi in-app, sub-item action, catatan
-- khusus & job list, serta gambar untuk Catatan Visual.
--
-- CATATAN DESAIN (peserta per-orang):
--   Tabel *_divisions LAMA TIDAK DIHAPUS -- penambahan ini bersifat aditif
--   supaya rapat/thread yang sudah ada tetap terlihat oleh divisinya. Model
--   barunya: UI memilih ORANG (divisi cuma pintasan untuk memilih semua
--   anggotanya sekaligus), dan hasilnya disimpan di *_participants.
--   Visibilitas = union dari keduanya.
--
-- Aman dijalankan berkali-kali (idempotent).

-- ---------------------------------------------------------------------------
-- 1. Peserta per-orang
-- ---------------------------------------------------------------------------
create table if not exists meeting_participants (
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (meeting_id, user_id)
);

create table if not exists forum_thread_participants (
  thread_id uuid not null references forum_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (thread_id, user_id)
);

alter table meeting_participants enable row level security;
alter table forum_thread_participants enable row level security;

drop policy if exists "meeting_participants_select" on meeting_participants;
create policy "meeting_participants_select" on meeting_participants
  for select using (auth.role() = 'authenticated' and can_view_meeting(meeting_id, auth.uid()));

drop policy if exists "meeting_participants_write_creator" on meeting_participants;
create policy "meeting_participants_write_creator" on meeting_participants
  for all using (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or exists (select 1 from meetings m where m.id = meeting_participants.meeting_id and m.created_by = auth.uid())
  )
  with check (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or exists (select 1 from meetings m where m.id = meeting_participants.meeting_id and m.created_by = auth.uid())
  );

drop policy if exists "forum_thread_participants_select" on forum_thread_participants;
create policy "forum_thread_participants_select" on forum_thread_participants
  for select using (auth.role() = 'authenticated' and can_view_thread(thread_id, auth.uid()));

drop policy if exists "forum_thread_participants_write_creator" on forum_thread_participants;
create policy "forum_thread_participants_write_creator" on forum_thread_participants
  for all using (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or exists (select 1 from forum_threads t where t.id = forum_thread_participants.thread_id and t.created_by = auth.uid())
  )
  with check (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or exists (select 1 from forum_threads t where t.id = forum_thread_participants.thread_id and t.created_by = auth.uid())
  );

grant select, insert, update, delete on meeting_participants, forum_thread_participants to authenticated;

-- Visibilitas: peserta per-orang ikut diperhitungkan (union dgn divisi).
create or replace function can_view_meeting(p_meeting_id uuid, p_uid uuid)
returns boolean
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_visibility text;
  v_created_by uuid;
begin
  select visibility, created_by into v_visibility, v_created_by
  from meetings where id = p_meeting_id;

  if v_visibility is null then return false; end if;
  if v_visibility = 'public' then return true; end if;
  if get_user_role(p_uid) in ('superadmin', 'admin') then return true; end if;
  if v_created_by = p_uid then return true; end if;

  if exists (
    select 1 from meeting_participants mp
    where mp.meeting_id = p_meeting_id and mp.user_id = p_uid
  ) then return true; end if;

  return exists (
    select 1 from meeting_divisions md
    where md.meeting_id = p_meeting_id
    and md.division_id = get_user_division(p_uid)
  );
end;
$$;

create or replace function can_view_thread(p_thread_id uuid, p_uid uuid)
returns boolean
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_visibility text;
  v_created_by uuid;
begin
  select visibility, created_by into v_visibility, v_created_by
  from forum_threads where id = p_thread_id;

  if v_visibility is null then return false; end if;
  if v_visibility = 'public' then return true; end if;
  if get_user_role(p_uid) in ('superadmin', 'admin') then return true; end if;
  if v_created_by = p_uid then return true; end if;

  if exists (
    select 1 from forum_thread_participants tp
    where tp.thread_id = p_thread_id and tp.user_id = p_uid
  ) then return true; end if;

  return exists (
    select 1 from forum_thread_divisions ftd
    where ftd.thread_id = p_thread_id
    and ftd.division_id = get_user_division(p_uid)
  );
end;
$$;

-- SELECT policy inline (INSERT ... RETURNING) juga harus ikut peserta orang.
drop policy if exists "meetings_select_visible" on meetings;
create policy "meetings_select_visible" on meetings
  for select using (
    auth.role() = 'authenticated'
    and (
      visibility = 'public'
      or created_by = auth.uid()
      or get_user_role(auth.uid()) in ('superadmin', 'admin')
      or exists (select 1 from meeting_participants mp
                 where mp.meeting_id = meetings.id and mp.user_id = auth.uid())
      or exists (select 1 from meeting_divisions md
                 where md.meeting_id = meetings.id
                 and md.division_id = get_user_division(auth.uid()))
    )
  );

drop policy if exists "forum_threads_select_visible" on forum_threads;
create policy "forum_threads_select_visible" on forum_threads
  for select using (
    auth.role() = 'authenticated'
    and (
      visibility = 'public'
      or created_by = auth.uid()
      or get_user_role(auth.uid()) in ('superadmin', 'admin')
      or exists (select 1 from forum_thread_participants tp
                 where tp.thread_id = forum_threads.id and tp.user_id = auth.uid())
      or exists (select 1 from forum_thread_divisions ftd
                 where ftd.thread_id = forum_threads.id
                 and ftd.division_id = get_user_division(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Notifikasi in-app (per orang)
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  link text,                      -- mis. /meeting/<id>
  kind text not null default 'info'
    check (kind in ('info', 'meeting', 'task', 'thread', 'action_item')),
  read_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists notifications_user_unread_idx
  on notifications (user_id, read_at, created_at desc);

alter table notifications enable row level security;

-- Hanya pemilik yang boleh membaca & menandai notifikasinya sendiri.
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on notifications;
create policy "notifications_delete_own" on notifications
  for delete using (user_id = auth.uid());

-- Semua user login boleh MEMBUAT notifikasi untuk orang lain (mis. saat
-- mengundang ke rapat), tapi harus jujur mencantumkan dirinya di created_by.
drop policy if exists "notifications_insert_authenticated" on notifications;
create policy "notifications_insert_authenticated" on notifications
  for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());

grant select, insert, update, delete on notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Sub-item untuk action item
-- ---------------------------------------------------------------------------
alter table action_items
  add column if not exists parent_id uuid references action_items(id) on delete cascade;

create index if not exists action_items_parent_idx on action_items (parent_id);

-- decisions & action_items perlu updated_at untuk jejak edit.
alter table decisions add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------------
-- 4. Catatan Khusus & Job List (menu baru)
-- ---------------------------------------------------------------------------
create table if not exists special_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  division_id uuid references divisions(id) on delete set null,
  is_private boolean not null default true,   -- true = hanya pembuat
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists job_list (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assignee_id uuid references auth.users(id) on delete set null,
  division_id uuid references divisions(id) on delete set null,
  due_date date,
  done boolean not null default false,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table special_notes enable row level security;
alter table job_list enable row level security;

-- Catatan: privat hanya pembuat; kalau tidak privat, semua yang login boleh baca.
drop policy if exists "special_notes_select" on special_notes;
create policy "special_notes_select" on special_notes
  for select using (
    auth.role() = 'authenticated'
    and (
      created_by = auth.uid()
      or is_private = false
      or get_user_role(auth.uid()) in ('superadmin', 'admin')
    )
  );

drop policy if exists "special_notes_write_own" on special_notes;
create policy "special_notes_write_own" on special_notes
  for all using (created_by = auth.uid() or get_user_role(auth.uid()) in ('superadmin', 'admin'))
  with check (created_by = auth.uid() or get_user_role(auth.uid()) in ('superadmin', 'admin'));

-- Job list: transparan untuk semua yang login (konsisten dgn pm_tasks).
drop policy if exists "job_list_select" on job_list;
create policy "job_list_select" on job_list
  for select using (auth.role() = 'authenticated');

-- Pembuat & yang ditugaskan boleh mengubah; Management/Owner bebas.
drop policy if exists "job_list_write" on job_list;
create policy "job_list_write" on job_list
  for all using (
    created_by = auth.uid()
    or assignee_id = auth.uid()
    or get_user_role(auth.uid()) in ('superadmin', 'admin')
  )
  with check (
    created_by = auth.uid()
    or assignee_id = auth.uid()
    or get_user_role(auth.uid()) in ('superadmin', 'admin')
  );

grant select, insert, update, delete on special_notes, job_list to authenticated;

drop trigger if exists trg_special_notes_touch on special_notes;
create trigger trg_special_notes_touch
  before update on special_notes
  for each row execute function pm_touch_updated_at();

drop trigger if exists trg_job_list_touch on job_list;
create trigger trg_job_list_touch
  before update on job_list
  for each row execute function pm_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Gambar untuk Catatan Visual
-- ---------------------------------------------------------------------------
create table if not exists meeting_images (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  storage_path text not null,
  caption text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists meeting_images_meeting_idx on meeting_images (meeting_id);

alter table meeting_images enable row level security;

drop policy if exists "meeting_images_select" on meeting_images;
create policy "meeting_images_select" on meeting_images
  for select using (auth.role() = 'authenticated' and can_view_meeting(meeting_id, auth.uid()));

drop policy if exists "meeting_images_write" on meeting_images;
create policy "meeting_images_write" on meeting_images
  for all using (
    get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
    or created_by = auth.uid()
  )
  with check (
    get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
    or created_by = auth.uid()
  );

grant select, insert, update, delete on meeting_images to authenticated;

-- Bucket publik untuk gambar rapat (dipakai <img> di Catatan Visual).
insert into storage.buckets (id, name, public)
values ('meeting-images', 'meeting-images', true)
on conflict (id) do nothing;
