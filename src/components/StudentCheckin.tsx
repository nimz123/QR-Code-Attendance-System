import React, { useState, useRef, useEffect } from "react";

interface StudentCheckInProps {
  token?: string;
  onLogout: () => void;
}

export default function StudentCheckIn({ token, onLogout }: StudentCheckInProps) {
  const [qrToken, setQrToken] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [statusResult, setStatusResult] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getAuthToken = () => {
    if (token) return token;
    return localStorage.getItem("token") || "";
  };

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAuthToken()}`,
  };

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("Webcam access error:", err);
        setError("Could not access camera. Please allow camera permissions.");
      });

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setCapturedPhoto(dataUrl);
      }
    }
  };

  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setStatusResult("");

    if (!qrToken.trim()) {
      setError("Please enter or scan a valid QR token.");
      return;
    }

    if (!capturedPhoto) {
      setError("Please capture a live photo for verification.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/student/verify-attendance", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          qrToken: qrToken.trim(),
          capturedPhoto,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Attendance verification failed.");
      } else {
        setMessage(data.message);
        setStatusResult(data.status);
        setQrToken("");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError("Network error while verifying attendance.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between bg-[#0d1322] border border-slate-800 rounded-2xl p-4 md:p-5">
        <div>
          <h1 className="text-lg md:text-xl font-bold">Student Attendance Portal</h1>
          <p className="text-xs md:text-sm text-slate-400">Scan QR code and verify your face to log attendance</p>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 text-xs md:text-sm font-medium"
        >
          Reset / Refresh
        </button>
      </div>

      {error && <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{error}</p>}
      {message && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl space-y-1">
          <p className="text-sm font-semibold text-emerald-400">{message}</p>
          {statusResult && (
            <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
              Status: {statusResult}
            </span>
          )}
        </div>
      )}

      <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-5">
        <h2 className="text-base font-semibold text-indigo-400">📷 Live Verification & Check-In</h2>

        <form onSubmit={handleSubmitAttendance} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">QR Session Token</label>
            <input
              type="text"
              placeholder="Paste or input session QR token here..."
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 block">Camera Capture (Face Verification)</label>
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <button
              type="button"
              onClick={capturePhoto}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-medium transition border border-slate-700"
            >
              📸 Capture Snapshot
            </button>
          </div>

          {capturedPhoto && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">Captured Snapshot Preview:</p>
              <img src={capturedPhoto} alt="Snapshot Preview" className="w-32 h-24 rounded-xl object-cover border border-emerald-500/40" />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !capturedPhoto}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? "Verifying Attendance..." : "Verify & Submit Attendance"}
          </button>
        </form>
      </div>
    </div>
  );
}