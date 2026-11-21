import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  Shield,
  Send,
  CalendarCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Logo } from '../components/Logo/Logo';
import { Modal } from '../components/Modal/Modal';
import { apiClient } from '../lib/apiClient';
import { submitPublicEnquiry } from '../lib/schoolSync';
import { schoolStore } from '../data/schoolData';

export function Login({ initialModal = null }) {
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const [isEnquireModalOpen, setIsEnquireModalOpen] = useState(initialModal === 'enquire');
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(initialModal === 'appointment');
  const [enquirySuccess, setEnquirySuccess] = useState(false);
  const [appointmentSuccess, setAppointmentSuccess] = useState(false);
  const [modalError, setModalError] = useState('');

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const [enquiryForm, setEnquiryForm] = useState({
    parentName: '',
    studentName: '',
    email: '',
    phone: '',
    yearLevel: 'JSS 1',
    subject: 'Mathematics',
    message: ''
  });

  const [appointmentForm, setAppointmentForm] = useState({
    parentName: '',
    studentName: '',
    email: '',
    phone: '',
    preferredDate: '',
    preferredTime: '10:00 AM',
    subject: 'Mathematics',
    meetingType: 'In-Person Consultation'
  });

  const roleLabel = role === 'teacher' ? 'Staff' : role.charAt(0).toUpperCase() + role.slice(1);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please fill in both email/ID and password.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setIsSubmitting(true);

    try {
      const response = await apiClient.post('/auth/login', {
        email: email.trim(),
        password
      });

      const resolvedRole = response?.user?.role || role;
      if (response?.user?.role && response.user.role !== role) {
        const actualLabel = response.user.role === 'teacher' ? 'Staff' : response.user.role;
        setErrorMsg(`This account belongs to the ${actualLabel} portal. Switch tab to sign in.`);
        return;
      }

      apiClient.setToken(response.token);
      localStorage.setItem('alamin_user', JSON.stringify(response.user));
      navigate(`/${resolvedRole}/dashboard`);
    } catch (err) {
      setErrorMsg(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    if (!enquiryForm.parentName || !enquiryForm.email || !enquiryForm.phone) {
      setModalError('Please fill in all required fields marked with *');
      return;
    }
    setModalError('');
    try {
      await submitPublicEnquiry('enquiry', enquiryForm);
      setEnquirySuccess(true);
      setTimeout(() => {
        setEnquirySuccess(false);
        setIsEnquireModalOpen(false);
        setEnquiryForm({
          parentName: '',
          studentName: '',
          email: '',
          phone: '',
          yearLevel: 'JSS 1',
          subject: 'Mathematics',
          message: ''
        });
      }, 2000);
    } catch (err) {
      setModalError(err?.message || 'Unable to submit enquiry.');
    }
  };

  const handleAppointmentSubmit = async (e) => {
    e.preventDefault();
    if (!appointmentForm.parentName || !appointmentForm.email || !appointmentForm.preferredDate) {
      setModalError('Please fill in all required fields marked with *');
      return;
    }
    setModalError('');
    try {
      await submitPublicEnquiry('appointment', appointmentForm);
      setAppointmentSuccess(true);
      setTimeout(() => {
        setAppointmentSuccess(false);
        setIsAppointmentModalOpen(false);
        setAppointmentForm({
          parentName: '',
          studentName: '',
          email: '',
          phone: '',
          preferredDate: '',
          preferredTime: '10:00 AM',
          subject: 'Mathematics',
          meetingType: 'In-Person Consultation'
        });
      }, 2000);
    } catch (err) {
      setModalError(err?.message || 'Unable to submit appointment request.');
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setForgotError('Please enter your email, student admission number, or staff ID.');
      return;
    }
    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(true);
    try {
      const res = await schoolStore.requestPasswordResetOtp(forgotIdentifier.trim());
      if (res?.error) {
        setForgotError(res.error);
      } else {
        setMaskedEmail(res.maskedEmail || res.email);
        setForgotStep('verify');
        setForgotSuccess('Verification code generated. Enter it below along with your new password.');
      }
    } catch (err) {
      setForgotError(err?.message || 'Unable to request verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotOtp.trim()) {
      setForgotError('Please enter the 6-digit verification code.');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError('Password must be at least 6 characters.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await schoolStore.resetPasswordWithOtp(
        forgotIdentifier.trim(),
        forgotOtp.trim(),
        forgotNewPassword
      );
      if (res?.error) {
        setForgotError(res.error);
      } else {
        setForgotSuccess('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          setIsForgotModalOpen(false);
          setPassword(forgotNewPassword);
          setInfoMsg('Password reset successful. Please sign in with your new password.');
        }, 1500);
      }
    } catch (err) {
      setForgotError(err?.message || 'Unable to reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf9ec] flex flex-col justify-center items-center px-4 py-8 font-['Poppins',sans-serif]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <Logo variant="dark" className="h-14 sm:h-16" showText={true} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
              Al-Amin Group of Schools
            </h1>
            <p className="text-xs sm:text-sm text-[#606043] max-w-sm mx-auto mt-1">
              Management & Academic Portal for Students, Staff, and Administrators
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#c9c7b6] shadow-xl">
          <div className="grid grid-cols-3 p-1.5 rounded-xl bg-[#f0ebd5] mb-6">
            <button
              type="button"
              onClick={() => {
                setRole('student');
                setEmail('');
                setPassword('');
                setErrorMsg('');
                setInfoMsg('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                role === 'student'
                  ? 'bg-white text-[#1c1c14] shadow-sm'
                  : 'text-[#606043] hover:text-[#1c1c14]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Student</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRole('teacher');
                setEmail('');
                setPassword('');
                setErrorMsg('');
                setInfoMsg('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                role === 'teacher'
                  ? 'bg-white text-[#1c1c14] shadow-sm'
                  : 'text-[#606043] hover:text-[#1c1c14]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Staff</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRole('admin');
                setEmail('');
                setPassword('');
                setErrorMsg('');
                setInfoMsg('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                role === 'admin'
                  ? 'bg-white text-[#1c1c14] shadow-sm'
                  : 'text-[#606043] hover:text-[#1c1c14]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>

          <div className="text-center text-xs font-medium text-[#606043] mb-5">
            {`${roleLabel} Portal Access`}
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{infoMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-[#1c1c14] mb-1.5">
                {role === 'student'
                  ? 'Portal Email or Admission Number'
                  : role === 'teacher'
                  ? 'School Email or Staff ID'
                  : 'Admin Email'}
              </label>
              <input
                id="login-email"
                type={role === 'admin' ? 'email' : 'text'}
                placeholder={
                  role === 'student'
                    ? 'e.g. 26/ASS/JA001 or student email'
                    : role === 'teacher'
                    ? 'e.g. ASS/staff/001 or staff email'
                    : 'Enter administrator email'
                }
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-[#1c1c14] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full h-10 pl-3 pr-10 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#797869] hover:text-[#1c1c14] rounded-md focus:outline-none focus:ring-2 focus:ring-[#616218]/20 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end -mt-1">
              <button
                type="button"
                onClick={() => {
                  setForgotStep('request');
                  setForgotIdentifier(email || '');
                  setForgotError('');
                  setForgotSuccess('');
                  setForgotOtp('');
                  setForgotNewPassword('');
                  setForgotConfirmPassword('');
                  setIsForgotModalOpen(true);
                }}
                className="text-xs font-semibold text-[#616218] hover:text-[#494900] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            <div className="pt-2 space-y-2.5">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 px-4 bg-[#616218] hover:bg-[#494900] disabled:opacity-60 text-white font-semibold text-xs rounded-lg shadow-xs inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Please wait...' : `Login as ${roleLabel}`}
              </button>

              {role !== 'admin' && (
                <p className="text-[11px] text-center text-[#797869] pt-1 leading-relaxed">
                  Accounts are created exclusively by the School Administrator. Contact the school office if you need your login details.
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="space-y-3 text-center">

          <div className="flex items-center justify-center gap-3 text-xs font-semibold text-[#616218] pt-1">
            <button
              type="button"
              onClick={() => setIsEnquireModalOpen(true)}
              className="hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enquire Now</span>
            </button>
            <span className="text-[#c9c7b6]">•</span>
            <button
              type="button"
              onClick={() => setIsAppointmentModalOpen(true)}
              className="hover:underline flex items-center gap-1 cursor-pointer"
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Book Appointment</span>
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isEnquireModalOpen}
        onClose={() => setIsEnquireModalOpen(false)}
        title="Enquire Now"
        subtitle="Contact our academic office for student admission details"
        size="md"
        footer={
          enquirySuccess ? (
            <button
              type="button"
              onClick={() => setIsEnquireModalOpen(false)}
              className="h-10 px-4 text-xs font-semibold border border-[#c9c7b6] bg-white text-[#1c1c14] rounded-lg hover:bg-[#faf8f0] shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEnquireModalOpen(false)}
                className="h-10 px-4 text-xs font-semibold border border-[#c9c7b6] bg-white text-[#1c1c14] rounded-lg hover:bg-[#faf8f0] shadow-xs inline-flex items-center justify-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="login-enquiry-form"
                className="h-10 px-4 text-xs font-semibold bg-[#616218] hover:bg-[#494900] text-white rounded-lg shadow-xs inline-flex items-center justify-center cursor-pointer"
              >
                Submit Enquiry
              </button>
            </>
          )
        }
      >
        {enquirySuccess ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-stone-800">Enquiry Submitted!</h4>
            <p className="text-xs text-stone-600">Our coordinator will contact you within 24 hours.</p>
          </div>
        ) : (
          <form id="login-enquiry-form" onSubmit={handleEnquirySubmit} className="space-y-5">
            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {modalError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Parent Name *</label>
                <input
                  type="text"
                  required
                  value={enquiryForm.parentName}
                  onChange={(e) => setEnquiryForm({ ...enquiryForm, parentName: e.target.value })}
                  placeholder="Enter parent or guardian name"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Student Name</label>
                <input
                  type="text"
                  value={enquiryForm.studentName}
                  onChange={(e) => setEnquiryForm({ ...enquiryForm, studentName: e.target.value })}
                  placeholder="Enter prospective student name"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={enquiryForm.email}
                  onChange={(e) => setEnquiryForm({ ...enquiryForm, email: e.target.value })}
                  placeholder="parent@example.com"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Phone *</label>
                <input
                  type="tel"
                  required
                  value={enquiryForm.phone}
                  onChange={(e) => setEnquiryForm({ ...enquiryForm, phone: e.target.value })}
                  placeholder="+234 803 000 0000"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Questions / Goals</label>
              <textarea
                rows={4}
                value={enquiryForm.message}
                onChange={(e) => setEnquiryForm({ ...enquiryForm, message: e.target.value })}
                placeholder="Specific topics or questions for our teachers..."
                className="w-full px-3 py-2.5 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              ></textarea>
            </div>
          </form>
        )}
      </Modal>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Account Password Recovery"
      >
        <div className="space-y-4 font-['Poppins',sans-serif]">
          {forgotError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{forgotError}</span>
            </div>
          )}

          {forgotSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{forgotSuccess}</span>
            </div>
          )}

          {forgotStep === 'request' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <p className="text-xs text-[#797869] leading-relaxed">
                Enter your registered portal email, student admission number (e.g. 26/ASS/JA001), or staff ID to receive a verification code.
              </p>
              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">
                  Email, Admission Number, or Staff ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. amina@alaminschools.edu or 26/ASS/JA001"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] transition-all shadow-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 border border-[#c9c7b6] text-[#48482d] hover:bg-[#ece7d0] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-4 py-2 bg-[#616218] hover:bg-[#494900] disabled:opacity-60 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {forgotLoading ? 'Generating...' : 'Get Verification Code'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <p className="text-xs text-[#797869] leading-relaxed">
                Verification code generated for <span className="font-semibold text-[#1c1c14]">{maskedEmail}</span>. Enter the 6-digit code and choose a new password.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1">
                  6-Digit Verification Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  className="w-full h-10 px-3 font-mono tracking-widest text-center text-base rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1">
                  New Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] transition-all shadow-xs"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setForgotStep('request')}
                  className="text-xs text-[#616218] hover:underline cursor-pointer"
                >
                  ← Back to request code
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 border border-[#c9c7b6] text-[#48482d] hover:bg-[#ece7d0] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 bg-[#616218] hover:bg-[#494900] disabled:opacity-60 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {forgotLoading ? 'Updating...' : 'Set New Password'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        title="Book Appointment"
        subtitle="Schedule a 30-minute consultation and campus tour"
        size="md"
        footer={
          appointmentSuccess ? (
            <button
              type="button"
              onClick={() => setIsAppointmentModalOpen(false)}
              className="h-10 px-4 text-xs font-semibold border border-[#c9c7b6] bg-white text-[#1c1c14] rounded-lg hover:bg-[#faf8f0] shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsAppointmentModalOpen(false)}
                className="h-10 px-4 text-xs font-semibold border border-[#c9c7b6] bg-white text-[#1c1c14] rounded-lg hover:bg-[#faf8f0] shadow-xs inline-flex items-center justify-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="login-appointment-form"
                className="h-10 px-4 text-xs font-semibold bg-[#616218] hover:bg-[#494900] text-white rounded-lg shadow-xs inline-flex items-center justify-center cursor-pointer"
              >
                Book Consultation
              </button>
            </>
          )
        }
      >
        {appointmentSuccess ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-stone-800">Appointment Requested!</h4>
            <p className="text-xs text-stone-600">We will email you a confirmation and schedule invite shortly.</p>
          </div>
        ) : (
          <form id="login-appointment-form" onSubmit={handleAppointmentSubmit} className="space-y-5">
            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {modalError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Parent Name *</label>
                <input
                  type="text"
                  required
                  value={appointmentForm.parentName}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, parentName: e.target.value })}
                  placeholder="Enter parent or guardian name"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Student Name</label>
                <input
                  type="text"
                  value={appointmentForm.studentName}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, studentName: e.target.value })}
                  placeholder="Enter student name"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={appointmentForm.email}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, email: e.target.value })}
                  placeholder="parent@example.com"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Preferred Date *</label>
                <input
                  type="date"
                  required
                  value={appointmentForm.preferredDate}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, preferredDate: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Account Password Recovery"
      >
        <div className="space-y-4 font-['Poppins',sans-serif]">
          {forgotError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{forgotError}</span>
            </div>
          )}

          {forgotSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{forgotSuccess}</span>
            </div>
          )}

          {forgotStep === 'request' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <p className="text-xs text-[#797869] leading-relaxed">
                Enter your registered portal email, student admission number (e.g. 26/ASS/JA001), or staff ID to receive a verification code.
              </p>
              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">
                  Email, Admission Number, or Staff ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. amina@alaminschools.edu or 26/ASS/JA001"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] transition-all shadow-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 border border-[#c9c7b6] text-[#48482d] hover:bg-[#ece7d0] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-4 py-2 bg-[#616218] hover:bg-[#494900] disabled:opacity-60 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {forgotLoading ? 'Generating...' : 'Get Verification Code'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <p className="text-xs text-[#797869] leading-relaxed">
                Verification code generated for <span className="font-semibold text-[#1c1c14]">{maskedEmail}</span>. Enter the 6-digit code and choose a new password.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1">
                  6-Digit Verification Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  className="w-full h-10 px-3 font-mono tracking-widest text-center text-base rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1">
                  New Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1c1c14] mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] transition-all shadow-xs"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setForgotStep('request')}
                  className="text-xs text-[#616218] hover:underline cursor-pointer"
                >
                  ← Back to request code
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 border border-[#c9c7b6] text-[#48482d] hover:bg-[#ece7d0] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 bg-[#616218] hover:bg-[#494900] disabled:opacity-60 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {forgotLoading ? 'Updating...' : 'Set New Password'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
}
