-- Fase: Alur Kerja / SOP berbasis diagram.
--
-- Konsep: satu FLOW = satu proses kerja, digambar sebagai diagram node-based.
--   flow_nodes  : kotak langkah (mulai/langkah/keputusan/selesai) + posisi kanvas
--   flow_edges  : panah antar node (boleh berlabel "Ya"/"Tidak" untuk cabang)
--   flow_issues : laporan masalah yang NEMPEL ke sebuah node -> peta titik rawan
--   flow_revisions : riwayat versi + alasan perubahan (SOP hidup)
--
-- Hak akses (via RLS, pakai helper get_user_role / get_user_division dari 0001):
--   - Leader     : lihat + edit flow DIVISINYA SENDIRI saja.
--   - Staff      : lihat (read-only) flow divisinya (untuk onboarding). Boleh lapor masalah.
--   - Management/Owner (admin/superadmin): lihat SEMUA flow + review (setujui/minta revisi).
--   - Leader divisi lain: TIDAK bisa lihat (ter-scope ke divisinya).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type flow_status as enum ('draft', 'diajukan', 'disetujui', 'perlu_revisi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type flow_node_type as enum ('mulai', 'langkah', 'keputusan', 'selesai');
exception when duplicate_object then null; end $$;

do $$ begin
  create type flow_issue_status as enum ('terbuka', 'selesai');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists flows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  division_id uuid references divisions(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  status flow_status not null default 'draft',
  version integer not null default 1,
  review_note text,                                    -- catatan owner saat minta revisi
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists flow_nodes (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flows(id) on delete cascade,
  type flow_node_type not null default 'langkah',
  title text not null default '',
  description text,
  assignee_id uuid references auth.users(id) on delete set null,
  pos_x double precision not null default 0,
  pos_y double precision not null default 0,
  created_at timestamptz default now()
);

create table if not exists flow_edges (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flows(id) on delete cascade,
  source_node uuid not null references flow_nodes(id) on delete cascade,
  target_node uuid not null references flow_nodes(id) on delete cascade,
  label text,
  created_at timestamptz default now()
);

create table if not exists flow_issues (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flows(id) on delete cascade,   -- denormalisasi utk query cepat
  node_id uuid not null references flow_nodes(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  description text not null,
  status flow_issue_status not null default 'terbuka',
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists flow_revisions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flows(id) on delete cascade,
  version integer not null,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_flows_division on flows(division_id);
create index if not exists idx_flow_nodes_flow on flow_nodes(flow_id);
create index if not exists idx_flow_edges_flow on flow_edges(flow_id);
create index if not exists idx_flow_issues_node on flow_issues(node_id);
create index if not exists idx_flow_issues_flow on flow_issues(flow_id);
create index if not exists idx_flow_revisions_flow on flow_revisions(flow_id);

-- ---------------------------------------------------------------------------
-- updated_at otomatis untuk flows
-- ---------------------------------------------------------------------------
create or replace function flows_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_flows_updated_at on flows;
create trigger trg_flows_updated_at
  before update on flows
  for each row execute function flows_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table flows enable row level security;
alter table flow_nodes enable row level security;
alter table flow_edges enable row level security;
alter table flow_issues enable row level security;
alter table flow_revisions enable row level security;

-- Helper: apakah user boleh MELIHAT flow divisi tertentu (admin/owner = semua).
create or replace function can_view_division(div uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select get_user_role(auth.uid()) in ('superadmin', 'admin')
      or div = get_user_division(auth.uid());
$$;

-- Helper: apakah user adalah leader yang boleh MENGEDIT flow divisi tertentu.
create or replace function can_edit_division(div uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select get_user_role(auth.uid()) = 'leader'
     and div = get_user_division(auth.uid());
$$;

-- flows -----------------------------------------------------------------
drop policy if exists "flows_select" on flows;
create policy "flows_select" on flows
  for select using (can_view_division(division_id));

drop policy if exists "flows_insert_leader" on flows;
create policy "flows_insert_leader" on flows
  for insert with check (
    can_edit_division(division_id) and owner_id = auth.uid()
  );

-- Leader mengubah isi flow divisinya; admin/superadmin mengubah untuk review.
drop policy if exists "flows_update_leader" on flows;
create policy "flows_update_leader" on flows
  for update using (can_edit_division(division_id));

drop policy if exists "flows_update_reviewer" on flows;
create policy "flows_update_reviewer" on flows
  for update using (get_user_role(auth.uid()) in ('superadmin', 'admin'));

drop policy if exists "flows_delete" on flows;
create policy "flows_delete" on flows
  for delete using (
    can_edit_division(division_id) or get_user_role(auth.uid()) = 'superadmin'
  );

-- flow_nodes ------------------------------------------------------------
drop policy if exists "flow_nodes_select" on flow_nodes;
create policy "flow_nodes_select" on flow_nodes
  for select using (
    exists (select 1 from flows f where f.id = flow_nodes.flow_id and can_view_division(f.division_id))
  );

drop policy if exists "flow_nodes_write" on flow_nodes;
create policy "flow_nodes_write" on flow_nodes
  for all using (
    exists (select 1 from flows f where f.id = flow_nodes.flow_id and can_edit_division(f.division_id))
  ) with check (
    exists (select 1 from flows f where f.id = flow_nodes.flow_id and can_edit_division(f.division_id))
  );

-- flow_edges ------------------------------------------------------------
drop policy if exists "flow_edges_select" on flow_edges;
create policy "flow_edges_select" on flow_edges
  for select using (
    exists (select 1 from flows f where f.id = flow_edges.flow_id and can_view_division(f.division_id))
  );

drop policy if exists "flow_edges_write" on flow_edges;
create policy "flow_edges_write" on flow_edges
  for all using (
    exists (select 1 from flows f where f.id = flow_edges.flow_id and can_edit_division(f.division_id))
  ) with check (
    exists (select 1 from flows f where f.id = flow_edges.flow_id and can_edit_division(f.division_id))
  );

-- flow_issues -----------------------------------------------------------
-- Lihat: siapa pun yang bisa lihat flow-nya. Lapor: anggota divisi (termasuk staff).
drop policy if exists "flow_issues_select" on flow_issues;
create policy "flow_issues_select" on flow_issues
  for select using (
    exists (select 1 from flows f where f.id = flow_issues.flow_id and can_view_division(f.division_id))
  );

drop policy if exists "flow_issues_insert" on flow_issues;
create policy "flow_issues_insert" on flow_issues
  for insert with check (
    exists (select 1 from flows f where f.id = flow_issues.flow_id and can_view_division(f.division_id))
    and reporter_id = auth.uid()
  );

-- Tandai selesai: leader divisi tsb, atau admin/superadmin.
drop policy if exists "flow_issues_update" on flow_issues;
create policy "flow_issues_update" on flow_issues
  for update using (
    exists (select 1 from flows f where f.id = flow_issues.flow_id
      and (can_edit_division(f.division_id) or get_user_role(auth.uid()) in ('superadmin', 'admin')))
  );

-- flow_revisions --------------------------------------------------------
drop policy if exists "flow_revisions_select" on flow_revisions;
create policy "flow_revisions_select" on flow_revisions
  for select using (
    exists (select 1 from flows f where f.id = flow_revisions.flow_id and can_view_division(f.division_id))
  );

drop policy if exists "flow_revisions_insert" on flow_revisions;
create policy "flow_revisions_insert" on flow_revisions
  for insert with check (
    exists (select 1 from flows f where f.id = flow_revisions.flow_id and can_edit_division(f.division_id))
  );

-- ---------------------------------------------------------------------------
-- Grants (authenticated; RLS tetap yang menyaring baris)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on flows to authenticated;
grant select, insert, update, delete on flow_nodes to authenticated;
grant select, insert, update, delete on flow_edges to authenticated;
grant select, insert, update, delete on flow_issues to authenticated;
grant select, insert, update, delete on flow_revisions to authenticated;
