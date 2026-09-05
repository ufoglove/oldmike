import { createV2Beta1RouteHandlers } from "../../../../lib/v2-beta1/route-handlers.ts";

const handlers = createV2Beta1RouteHandlers();

export const GET = handlers.GET;
export const POST = handlers.POST;
