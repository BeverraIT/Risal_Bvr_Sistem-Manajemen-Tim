// Client-safe helper: jalankan server action "fire-and-forget" (yang melempar
// Error saat gagal) tanpa menelan kegagalannya diam-diam. Di produksi pesan
// error server action disamarkan Next.js, jadi yang ditampilkan ke user
// adalah pesan fallback; detail aslinya ada di log server.
export async function runAction(
  action: () => Promise<unknown>,
  fallbackMessage = "Gagal menyimpan perubahan. Muat ulang halaman lalu coba lagi.",
): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (err) {
    console.error(err);
    window.alert(fallbackMessage);
    return false;
  }
}
