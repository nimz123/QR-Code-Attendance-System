import React, { useState } from 'react';
import { Shield, User, GraduationCap, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { AuthUser } from '../types';
import { apiFetch } from '../lib/api';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onBackToCheckin: () => void;
}

type Role = 'admin' | 'teacher' | 'student';

export default function LoginPage({ onLoginSuccess, onBackToCheckin }: LoginPageProps) {
  const [role, setRole] = useState<Role>('teacher');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tabs: { key: Role; label: string; icon: React.ReactNode }[] = [
    { key: 'teacher', label: 'Teacher', icon: <User size={14} /> },
    { key: 'student', label: 'Student', icon: <GraduationCap size={14} /> },
    { key: 'admin', label: 'Admin', icon: <Shield size={14} /> },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const { ok, data } = await apiFetch(`/api/auth/${role}/login`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (ok && data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'Invalid username or password.');
      }
    } catch (err) {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="login-page-root" className="max-w-md mx-auto">
      <button
        id="btn-back-to-checkin"
        type="button"
        onClick={onBackToCheckin}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Check-In</span>
      </button>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 sm:p-8 transition-colors">
        <div className="text-center space-y-1 mb-6">
          <h1 className="text-xl font-bold font-display text-gray-900 dark:text-white">Sign In</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Choose your role and enter your credentials.</p>
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              id={`login-tab-${tab.key}`}
              type="button"
              onClick={() => { setRole(tab.key); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                role === tab.key 
                  ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-xs' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-username" className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider block">Username</label>
            <input
              id="login-username"
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5 relative">
            <label htmlFor="login-password" className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider block">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                title={showPassword ? "Hide Password" : "Show Password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div id="login-error" className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle size={13} />
              <span>{error}</span>
            </div>
          )}

          <button
            id="btn-login-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm py-2.5 rounded-xl transition shadow-xs cursor-pointer"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}