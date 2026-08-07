import { NextResponse } from "next/server"
import { crmCatalog } from "@/lib/catalog"
import { requireDemoSession } from "@/lib/demo-auth"
import { failure } from "@/lib/http"

export async function GET(request: Request) {
  try {
    requireDemoSession(request)
    return NextResponse.json(await crmCatalog(request.signal))
  } catch (error) {
    return failure(error)
  }
}
