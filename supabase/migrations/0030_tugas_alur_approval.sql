-- Fondasi restrukturisasi menu Tugas jadi tiga tahap:
--   Ide  ->  Menunggu Persetujuan  ->  Daftar Tugas
--
-- Sebelumnya status 'idea' merangkap dua peran sekaligus (ide mentah DAN
-- antrean approval), sehingga tidak ada cara membedakan "baru sebatas usulan"
-- dari "sudah diajukan dan menunggu keputusan". Status 'waiting_approval'
-- memisahkan keduanya.
--
-- Sekalian menambah yang dibutuhkan Daftar Tugas: progress, komentar,
-- lampiran, dan riwayat aktivitas.
--
-- Aman dijalankan berkali-kali.

-- ---------------------------------------------------------------------------
-- 1. Status baru: menunggu persetujuan
-- ---------------------------------------------------------------------------
-- CATATAN: nilai enum yang baru ditambahkan tidak boleh langsung dipakai di
-- transaksi yang sama (mis. sebagai default atau di dalam CHECK), jadi di file
-- ini nilainya hanya didaftarkan -- pemakaiannya ada di kode aplikasi.
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'task_status' and e.enumlabel = 'waiting_approval'
  ) then
    alter type task_status add value 'waiting_approval' after 'idea';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Progress pekerjaan (0-100)
-- ---------------------------------------------------------------------------
alter table pm_tasks add column if not exists progress smallint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pm_tasks_progress_range'
  ) then
    alter table pm_tasks
      add constraint pm_tasks_progress_range check (progress between 0 and 100);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Komentar
-- ---------------------------------------------------------------------------
create table if not exists pm_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references pm_tasks(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists idx_pm_task_comments_task on pm_task_comments(task_id, created_at);

alter table pm_task_comments enable row level security;

drop policy if exists "pm_task_comments_select" on pm_task_comments;
create policy "pm_task_comments_select" on pm_task_comments
  for select using (auth.role() = 'authenticated');

drop policy if exists "pm_task_comments_insert_own" on pm_task_comments;
create policy "pm_task_comments_insert_own" on pm_task_comments
  for insert with check (author_id = auth.uid());

-- Komentar hanya boleh disunting penulisnya; dihapus penulisnya atau atasan.
drop policy if exists "pm_task_comments_update_own" on pm_task_comments;
create policy "pm_task_comments_update_own" on pm_task_comments
  for update using (author_id = auth.uid());

drop policy if exists "pm_task_comments_delete_own_or_admin" on pm_task_comments;
create policy "pm_task_comments_delete_own_or_admin" on pm_task_comments
  for delete using (
    author_id = auth.uid()
    or get_user_role(auth.uid()) in ('superadmin', 'admin')
  );

-- ---------------------------------------------------------------------------
-- 4. Lampiran
-- ---------------------------------------------------------------------------
create table if not exists pm_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references pm_tasks(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_name text not null,
  -- Path di bucket Storage "task-attachments", bukan URL publik: bucket-nya
  -- privat, jadi link-nya harus ditandatangani saat mau diunduh.
  file_path text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);
create index if not exists idx_pm_task_attachments_task on pm_task_attachments(task_id, created_at);

alter table pm_task_attachments enable row level security;

drop policy if exists "pm_task_attachments_select" on pm_task_attachments;
create policy "pm_task_attachments_select" on pm_task_attachments
  for select using (auth.role() = 'authenticated');

drop policy if exists "pm_task_attachments_insert_own" on pm_task_attachments;
create policy "pm_task_attachments_insert_own" on pm_task_attachments
  for insert with check (uploaded_by = auth.uid());

drop policy if exists "pm_task_attachments_delete_own_or_admin" on pm_task_attachments;
create policy "pm_task_attachments_delete_own_or_admin" on pm_task_attachments
  for delete using (
    uploaded_by = auth.uid()
    or get_user_role(auth.uid()) in ('superadmin', 'admin')
  );

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Riwayat aktivitas
-- ---------------------------------------------------------------------------
-- Hanya bisa ditambah, tidak bisa diubah/dihapus dari aplikasi -- riwayat yang
-- bisa disunting tidak ada gunanya sebagai jejak audit.
create table if not exists pm_task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references pm_tasks(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  -- mis. 'created', 'status_changed', 'assigned', 'progress_changed',
  -- 'approved', 'rejected', 'commented', 'attachment_added'
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists idx_pm_task_activity_task on pm_task_activity(task_id, created_at desc);

alter table pm_task_activity enable row level security;

drop policy if exists "pm_task_activity_select" on pm_task_activity;
create policy "pm_task_activity_select" on pm_task_activity
  for select using (auth.role() = 'authenticated');

drop policy if exists "pm_task_activity_insert_own" on pm_task_activity;
create policy "pm_task_activity_insert_own" on pm_task_activity
  for insert with check (actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on pm_task_comments to authenticated;
grant select, insert, delete on pm_task_attachments to authenticated;
grant select, insert on pm_task_activity to authenticated;
