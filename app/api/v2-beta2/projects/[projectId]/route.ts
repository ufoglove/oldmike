import { createV2Beta2RouteHandlers } from "@/lib/v2-beta2/route-handlers";

export const dynamic = "force-dynamic";

const handlers = createV2Beta2RouteHandlers();

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  const { projectId } = await context.params;
  return handlers.GET(request, projectId);
}

export async function POST(request: Request, context: Context) {
  const { projectId } = await context.params;
  return handlers.POST(request, projectId);
}
