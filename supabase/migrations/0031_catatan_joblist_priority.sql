-- Catatan Khusus & Job List disederhanakan jadi satu daftar prioritas
-- pribadi per orang: divisi/assignee/due date/toggle privat dibuang dari
-- form, diganti urutan drag & drop (position) yang gabungan lintas dua
-- tabel, dan catatan bisa dikaitkan ke satu job list.
alter table special_notes
  add column if not exists position integer not null default 0,
  add column if not exists related_job_id uuid references job_list(id) on delete set null;

alter table job_list
  add column if not exists position integer not null default 0;

create index if not exists special_notes_related_job_idx on special_notes (related_job_id);
create index if not exists special_notes_created_by_idx on special_notes (created_by);
create index if not exists job_list_created_by_idx on job_list (created_by);

-- Kedua tabel sudah mengizinkan superadmin/admin baca & tulis semua baris
-- (special_notes_select & special_notes_write_own, job_list_select &
-- job_list_write -- lihat 0026), jadi Management/Owner otomatis bisa lihat
-- (dan sudah lama bisa lihat) job list & catatan khusus siapa pun tanpa
-- perlu policy baru. Tidak ada perubahan RLS di migration ini.
