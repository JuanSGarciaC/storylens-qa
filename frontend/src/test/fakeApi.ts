import type { AuditEvent, Me, Named, Project } from "../api/client";

export const PROJECT_ID = "p1";

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    name: "Banca móvil",
    description: "App de banca para clientes",
    objective: "Reducir defectos en producción",
    settings: {
      disabled_rules: [],
      penalties: null,
      not_ready_below: 60,
      ready_from: 85,
    },
    is_demo: false,
    created_at: "2026-10-23T12:00:00Z",
    ...overrides,
  };
}

export function makeMe(overrides: Partial<Me> = {}): Me {
  return { authenticated: true, email: "dueno@example.com", ...overrides };
}

export function makeNamed(name: string, overrides: Partial<Named> = {}): Named {
  return { id: `n-${name}`, project_id: PROJECT_ID, name, ...overrides };
}

export function makeAuditEvent(
  overrides: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    id: 1,
    at: "2026-10-23T12:00:00Z",
    actor: "dueno@example.com",
    action: "story.created",
    entity: "story",
    entity_id: "s-1",
    project_id: PROJECT_ID,
    detail: "",
    ...overrides,
  };
}
