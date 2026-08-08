-- ============================================================================
-- HAPUS DIVISI YANG TIDAK PUNYA LEADER DAN TIDAK PUNYA STAF (kosong total)
--
-- CARA PAKAI:
--   Supabase Dashboard -> SQL Editor -> New query -> jalankan bertahap:
--     1) Lihat daftar kandidat.
--     2) Cek apakah kandidat itu masih punya data historis nyangkut di
--        tabel lain -- kalau ada angka bukan 0, JANGAN lanjut ke langkah 3
--        untuk divisi itu dulu, investigasi dulu datanya.
--     3) Baru jalankan DELETE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Kandidat: leader_id kosong DAN tidak ada satupun profil di divisi itu
-- ---------------------------------------------------------------------------
select d.id, d.name, d.leader_id
from divisions d
where d.leader_id is null
  and not exists (select 1 from profiles p where p.division_id = d.id)
order by d.name;

-- ---------------------------------------------------------------------------
-- 2) Cek data historis yang masih menempel ke kandidat di atas
-- ---------------------------------------------------------------------------
with kandidat as (
  select d.id, d.name from divisions d
  where d.leader_id is null
    and not exists (select 1 from profiles p where p.division_id = d.id)
)
select
  k.name,
  (select count(*) from user_roles ur where ur.division_id = k.id)                                   as user_roles,
  (select count(*) from kpi_metrics m where m.division_id = k.id)                                    as kpi_metrics,
  (select count(*) from kpi_tasks t where t.division_id = k.id)                                      as kpi_tasks,
  (select count(*) from evaluations_cross_division e
     where e.rater_division_id = k.id or e.ratee_division_id = k.id)                                 as evaluasi_lintas_divisi,
  (select count(*) from forum_thread_divisions ftd where ftd.division_id = k.id)                      as forum_threads,
  (select count(*) from meeting_divisions md where md.division_id = k.id)                             as rapat_privat,
  (select count(*) from pm_projects pr where pr.division_id = k.id)                                   as project,
  (select count(*) from pm_tasks pt where pt.division_id = k.id)                                      as tugas,
  (select count(*) from retros r where r.division_id = k.id)                                          as retro,
  (select count(*) from special_notes sn where sn.division_id = k.id)                                 as catatan_khusus,
  (select count(*) from job_list jl where jl.division_id = k.id)                                      as job_list,
  (select count(*) from flows fl where fl.division_id = k.id)                                         as alur_kerja
from kandidat k
order by k.name;

-- ---------------------------------------------------------------------------
-- 3) DELETE -- jalankan hanya setelah langkah 2 dicek dan aman
--    (kalau ada FK tanpa on delete cascade yang masih terisi, Postgres akan
--    menolak dengan error, bukan diam-diam menghapus data -- aman dicoba)
-- ---------------------------------------------------------------------------
delete from divisions d
where d.leader_id is null
  and not exists (select 1 from profiles p where p.division_id = d.id);
