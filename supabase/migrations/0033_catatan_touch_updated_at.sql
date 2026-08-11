-- special_notes & job_list memakai pm_touch_updated_at() yang membumbui
-- updated_at pada SETIAP update. Masalahnya drag & drop prioritas menulis
-- ulang kolom `position` di SEMUA baris sekaligus -- jadi sekali geser,
-- seluruh daftar tercatat "baru diubah" dan tanggal terakhir-diubah kehilangan
-- artinya persis saat mau mulai ditampilkan di UI.
--
-- Trigger khusus di bawah ini menahan pembaruan updated_at kalau satu-satunya
-- yang berubah memang cuma `position`. Perubahan lain (judul, isi, status
-- selesai, kaitan ke job) tetap membumbui seperti biasa.
create or replace function catatan_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.position is distinct from old.position
     and (to_jsonb(new) - 'position' - 'updated_at')
       = (to_jsonb(old) - 'position' - 'updated_at') then
    new.updated_at := old.updated_at;
    return new;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_special_notes_touch on special_notes;
create trigger trg_special_notes_touch
  before update on special_notes
  for each row execute function catatan_touch_updated_at();

drop trigger if exists trg_job_list_touch on job_list;
create trigger trg_job_list_touch
  before update on job_list
  for each row execute function catatan_touch_updated_at();
