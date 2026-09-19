import { auth } from "@/auth";
import { canOverrideStages } from "@/lib/users";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function actorFromSession() {
  const session = await requireSession();
  return {
    email: session.user.email!,
    name: session.user.name ?? session.user.email!,
    role: session.user.role ?? "pm",
    slug: session.user.slug ?? "unknown",
    allowBackward: canOverrideStages(session.user.role),
  };
}
