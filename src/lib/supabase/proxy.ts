import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];
const VISUAL_NOTES_PATH = /^\/api\/meeting\/[^/]+\/visual-notes\/?$/;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  // Link bagikan poster "Catatan Visual" (?token=...) harus bisa dibuka tanpa
  // login; validitas token dicek di route itu sendiri.
  const isVisualNotesShare =
    VISUAL_NOTES_PATH.test(request.nextUrl.pathname) &&
    request.nextUrl.searchParams.has("token");

  if (!user && !isPublicPath && !isVisualNotesShare) {
    // API tidak boleh di-redirect ke halaman login (fetch akan menerima HTML
    // 200) -- kembalikan 401 JSON supaya klien bisa menampilkan errornya.
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sesi berakhir, silakan login ulang." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
