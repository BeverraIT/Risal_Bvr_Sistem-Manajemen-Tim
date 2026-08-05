-- ============================================================================
-- PERBAIKAN RLS: "new row violates row-level security policy"
-- untuk tabel "meetings" (Jadwalkan Rapat) dan "forum_threads" (Buat Thread).
--
-- CARA PAKAI:
--   Supabase Dashboard -> SQL Editor -> New query -> tempel SELURUH file ini
--   -> Run. Aman dijalankan berkali-kali (idempotent).
--
-- PENYEBAB:
--   App memakai .insert(...).select("id") = INSERT ... RETURNING. PostgreSQL
--   ikut mengevaluasi SELECT policy untuk baris yang baru dibuat. SELECT
--   policy lama memanggil can_view_meeting()/can_view_thread() yang membaca
--   ULANG tabelnya sendiri -- baris baru itu belum terlihat selama statement
--   INSERT masih berjalan, jadi fungsi balas false -> error 42501 dengan
--   pesan "new row violates row-level security policy" (menyesatkan: yang
--   menolak adalah SELECT policy, bukan INSERT policy).
--
-- SOLUSI:
--   Tulis ulang SELECT policy secara inline pada kolom row-nya sendiri, jadi
--   dievaluasi langsung di tuple tanpa perlu re-query tabelnya.
--   Sekaligus: Management (admin) ikut bisa melihat rapat/thread Internal
--   Divisi, bukan cuma Owner (superadmin).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. meetings: SELECT policy inline (memperbaiki INSERT ... RETURNING)
-- ---------------------------------------------------------------------------
drop policy if exists "meetings_select_authenticated" on meetings;
drop policy if exists "meetings_select_visible" on meetings;
create policy "meetings_select_visible" on meetings
  for select using (
    auth.role() = 'authenticated'
    and (
      visibility = 'public'
      or created_by = auth.uid()
      or get_user_role(auth.uid()) in ('superadmin', 'admin')
      or exists (
        select 1 from meeting_divisions md
        where md.meeting_id = meetings.id
        and md.division_id = get_user_division(auth.uid())
      )
    )
  );

-- Pastikan INSERT policy meetings ada & benar (Owner/Management/Lead).
drop policy if exists "meetings_write_leader_admin" on meetings;
drop policy if exists "meetings_insert_leader_admin" on meetings;
create policy "meetings_insert_leader_admin" on meetings
  for insert with check (
    created_by = auth.uid()
    and get_user_role(auth.uid()) in ('superadmin', 'admin', 'leader')
  );

-- ---------------------------------------------------------------------------
-- 2. forum_threads: SELECT policy inline + INSERT policy tunggal
-- ---------------------------------------------------------------------------
drop policy if exists "forum_threads_select_authenticated" on forum_threads;
drop policy if exists "forum_threads_select_visible" on forum_threads;
create policy "forum_threads_select_visible" on forum_threads
  for select using (
    auth.role() = 'authenticated'
    and (
      visibility = 'public'
      or created_by = auth.uid()
      or get_user_role(auth.uid()) in ('superadmin', 'admin')
      or exists (
        select 1 from forum_thread_divisions ftd
        where ftd.thread_id = forum_threads.id
        and ftd.division_id = get_user_division(auth.uid())
      )
    )
  );

drop policy if exists "forum_threads_insert_authenticated" on forum_threads;
drop policy if exists "forum_threads_insert_public"        on forum_threads;
drop policy if exists "forum_threads_insert_private"       on forum_threads;
drop policy if exists "forum_threads_insert_own"           on forum_threads;
create policy "forum_threads_insert_own" on forum_threads
  for insert with check (
    auth.role() = 'authenticated' and created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 3. Helper function: Management (admin) ikut bypass privasi internal divisi.
--    Dipakai policy tabel turunan (notulen, decisions, action_items, posts).
-- ---------------------------------------------------------------------------
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

  return exists (
    select 1 from forum_thread_divisions ftd
    where ftd.thread_id = p_thread_id
    and ftd.division_id = get_user_division(p_uid)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Grant dasar (RLS policy tidak berlaku kalau privilege tabelnya tidak ada)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on meetings, forum_threads, forum_posts to authenticated;
grant select, insert, delete on meeting_divisions, forum_thread_divisions to authenticated;

-- ---------------------------------------------------------------------------
-- 5. DIAGNOSTIK -- lihat hasilnya di tab Results setelah Run.
-- ---------------------------------------------------------------------------

-- 5a. Role Anda menurut database (harus superadmin / admin / leader supaya
--     boleh membuat rapat). Kalau hasilnya kosong atau 'staff', itu masalah
--     terpisah: baris di user_roles belum benar.
select
  auth.uid()                    as user_id_anda,
  get_user_role(auth.uid())     as role_menurut_db,
  get_user_division(auth.uid()) as divisi_menurut_db;

-- 5b. Policy yang aktif sekarang di kedua tabel.
select tablename, policyname, cmd
from pg_policies
where tablename in ('meetings', 'forum_threads')
order by tablename, cmd, policyname;

-- 5c. Cek migrasi mana yang sudah/belum mendarat -- kolom & tabel penanda.
select
  to_regclass('public.meeting_divisions')       is not null as migrasi_0012_rapat_privat,
  to_regclass('public.pm_tasks')                is not null as migrasi_0013_tugas,
  to_regclass('public.retros')                  is not null as migrasi_0014_evaluasi,
  to_regclass('public.pm_task_staff')           is not null as migrasi_0022_staff_pelaksana,
  exists (select 1 from information_schema.columns
          where table_name = 'meetings' and column_name = 'visibility') as kolom_visibility_rapat;
