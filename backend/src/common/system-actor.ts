export const SYSTEM_ACTOR_EMAIL = 'system@unnatify.local';

export function actorOrSystem(actor?: string | null) {
  return actor && actor !== 'system' ? actor : SYSTEM_ACTOR_EMAIL;
}
