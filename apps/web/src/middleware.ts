import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The Chrome extension's service worker calls these API routes from a
// chrome-extension:// origin. Extensions with host_permissions are normally
// exempt from CORS, but we set permissive headers too so the API also works
// from a plain browser tab during local development.
export function middleware(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }));
  }
  return withCors(NextResponse.next());
}

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
