-- Panah di editor Alur Kerja sebelumnya cuma bisa keluar dari sisi bawah dan
-- masuk ke sisi atas, karena flow_edges tidak menyimpan sisi mana panah
-- menempel. Kolom di bawah ini menyimpannya, supaya panah bisa ditarik dari
-- sisi mana saja (kiri/kanan/atas/bawah) dan posisinya tetap setelah disimpan.
--
-- edge_type menyimpan bentuk garis: 'smoothstep' (siku, default -- paling
-- terbaca untuk flowchart), 'straight' (lurus), atau 'default' (lengkung).
alter table flow_edges
  add column if not exists source_handle text,
  add column if not exists target_handle text,
  add column if not exists edge_type text not null default 'smoothstep';
