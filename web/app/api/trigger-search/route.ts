import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { routeId } = await req.json();

  const r = await fetch(
    `https://api.github.com/repos/${process.env.GH_REPO}/actions/workflows/daily-search.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${process.env.GH_PAT}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ ref: "main", inputs: { route_id: routeId ?? "" } }),
    }
  );

  if (!r.ok) return NextResponse.json({ error: "trigger_failed" }, { status: 500 });
  return NextResponse.json({ status: "triggered" });
}
