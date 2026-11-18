import React, { useState, useEffect, useRef } from 'react';
import { Section } from '../types';
import { apiFetch } from '../services/api';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  QrCode,
  UserCheck,
  Camera,
  Upload,
  X,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  User,
  Key,
  FileText,
} from 'lucide-react';

interface StudentPortalProps {
  sections: Section[];
  preselectedSectionId?: string | null;
  onSubmitAttendance: (
    studentId: string,
    studentName: string,
    sectionId: string,
    sectionName: string,
    date: string,
    time: string,
    type?: 'In' | 'Out'
  ) => Promise<{
    status: 'Present' | 'Late' | 'Time Out';
    startTime: string;
  }>;
  onUpdateStudentPhoto?: (
    sectionId: string,
    studentId: string,
    photoUrl: string
  ) => void;
  onGoToLogin: () => void;
}

function formatSectionTime(timeStr: string): string {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
    return timeStr || '';
  }

  const [hours, minutes] = timeStr.split(':').map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return timeStr;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export default function StudentPortal({
  sections: propSections,
  preselectedSectionId,
  onSubmitAttendance,
}: StudentPortalProps) {
  const [step, setStep] = useState<
    'qr_scan' | 'facial_verify' | 'success' | 'failed'
  >('qr_scan');

  const [sections, setSections] = useState<any[]>(propSections || []);
  const [teachersList, setTeachersList] = useState<any[]>([]);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const res = await apiFetch('/api/state/public');
        if (res.ok && res.data.success) {
          setTeachersList(res.data.teachers || []);
          if (res.data.sections && res.data.sections.length > 0) {
            setSections(res.data.sections);
          }
        }
      } catch (err) {
        console.error('Error fetching public state in student portal:', err);
      }
    };
    fetchPublicData();
  }, [propSections]);

  const [scannedSectionId, setScannedSectionId] = useState(
    preselectedSectionId || ''
  );
  const [attendanceType, setAttendanceType] = useState<'In' | 'Out'>('In');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [verifiedStudent, setVerifiedStudent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Student Settings State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newProfilePhoto, setNewProfilePhoto] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  };

  const startCamera = async () => {
    setErrorMessage('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage(
        'Camera access is unavailable. Use HTTPS or localhost and check browser permissions.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      } else {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    } catch (error) {
      console.error('Camera error:', error);
      setErrorMessage(
        'Unable to open the camera. Please allow camera access in your browser.'
      );
      setCameraActive(false);
    }
  };

  const stopQrCamera = () => {
    qrStreamRef.current?.getTracks().forEach((track) => track.stop());
    qrStreamRef.current = null;
    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
    setIsScanningQR(false);
  };

  const startQrCamera = async () => {
    setErrorMessage('');
    if (!('BarcodeDetector' in window)) {
      setErrorMessage('QR Code scanning via camera is not supported in this browser. Please use Upload QR or Manual selection.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      qrStreamRef.current = stream;
      setIsScanningQR(true);

      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        await qrVideoRef.current.play();
        scanQrLoop();
      }
    } catch (error) {
      console.error('QR Camera error:', error);
      setErrorMessage('Unable to access camera for QR scanning.');
      setIsScanningQR(false);
    }
  };

  const scanQrLoop = async () => {
    if (!isScanningQR && !qrStreamRef.current) return;

    if (qrVideoRef.current && qrVideoRef.current.readyState === qrVideoRef.current.HAVE_ENOUGH_DATA) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await barcodeDetector.detect(qrVideoRef.current);
        if (barcodes.length > 0) {
          const qrText = barcodes[0].rawValue;
          processScannedCode(qrText);
          return;
        }
      } catch (err) {
        // Ignore detection frame errors while scanning
      }
    }

    if (qrStreamRef.current) {
      requestAnimationFrame(scanQrLoop);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    if (!('BarcodeDetector' in window)) {
      setErrorMessage('QR Code detection from image is not supported in this browser.');
      return;
    }

    const image = document.createElement('img');
    image.src = URL.createObjectURL(file);
    image.onload = async () => {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await barcodeDetector.detect(image);
        if (barcodes.length > 0) {
          const qrText = barcodes[0].rawValue;
          processScannedCode(qrText);
        } else {
          setErrorMessage('No valid QR code found in the uploaded image.');
        }
      } catch (err) {
        setErrorMessage('Failed to read QR code from the uploaded image.');
      }
    };
    image.onerror = () => {
      setErrorMessage('Invalid image file.');
    };
  };

  const processScannedCode = (code: string) => {
    const matchedSection = sections.find(
      (s) => s.id === code.trim() || code.includes(s.id)
    );

    if (matchedSection) {
      stopQrCamera();
      setScannedSectionId(matchedSection.id);
      setSelectedSubjectId(matchedSection.id);
      setErrorMessage('');
      setStep('facial_verify');
    } else {
      setErrorMessage(`Scanned QR code does not match any active section: "${code}"`);
    }
  };

  useEffect(() => {
    if (step === 'facial_verify') {
      void startCamera();
    } else {
      stopCamera();
    }

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      stopQrCamera();
    };
  }, [step]);

  const handleValidateManual = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedTeacherId) {
      setErrorMessage('Please select a teacher.');
      return;
    }

    if (!selectedSubjectId) {
      setErrorMessage('Please select a subject or section.');
      return;
    }

    const sectionExists = sections.some(
      (section) => section.id === selectedSubjectId
    );

    if (!sectionExists) {
      setErrorMessage('The selected section was not found in the database. Please refresh.');
      return;
    }

    setScannedSectionId(selectedSubjectId);
    setErrorMessage('');
    setStep('facial_verify');
  };

  const handleCaptureAndVerifyFace = async () => {
    if (isVerifying) return;

    if (!selectedStudentId) {
      setErrorMessage('Please select your name.');
      return;
    }

    if (attendanceType === 'In' && !passwordInput) {
      setErrorMessage('Please enter your student password.');
      return;
    }

    const currentSection = sections.find((s) => s.id === scannedSectionId);
    const selectedStudent = currentSection?.students?.find(
      (st: any) => String(st.id) === String(selectedStudentId)
    );

    if (!selectedStudent) {
      setErrorMessage('Selected student not found in this section.');
      return;
    }

    const isUnverified = !selectedStudent.isVerified && !selectedStudent.photoUrl;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !cameraActive || video.videoWidth === 0) {
      setErrorMessage('Camera access is required for facial verification. Please allow camera permissions.');
      setStep('failed');
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      setErrorMessage('Failed to capture facial security frame.');
      setStep('failed');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const capturedImage = canvas.toDataURL('image/jpeg', 0.85);

    if (!capturedImage || capturedImage.length < 100) {
      setErrorMessage('Captured facial image is invalid or unclear.');
      setStep('failed');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await apiFetch('/api/student/verify-attendance', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudent.id,
          username: selectedStudent.username || selectedStudent.name,
          password: attendanceType === 'In' ? passwordInput : '',
          sectionId: scannedSectionId,
          capturedPhoto: capturedImage,
          type: attendanceType,
        }),
      });

      const data = res.data;

      if (
        !res.ok ||
        !data.success ||
        !data.student?.id ||
        !data.student?.name ||
        (isUnverified && data.student?.isVerified === false)
      ) {
        setErrorMessage(
          data.error ||
            'ACCESS DENIED: Facial verification required to unlock access.'
        );
        setStep('failed');
        return;
      }

      const studentId = String(data.student.id);
      const studentName = String(data.student.name);
      const section = sections.find(
        (item) => item.id === scannedSectionId
      );

      if (!section) {
        setErrorMessage('Selected section record not found.');
        setStep('failed');
        return;
      }

      setVerifiedStudent({ id: studentId, name: studentName });

      const now = new Date();
      const dateStr = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-');

      const timeStr = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
      ].join(':');

      await onSubmitAttendance(
        studentId,
        studentName,
        scannedSectionId,
        section.name,
        dateStr,
        timeStr,
        attendanceType
      );

      setStep('success');
    } catch (error) {
      console.error('Attendance verification error:', error);
      setErrorMessage('Server connection error during verification.');
      setStep('failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUpdateStudentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!selectedStudentId) {
      setErrorMessage('Please select a student account.');
      return;
    }

    try {
      const res = await apiFetch('/api/student/update-settings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudentId,
          photoUrl: newProfilePhoto,
          currentPassword,
          newPassword,
        }),
      });

      if (res.ok && res.data.success) {
        setSuccessMessage('Student profile and password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setErrorMessage(res.data.error || 'Failed to update student settings.');
      }
    } catch (err) {
      setErrorMessage('Server error while updating profile.');
    }
  };

  const resetPortal = () => {
    stopCamera();
    stopQrCamera();
    setSelectedStudentId('');
    setPasswordInput('');
    setSelectedTeacherId('');
    setSelectedSubjectId('');
    setScannedSectionId('');
    setErrorMessage('');
    setSuccessMessage('');
    setVerifiedStudent(null);
    setAttendanceType('In');
    setStep('qr_scan');
  };

  const activeTeacher = teachersList.find((t) => String(t.id) === String(selectedTeacherId));
  const teacherSections = activeTeacher ? activeTeacher.sections : [];

  const availableSections = Array.from(new Set(teacherSections.map((s: any) => s.name)));
  const availableSubjectsForSection = teacherSections.filter((s: any) => scannedSectionId && s.name === scannedSectionId);

  const currentActiveSection = sections.find((s) => s.id === scannedSectionId);
  const sectionStudents = currentActiveSection?.students || [];

  const selectedStudentObj = sectionStudents.find((st: any) => String(st.id) === String(selectedStudentId));
  const isStudentUnverified = selectedStudentObj && !selectedStudentObj.isVerified && !selectedStudentObj.photoUrl;

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-gray-900 rounded-3xl border p-8 shadow-xl space-y-6">
      <div className="text-center space-y-2 relative">
        <button
          type="button"
          onClick={() => setShowSettingsModal(true)}
          className="absolute right-0 top-0 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
        >
          <User size={14} />
          <span>Settings &amp; Logs</span>
        </button>

        <h2 className="text-2xl font-black">
          Student Attendance Portal
        </h2>
        <p className="text-xs text-gray-400">
          Facial Security &amp; Verification Portal
        </p>
      </div>

      {step === 'qr_scan' && (
        <div className="space-y-6 text-xs">
          <div>
            <label className="font-bold block mb-1">
              Attendance Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAttendanceType('In')}
                className={`flex-1 py-2.5 rounded-xl font-bold cursor-pointer ${
                  attendanceType === 'In'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                Time In
              </button>
              <button
                type="button"
                onClick={() => setAttendanceType('Out')}
                className={`flex-1 py-2.5 rounded-xl font-bold cursor-pointer ${
                  attendanceType === 'Out'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                Time Out
              </button>
            </div>
          </div>

          <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
              <QrCode size={18} />
              <span>QR Code Verification</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Scan using your camera or upload a QR code image to proceed to facial verification.
            </p>

            {isScanningQR ? (
              <div className="space-y-3 text-center">
                <div className="relative inline-block overflow-hidden rounded-2xl border-4 border-indigo-600 bg-black shadow-lg">
                  <video
                    ref={qrVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-64 h-64 object-cover"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={stopQrCamera}
                    className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 mx-auto cursor-pointer"
                  >
                    <X size={16} />
                    <span>Close QR Camera</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={startQrCamera}
                  className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow cursor-pointer"
                >
                  <Camera size={16} />
                  <span>Scan QR Camera</span>
                </button>

                <label className="flex-1 py-3 px-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold rounded-xl flex items-center justify-center gap-2 transition shadow cursor-pointer text-center">
                  <Upload size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Upload QR Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
            <span className="flex-shrink mx-4 text-gray-400 font-bold uppercase text-[10px]">
              Or Manual Selection
            </span>
            <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
          </div>

          <form onSubmit={handleValidateManual} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="font-bold block mb-1 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-indigo-500" />
                  <span>Choose Teacher</span>
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => {
                    setSelectedTeacherId(e.target.value);
                    setScannedSectionId('');
                    setSelectedSubjectId('');
                  }}
                  className="w-full border dark:border-gray-700 rounded-xl p-3 font-bold bg-white dark:bg-gray-900"
                  required
                >
                  <option value="">-- Select Teacher --</option>
                  {teachersList.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>

                {activeTeacher && (
                  <div className="mt-3 p-3 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-2xl flex items-center gap-3">
                    {activeTeacher.photo ? (
                      <img
                        src={activeTeacher.photo}
                        alt={activeTeacher.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-indigo-600 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center text-lg shadow-sm">
                        {activeTeacher.name ? activeTeacher.name.charAt(0).toUpperCase() : 'T'}
                      </div>
                    )}
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">
                        {activeTeacher.name}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {activeTeacher.subject ? `Subject: ${activeTeacher.subject}` : 'Instructor'} 
                        {activeTeacher.room ? ` • Room: ${activeTeacher.room}` : ''}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Choose Section
                </label>
                <select
                  value={scannedSectionId}
                  onChange={(e) => {
                    setScannedSectionId(e.target.value);
                    setSelectedSubjectId('');
                  }}
                  disabled={!selectedTeacherId}
                  className="w-full border dark:border-gray-700 rounded-xl p-3 font-bold bg-white dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">
                    {!selectedTeacherId ? '-- Please Select a Teacher First --' : '-- Select Section --'}
                  </option>
                  {availableSections.map((secName: any) => (
                    <option key={secName} value={secName}>
                      Section: {secName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Choose Subject / Schedule
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  disabled={!scannedSectionId}
                  className="w-full border dark:border-gray-700 rounded-xl p-3 font-bold bg-white dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">
                    {!scannedSectionId ? '-- Please Select a Section First --' : '-- Select Subject --'}
                  </option>
                  {availableSubjectsForSection.map((section: any) => {
                    const displayTime = attendanceType === 'Out' 
                      ? (section.endTime || '17:00') 
                      : (section.startTime || '08:00');

                    const displaySubjectName = section.subject || activeTeacher?.subject || section.name;

                    return (
                      <option key={section.id} value={section.id}>
                        {displaySubjectName} ({formatSectionTime(displayTime)})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {errorMessage && (
              <p role="alert" className="text-rose-500 font-bold">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>Proceed to Facial Verification</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}

      {step === 'facial_verify' && (
        <div className="space-y-4 text-xs text-center">
          <p className="font-bold text-indigo-600 dark:text-indigo-400">
            Step 2: Select Your Name &amp; Facial Verification ({attendanceType === 'In' ? 'Time In' : 'Time Out'})
          </p>

          <div className="relative inline-block overflow-hidden rounded-2xl border-4 border-indigo-600 bg-black shadow-lg">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-72 h-72 object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {!cameraActive && (
            <p className="text-amber-600">
              Camera is initializing or check camera permissions.
            </p>
          )}

          {isStudentUnverified && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl flex items-center gap-2 text-left">
              <ShieldAlert size={20} className="flex-shrink-0" />
              <span>
                <strong>Access Restricted:</strong> This account is <em>Not Fully Verified</em>. You must complete live facial verification below to unlock access.
              </span>
            </div>
          )}

          <div className="space-y-2 text-left max-w-xs mx-auto">
            <div>
              <label className="font-bold block mb-1">Select Your Name</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full border dark:border-gray-700 rounded-xl p-2.5 bg-white dark:bg-gray-900 font-bold"
                required
              >
                <option value="">-- Select Your Name --</option>
                {sectionStudents.map((st: any) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.isVerified || st.photoUrl ? '✓ (Fully Verified)' : '🔒 (Not Fully Verified)'}
                  </option>
                ))}
              </select>
            </div>

            {attendanceType === 'In' && (
              <div>
                <label className="font-bold block mb-1">Student Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full border dark:border-gray-700 rounded-xl p-2.5 bg-white dark:bg-gray-900 font-bold"
                  required
                />
              </div>
            )}
          </div>

          {errorMessage && (
            <p role="alert" className="text-rose-500 font-bold">
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleCaptureAndVerifyFace}
            disabled={!cameraActive || isVerifying}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock size={16} />
            <span>{isVerifying ? 'Verifying & Unlocking...' : 'Verify Face & Unlock Access'}</span>
          </button>

          <button
            type="button"
            onClick={resetPortal}
            className="text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center space-y-4 py-8">
          <CheckCircle2 size={64} className="text-green-500 mx-auto" />

          <h3 className="text-xl font-bold">
            Attendance Submitted Successfully!
          </h3>

          {verifiedStudent && (
            <p className="text-sm font-semibold">
              {verifiedStudent.name}
            </p>
          )}

          <p className="text-xs text-gray-500">
            Facial verification complete. Attendance record saved into system logs.
          </p>

          <button
            type="button"
            onClick={resetPortal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition shadow cursor-pointer"
          >
            Done / Submit Another
          </button>
        </div>
      )}

      {step === 'failed' && (
        <div className="text-center space-y-4 py-8">
          <AlertCircle size={64} className="text-rose-500 mx-auto" />

          <h3 className="text-xl font-bold text-rose-600">
            Access Denied: Verification Required
          </h3>

          <p role="alert" className="text-xs text-rose-500">
            {errorMessage || 'You cannot submit attendance until your account is fully verified through facial security.'}
          </p>

          <button
            type="button"
            onClick={resetPortal}
            className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition shadow cursor-pointer"
          >
            Back to Verification
          </button>
        </div>
      )}

      {/* STUDENT SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 dark:border-gray-800">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <User size={16} className="text-indigo-600" /> Student Profile &amp; Settings
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-gray-200 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateStudentSettings} className="space-y-4 text-xs">
              <div>
                <label className="font-bold block mb-1">Select Student Account</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full border dark:border-gray-700 rounded-xl p-2.5 bg-white dark:bg-gray-900 font-bold"
                  required
                >
                  <option value="">-- Choose Account --</option>
                  {sections.flatMap((sec) => sec.students || []).map((st: any) => (
                    <option key={st.id} value={st.id}>
                      {st.name} (@{st.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">Update Profile Photo URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/photo.jpg"
                  value={newProfilePhoto}
                  onChange={(e) => setNewProfilePhoto(e.target.value)}
                  className="w-full border dark:border-gray-700 rounded-xl p-2.5 bg-white dark:bg-gray-900"
                />
              </div>

              <div className="border-t pt-3 dark:border-gray-800 space-y-3">
                <h4 className="font-bold text-gray-700 dark:text-gray-300">Change Password (Optional)</h4>
                
                <div>
                  <label className="font-bold block mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="Current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full border dark:border-gray-700 rounded-xl p-2.5 pr-10 bg-white dark:bg-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200 cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold block mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border dark:border-gray-700 rounded-xl p-2.5 pr-10 bg-white dark:bg-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <p role="alert" className="text-rose-500 font-bold">{errorMessage}</p>
              )}
              {successMessage && (
                <p className="text-green-500 font-bold">{successMessage}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-xl font-bold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}