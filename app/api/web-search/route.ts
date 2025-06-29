import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query")
  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 })
  }
  try {
    // @ts-ignore - web_search tool is available in this environment
    const webRes = await web_search({ search_term: query, explanation: "Get relevant web results for the user query." })
    return NextResponse.json({ results: webRes?.results || [] })
  } catch (err) {
    return NextResponse.json({ error: "Web search failed" }, { status: 500 })
  }
} 