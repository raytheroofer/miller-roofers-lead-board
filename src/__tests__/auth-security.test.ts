import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAllowlistedEmail, staffFromEmail } from "@/lib/users";
import { authorizeUser } from "@/auth";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/[...nextauth]/route";
import nextConfig from "../../next.config";

describe("User Allowlist and Staff Mapping", () => {
  it("allows configured MRS staff emails", () => {
    expect(isAllowlistedEmail("ray@mrsroofers.com")).toBe(true);
    expect(isAllowlistedEmail("austin@mrsroofers.com")).toBe(true);
    expect(isAllowlistedEmail("cody@mrsroofers.com")).toBe(true);
    expect(isAllowlistedEmail("firstmate@mrsroofers.com")).toBe(true);
  });

  it("handles case insensitivity and whitespace", () => {
    expect(isAllowlistedEmail("  RAY@mrsroofers.com  ")).toBe(true);
    expect(isAllowlistedEmail("Austin@MRSRoofers.COM")).toBe(true);
  });

  it("rejects unauthorized emails", () => {
    expect(isAllowlistedEmail("stranger@gmail.com")).toBe(false);
    expect(isAllowlistedEmail("attacker@badactor.org")).toBe(false);
    expect(isAllowlistedEmail("")).toBe(false);
  });

  it("correctly identifies staff roles and round-robin flags", () => {
    const ray = staffFromEmail("ray@mrsroofers.com");
    expect(ray.role).toBe("owner");
    expect(ray.slug).toBe("raymond");
    expect(ray.inRrPool).toBe(true);

    const austin = staffFromEmail("austin@mrsroofers.com");
    expect(austin.role).toBe("pm");
    expect(austin.slug).toBe("austin");
    expect(austin.inRrPool).toBe(true);

    const firstmate = staffFromEmail("firstmate@mrsroofers.com");
    expect(firstmate.role).toBe("firstmate");
    expect(firstmate.slug).toBe("firstmate");
    expect(firstmate.inRrPool).toBe(false);
  });
});

describe("Password and Credentials Authorization", () => {
  const origAuthPw = process.env.AUTH_PASSWORD;
  const origFirstmatePw = process.env.FIRSTMATE_PASSWORD;

  beforeEach(() => {
    process.env.AUTH_PASSWORD = "test-shared-password";
    process.env.FIRSTMATE_PASSWORD = "test-firstmate-password";
  });

  afterEach(() => {
    process.env.AUTH_PASSWORD = origAuthPw;
    process.env.FIRSTMATE_PASSWORD = origFirstmatePw;
  });

  it("authorizes allowlisted staff with matching password", async () => {
    const user = await authorizeUser({
      email: "ray@mrsroofers.com",
      password: "test-shared-password",
    });
    expect(user).not.toBeNull();
    expect(user?.email).toBe("ray@mrsroofers.com");
    expect(user?.name).toBe("Raymond");
    expect(user?.role).toBe("owner");
    expect(user?.slug).toBe("raymond");
    expect(user?.inRrPool).toBe(true);

    const austin = await authorizeUser({
      email: "austin@mrsroofers.com",
      password: "test-shared-password",
    });
    expect(austin?.slug).toBe("austin");
    expect(austin?.role).toBe("pm");

    const cody = await authorizeUser({
      email: "cody@mrsroofers.com",
      password: "test-shared-password",
    });
    expect(cody?.slug).toBe("cody");
    expect(cody?.role).toBe("pm");
  });

  it("authorizes firstmate with FIRSTMATE_PASSWORD", async () => {
    const user = await authorizeUser({
      email: "firstmate@mrsroofers.com",
      password: "test-firstmate-password",
    });
    expect(user).not.toBeNull();
    expect(user?.slug).toBe("firstmate");
    expect(user?.role).toBe("firstmate");
  });

  it("rejects allowlisted staff with wrong password", async () => {
    const user = await authorizeUser({
      email: "ray@mrsroofers.com",
      password: "wrong-password",
    });
    expect(user).toBeNull();
  });

  it("rejects non-allowlisted email even with correct password", async () => {
    const user = await authorizeUser({
      email: "stranger@otherdomain.com",
      password: "test-shared-password",
    });
    expect(user).toBeNull();
  });

  it("rejects empty or missing credentials", async () => {
    expect(await authorizeUser()).toBeNull();
    expect(await authorizeUser({ email: "", password: "" })).toBeNull();
    expect(await authorizeUser({ email: "ray@mrsroofers.com", password: "" })).toBeNull();
    expect(await authorizeUser({ email: "", password: "test-shared-password" })).toBeNull();
  });
});

describe("Credentials & Secret File Protection Safeguards", () => {
  it("blocks direct requests to /credentials.json via proxy with 404 plain text", () => {
    const req = new NextRequest("https://mrs-leaderboard.vercel.app/credentials.json");
    const res = proxy(req);

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("text/plain");
  });

  it("blocks requests to nested credentials.json paths", () => {
    const req = new NextRequest("https://mrs-leaderboard.vercel.app/public/credentials.json");
    const res = proxy(req);

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("text/plain");
  });

  it("blocks direct requests to .env files via proxy", () => {
    const req = new NextRequest("https://mrs-leaderboard.vercel.app/.env");
    const res = proxy(req);

    expect(res.status).toBe(404);
  });

  it("redirects GET /api/auth/callback/credentials to /login to prevent iOS JSON download prompt", async () => {
    const req = new NextRequest("https://mrs-leaderboard.vercel.app/api/auth/callback/credentials");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBe("https://mrs-leaderboard.vercel.app/login");
  });

  it("redirects GET /api/auth/error to /login", async () => {
    const req = new NextRequest("https://mrs-leaderboard.vercel.app/api/auth/error?error=Configuration");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBe("https://mrs-leaderboard.vercel.app/login?error=Configuration");
  });

  it("has next.config safeguard rewrites and headers for credentials.json", async () => {
    expect(typeof nextConfig.rewrites).toBe("function");
    const rewrites = await nextConfig.rewrites!();
    // @ts-expect-error rewrite structure check
    const beforeFiles = rewrites.beforeFiles || rewrites;
    expect(
      beforeFiles.some((r: { source: string }) => r.source === "/credentials.json"),
    ).toBe(true);

    expect(typeof nextConfig.headers).toBe("function");
    const headers = await nextConfig.headers!();
    expect(
      headers.some((h: { source: string }) => h.source === "/credentials.json"),
    ).toBe(true);
  });
});
