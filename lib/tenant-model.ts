export type WorkspaceRole = "owner" | "member";
export type ProjectRecord = {
  projectId: string;
  workspaceId: string;
  ownerUserId: string;
  title: string;
  status: "ACTIVE" | "LEGACY_UNCLAIMED";
  legacy: boolean;
  trashedAt?: string | null;
};

export type TenantUser = { userId: string; workspaceId: string; role: WorkspaceRole };
export type TenantFixture = {
  users: Array<{ userId: string; workspaceId: string; verified: boolean; sessions: string[] }>;
  projects: ProjectRecord[];
};

export function workspaceForUser(fixture: TenantFixture, userId: string) {
  const user = fixture.users.find((candidate) => candidate.userId === userId);
  return user ? { userId, workspaceId: user.workspaceId, role: "owner" as const } : null;
}

export function canAccessProject(fixture: TenantFixture, identity: TenantUser, projectId: string) {
  const project = fixture.projects.find((candidate) => candidate.projectId === projectId);
  if (!project || project.legacy || project.workspaceId !== identity.workspaceId || project.ownerUserId !== identity.userId) return null;
  return project;
}

export function listProjectsForUser(fixture: TenantFixture, identity: TenantUser) {
  return fixture.projects.filter((project) => !project.legacy && !project.trashedAt && project.workspaceId === identity.workspaceId && project.ownerUserId === identity.userId);
}

export function tenantConversationId(workspaceId: string, projectId: string) {
  return `workspace:${workspaceId}:project:${projectId}`;
}
