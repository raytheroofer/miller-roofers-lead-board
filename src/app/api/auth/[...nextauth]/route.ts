import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // A GET request to credentials callback or signin is invalid; redirect to /login
  // rather than returning raw JSON or error pages that Safari treats as credentials.json
  if (
    pathname.endsWith("/callback/credentials") ||
    pathname.endsWith("/signin/credentials") ||
    pathname.endsWith("/credentials") ||
    pathname.endsWith("/error")
  ) {
    const loginUrl = new URL("/login", req.url);
    const error = req.nextUrl.searchParams.get("error");
    if (error) loginUrl.searchParams.set("error", error);
    return NextResponse.redirect(loginUrl);
  }
  return handlers.GET(req);
}

export const POST = handlers.POST;
