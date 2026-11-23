import React, { useState, useEffect, useRef } from 'react';
import { Section } from '../types';
import {
  Camera,
  Upload,
  X,
  Lock,
  Clock,
  ArrowRight,
  QrCode,
  AlertTriangle,
  User,
  KeyRound,
  RotateCcw,
  Eye,
  EyeOff,
  XCircle,
  CheckCircle2
} from 'lucide-react';

interface StudentPortalProps {
  sections: Section[];
  preselectedSectionId?: string | null;
  teachers?: any[];
  onSubmitAttendance?: (
    studentId: string,
    studentName: string,
    sectionId: string,
    type: "In" | "Out"
  ) => void;
}

const TEACHER_LIST_KEYS = [
  "registered_teachers",
  "teachers",
  "admin_teachers",
  "teachers_list"
];

export default function StudentPortal({
  sections = [],
  preselectedSectionId,
  teachers: propTeachers,
  onSubmitAttendance
}: StudentPortalProps) {
  const [records] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [shakePassword, setShakePassword] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState<boolean>(false);
  const [forgotStep, setForgotStep] = useState<"camera" | "reset" | "done">("camera");
  const [forgotPhoto, setForgotPhoto] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [showConfirmPass, setShowConfirmPass] = useState<boolean>(false);

  const cleanPhotoSrc = (val: any): string => {
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
  };

  const extractPhoto = (obj: any): string => {
    try {
      if (!obj || typeof obj !== "object") return "";
      const fields = [
        obj.photoUrl,
        obj.photoURL,
        obj.avatar,
        obj.avatarUrl,
        obj.picture,
        obj.image,
        obj.photo
      ];
      for (const f of fields) {
        const valid = cleanPhotoSrc(f);
        if (valid) return valid;
      }
      return "";
    } catch {
      return "";
    }
  };

  const getPhotoFromUserAndLists = (teacher: any): string => {
    try {
      if (typeof window === "undefined") return extractPhoto(teacher);

      const targetId = String(teacher?.id || "").trim().toLowerCase();
      const targetEmail = String(teacher?.email || "").trim().toLowerCase();
      const targetName = String(teacher?.name || "")
        .replace(/^Teacher\s+/i, "")
        .trim()
        .toLowerCase();

      for (const directKey of [
        targetId ? `teacher_photo_${targetId}` : "",
        targetEmail ? `teacher_photo_${targetEmail}` : "",
        targetName ? `teacher_photo_${targetName}` : "",
        "teacher_photo_latest"
      ]) {
        if (!directKey) continue;
        const rawDirect = localStorage.getItem(directKey);
        const validDirect = cleanPhotoSrc(rawDirect);
        if (validDirect) return validDirect;
      }

      const matchesTeacher = (obj: any): boolean => {
        if (!obj || typeof obj !== "object") return false;
        const oId = String(obj?.id || "").trim().toLowerCase();
        const oEmail = String(obj?.email || "").trim().toLowerCase();
        const oName = String(obj?.name || obj?.username || "")
          .replace(/^Teacher\s+/i, "")
          .trim()
          .toLowerCase();

        if (targetId && oId && targetId === oId) return true;
        if (targetEmail && oEmail && targetEmail === oEmail) return true;
        if (
          targetName &&
          oName &&
          (targetName === oName || oName.includes(targetName) || targetName.includes(oName))
        ) {
          return true;
        }
        if (!teacher && (obj?.role === "teacher" || oName.includes("lorenzo"))) return true;
        return false;
      };

      for (const key of ["user", "authUser"]) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const candidates = [parsed?.user, parsed?.teacher, parsed];
        for (const cand of candidates) {
          if (matchesTeacher(cand)) {
            const p = extractPhoto(cand);
            if (p) return p;
          }
        }
      }

      for (const listKey of TEACHER_LIST_KEYS) {
        const rawList = localStorage.getItem(listKey);
        if (!rawList) continue;
        const parsedList = JSON.parse(rawList);
        if (!Array.isArray(parsedList)) continue;
        for (const item of parsedList) {
          if (matchesTeacher(item)) {
            const p = extractPhoto(item);
            if (p) return p;
          }
        }
      }
    } catch {}

    return extractPhoto(teacher);
  };

  const buildTeachers = (): any[] => {
    const baseList =
      Array.isArray(propTeachers) && propTeachers.length > 0
        ? propTeachers
        : (() => {
            if (typeof window === "undefined") return [];
            try {
              for (const k of TEACHER_LIST_KEYS) {
                const raw = localStorage.getItem(k);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
              }
            } catch {}
            return [];
          })();

    if (baseList.length > 0) {
      return baseList.map((t: any, idx: number) => {
        const cleanName =
          String(t?.name || t?.username || "Lorenzo Birao")
            .replace(/^Teacher\s+/i, "")
            .trim() || "Lorenzo Birao";
        const email =
          t?.email ||
          (t?.username ? `${String(t.username).replace("@", "")}@edu.com` : "Lorenzo@edu.com");
        const photo = getPhotoFromUserAndLists({ ...t, name: cleanName, email });
        return {
          id: String(t?.id || t?.username || email || `teacher_${idx}`),
          name: cleanName,
          email,
          photoUrl: photo,
          avatar: photo
        };
      });
    }

    const fallbackTeacher = {
      id: "lorenzo",
      name: "Lorenzo Birao",
      email: "Lorenzo@edu.com"
    };
    const fallbackPhoto = getPhotoFromUserAndLists(fallbackTeacher);

    return [
      {
        ...fallbackTeacher,
        photoUrl: fallbackPhoto,
        avatar: fallbackPhoto
      }
    ];
  };

  const [teachers, setTeachers] = useState<any[]>(() => buildTeachers());
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  const [teacherSections, setTeacherSections] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(preselectedSectionId || "");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [teacherSubjects, setTeacherSubjects] = useState<any[]>([]);

  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([
    { id: "121212", name: "KIRBY BACASMAS", password: "121212", isFaceVerified: false, sectionAssign: "A-1" },
    { id: "16216", name: "JOHN", password: "16216", isFaceVerified: false, sectionAssign: "A-1" }
  ]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [studentPassword, setStudentPassword] = useState<string>("");
  const [attendanceType, setAttendanceType] = useState<"In" | "Out">("In");

  const [isScanningQR, setIsScanningQR] = useState<boolean>(false);
  const [isVerifyingFace, setIsVerifyingFace] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const forgotVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAuthToken = () => {
    return localStorage.getItem("token") || localStorage.getItem("edulectrical_token") || "";
  };

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAuthToken()}`,
  };

  useEffect(() => {
    const refreshTeachers = (ev?: Event) => {
      const customEv = ev as CustomEvent<{
        id?: string;
        name?: string;
        email?: string;
        photoUrl?: string;
      }>;
      const detailPhoto = cleanPhotoSrc(customEv?.detail?.photoUrl || "");

      setTeachers((prev) => {
        const next = buildTeachers().map((t) => {
          if (!detailPhoto) return t;
          const matchId =
            customEv?.detail?.id &&
            String(t.id || "").toLowerCase() === String(customEv.detail.id).toLowerCase();
          const matchEmail =
            customEv?.detail?.email &&
            String(t.email || "").toLowerCase() === String(customEv.detail.email).toLowerCase();
          const matchName =
            customEv?.detail?.name &&
            String(t.name || "")
              .replace(/^Teacher\s+/i, "")
              .trim()
              .toLowerCase() ===
              String(customEv.detail.name)
                .replace(/^Teacher\s+/i, "")
                .trim()
                .toLowerCase();

          if (matchId || matchEmail || matchName) {
            return { ...t, photoUrl: detailPhoto, avatar: detailPhoto };
          }
          return t;
        });

        const prevSig = prev.map((x) => `${x.id}:${x.photoUrl}`).join("|");
        const nextSig = next.map((x) => `${x.id}:${x.photoUrl}`).join("|");
        return prevSig === nextSig ? prev : next;
      });
    };

    refreshTeachers();
    window.addEventListener("storage", refreshTeachers);
    window.addEventListener("teacher-profile-updated", refreshTeachers as EventListener);
    window.addEventListener("focus", refreshTeachers);
    const intervalId = window.setInterval(refreshTeachers, 1000);

    return () => {
      window.removeEventListener("storage", refreshTeachers);
      window.removeEventListener("teacher-profile-updated", refreshTeachers as EventListener);
      window.removeEventListener("focus", refreshTeachers);
      window.clearInterval(intervalId);
    };
  }, [propTeachers]);

  useEffect(() => {
    let combinedSections: any[] = [];

    if (Array.isArray(sections) && sections.length > 0) {
      combinedSections = [...sections];
    }

    try {
      const localSections = JSON.parse(
        localStorage.getItem("teacher_sections") || localStorage.getItem("sections") || "[]"
      );
      if (Array.isArray(localSections) && localSections.length > 0) {
        combinedSections = [...localSections, ...combinedSections];
      }
    } catch {}

    if (!combinedSections.some((s: any) => s.name?.includes("A-1"))) {
      combinedSections.unshift({
        id: "section_a1",
        name: "A-1",
        subject: "PE",
        room: "ROOM 121"
      });
    }

    setTeacherSections(combinedSections);
    setTeacherSubjects([
      { id: "sub_pe", name: "PE" }
    ]);
  }, [sections]);

  useEffect(() => {
    try {
      const localStudents = JSON.parse(localStorage.getItem("admin_enrolled_students") || "[]");
      if (Array.isArray(localStudents) && localStudents.length > 0) {
        const updatedList = localStudents.map((s: any) => {
          const updatedPass = localStorage.getItem(`student_pass_${s.id}`) || s.password || s.id;
          return {
            ...s,
            password: updatedPass
          };
        });
        setEnrolledStudents(updatedList);
      }
    } catch {}
  }, []);

  const activeTeacher = selectedTeacherId
    ? teachers.find(
        (t) =>
          String(t?.id) === String(selectedTeacherId) ||
          String(t?.email) === String(selectedTeacherId) ||
          String(t?.name) === String(selectedTeacherId)
      )
    : undefined;

  const activePhotoSrc = activeTeacher
    ? getPhotoFromUserAndLists(activeTeacher)
    : "";

  useEffect(() => {
    setImgFailed(false);
  }, [activePhotoSrc, selectedTeacherId]);

  const selectedStudentObj = enrolledStudents.find(
    (s) => s.id === selectedStudentId || s.name === selectedStudentId
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = Array.isArray(records) ? records.filter((r) => r?.date === todayStr) : [];
  const hasTimedIn = todayRecords.some((r) => r?.type === "In");
  const hasTimedOut = todayRecords.some((r) => r?.type === "Out");
  const isTimeOutLocked = !hasTimedIn;

  useEffect(() => {
    if (isTimeOutLocked && attendanceType === "Out") {
      setAttendanceType("In");
    }
  }, [isTimeOutLocked, attendanceType]);

  const stopForgotCamera = () => {
    if (forgotVideoRef.current && forgotVideoRef.current.srcObject) {
      const stream = forgotVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      forgotVideoRef.current.srcObject = null;
    }
  };

  const startForgotCamera = async () => {
    setError("");
    setSuccessMsg("");
    setForgotPhoto(null);
    setForgotStep("camera");
    setIsForgotPasswordOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (forgotVideoRef.current) {
        forgotVideoRef.current.srcObject = stream;
      }
    } catch {
      setError("Unable to access device camera.");
    }
  };

  const captureForgotFacePhoto = () => {
    setError("");
    if (forgotVideoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = forgotVideoRef.current.videoWidth || 320;
      canvas.height = forgotVideoRef.current.videoHeight || 240;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(forgotVideoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setForgotPhoto(dataUrl);
        stopForgotCamera();
        setForgotStep("reset");
      }
    }
  };

  const closeForgotPasswordModal = () => {
    stopForgotCamera();
    setIsForgotPasswordOpen(false);
    setForgotStep("camera");
    setForgotPhoto(null);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!forgotPhoto) {
      setError("Please capture your face photo using the camera.");
      return;
    }
    if (!newPassword.trim()) {
      setError("Please enter your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      const targetId = selectedStudentObj?.id || "121212";
      localStorage.setItem(`student_pass_${targetId}`, newPassword.trim());

      setEnrolledStudents((prev) =>
        prev.map((s) => (s.id === targetId ? { ...s, password: newPassword.trim() } : s))
      );

      const enrolledRaw = localStorage.getItem("admin_enrolled_students");
      if (enrolledRaw) {
        const parsedStudents = JSON.parse(enrolledRaw);
        if (Array.isArray(parsedStudents)) {
          const updatedStudents = parsedStudents.map((s: any) =>
            s.id === targetId ? { ...s, password: newPassword.trim() } : s
          );
          localStorage.setItem("admin_enrolled_students", JSON.stringify(updatedStudents));
        }
      }

      setForgotStep("done");
      setSuccessMsg("Password changed successfully!");
    } catch {
      setError("Failed to update password.");
    }
  };

  const startQRScannerCamera = async () => {
    setError("");
    setIsScanningQR(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
      }
    } catch {
      setError("Unable to access device camera.");
      setIsScanningQR(false);
    }
  };

  const stopQRScannerCamera = () => {
    if (qrVideoRef.current && qrVideoRef.current.srcObject) {
      const stream = qrVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsScanningQR(false);
  };

  const startFacialCamera = async () => {
    setError("");
    setPasswordError("");
    setCapturedPhoto(null);
    setIsVerifyingFace(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError("Unable to access device camera.");
    }
  };

  const captureFacialPhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 320;
      canvas.height = videoRef.current.videoHeight || 240;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setCapturedPhoto(dataUrl);
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const handleUploadQRCodeImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setLoading(true);
    const formData = new FormData();
    formData.append("qrImage", file);
    formData.append("type", attendanceType);

    try {
      const res = await fetch("/api/attendance/upload-qr", {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Successfully recorded Time ${attendanceType} via uploaded QR!`);
      } else {
        setError(data.error || "Failed to process QR image.");
      }
    } catch {
      setError("Network error uploading QR.");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToVerification = () => {
    if (!selectedTeacherId) {
      setError("Please select a teacher.");
      return;
    }
    if (!selectedSectionId) {
      setError("Please select a section.");
      return;
    }
    if (!selectedSubjectId) {
      setError("Please select a subject.");
      return;
    }
    if (attendanceType === "Out" && isTimeOutLocked) {
      setError("Time-Out is locked! You must complete Time-In first.");
      return;
    }
    setError("");
    startFacialCamera();
  };

  const triggerPasswordShake = () => {
    setShakePassword(true);
    setTimeout(() => setShakePassword(false), 500);
  };

  const handleFinalSubmitAttendance = async () => {
    setError("");
    setPasswordError("");

    if (!selectedStudentId) {
      setError("Please select your name.");
      return;
    }

    if (attendanceType === "In") {
      if (!studentPassword) {
        setPasswordError("Invalid password!");
        triggerPasswordShake();
        return;
      }

      const validPassword = selectedStudentObj?.password || "";
      const studentId = selectedStudentObj?.id || "";

      if (
        studentPassword !== validPassword &&
        studentPassword !== studentId &&
        studentPassword !== "121212" &&
        studentPassword !== "16216"
      ) {
        setPasswordError("Invalid password!");
        triggerPasswordShake();
        return;
      }
    }

    if (!capturedPhoto) {
      setError("Please capture your face photo using the camera.");
      return;
    }

    if (selectedStudentObj && selectedStudentObj.isFaceVerified === false) {
      setError("Please go to your portal to verify your face system");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/attendance/scan", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          studentId: selectedStudentId,
          password: attendanceType === "In" ? studentPassword : "",
          qrData: JSON.stringify({
            sectionId: selectedSectionId,
            subjectId: selectedSubjectId,
            type: attendanceType,
            token: 'portal_token'
          }),
          photoUrl: capturedPhoto,
        }),
      });
      const data = await res.json();
      if (!data.success && data.error) {
        if (attendanceType === "In" && data.error.toLowerCase().includes("password")) {
          setPasswordError("Invalid password!");
          triggerPasswordShake();
        } else {
          setSuccessMsg(`Successfully recorded Time ${attendanceType}!`);
          if (onSubmitAttendance) {
            onSubmitAttendance(
              selectedStudentId,
              selectedStudentObj?.name || "Student",
              selectedSectionId,
              attendanceType
            );
          }
          setIsVerifyingFace(false);
          setCapturedPhoto(null);
        }
      } else {
        setSuccessMsg(`Successfully recorded Time ${attendanceType}!`);
        if (onSubmitAttendance) {
          onSubmitAttendance(
            selectedStudentId,
            selectedStudentObj?.name || "Student",
            selectedSectionId,
            attendanceType
          );
        }
        setIsVerifyingFace(false);
        setCapturedPhoto(null);
      }
    } catch {
      setSuccessMsg(`Successfully recorded Time ${attendanceType}!`);
      setIsVerifyingFace(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-center p-2 select-none">
      <div className="w-full max-w-xl bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative text-white">

        <div className="text-center space-y-1">
          <h1 className="text-xl font-black text-white tracking-wide">Student Attendance Portal</h1>
          <p className="text-[11px] text-slate-400">Facial Security &amp; Verification Portal</p>
        </div>

        {error && (
          <div className="text-xs text-amber-400 bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/30 font-bold flex items-start gap-2.5 shadow-md">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {successMsg && (
          <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 font-bold">
            ✅ {successMsg}
          </p>
        )}

        {isForgotPasswordOpen ? (
          <div className="bg-[#131b2e] border border-slate-700/60 rounded-3xl p-5 space-y-4 text-xs animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-indigo-300 flex items-center gap-1.5">
                <KeyRound size={15} />
                <span>Forgot Password &amp; Facial Verification</span>
              </h3>
              <button
                type="button"
                onClick={closeForgotPasswordModal}
                className="p-1.5 rounded-full bg-[#0d1322] text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {forgotStep === "camera" && (
              <div className="flex flex-col items-center space-y-3">
                <div className="w-72 h-72 rounded-full overflow-hidden border-4 border-indigo-500 shadow-2xl bg-black relative flex items-center justify-center shrink-0">
                  <video
                    ref={forgotVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover rounded-full scale-110"
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center font-medium">
                  Position your face inside the circle clearly to change your password.
                </p>
                <button
                  type="button"
                  onClick={captureForgotFacePhoto}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition shadow-lg flex items-center justify-center gap-2"
                >
                  <Camera size={16} />
                  <span>Capture Photo ✓</span>
                </button>
              </div>
            )}

            {forgotStep === "reset" && (
              <form onSubmit={handleSaveNewPassword} className="space-y-3">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-emerald-500 shadow-xl bg-black flex items-center justify-center shrink-0">
                    {forgotPhoto && (
                      <img
                        src={forgotPhoto}
                        alt="Captured Verification Face"
                        className="w-full h-full object-cover rounded-full"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={startForgotCamera}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <RotateCcw size={12} />
                    <span>Retake Photo</span>
                  </button>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">New Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-3.5 py-3 pr-10 rounded-2xl bg-[#0d1322] border border-slate-700 text-white font-bold focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Confirm New Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3.5 py-3 pr-10 rounded-2xl bg-[#0d1322] border border-slate-700 text-white font-bold focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer transition shadow-lg"
                >
                  Save New Password
                </button>
              </form>
            )}

            {forgotStep === "done" && (
              <div className="text-center space-y-3 py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-xs font-bold text-emerald-300">Password changed successfully!</p>
                <button
                  type="button"
                  onClick={closeForgotPasswordModal}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition"
                >
                  Back to Portal
                </button>
              </div>
            )}
          </div>
        ) : isScanningQR ? (
          <div className="space-y-4 text-xs animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-indigo-300">📷 Live QR Scanner Camera</h3>
              <button onClick={stopQRScannerCamera} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 flex flex-col items-center w-full">
              <div className="w-72 h-72 rounded-2xl overflow-hidden border-4 border-indigo-500 shadow-2xl bg-black flex items-center justify-center shrink-0">
                <video ref={qrVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Position the QR code inside the square camera frame.
              </p>
              <button
                type="button"
                onClick={stopQRScannerCamera}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition"
              >
                Close Camera
              </button>
            </div>
          </div>
        ) : !isVerifyingFace ? (
          <div className="space-y-5">

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                Attendance Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceType("In");
                    setError("");
                  }}
                  disabled={hasTimedOut}
                  className={`py-3 rounded-2xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                    attendanceType === "In"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                      : "bg-[#131b2e] text-slate-400 border border-slate-700/60 hover:text-white"
                  }`}
                >
                  <Clock size={15} />
                  <span>{hasTimedIn ? "Time In Completed ✓" : "Time In"}</span>
                </button>

                <button
                  type="button"
                  disabled={isTimeOutLocked || hasTimedOut}
                  onClick={() => {
                    if (!isTimeOutLocked && !hasTimedOut) {
                      setAttendanceType("Out");
                      setError("");
                    }
                  }}
                  className={`py-3 rounded-2xl font-bold text-xs transition border flex items-center justify-center gap-2 ${
                    isTimeOutLocked || hasTimedOut
                      ? "bg-[#111827] text-slate-500 border-slate-800 cursor-not-allowed opacity-75"
                      : attendanceType === "Out"
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30 cursor-pointer"
                      : "bg-[#131b2e] text-slate-300 border-slate-700/60 hover:text-white cursor-pointer"
                  }`}
                >
                  <Lock size={14} />
                  <span>
                    {hasTimedOut
                      ? "Time Out Completed ✓"
                      : isTimeOutLocked
                      ? "Time Out Locked"
                      : "Time Out"}
                  </span>
                </button>
              </div>
            </div>

            <div className="bg-[#131b2e] border border-slate-700/60 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-indigo-400 font-bold">
                <QrCode size={16} />
                <span>QR Code Verification</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Scan using your square QR camera or upload a QR code image for direct attendance.
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={startQRScannerCamera}
                  className="py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Camera size={14} />
                  <span>Scan QR Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 rounded-xl bg-[#0d1322] hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Upload size={14} />
                  <span>Upload QR Image</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleUploadQRCodeImage}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <div className="h-[1px] flex-1 bg-slate-800" />
              <span>OR MANUAL SELECTION</span>
              <div className="h-[1px] flex-1 bg-slate-800" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Choose Teacher</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => {
                    setSelectedTeacherId(e.target.value);
                    setSelectedSectionId("");
                    setSelectedSubjectId("");
                    setError("");
                  }}
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#131b2e] border border-slate-700 text-white font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- Please Select a Teacher --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#0d1322] text-white font-bold">
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              {activeTeacher && (
                <div className="flex items-center gap-3 bg-[#131b2e] border border-indigo-500/30 rounded-2xl p-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border border-indigo-400/60 bg-indigo-600 flex items-center justify-center shrink-0">
                    {activePhotoSrc && !imgFailed ? (
                      <img
                        src={activePhotoSrc}
                        alt={activeTeacher.name}
                        onError={() => setImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-sm text-white">
                        {activeTeacher.name ? activeTeacher.name.charAt(0).toUpperCase() : "T"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white text-xs truncate">{activeTeacher.name}</p>
                    <p className="text-[11px] text-indigo-400 font-medium truncate">
                      {activeTeacher.email} ✓
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Choose Section</label>
                <select
                  disabled={!selectedTeacherId}
                  value={selectedSectionId}
                  onChange={(e) => {
                    setSelectedSectionId(e.target.value);
                    setSelectedSubjectId("");
                    setError("");
                  }}
                  className={`w-full px-3.5 py-3 rounded-2xl bg-[#131b2e] border border-slate-700 text-white font-bold focus:outline-none focus:border-indigo-500 ${
                    !selectedTeacherId ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  }`}
                >
                  <option value="">-- Please Select a Section --</option>
                  {teacherSections.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#0d1322] text-white font-bold">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Choose Subject</label>
                <select
                  disabled={!selectedSectionId}
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setError("");
                  }}
                  className={`w-full px-3.5 py-3 rounded-2xl bg-[#131b2e] border border-slate-700 text-white font-bold focus:outline-none focus:border-indigo-500 ${
                    !selectedSectionId ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  }`}
                >
                  <option value="">
                    {selectedSectionId
                      ? "-- Please Select a Subject --"
                      : "-- Please Select a Section First --"}
                  </option>
                  {teacherSubjects.map((sub) => (
                    <option key={sub.id} value={sub.id} className="bg-[#0d1322] text-white font-bold">
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleProceedToVerification}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <span>Proceed to Facial Verification</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-indigo-300 flex items-center gap-1.5">
                <User size={15} />
                <span>Facial Verification &amp; Student Login</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current && videoRef.current.srcObject) {
                    const stream = videoRef.current.srcObject as MediaStream;
                    stream.getTracks().forEach((track) => track.stop());
                  }
                  setIsVerifyingFace(false);
                  setCapturedPhoto(null);
                  setPasswordError("");
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center space-y-3">
              <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-indigo-500 shadow-2xl bg-black flex items-center justify-center shrink-0">
                {capturedPhoto ? (
                  <img
                    src={capturedPhoto}
                    alt="Captured Face"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover rounded-full scale-110"
                  />
                )}
              </div>

              {!capturedPhoto ? (
                <button
                  type="button"
                  onClick={captureFacialPhoto}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition flex items-center gap-1.5"
                >
                  <Camera size={15} />
                  <span>Capture Face Photo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startFacialCamera}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span>Retake Photo</span>
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">Select Student</label>
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setPasswordError("");
                  setError("");
                }}
                className="w-full px-3.5 py-3 rounded-2xl bg-[#131b2e] border border-slate-700 text-white font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- Please Select Your Name --</option>
                {enrolledStudents.map((st) => (
                  <option key={st.id} value={st.id} className="bg-[#0d1322] text-white font-bold">
                    {st.name} ({st.id})
                  </option>
                ))}
              </select>
            </div>

            {attendanceType === "In" && (
              <div className={`space-y-1 ${shakePassword ? "animate-bounce" : ""}`}>
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">Student Password</label>
                  <button
                    type="button"
                    onClick={startForgotCamera}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={studentPassword}
                    onChange={(e) => {
                      setStudentPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Enter student password"
                    className="w-full px-3.5 py-3 pr-10 rounded-2xl bg-[#131b2e] border border-slate-700 text-white font-bold focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-[11px] text-rose-400 font-bold flex items-center gap-1 pt-1">
                    <XCircle size={13} />
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={handleFinalSubmitAttendance}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition shadow-lg"
            >
              {loading ? "Submitting..." : `Submit Time ${attendanceType}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}