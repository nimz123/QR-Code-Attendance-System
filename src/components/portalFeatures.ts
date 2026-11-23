export const TEACHER_RESET_STORAGE_KEY = 'teacher_password_reset_requests';
export const TEACHER_RESET_COOLDOWN_KEY = 'teacher_password_reset_cooldowns';
export const TEACHER_RESET_COOLDOWN_MS = 2 * 60 * 1000;

export interface TeacherResetRequest {
  id: string;
  role: 'teacher';
  username: string;
  email?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
}

export function getTeacherResetCooldownLeft(username: string): number {
  const key = username.trim().toLowerCase();
  if (!key) return 0;
  try {
    const map = JSON.parse(localStorage.getItem(TEACHER_RESET_COOLDOWN_KEY) || '{}');
    const last = Number(map?.[key] || 0);
    const diff = Date.now() - last;
    return diff > 0 && diff < TEACHER_RESET_COOLDOWN_MS
      ? Math.ceil((TEACHER_RESET_COOLDOWN_MS - diff) / 1000)
      : 0;
  } catch {
    return 0;
  }
}

export function submitTeacherResetRequestLocal(payload: {
  username: string;
  email?: string;
  note?: string;
}): { ok: boolean; message: string } {
  const cleanUser = payload.username.trim();
  if (!cleanUser) return { ok: false, message: 'Enter teacher username.' };

  const waitSec = getTeacherResetCooldownLeft(cleanUser);
  if (waitSec > 0) {
    return {
      ok: false,
      message: `Wait ${waitSec}s before sending another reset request for "${cleanUser}".`,
    };
  }

  try {
    const list: TeacherResetRequest[] = JSON.parse(
      localStorage.getItem(TEACHER_RESET_STORAGE_KEY) || '[]'
    );
    const hasPending = list.some(
      (r) => r.username.toLowerCase() === cleanUser.toLowerCase() && r.status === 'pending'
    );
    if (!hasPending) {
      list.unshift({
        id: `tr_${Date.now()}`,
        role: 'teacher',
        username: cleanUser,
        email: payload.email?.trim() || '',
        note: payload.note?.trim() || '',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });
      localStorage.setItem(TEACHER_RESET_STORAGE_KEY, JSON.stringify(list));
    }

    const cooldowns = JSON.parse(localStorage.getItem(TEACHER_RESET_COOLDOWN_KEY) || '{}');
    cooldowns[cleanUser.toLowerCase()] = Date.now();
    localStorage.setItem(TEACHER_RESET_COOLDOWN_KEY, JSON.stringify(cooldowns));

    return { ok: true, message: 'Reset request sent for Admin approval.' };
  } catch {
    return { ok: false, message: 'Unable to save request.' };
  }
}

export function getTeacherResetRequestsLocal(): TeacherResetRequest[] {
  try {
    const list = JSON.parse(localStorage.getItem(TEACHER_RESET_STORAGE_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function updateTeacherResetRequestStatus(
  id: string,
  status: 'approved' | 'rejected'
): TeacherResetRequest[] {
  const next = getTeacherResetRequestsLocal().map((r) =>
    r.id === id ? { ...r, status } : r
  );
  localStorage.setItem(TEACHER_RESET_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteTeacherResetRequest(id: string): TeacherResetRequest[] {
  const next = getTeacherResetRequestsLocal().filter((r) => r.id !== id);
  localStorage.setItem(TEACHER_RESET_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearTeacherResetRequests(): TeacherResetRequest[] {
  localStorage.setItem(TEACHER_RESET_STORAGE_KEY, JSON.stringify([]));
  return [];
}