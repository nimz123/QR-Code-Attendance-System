export const TEACHER_LIST_KEYS = [
  "registered_teachers",
  "teachers",
  "admin_teachers",
  "teachers_list"
];

export const STUDENT_LIST_KEYS = [
  "admin_enrolled_students",
  "enrolled_students",
  "students",
  "registered_students"
];

export function cleanPhotoUrl(val: unknown): string {
  try {
    if (typeof val !== "string") return "";
    const s = val.trim().replace(/^"+|"+$/g, "");
    if (!s || s.toLowerCase().includes("text/html")) return "";
    if (
      s.startsWith("data:image") ||
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("blob:") ||
      s.startsWith("/")
    ) {
      return s;
    }
    return "";
  } catch {
    return "";
  }
}

export function compressImageFile(file: File, size = 180, quality = 0.55): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      if (!raw) return reject(new Error("Empty image data"));

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(raw);

          const minSide = Math.min(img.width, img.height);
          const sx = Math.max(0, (img.width - minSide) / 2);
          const sy = Math.max(0, (img.height - minSide) / 2);
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", quality) || raw);
        } catch {
          resolve(raw);
        }
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function saveTeacherPhotoGlobal(profile: any, photoUrl: string): string {
  if (typeof window === "undefined") return "";
  const clean = cleanPhotoUrl(photoUrl) || readTeacherPhotoGlobal(profile);
  if (!clean) return "";

  const idKey = String(profile?.id || "lorenzo").trim().toLowerCase();
  const emailKey = String(profile?.email || "lorenzo@edu.com").trim().toLowerCase();
  const nameKey = String(profile?.name || profile?.username || "lorenzo birao")
    .replace(/^Teacher\s+/i, "")
    .trim()
    .toLowerCase();

  for (const key of [
    "teacher_photo_latest",
    idKey ? `teacher_photo_${idKey}` : "",
    emailKey ? `teacher_photo_${emailKey}` : "",
    nameKey ? `teacher_photo_${nameKey}` : ""
  ]) {
    if (!key) continue;
    try {
      localStorage.setItem(key, clean);
    } catch {}
  }

  try {
    const rawUser = localStorage.getItem("user");
    const existing = rawUser ? JSON.parse(rawUser) : {};
    const isSameUser =
      !existing?.role ||
      existing?.role === "teacher" ||
      String(existing?.id || "").toLowerCase() === idKey ||
      String(existing?.email || "").toLowerCase() === emailKey;

    if (isSameUser) {
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...existing,
          ...profile,
          photoUrl: clean,
          avatar: clean
        })
      );
    }
  } catch {}

  for (const listKey of TEACHER_LIST_KEYS) {
    try {
      const raw = localStorage.getItem(listKey);
      if (!raw) continue;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) continue;

      const updated = list.map((item: any) => {
        if (!item || typeof item !== "object") return item;
        const iId = String(item?.id || "").trim().toLowerCase();
        const iEmail = String(item?.email || "").trim().toLowerCase();
        const iName = String(item?.name || item?.username || "")
          .replace(/^Teacher\s+/i, "")
          .trim()
          .toLowerCase();

        const match =
          (idKey && iId && idKey === iId) ||
          (emailKey && iEmail && emailKey === iEmail) ||
          (nameKey && iName && nameKey === iName);

        return match ? { ...item, photoUrl: clean, avatar: clean } : item;
      });

      localStorage.setItem(listKey, JSON.stringify(updated));
    } catch {}
  }

  try {
    window.dispatchEvent(
      new CustomEvent("teacher-profile-updated", {
        detail: { id: profile?.id, name: profile?.name, email: profile?.email, photoUrl: clean }
      })
    );
    window.dispatchEvent(new Event("storage"));
  } catch {}

  return clean;
}

