import { query } from '../config/db';

export async function logActivity(params: {
  actorStaffId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
}) {
  await query(
    `INSERT INTO activity_log (actor_staff_id, action, entity_type, entity_id, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.actorStaffId ?? null, params.action, params.entityType, params.entityId ?? null, params.description]
  );
}
