import { query } from '../config/db';

export async function logActivity(params: {
  actorStaffId?: string | null;
  /** Scopes the entry to a tenant so one company's feed never shows another's. */
  companyId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
}) {
  await query(
    `INSERT INTO activity_log (actor_staff_id, company_id, action, entity_type, entity_id, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.actorStaffId ?? null,
      params.companyId ?? null,
      params.action,
      params.entityType,
      params.entityId ?? null,
      params.description,
    ]
  );
}
