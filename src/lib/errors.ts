// Blok catch di TypeScript menerima `unknown` -- yang dilempar belum tentu
// Error. Helper ini mengambil pesannya kalau ada, dan memakai pesan cadangan
// kalau tidak, supaya tidak perlu `any` di setiap catch.
//
// Client-safe: tidak mengimpor apa pun yang server-only.
export function pesanError(err: unknown, cadangan: string): string {
  return err instanceof Error && err.message ? err.message : cadangan;
}
