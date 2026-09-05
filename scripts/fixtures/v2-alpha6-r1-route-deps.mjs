export function originAllowed(request) {
  return request.headers.get("origin") === "http://localhost:3000";
}

export async function resolveV2Alpha3Principal() {
  return {
    ok: true,
    principal: {
      workspaceId: "fixture-workspace-v2",
      userId: "fixture-user-v2",
    },
  };
}
