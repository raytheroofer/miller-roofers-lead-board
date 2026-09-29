import { auth } from "@/auth";
export async function POST() {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ error: "API writes are paused during owner recovery. Use the lead forms." }, { status: 503 });
}
