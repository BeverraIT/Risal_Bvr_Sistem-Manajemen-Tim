-- Fase 11: Staff pelaksana tugas (many-to-many), terpisah dari PIC.
--
-- PIC (pm_tasks.assignee_id) TETAP satu orang -- penanggung jawab yang
-- me-review/menggerakkan status. Tabel baru ini menampung staff tambahan
-- yang ikut mengerjakan tugas tsb, tanpa mengubah semantik PIC.
--
-- Poin: saat task selesai (status = done), poin task dibagi rata ke PIC +
-- semua staff pelaksana (lihat ulang pm_user_points di bawah).

create table if not exists pm_task_staff (
  task_id uuid not null references pm_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (task_id, user_id)
);

alter table pm_task_staff enable row level security;

-- Baca: sama seperti pm_tasks -- semua authenticated boleh baca (transparansi).
drop policy if exists "pm_task_staff_select_authenticated" on pm_task_staff;
create policy "pm_task_staff_select_authenticated" on pm_task_staff
  for select using (auth.role() = 'authenticated');

-- Tulis: siapa pun yang boleh mengubah task itu sendiri (Lead divisi terkait,
-- atau Management/Owner) juga boleh mengatur staff pelaksananya.
drop policy if exists "pm_task_staff_write_leader_admin" on pm_task_staff;
create policy "pm_task_staff_write_leader_admin" on pm_task_staff
  for all using (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or exists (
      select 1 from pm_tasks t
      where t.id = pm_task_staff.task_id
      and t.division_id = get_user_division(auth.uid())
      and get_user_role(auth.uid()) = 'leader'
    )
  )
  with check (
    get_user_role(auth.uid()) in ('superadmin', 'admin')
    or exists (
      select 1 from pm_tasks t
      where t.id = pm_task_staff.task_id
      and t.division_id = get_user_division(auth.uid())
      and get_user_role(auth.uid()) = 'leader'
    )
  );

grant select, insert, update, delete on pm_task_staff to authenticated;

-- ---------------------------------------------------------------------------
-- Poin per user: dibagi rata antara PIC (assignee_id) + staff pelaksana
-- (pm_task_staff) untuk task yang sudah 'done'. Task tanpa staff pelaksana
-- berperilaku identik seperti sebelumnya (1 penerima = PIC, poin penuh).
-- ---------------------------------------------------------------------------
-- Harus drop dulu, bukan "create or replace": 0013 mendefinisikan
-- total_points sebagai sum(points) (bigint), sedangkan di sini jadi numeric,
-- dan Postgres menolak "create or replace view" yang mengubah tipe kolom.
-- Tanpa ini migrasi gagal di database yang dibangun dari nol. security_invoker
-- dan grant dipasang ulang di bawah, jadi tidak ada yang hilang.
drop view if exists pm_user_points;
create view pm_user_points as
with done_tasks as (
  select id, points, assignee_id
  from pm_tasks
  where status = 'done'
),
recipients as (
  -- PIC selalu jadi salah satu penerima.
  select id as task_id, points, assignee_id as user_id
  from done_tasks
  where assignee_id is not null
  union all
  -- Staff pelaksana tambahan.
  select dt.id as task_id, dt.points, ts.user_id
  from done_tasks dt
  join pm_task_staff ts on ts.task_id = dt.id
),
recipient_counts as (
  select task_id, count(*) as n from recipients group by task_id
)
select
  r.user_id as assignee_id,
  sum(r.points::numeric / rc.n) as total_points,
  count(*) as done_count
from recipients r
join recipient_counts rc on rc.task_id = r.task_id
group by r.user_id;

alter view pm_user_points set (security_invoker = true);
grant select on pm_user_points to authenticated;
