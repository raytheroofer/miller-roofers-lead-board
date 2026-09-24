"use server";

import { revalidatePath } from "next/cache";
import { actorFromSession } from "@/lib/session";
import { createStaffInvite } from "@/lib/auth-service";

export type InviteActionState = {
  success?: boolean;
  error?: string;
  email?: string;
  inviteUrl?: string;
  relativeUrl?: string;
  expiresAt?: string;
  emailSent?: boolean;
};

export async function createStaffInviteAction(
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const actor = await actorFromSession();
  if (actor.role !== "owner" && actor.role !== "firstmate") {
    return { error: "Unauthorized: Only owners or ops can create invites." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Staff email is required." };
  }

  try {
    const invite = await createStaffInvite({
      email,
      actorRole: actor.role,
    });

    revalidatePath("/admin/team");

    return {
      success: true,
      email: invite.email,
      inviteUrl: invite.inviteUrl,
      relativeUrl: invite.relativeUrl,
      expiresAt: invite.expiresAt.toISOString(),
      emailSent: invite.emailSent,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to generate invite.",
    };
  }
}
