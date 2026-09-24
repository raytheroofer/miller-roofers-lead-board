"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { setPasswordFromInvite } from "@/lib/auth-service";

export async function setPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    redirect("/login?error=missing_token");
  }

  if (password.length < 12) {
    redirect(`/invite/${encodeURIComponent(token)}?error=Password+must+be+at+least+12+characters`);
  }

  if (password !== confirmPassword) {
    redirect(`/invite/${encodeURIComponent(token)}?error=Passwords+do+not+match`);
  }

  let userEmail = "";
  try {
    const result = await setPasswordFromInvite({
      token,
      password,
      confirmPassword,
    });
    userEmail = result.email;
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "Failed to set password";
    redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/login?message=password_set&email=${encodeURIComponent(userEmail)}`);
}
