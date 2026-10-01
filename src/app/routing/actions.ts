"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { actorFromSession } from "@/lib/session";
import { InputError, runFormAction } from "@/lib/input-error";
import { serialTransaction } from "@/lib/transaction";
import { ASSIGNEE_ROLE, getRoutingDirectory, initializeRoutingSettings } from "@/lib/routing-directory";
import { STAFF_DIRECTORY, ownerEmail, firstmateEmail } from "@/lib/users";
import { RR_CURSOR_ID } from "@/lib/rr";

export async function addAssigneeAction(form: FormData) {
  return runFormAction(async () => {
    await requireRoutingOwner();
    const id = String(form.get("captureId") ?? "");
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new InputError("Reload the form before adding an assignee.");
    if (!name || name.length > 100 || /[\u0000-\u001f\u007f]|https?:\/\//i.test(name)) throw new InputError("Enter a name of 1–100 characters.");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\u0000-\u001f\u007f]/.test(email)) throw new InputError("Enter a valid work email.");
    const reserved = [...STAFF_DIRECTORY.map(person => person.email), ownerEmail(), firstmateEmail(), "austin@mrsroofers.com"];
    if (reserved.includes(email)) throw new InputError("That person is already in the staff directory or is excluded from lead routing.");
    try {
      await serialTransaction(async tx => {
        const existing = await tx.user.findUnique({ where: { id: `assignee_${id}` } });
        if (existing) {
          if (existing.name !== name || existing.email !== email || existing.role !== ASSIGNEE_ROLE) throw new InputError("This submission already added a different assignee. Reload the form.");
          return;
        }
        if (await tx.user.count({ where: { role: ASSIGNEE_ROLE } }) >= 100) throw new InputError("The assignee limit has been reached.");
        const before = await getRoutingDirectory(tx);
        const cursor = await tx.roundRobinCursor.findUnique({ where: { id: RR_CURSOR_ID } });
        const lastSlug = cursor && cursor.lastIndex >= 0 ? before[cursor.lastIndex]?.slug : undefined;
        await tx.user.create({ data: { id: `assignee_${id}`, slug: `rep_${id}`, name, email, role: ASSIGNEE_ROLE, inRrPool: false } });
        // Preserve the current turn if concurrently created members share a timestamp.
        if (lastSlug) {
          const after = await getRoutingDirectory(tx);
          const lastIndex = after.findIndex(member => member.slug === lastSlug);
          if (lastIndex !== cursor!.lastIndex) await tx.roundRobinCursor.update({ where: { id: RR_CURSOR_ID }, data: { lastIndex } });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new InputError("That assignee already exists. Reload the directory before trying again.");
      throw error;
    }
    refreshRoutingViews();
  });
}

export async function setPoolMembershipAction(form: FormData) {
  return runFormAction(async () => {
    await requireRoutingOwner();
    const slug = String(form.get("slug") ?? "");
    const version = String(form.get("version") ?? "");
    const enabled = String(form.get("enabled") ?? "");
    if (!["true", "false"].includes(enabled)) throw new InputError("Choose whether this assignee receives paid leads.");
    try {
    await serialTransaction(async tx => {
      const member = (await getRoutingDirectory(tx)).find(person => person.slug === slug);
      if (!member) throw new InputError("Choose an assignee from the directory.");
      if (member.version !== version) throw new InputError("The pool changed. Reload before saving.");
      await initializeRoutingSettings(tx);
      const builtin = STAFF_DIRECTORY.find(person => person.slug === slug);
      await tx.user.upsert({ where: { slug }, update: { inRrPool: enabled === "true" },
        create: { slug, name: member.name, email: member.email, role: builtin?.role ?? ASSIGNEE_ROLE, inRrPool: enabled === "true" } });
    });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new InputError("The directory changed. Reload before saving the pool.");
      throw error;
    }
    refreshRoutingViews();
  });
}

async function requireRoutingOwner() {
  const actor = await actorFromSession();
  if (actor.role !== "owner" || actor.email.toLowerCase() !== ownerEmail()) throw new InputError("Only the owner can manage lead routing.");
  const password = process.env.OWNER_PASSWORD ?? "";
  if (password.length < 16 || [process.env.AUTH_PASSWORD, process.env.CODY_PASSWORD, process.env.FIRSTMATE_PASSWORD].includes(password)) {
    throw new InputError("Finish the private owner sign-in setup before changing the routing pool.");
  }
}

function refreshRoutingViews() {
  revalidatePath("/", "layout");
}
