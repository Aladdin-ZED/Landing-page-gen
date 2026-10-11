/**
 * In-flight upload slots (per process), taken BEFORE an upload body is read.
 *
 * The CPU gate in process.ts only covers sharp/inspection work; without this, every concurrent
 * request would buffer its whole body (up to ~25 MB) while waiting. Limits: a few uploads per
 * process, fewer per user (the admin UI sends 2 files in parallel).
 */

export const MAX_UPLOADS = 4;
export const MAX_UPLOADS_PER_USER = 2;

declare global {
  var __codUploadSlots: { total: number; perUser: Map<string, number> } | undefined;
}

const state = () => (globalThis.__codUploadSlots ??= { total: 0, perUser: new Map() });

export type UploadSlot = { ok: true; release: () => void } | { ok: false; scope: "user" | "server" };

export function takeUploadSlot(userId: string): UploadSlot {
  const s = state();
  const mine = s.perUser.get(userId) ?? 0;
  if (mine >= MAX_UPLOADS_PER_USER) return { ok: false, scope: "user" };
  if (s.total >= MAX_UPLOADS) return { ok: false, scope: "server" };
  s.total++;
  s.perUser.set(userId, mine + 1);
  let released = false;
  return {
    ok: true,
    release() {
      if (released) return;
      released = true;
      s.total--;
      const left = (s.perUser.get(userId) ?? 1) - 1;
      if (left > 0) s.perUser.set(userId, left);
      else s.perUser.delete(userId);
    },
  };
}
