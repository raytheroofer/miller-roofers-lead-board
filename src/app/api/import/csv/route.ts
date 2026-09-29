import { auth } from "@/auth";

export async function POST() {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ error: "Bulk import is paused during recovery. Add verified leads individually; duplicate-safe import must pass its launch checks first." }, { status: 503 });
}
