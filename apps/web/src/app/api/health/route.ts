import { makeClient } from "@kantorcore/db";

// Health probe for Coolify/uptime checks. Runs per-request, never at build time.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    return Response.json({ status: "ok", db: "unconfigured" });
  }
  const sql = makeClient(url);
  try {
    await sql`select 1`;
    return Response.json({ status: "ok", db: "up" });
  } catch {
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  } finally {
    await sql.end();
  }
}
