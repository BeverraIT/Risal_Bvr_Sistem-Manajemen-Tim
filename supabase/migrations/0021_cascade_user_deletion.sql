-- Memungkinkan hapus permanen akun karyawan (auth.users) dari menu Team Divisi.
--
-- Sebelumnya banyak FK ke auth.users memakai perilaku default (NO ACTION), jadi
-- menghapus akun yang punya jejak di tabel lain ditolak database -> muncul error
-- kosong "{}" di UI. Migrasi ini menetapkan perilaku ON DELETE eksplisit:
--
--   * SET NULL  untuk kolom NULLABLE  -> konten/record tetap ada, atribusi hilang
--                                        (notulen, thread forum, proyek, dsb).
--   * CASCADE   untuk kolom NOT NULL  -> baris ikut terhapus karena tak bisa NULL
--                                        (evaluasi, kehadiran rapat, tugas KPI).
--
-- Idempoten: drop constraint if exists lalu add ulang, aman dijalankan berkali-kali.

-- ---------------------------------------------------------------------------
-- SET NULL (kolom nullable, record dipertahankan)
-- ---------------------------------------------------------------------------

alter table divisions drop constraint if exists divisions_leader_id_fkey;
alter table divisions add constraint divisions_leader_id_fkey
  foreign key (leader_id) references auth.users(id) on delete set null;

alter table kpi_entries drop constraint if exists kpi_entries_entered_by_fkey;
alter table kpi_entries add constraint kpi_entries_entered_by_fkey
  foreign key (entered_by) references auth.users(id) on delete set null;

alter table forum_threads drop constraint if exists forum_threads_created_by_fkey;
alter table forum_threads add constraint forum_threads_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table forum_posts drop constraint if exists forum_posts_author_id_fkey;
alter table forum_posts add constraint forum_posts_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

alter table meetings drop constraint if exists meetings_created_by_fkey;
alter table meetings add constraint meetings_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table notulen drop constraint if exists notulen_created_by_fkey;
alter table notulen add constraint notulen_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table action_items drop constraint if exists action_items_assignee_id_fkey;
alter table action_items add constraint action_items_assignee_id_fkey
  foreign key (assignee_id) references auth.users(id) on delete set null;

alter table kpi_tasks drop constraint if exists kpi_tasks_reviewed_by_fkey;
alter table kpi_tasks add constraint kpi_tasks_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table projects drop constraint if exists projects_created_by_fkey;
alter table projects add constraint projects_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table pm_projects drop constraint if exists pm_projects_assignee_id_fkey;
alter table pm_projects add constraint pm_projects_assignee_id_fkey
  foreign key (assignee_id) references auth.users(id) on delete set null;

alter table pm_projects drop constraint if exists pm_projects_created_by_fkey;
alter table pm_projects add constraint pm_projects_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table pm_tasks drop constraint if exists pm_tasks_assignee_id_fkey;
alter table pm_tasks add constraint pm_tasks_assignee_id_fkey
  foreign key (assignee_id) references auth.users(id) on delete set null;

alter table pm_tasks drop constraint if exists pm_tasks_created_by_fkey;
alter table pm_tasks add constraint pm_tasks_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table retros drop constraint if exists retros_evaluator_id_fkey;
alter table retros add constraint retros_evaluator_id_fkey
  foreign key (evaluator_id) references auth.users(id) on delete set null;

alter table retros drop constraint if exists retros_assignee_id_fkey;
alter table retros add constraint retros_assignee_id_fkey
  foreign key (assignee_id) references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- CASCADE (kolom NOT NULL, baris ikut terhapus)
-- ---------------------------------------------------------------------------

alter table evaluations_individual drop constraint if exists evaluations_individual_rater_id_fkey;
alter table evaluations_individual add constraint evaluations_individual_rater_id_fkey
  foreign key (rater_id) references auth.users(id) on delete cascade;

alter table evaluations_individual drop constraint if exists evaluations_individual_ratee_id_fkey;
alter table evaluations_individual add constraint evaluations_individual_ratee_id_fkey
  foreign key (ratee_id) references auth.users(id) on delete cascade;

alter table evaluations_cross_division drop constraint if exists evaluations_cross_division_rater_user_id_fkey;
alter table evaluations_cross_division add constraint evaluations_cross_division_rater_user_id_fkey
  foreign key (rater_user_id) references auth.users(id) on delete cascade;

alter table meeting_attendees drop constraint if exists meeting_attendees_user_id_fkey;
alter table meeting_attendees add constraint meeting_attendees_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table kpi_tasks drop constraint if exists kpi_tasks_assignee_id_fkey;
alter table kpi_tasks add constraint kpi_tasks_assignee_id_fkey
  foreign key (assignee_id) references auth.users(id) on delete cascade;

alter table kpi_tasks drop constraint if exists kpi_tasks_assigned_by_fkey;
alter table kpi_tasks add constraint kpi_tasks_assigned_by_fkey
  foreign key (assigned_by) references auth.users(id) on delete cascade;
