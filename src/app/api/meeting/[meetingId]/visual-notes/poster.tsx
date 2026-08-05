import { ImageResponse } from "next/og";

// Renderer poster "Catatan Visual" -- dipisah dari route.tsx karena file route
// hanya boleh mengekspor HTTP handler, dan supaya bagian render (satori punya
// aturan JSX ketat yang baru meledak saat runtime) bisa diuji terpisah dari
// gate RLS di GET handler.

// Kanvas berukuran tetap, jadi jumlah konten harus dibatasi ketat supaya
// tidak meluber menabrak footer (satori tidak bisa auto-grow).
const MAX_DECISIONS = 4;
const MAX_ACTION_ITEMS = 3;

// Satori hanya merender teks polos; buang sintaks Markdown dari notulen AI.
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export interface VisualNotesInput {
  meeting: { title: string; scheduled_at: string };
  notulenContent: string | null;
  decisions: { content: string }[];
  actionItems: {
    title: string;
    assignee_id: string | null;
    due_date: string | null;
    status: string;
  }[];
  profiles: { id: string; full_name: string }[];
  images?: { url: string; caption: string | null }[];
}

export function renderVisualNotesPoster({
  meeting,
  notulenContent,
  decisions,
  actionItems,
  profiles,
  images = [],
}: VisualNotesInput) {
  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));

  // Ratakan jadi satu paragraf: tiap baris baru di notulen memakan satu baris
  // penuh di poster, membuat tinggi konten tak terprediksi di kanvas tetap.
  const summary = notulenContent
    ? truncate(stripMarkdown(notulenContent).replace(/\s*\n+\s*/g, " "), 320)
    : "Belum ada notulen untuk rapat ini.";

  const shownDecisions = decisions.slice(0, MAX_DECISIONS);
  const moreDecisions = decisions.length - shownDecisions.length;
  const shownItems = actionItems.slice(0, MAX_ACTION_ITEMS);
  const moreItems = actionItems.length - shownItems.length;

  const dateLabel = new Date(meeting.scheduled_at).toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });

  const ink = "#0f172a"; // slate-900
  const inkSecondary = "#475569"; // slate-600
  const inkMuted = "#94a3b8"; // slate-400
  const accent = "#2563eb"; // blue-600 (warna brand aplikasi)
  const border = "#e2e8f0"; // slate-200

  const sectionTitle = (label: string) => (
    <div
      style={{
        fontSize: 20,
        fontWeight: 700,
        color: inkMuted,
        textTransform: "uppercase",
        letterSpacing: 3,
      }}
    >
      {label}
    </div>
  );

  const statTile = (label: string, value: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        backgroundColor: "#f8fafc",
        border: `2px solid ${border}`,
        borderRadius: 20,
        padding: "20px 28px",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 600, color: ink }}>{value}</div>
      <div style={{ fontSize: 19, color: inkSecondary }}>{label}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f1f5f9",
          padding: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            backgroundColor: "#ffffff",
            borderRadius: 28,
            overflow: "hidden",
          }}
        >
          {/* Aksen brand di puncak kartu */}
          <div
            style={{
              height: 10,
              width: "100%",
              backgroundImage: "linear-gradient(90deg, #2563eb, #e11d48)",
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              padding: "40px 52px",
              gap: 28,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: accent,
                  textTransform: "uppercase",
                  letterSpacing: 4,
                }}
              >
                Catatan visual rapat
              </div>
              <div
                style={{
                  fontSize: 46,
                  fontWeight: 800,
                  color: ink,
                  lineHeight: 1.15,
                }}
              >
                {truncate(meeting.title, 90)}
              </div>
              <div style={{ display: "flex", fontSize: 21, color: inkSecondary }}>
                {dateLabel}
              </div>
            </div>

            {/* Stat tiles */}
            <div style={{ display: "flex", gap: 16 }}>
              {statTile("Keputusan", String(decisions.length))}
              {statTile("Action items", String(actionItems.length))}
            </div>

            {/* Ringkasan */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sectionTitle("Ringkasan")}
              <div
                style={{
                  fontSize: 22,
                  color: inkSecondary,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {summary}
              </div>
            </div>

            {/* Gambar rapat (maks 3 supaya tinggi poster tetap terkendali) */}
            {images.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sectionTitle("Dokumentasi")}
                <div style={{ display: "flex", gap: 14 }}>
                  {images.slice(0, 3).map((img, i) => (
                    <img
                      key={i}
                      src={img.url}
                      width={images.length === 1 ? 640 : 300}
                      height={images.length === 1 ? 360 : 200}
                      style={{
                        objectFit: "cover",
                        borderRadius: 16,
                        border: `1px solid ${inkMuted}`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Keputusan */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sectionTitle("Keputusan")}
              {shownDecisions.length === 0 && (
                <div style={{ fontSize: 22, color: inkMuted }}>
                  Belum ada keputusan tercatat.
                </div>
              )}
              {shownDecisions.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: accent,
                      marginTop: 11,
                    }}
                  />
                  <div style={{ display: "flex", flex: 1, fontSize: 22, color: ink, lineHeight: 1.4 }}>
                    {truncate(d.content, 110)}
                  </div>
                </div>
              ))}
              {moreDecisions > 0 && (
                <div style={{ fontSize: 20, color: inkMuted }}>
                  {`+${moreDecisions} keputusan lainnya`}
                </div>
              )}
            </div>

            {/* Action items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              {sectionTitle("Tindak lanjut")}
              {shownItems.length === 0 && (
                <div style={{ fontSize: 22, color: inkMuted }}>Belum ada action item.</div>
              )}
              {shownItems.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    border: `2px solid ${border}`,
                    borderRadius: 16,
                    padding: "14px 20px",
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 600, color: ink, lineHeight: 1.3 }}>
                    {truncate(item.title, 90)}
                  </div>
                  <div style={{ display: "flex", fontSize: 19, color: inkSecondary }}>
                    {`PIC: ${
                      item.assignee_id
                        ? nameById.get(item.assignee_id) ?? "-"
                        : "Belum ditugaskan"
                    }${
                      item.due_date
                        ? ` — tenggat ${new Date(item.due_date).toLocaleDateString("id-ID", {
                            dateStyle: "medium",
                          })}`
                        : ""
                    }`}
                  </div>
                </div>
              ))}
              {moreItems > 0 && (
                <div style={{ fontSize: 20, color: inkMuted }}>
                  {`+${moreItems} tindak lanjut lainnya`}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: `2px solid ${border}`,
                paddingTop: 20,
                fontSize: 18,
                color: inkMuted,
              }}
            >
              <div style={{ display: "flex" }}>Dibuat otomatis oleh Asisten Notulen AI</div>
              <div style={{ display: "flex" }}>BVR Management</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1500,
      headers: {
        // Data notulen bisa berubah kapan saja; jangan cache di browser/CDN.
        "Cache-Control": "no-store",
      },
    }
  );
}
