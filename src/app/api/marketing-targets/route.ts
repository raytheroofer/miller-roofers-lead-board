import { auth } from "@/auth";
import { targetMarketCsv } from "@/lib/marketing-targets";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "owner") return new Response(null, { status: 401 });
  return new Response(targetMarketCsv(), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="roofing-target-zips.csv"',
    "Cache-Control": "private, no-store",
  } });
}
