import React, { useState, useRef, useEffect } from 'react';
import { AuthUser } from '../types';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Shield,
  UserCheck,
  GraduationCap,
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  X,
  Send,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onBackToCheckin: () => void;
}

const TEACHER_RESET_COOLDOWN_MS = 2 * 60 * 1000;
const TEACHER_RESET_STORAGE_KEY = 'teacher_password_reset_requests';
const TEACHER_RESET_COOLDOWN_KEY = 'teacher_password_reset_cooldowns';

export default function LoginPage({ onLoginSuccess, onBackToCheckin }: LoginPageProps) {
  const [role, setRole] = useState<'teacher' | 'student' | 'admin'>('teacher');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [needsVerification, setNeedsVerification] = useState(false);
  const [pendingStudentData, setPendingStudentData] = useState<any>(null);

  // Student Forgot Password flow states
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'username' | 'face' | 'reset'>('username');
  const [forgotUsername, setForgotUsername] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPassword] = useState(false);

  // Teacher Admin Approval Request states
  const [isTeacherResetRequest, setIsTeacherResetRequest] = useState(false);
  const [teacherResetUsername, setTeacherResetUsername] = useState('');
  const [teacherResetEmail, setTeacherResetEmail] = useState('');
  const [teacherResetNote, setTeacherResetNote] = useState('');

  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraActive(false);
      setErrorMessage('Unable to open camera. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleCloseFaceVerification = () => {
    stopCamera();
    setCapturedPhoto(null);
    setErrorMessage('');
    setNeedsVerification(false);
    setPendingStudentData(null);
  };

  const handleCloseForgotFaceScan = () => {
    stopCamera();
    setCapturedPhoto(null);
    setErrorMessage('');
    setForgotStep('username');
  };

  useEffect(() => {
    if (needsVerification || (isForgotPassword && forgotStep === 'face')) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [needsVerification, isForgotPassword, forgotStep]);

  useEffect(() => {
    if (streamRef.current && videoRef.current && !capturedPhoto) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [capturedPhoto, needsVerification, isForgotPassword, forgotStep]);

  const validateImageBrightness = (dataUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(true);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        let colorSum = 0;

        for (let i = 0; i < data.length; i += 4 * 10) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const avg = r * 0.299 + g * 0.587 + b * 0.114;
          colorSum += avg;
        }

        const brightness = colorSum / (data.length / 4 / 10);
        resolve(brightness >= 45);
      };
      img.onerror = () => resolve(false);
    });
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current || !cameraActive) {
      setErrorMessage('Camera is not active yet. Please wait.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');

      const isBrightEnough = await validateImageBrightness(dataUrl);
      if (!isBrightEnough) {
        setErrorMessage('Image is too dark or face is not clear. Please try again in a well-lit area.');
        return;
      }

      setErrorMessage('');
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const handleVerifyAndCompleteLogin = async () => {
    if (!capturedPhoto) {
      setErrorMessage('No face detected. Please capture your face before confirming.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const { ok, data } = await apiFetch('/api/student/verify-attendance', {
        method: 'POST',
        body: JSON.stringify({
          studentId: pendingStudentData?.user?.id,
          sectionId: pendingStudentData?.user?.sectionId,
          capturedPhoto,
          type: 'In',
        }),
      });

      if (ok && data.success) {
        const updatedUser = { ...pendingStudentData.user, isVerified: true, photoUrl: capturedPhoto };
        localStorage.setItem('authUser', JSON.stringify(updatedUser));
        if (pendingStudentData.token) localStorage.setItem('token', pendingStudentData.token);
        onLoginSuccess(updatedUser);
      } else {
        setErrorMessage(data.error || 'Verification failed. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Server connection error during verification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartForgotFaceScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) {
      setErrorMessage('Please enter your student ID or name.');
      return;
    }
    setErrorMessage('');
    setCapturedPhoto(null);
    setForgotStep('face');
  };

  const handleResetPasswordWithFace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedPhoto) {
      setErrorMessage('No face detected. Please capture your face first.');
      return;
    }
    if (newResetPassword.length < 4) {
      setErrorMessage('New password must be at least 4 characters.');
      return;
    }
    if (newResetPassword !== confirmResetPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const { ok, data } = await apiFetch('/api/student/forgot-password-face', {
        method: 'POST',
        body: JSON.stringify({
          username: forgotUsername.trim(),
          capturedPhoto,
          newPassword: newResetPassword,
        }),
      });

      if (ok && data.success) {
        stopCamera();
        setIsForgotPassword(false);
        setForgotStep('username');
        setCapturedPhoto(null);
        setNewResetPassword('');
        setConfirmResetPassword('');
        setUsername(forgotUsername.trim());
        setPassword('');
        setSuccessMessage('Identity verified! Password updated. You can now sign in.');
      } else {
        setErrorMessage(data.error || 'Face did not match records.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Server error while verifying face.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRemainingTeacherCooldownSeconds = (targetUsername: string): number => {
    const cleanKey = targetUsername.trim().toLowerCase();
    if (!cleanKey) return 0;
    try {
      const map = JSON.parse(localStorage.getItem(TEACHER_RESET_COOLDOWN_KEY) || '{}');
      const lastSentAt = Number(map?.[cleanKey] || 0);
      if (!lastSentAt) return 0;
      const elapsed = Date.now() - lastSentAt;
      if (elapsed >= TEACHER_RESET_COOLDOWN_MS) return 0;
      return Math.ceil((TEACHER_RESET_COOLDOWN_MS - elapsed) / 1000);
    } catch {
      return 0;
    }
  };

  const recordTeacherCooldown = (targetUsername: string) => {
    const cleanKey = targetUsername.trim().toLowerCase();
    if (!cleanKey) return;
    try {
      const map = JSON.parse(localStorage.getItem(TEACHER_RESET_COOLDOWN_KEY) || '{}');
      map[cleanKey] = Date.now();
      localStorage.setItem(TEACHER_RESET_COOLDOWN_KEY, JSON.stringify(map));
    } catch {}
  };

  const handleSubmitTeacherResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = teacherResetUsername.trim();
    if (!cleanUsername) {
      setErrorMessage('Please enter your teacher username.');
      return;
    }

    const remainingSec = getRemainingTeacherCooldownSeconds(cleanUsername);
    if (remainingSec > 0) {
      setErrorMessage(
        `A reset request was already sent for "${cleanUsername}". Please wait ${remainingSec}s before sending another request.`
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const requestPayload = {
      id: `tr_${Date.now()}`,
      role: 'teacher',
      username: cleanUsername,
      email: teacherResetEmail.trim(),
      note: teacherResetNote.trim(),
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    const saveLocalRequestIfNotDuplicate = () => {
      try {
        const existing = JSON.parse(localStorage.getItem(TEACHER_RESET_STORAGE_KEY) || '[]');
        const list = Array.isArray(existing) ? existing : [];
        const hasPending = list.some(
          (item: any) =>
            String(item?.username || '').trim().toLowerCase() === cleanUsername.toLowerCase() &&
            String(item?.status || 'pending').toLowerCase() === 'pending'
        );
        if (!hasPending) {
          list.unshift(requestPayload);
          localStorage.setItem(TEACHER_RESET_STORAGE_KEY, JSON.stringify(list));
        }
      } catch {}
    };

    try {
      const { ok, data } = await apiFetch('/api/auth/teacher-password-reset-request', {
        method: 'POST',
        body: JSON.stringify(requestPayload),
      });

      recordTeacherCooldown(cleanUsername);
      saveLocalRequestIfNotDuplicate();

      setIsTeacherResetRequest(false);
      setUsername(cleanUsername);
      setPassword('');
      setTeacherResetNote('');
      setSuccessMessage(
        ok && data?.success !== false
          ? 'Password reset request sent for Admin approval.'
          : 'Password reset request recorded for Admin approval.'
      );
    } catch {
      recordTeacherCooldown(cleanUsername);
      saveLocalRequestIfNotDuplicate();

      setIsTeacherResetRequest(false);
      setUsername(cleanUsername);
      setPassword('');
      setSuccessMessage('Password reset request saved for Admin approval.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdentifier = username.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      setErrorMessage('Please enter both ID/name/username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { ok, data } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: cleanIdentifier,
          idNumber: cleanIdentifier,
          password: cleanPassword,
          role,
        }),
      });

      if (ok && data?.success && data?.user) {
        if (data.user.role !== role) {
          setErrorMessage('Access Denied for selected role.');
          setIsLoading(false);
          return;
        }

        if (data.user.role === 'student' && !data.user.isVerified) {
          setPendingStudentData(data);
          setNeedsVerification(true);
          setIsLoading(false);
          return;
        }

        localStorage.setItem('authUser', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('token', data.token);
        onLoginSuccess(data.user);
      } else {
        setErrorMessage(data?.error || 'Invalid ID, name, username, or password.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Server connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isTeacherResetRequest) {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setIsTeacherResetRequest(false);
              setErrorMessage('');
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 transition cursor-pointer"
          >
            <ArrowLeft size={16} /> <span>Back to Sign In</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 text-[10px] font-mono font-bold uppercase">
            <KeyRound size={12} /> Admin Approval
          </span>
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-xl font-black text-gray-900 dark:text-white">Teacher Password Reset</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Submit a request for Admin approval to reset your teacher password.
          </p>
        </div>

        <form onSubmit={handleSubmitTeacherResetRequest} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              TEACHER USERNAME
            </label>
            <input
              type="text"
              required
              value={teacherResetUsername}
              onChange={(e) => setTeacherResetUsername(e.target.value)}
              placeholder="Enter teacher username"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 font-bold text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              EMAIL (OPTIONAL)
            </label>
            <input
              type="email"
              value={teacherResetEmail}
              onChange={(e) => setTeacherResetEmail(e.target.value)}
              placeholder="Enter registered email"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 font-bold text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              NOTE FOR ADMIN (OPTIONAL)
            </label>
            <input
              type="text"
              value={teacherResetNote}
              onChange={(e) => setTeacherResetNote(e.target.value)}
              placeholder="e.g. Forgot password, need reset"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 font-bold text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 rounded-2xl font-bold flex items-center gap-2 text-xs">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition cursor-pointer text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send size={16} />
            <span>{isLoading ? 'Sending Request...' : 'Request Admin Approval'}</span>
          </button>
        </form>
      </div>
    );
  }

  if (isForgotPassword) {
    return (
      <div className="max-w-md mx-auto bg-gray-950 text-white rounded-3xl border border-indigo-500/30 p-8 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setIsForgotPassword(false);
              setForgotStep('username');
              setCapturedPhoto(null);
              setErrorMessage('');
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft size={16} /> <span>Back to Sign In</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-400 text-[10px] font-mono font-bold uppercase">
            <KeyRound size={12} /> Face Recovery
          </span>
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black tracking-tight">Recover Account</h2>
          <p className="text-xs text-gray-400">
            Verify your identity using facial recognition to reset your password.
          </p>
        </div>

        {forgotStep === 'username' && (
          <form onSubmit={handleStartForgotFaceScan} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-gray-400 uppercase tracking-wider">
                STUDENT ID OR NAME
              </label>
              <input
                type="text"
                required
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
                placeholder="Enter your student ID or registered name"
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 font-bold text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            {errorMessage && (
              <div className="p-3 bg-amber-950/60 border border-amber-700/60 text-amber-200 rounded-2xl font-bold flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-2xl shadow-lg transition cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              <Camera size={18} /> Proceed to Face Scan
            </button>
          </form>
        )}

        {forgotStep === 'face' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300">Face Scan</span>
              <button
                type="button"
                onClick={handleCloseForgotFaceScan}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold transition cursor-pointer"
              >
                <X size={14} /> <span>Close</span>
              </button>
            </div>

            <div className="flex flex-col items-center justify-center py-1">
              <div className="relative w-60 h-60 sm:w-72 sm:h-72 rounded-full overflow-hidden bg-black flex items-center justify-center border-4 border-emerald-400/80 shadow-[0_0_35px_rgba(16,185,129,0.3)]">
                {capturedPhoto ? (
                  <img src={capturedPhoto} alt="Captured Face" className="w-full h-full object-cover" />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-amber-950/60 border border-amber-700/60 text-amber-200 rounded-2xl font-bold flex items-center gap-2 text-xs">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {!capturedPhoto ? (
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl text-xs shadow-lg flex items-center justify-center gap-2 transition cursor-pointer uppercase tracking-wider"
              >
                <Camera size={18} /> Capture Face to Verify
              </button>
            ) : (
              <form onSubmit={handleResetPasswordWithFace} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-gray-400 uppercase tracking-wider">
                    NEW PASSWORD
                  </label>
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 font-bold text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-400 uppercase tracking-wider">
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 font-bold text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="w-1/3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw size={14} /> Retake
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-2/3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl text-xs shadow-lg flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> {isLoading ? 'Verifying Face...' : 'Verify & Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  if (needsVerification) {
    return (
      <div className="max-w-lg mx-auto bg-gray-950 text-white rounded-3xl border border-emerald-500/30 p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-mono font-bold tracking-widest uppercase">
            <Shield size={14} /> Biometric Security Required
          </span>
          <button
            type="button"
            onClick={handleCloseFaceVerification}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 text-xs font-bold transition cursor-pointer"
          >
            <X size={15} /> <span>Close</span>
          </button>
        </div>

        <div className="space-y-2 relative z-10">
          <h2 className="text-2xl font-black tracking-tight text-white">
            First-Time Facial Identity Lock
          </h2>
          <p className="text-xs text-gray-400">
            Position your face clearly inside the circle in a well-lit area. Dark or unclear scans
            will trigger an error.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-1 relative z-10">
          <div className="relative w-60 h-60 sm:w-72 sm:h-72 rounded-full overflow-hidden bg-black flex items-center justify-center border-4 border-emerald-400/80 shadow-[0_0_35px_rgba(16,185,129,0.3)]">
            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Captured Face" className="w-full h-full object-cover" />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl font-bold text-xs relative z-10">
            {errorMessage}
          </div>
        )}

        <div className="flex gap-3 relative z-10">
          {capturedPhoto ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="w-1/2 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RefreshCw size={14} /> Retake Scan
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleVerifyAndCompleteLogin}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl text-xs shadow-lg flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={16} /> {isLoading ? 'Verifying...' : 'Verify & Enter'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCapturePhoto}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl text-xs shadow-lg flex items-center justify-center gap-2 transition cursor-pointer uppercase tracking-wider"
            >
              <Camera size={18} /> Capture Biometric Face
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToCheckin}
          className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-indigo-600 transition cursor-pointer"
        >
          <ArrowLeft size={16} /> <span>Back to Check-In</span>
        </button>
        <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold">
          Secure Portal
        </span>
      </div>

      <div className="text-center space-y-1">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Sign In</h2>
      </div>

      <div className="grid grid-cols-3 gap-1.5 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setRole('teacher')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
            role === 'teacher'
              ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <UserCheck size={16} />
          <span>Teacher</span>
        </button>
        <button
          type="button"
          onClick={() => setRole('student')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
            role === 'student'
              ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <GraduationCap size={16} />
          <span>Student</span>
        </button>
        <button
          type="button"
          onClick={() => setRole('admin')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
            role === 'admin'
              ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          <Shield size={16} />
          <span>Admin</span>
        </button>
      </div>

      <form onSubmit={handleLogin} className="space-y-4 text-xs">
        <div className="space-y-1">
          <label className="font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            {role === 'student' ? 'STUDENT ID OR NAME' : 'USERNAME'}
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={
              role === 'student'
                ? 'Enter student ID or registered name'
                : 'Enter username'
            }
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 font-bold text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              PASSWORD
            </label>
            {role === 'student' && (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setForgotUsername(username);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            )}
            {role === 'teacher' && (
              <button
                type="button"
                onClick={() => {
                  setIsTeacherResetRequest(true);
                  setTeacherResetUsername(username);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={role === 'student' ? 'Enter system-assigned Student ID' : '••••••••'}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 pr-12 font-bold text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {role === 'student' && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Default password is your system-assigned Student ID (e.g., 466220)[cite: 2].
            </p>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 rounded-2xl font-bold flex items-center justify-center gap-2 text-xs">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 rounded-2xl font-bold text-center text-xs">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition cursor-pointer text-sm disabled:opacity-50"
        >
          {isLoading ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}