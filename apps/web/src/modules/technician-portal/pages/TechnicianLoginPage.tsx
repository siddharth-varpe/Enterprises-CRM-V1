import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Wrench,
  Smartphone,
  User,
  ArrowRight,
  ShieldCheck,
  Info,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ArrowLeft,
  KeyRound,
  Loader2,
} from 'lucide-react';
import {
  TECHNICIAN_PORTAL_ROUTE_PREFIX,
  TECHNICIAN_AUTH_API_PREFIX,
} from '@crm/shared';
import { apiClient } from '../../../lib/api-client';
import { CRM_OFFICIAL_LOGO_B64 } from '../../../assets/invoiceAssets';

export const TechnicianLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Form State
  const [step, setStep] = useState<'CREDENTIALS' | 'OTP'>('CREDENTIALS');
  const [mobileNumber, setMobileNumber] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Timer & Resend Cooldown
  const [countdown, setCountdown] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Countdown timers
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'OTP' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'OTP' && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 1. Submit Credentials -> Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const cleanPhone = mobileNumber.trim();
    const cleanName = technicianName.trim();

    if (!cleanPhone || !cleanName) {
      setErrorMessage('Please enter both your registered mobile number and full name.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post<any>(`${TECHNICIAN_AUTH_API_PREFIX}/request-otp`, {
        mobileNumber: cleanPhone,
        technicianName: cleanName,
      });

      if (response && response.data?.challengeId) {
        setChallengeId(response.data.challengeId);
        setMaskedEmail(response.data.maskedEmail || 'your registered email');
        setCountdown(response.data.expiresInSeconds || 300);
        setResendCooldown(response.data.resendAvailableInSeconds || 60);
        setStep('OTP');
        setOtp('');
        setSuccessNotice(`Verification code sent to ${response.data.maskedEmail}`);
      } else {
        setErrorMessage('Unable to initiate login verification. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Verification request failed. Check your mobile number and name.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Submit OTP -> Verify & Create Session
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^[0-9]{6}$/.test(cleanOtp)) {
      setErrorMessage('Please enter the complete 6-digit numeric verification code.');
      return;
    }

    if (countdown <= 0) {
      setErrorMessage('Verification code has expired. Please click "Resend Code".');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post<any>(`${TECHNICIAN_AUTH_API_PREFIX}/verify-otp`, {
        challengeId,
        otp: cleanOtp,
      });

      if (response && response.data?.sessionToken) {
        const fromPath = (location.state as any)?.from?.pathname || TECHNICIAN_PORTAL_ROUTE_PREFIX;
        navigate(fromPath, { replace: true });
      } else {
        setErrorMessage('Verification could not be confirmed. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;

    setErrorMessage(null);
    setSuccessNotice(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post<any>(`${TECHNICIAN_AUTH_API_PREFIX}/resend-otp`, {
        challengeId,
        mobileNumber: mobileNumber.trim(),
        technicianName: technicianName.trim(),
      });

      if (response && response.data?.challengeId) {
        setChallengeId(response.data.challengeId);
        setCountdown(response.data.expiresInSeconds || 300);
        setResendCooldown(response.data.resendAvailableInSeconds || 60);
        setOtp('');
        setSuccessNotice('A new verification code has been dispatched to your email.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend verification code. Please wait.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Temporary Super Admin Instant Access Bypass
  const handleSuperAdminBypass = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.post<any>(`${TECHNICIAN_AUTH_API_PREFIX}/superadmin-bypass`, {});
      if (response && response.data?.sessionToken) {
        const fromPath = (location.state as any)?.from?.pathname || TECHNICIAN_PORTAL_ROUTE_PREFIX;
        navigate(fromPath, { replace: true });
      } else {
        setErrorMessage('Super Admin bypass could not be confirmed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Super Admin bypass failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-workspace text-slate-900 flex flex-col justify-center items-center px-4 py-12 selection:bg-primary-500 selection:text-white">
      <div className="relative w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-center mx-auto mb-4 shadow-elevated p-2">
            <img
              src={CRM_OFFICIAL_LOGO_B64}
              alt="Enterprises CRM Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Enterprises CRM</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-slate-900">
            Technician Portal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Commercial field service operations & work order execution
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-elevated space-y-6">
          {/* STEP 1: Enter Credentials */}
          {step === 'CREDENTIALS' && (
            <>
              <div className="space-y-1">
                <h2 className="text-lg font-display font-bold text-slate-900">Technician Login</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your registered mobile number and full name to receive a verification OTP on your registered email.
                </p>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleRequestOtp} className="space-y-4">
                {/* Mobile Number Field */}
                <div className="space-y-1.5">
                  <label htmlFor="tech-phone" className="block text-xs font-semibold text-slate-700">
                    Registered Mobile Number
                  </label>
                  <div className="relative rounded-xl border border-slate-300 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <input
                      id="tech-phone"
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={mobileNumber}
                      disabled={isLoading}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none rounded-xl"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Technician Name Field */}
                <div className="space-y-1.5">
                  <label htmlFor="tech-name" className="block text-xs font-semibold text-slate-700">
                    Registered Full Name
                  </label>
                  <div className="relative rounded-xl border border-slate-300 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="tech-name"
                      type="text"
                      placeholder="e.g. Rahul Patil"
                      value={technicianName}
                      disabled={isLoading}
                      onChange={(e) => setTechnicianName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none rounded-xl"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 text-white font-semibold text-sm shadow-2xs transition-all cursor-pointer active:scale-[0.99]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Instant Access Super Admin Bypass Button */}
                <button
                  type="button"
                  onClick={handleSuperAdminBypass}
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl border border-amber-200 hover:border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-[0.99] shadow-2xs"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>⚡ One-Click Instant Access (Super Admin Bypass)</span>
                </button>
              </form>
            </>
          )}

          {/* STEP 2: Enter & Verify OTP */}
          {step === 'OTP' && (
            <>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('CREDENTIALS');
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-primary-600 mb-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change mobile / name</span>
                </button>
                <h2 className="text-lg font-display font-bold text-slate-900">Enter Verification Code</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We sent a 6-digit OTP to your registered email <strong className="text-slate-700 font-semibold">{maskedEmail}</strong>.
                </p>
              </div>

              {/* Success Notification */}
              {successNotice && (
                <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
                  <span>{successNotice}</span>
                </div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {/* 6-Digit OTP Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="tech-otp" className="block text-xs font-semibold text-slate-700">
                      6-Digit Code
                    </label>
                    <span className="text-xs font-mono font-semibold text-primary-600">
                      Expires in: {formatTimer(countdown)}
                    </span>
                  </div>

                  <div className="relative rounded-xl border border-slate-300 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      id="tech-otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otp}
                      disabled={isLoading}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setOtp(val);
                      }}
                      className="w-full pl-10 pr-3 py-3 bg-transparent text-center font-mono text-xl tracking-[0.5em] text-slate-900 placeholder-slate-400 focus:outline-none rounded-xl"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6 || countdown <= 0}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-sm shadow-2xs transition-all cursor-pointer active:scale-[0.99]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Session...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Enter Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Instant Access Super Admin Bypass Button */}
                <button
                  type="button"
                  onClick={handleSuperAdminBypass}
                  disabled={isLoading}
                  className="w-full py-2 rounded-xl border border-amber-200 hover:border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-[0.99]"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>⚡ Instant Access (Super Admin Bypass)</span>
                </button>

                {/* Resend Cooldown Section */}
                <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Didn't receive the email?</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isLoading}
                    className="flex items-center space-x-1 text-primary-600 hover:text-primary-700 disabled:text-slate-400 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                  >
                    <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </span>
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Security badge footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center space-x-1.5 text-slate-500 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted Session • Role-Scoped Access</span>
          </div>
        </div>
      </div>
    </div>
  );
};
