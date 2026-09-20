"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export async function loginAction(formData: FormData) {
  const callbackUrl = String(formData.get("redirectTo") ?? "/");
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (isRedirectError(error)) {
      const url = getURLFromRedirectError(error);
      // NextAuth redirects to the callback/signin/error route when configuration fails
      // or no response URL is returned. Catch this to prevent browser downloads of credentials.json.
      if (
        url &&
        (url.includes("/api/auth/callback") ||
          url.includes("/api/auth/signin") ||
          url.includes("/api/auth/error"))
      ) {
        redirect(
          `/login?error=Configuration&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        );
      }
      throw error;
    }
    if (error instanceof AuthError) {
      redirect(
        `/login?error=credentials&callbackUrl=${encodeURIComponent(callbackUrl)}`,
      );
    }
    redirect(
      `/login?error=Configuration&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }
}
