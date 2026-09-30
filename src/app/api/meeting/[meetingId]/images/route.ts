import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Batas per gambar. Body serverless Vercel sendiri ~4.5MB, jadi angka ini
// harus di bawahnya -- gambar dokumentasi rapat tidak perlu lebih besar.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await params;

  // Pakai client ber-sesi (bukan admin) supaya RLS tetap menentukan siapa
  // yang boleh menambah gambar ke rapat ini.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Data upload tidak valid." }, { status: 400 });
  }
  const file = formData.get("image");
  const caption = String(formData.get("caption") ?? "").trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Tidak ada gambar yang dikirim." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File harus berupa gambar." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Gambar terlalu besar (maks ${MAX_IMAGE_BYTES / 1024 / 1024}MB).` },
      { status: 400 },
    );
  }

  // SVG bisa berisi script dan bucket-nya publik -- tolak.
  if (file.type === "image/svg+xml") {
    return NextResponse.json({ error: "Format SVG tidak didukung." }, { status: 400 });
  }

  // Ekstensi masuk ke path storage -- hanya terima alfanumerik pendek.
  const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
  const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : "jpg";
  const storagePath = `${meetingId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("meeting-images")
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("meeting_images").insert({
    meeting_id: meetingId,
    storage_path: storagePath,
    caption,
    created_by: user.id,
  });

  if (insertError) {
    // Baris DB gagal -> jangan tinggalkan file yatim di storage.
    await supabase.storage.from("meeting-images").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await params;
  const { searchParams } = new URL(request.url);
  const imageId = searchParams.get("id");
  if (!imageId) {
    return NextResponse.json({ error: "id gambar wajib diisi" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: image } = await supabase
    .from("meeting_images")
    .select("storage_path")
    .eq("id", imageId)
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (!image) {
    return NextResponse.json({ error: "Gambar tidak ditemukan" }, { status: 404 });
  }

  const { error } = await supabase.from("meeting_images").delete().eq("id", imageId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.storage.from("meeting-images").remove([image.storage_path]);
  return NextResponse.json({ success: true });
}
