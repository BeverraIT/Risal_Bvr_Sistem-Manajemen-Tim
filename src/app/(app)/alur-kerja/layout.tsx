import { notFound } from "next/navigation";

// Modul Alur Kerja & SOP sementara dinonaktifkan atas permintaan. Kodenya
// sengaja TIDAK dihapus -- penjaga ini menutup seluruh rute di bawah
// /alur-kerja (termasuk /alur-kerja/[id] dan /alur-kerja/approval) supaya
// tidak bisa dibuka lewat URL langsung meski menunya sudah disembunyikan.
//
// Untuk menghidupkan kembali: hapus file ini, lalu kembalikan baris menu
// "Alur Kerja & SOP" di src/app/(app)/SidebarNav.tsx.
const AKTIF = false;

export default function AlurKerjaLayout({ children }: { children: React.ReactNode }) {
  if (!AKTIF) notFound();
  return <>{children}</>;
}
