-- Naikkan batas ukuran file bucket "meeting-recordings" ke 500MB supaya
-- rekaman rapat panjang (2 jam+) tidak ditolak saat upload.
--
-- CATATAN PENTING: 0021 sengaja TIDAK menaruh file_size_limit eksplisit
-- karena percobaan sebelumnya (100MB) melebihi batas upload GLOBAL project
-- Supabase saat itu dan membuat createBucket() gagal total. Supabase
-- menegakkan nilai efektif = MIN(file_size_limit bucket ini, batas global
-- project). Kalau project masih di paket Free, batas global defaultnya
-- 50MB dan value 500MB di sini TIDAK akan berlaku sampai batas global project
-- juga dinaikkan lewat Dashboard: Project Settings -> Storage -> Global file
-- size limit (butuh paket Pro ke atas untuk limit sebesar ini).
update storage.buckets
set file_size_limit = 524288000 -- 500MB
where id = 'meeting-recordings';
