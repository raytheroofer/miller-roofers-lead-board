"use server";

import { createBootstrapInvite } from "@/lib/auth-service";

export type BootstrapState = {
  success?: boolean;
  error?: string;
  email?: string;
  inviteUrl?: string;
  relativeUrl?: string;
  expiresAt?: string;
};

export async function bootstrapAction(
  _prevState: BootstrapState,
  formData: FormData,
): Promise<BootstrapState> {
  const secret = String(formData.get("secret") ?? "").trim();
  if (!secret) {
    return { error: "Bootstrap secret is required" };
  }

  try {
    const invite = await createBootstrapInvite({ secret });
    return {
      success: true,
      email: invite.email,
      inviteUrl: invite.inviteUrl,
      relativeUrl: invite.relativeUrl,
      expiresAt: invite.expiresAt.toISOString(),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to run bootstrap",
    };
  }
}
