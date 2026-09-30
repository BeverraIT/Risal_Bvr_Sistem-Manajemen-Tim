"use client";

// Cadangan terakhir kalau layout (root atau (app)) sendiri yang gagal --
// mis. Supabase tidak terjangkau. Merender dokumen sendiri tanpa CSS global,
// jadi gaya ditulis inline.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#1e293b",
          padding: 16,
        }}
      >
        <title>Terjadi kesalahan</title>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Aplikasi gagal dimuat</h2>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>
            Coba lagi beberapa saat. Kalau masih gagal, laporkan ke admin
            {error.digest ? ` dengan kode ${error.digest}` : ""}.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              padding: "8px 16px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
