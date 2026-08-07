// Panjang minimum password yang diterima Supabase Auth.
//
// Ditaruh di sini, bukan di file server action, karena file bertanda
// "use server" hanya boleh mengekspor fungsi async -- mengekspor konstanta
// dari sana membuat seluruh modulnya gagal dikompilasi. Dipakai bersama oleh
// form di klien dan pemeriksaan di server supaya pesannya tidak berbeda.
export const MIN_PANJANG_PASSWORD = 6;
