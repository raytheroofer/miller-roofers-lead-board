import { NextResponse } from "next/server";
import { createBootstrapInvite, canCreateBootstrapInvite } from "@/lib/auth-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let secret = request.headers.get("x-bootstrap-secret");

    if (!secret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        secret = authHeader.substring(7);
      }
    }

    if (!secret) {
      try {
        const body = await request.json();
        secret = body?.secret;
      } catch {
        // Body may be empty or not json
      }
    }

    if (!secret) {
      const url = new URL(request.url);
      secret = url.searchParams.get("secret");
    }

    if (!secret) {
      return NextResponse.json(
        { error: "Missing bootstrap secret. Provide via header x-bootstrap-secret or JSON body { secret }." },
        { status: 400 },
      );
    }

    const invite = await createBootstrapInvite({ secret });
    return NextResponse.json({
      success: true,
      message: "Bootstrap invite created successfully",
      email: invite.email,
      inviteUrl: invite.inviteUrl,
      relativeUrl: invite.relativeUrl,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bootstrap failed";
    if (message.includes("locked")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes("Invalid")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message.includes("not configured")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (!secret) {
    const isAvailable = await canCreateBootstrapInvite();
    return NextResponse.json({
      available: isAvailable,
      message: isAvailable
        ? "Bootstrap is available. Pass ?secret=... to generate an invite for ray@mrsroofers.com."
        : "Bootstrap is not available or has already been used.",
    });
  }

  try {
    const invite = await createBootstrapInvite({ secret });
    return NextResponse.json({
      success: true,
      message: "Bootstrap invite created successfully",
      email: invite.email,
      inviteUrl: invite.inviteUrl,
      relativeUrl: invite.relativeUrl,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bootstrap failed";
    if (message.includes("locked")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes("Invalid")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