export function readTeacherPhotoGlobal(teacher?: any): string {
  if (typeof window === "undefined") return cleanPhotoUrl(teacher?.photoUrl || teacher?.avatar);

  const targetId = String(teacher?.id || "").trim().toLowerCase();
  const targetEmail = String(teacher?.email || "").trim().toLowerCase();
  const targetName = String(teacher?.name || teacher?.username || "")
    .replace(/^Teacher\s+/i, "")
    .trim()
    .toLowerCase();

  for (const k of [
    targetId ? `teacher_photo_${targetId}` : "",
    targetEmail ? `teacher_photo_${targetEmail}` : "",
    targetName ? `teacher_photo_${targetName}` : "",
    "teacher_photo_lorenzo",
    "teacher_photo_lorenzo@edu.com",
    "teacher_photo_lorenzo birao",
    "teacher_photo_latest"
  ]) {
    if (!k) continue;
    try {
      const val = cleanPhotoUrl(localStorage.getItem(k));
      if (val) return val;
    } catch {}
  }

  try {
    for (const storageKey of ["user", "authUser"]) {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const candidates = [parsed?.user, parsed?.teacher, parsed];
      for (const c of candidates) {
        if (!c || typeof c !== "object") continue;
        const cId = String(c?.id || "").trim().toLowerCase();
        const cEmail = String(c?.email || "").trim().toLowerCase();
        const cName = String(c?.name || c?.username || "")
          .replace(/^Teacher\s+/i, "")
          .trim()
          .toLowerCase();

        const match =
          (targetId && cId && targetId === cId) ||
          (targetEmail && cEmail && targetEmail === cEmail) ||
          (targetName && cName && (targetName === cName || cName.includes(targetName) || targetName.includes(cName))) ||
          (!teacher && (c?.role === "teacher" || cName.includes("lorenzo")));

        if (match) {
          const p = cleanPhotoUrl(c?.photoUrl || c?.avatar || c?.photo);
          if (p) return p;
        }
      }
    }
  } catch {}

  for (const listKey of TEACHER_LIST_KEYS) {
    try {
      const raw = localStorage.getItem(listKey);
      if (!raw) continue;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const iId = String(item?.id || "").trim().toLowerCase();
        const iEmail = String(item?.email || "").trim().toLowerCase();
        const iName = String(item?.name || item?.username || "")
          .replace(/^Teacher\s+/i, "")
          .trim()
          .toLowerCase();

        const match =
          (targetId && iId && targetId === iId) ||
          (targetEmail && iEmail && targetEmail === iEmail) ||
          (targetName && iName && (targetName === iName || iName.includes(targetName) || targetName.includes(iName)));

        if (match) {
          const p = cleanPhotoUrl(item?.photoUrl || item?.avatar || item?.photo);
          if (p) return p;
        }
      }
    } catch {}
  }

  return cleanPhotoUrl(teacher?.photoUrl || teacher?.avatar || teacher?.photo);
}

export function saveStudentPhotoGlobal(student: any, photoUrl: string): string {
  if (typeof window === "undefined") return "";
  const clean = cleanPhotoUrl(photoUrl) || readStudentPhotoGlobal(student);
  if (!clean) return "";

  const idKey = String(student?.id || student?.studentId || "").trim().toLowerCase();
  const nameKey = String(student?.name || student?.username || "").trim().toLowerCase();

  for (const k of [
    idKey ? `student_photo_${idKey}` : "",
    nameKey ? `student_photo_${nameKey}` : "",
    "student_photo_latest"
  ]) {
    if (!k) continue;
    try {
      localStorage.setItem(k, clean);
    } catch {}
  }

  try {
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      const existing = JSON.parse(rawUser);
      const eId = String(existing?.id || existing?.studentId || "").trim().toLowerCase();
      if (existing?.role === "student" || (idKey && eId === idKey)) {
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...existing,
            photoUrl: clean,
            avatar: clean
          })
        );
      }
    }
  } catch {}

  for (const listKey of STUDENT_LIST_KEYS) {
    try {
      const raw = localStorage.getItem(listKey);
      if (!raw) continue;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) continue;

      const updated = list.map((item: any) => {
        if (!item || typeof item !== "object") return item;
        const iId = String(item?.id || item?.studentId || "").trim().toLowerCase();
        const iName = String(item?.name || item?.username || "").trim().toLowerCase();
        const match = (idKey && iId && idKey === iId) || (nameKey && iName && nameKey === iName);
        return match ? { ...item, photoUrl: clean, avatar: clean } : item;
      });

      localStorage.setItem(listKey, JSON.stringify(updated));
    } catch {}
  }

  try {
    window.dispatchEvent(
      new CustomEvent("student-profile-updated", {
        detail: { id: student?.id || student?.studentId, name: student?.name, photoUrl: clean }
      })
    );
    window.dispatchEvent(new Event("storage"));
  } catch {}

  return clean;
}

export function readStudentPhotoGlobal(student?: any): string {
  if (typeof window === "undefined") return cleanPhotoUrl(student?.photoUrl || student?.avatar);

  const targetId = String(student?.id || student?.studentId || "").trim().toLowerCase();
  const targetName = String(student?.name || student?.username || "").trim().toLowerCase();

  for (const k of [
    targetId ? `student_photo_${targetId}` : "",
    targetName ? `student_photo_${targetName}` : ""
  ]) {
    if (!k) continue;
    try {
      const val = cleanPhotoUrl(localStorage.getItem(k));
      if (val) return val;
    } catch {}
  }

  for (const listKey of STUDENT_LIST_KEYS) {
    try {
      const raw = localStorage.getItem(listKey);
      if (!raw) continue;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const iId = String(item?.id || item?.studentId || "").trim().toLowerCase();
        const iName = String(item?.name || item?.username || "").trim().toLowerCase();
        if ((targetId && iId && targetId === iId) || (targetName && iName && targetName === iName)) {
          const p = cleanPhotoUrl(item?.photoUrl || item?.avatar || item?.photo);
          if (p) return p;
        }
      }
    } catch {}
  }

  return cleanPhotoUrl(student?.photoUrl || student?.avatar || student?.photo);
}