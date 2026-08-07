import type { LucideIcon } from "lucide-react";

// Tampilan saat daftar kosong. Dibuat satu komponen supaya semua halaman
// memberi pesan kosong yang bentuknya sama -- dan supaya bedanya jelas antara
// "memang belum ada isinya" dan "ada isinya tapi tersaring habis oleh filter".
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-bold text-slate-600">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
