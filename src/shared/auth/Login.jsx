import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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

export function Login({ initialModal = null }) {
  const navigate = useNavigate();
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

      const resolvedRole = response?.user?.role;
      if (!['admin', 'teacher', 'student'].includes(resolvedRole)) {
        setErrorMsg('This account does not have a supported portal role. Please contact the school office.');
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

  return (
    <div className="min-h-screen bg-[#fdf9ec] font-['Poppins',sans-serif] md:grid md:grid-cols-2">
      <section
        className="relative flex min-h-[36vh] flex-col justify-between bg-cover bg-center px-6 py-6 sm:px-10 sm:py-8 md:min-h-screen md:px-12 md:py-10 lg:px-16"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(20, 28, 12, 0.42), rgba(20, 28, 12, 0.72)), url('/assets/login-classroom.jpg')"
        }}
        aria-label="Al-Amin Group of Schools"
      >
        <Logo variant="white" className="h-14 sm:h-16" showText />
        <div className="max-w-xl pb-2 text-white md:pb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#e7e78f]">
            Learn • Lead • Succeed
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Welcome to Al-Amin Group of Schools
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/85 sm:text-base">
            Your school community, learning resources, and academic progress—all in one place.
          </p>
        </div>
      </section>

      <section className="flex min-h-[64vh] items-center justify-center px-5 py-10 sm:px-8 md:min-h-screen md:px-10 lg:px-16">
        <div className="w-full max-w-md space-y-6">
          <div>
            <p className="text-sm font-semibold text-[#616218]">School portal</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1c1c14] sm:text-3xl">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-[#606043]">
              Use the email or ID linked to your school account.
            </p>
          </div>

          <div className="rounded-2xl border border-[#c9c7b6] bg-white p-6 shadow-xl sm:p-8">
            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{infoMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-[#1c1c14]">
                  Email, admission number, or staff ID
                </label>
                <input
                  id="login-email"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your email or ID"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg('');
                  }}
                  className="h-11 w-full rounded-lg border border-[#c9c7b6] bg-white px-3 text-sm text-[#1c1c14] placeholder-[#797869] shadow-xs transition-all hover:border-[#797869] focus:border-[#616218] focus:outline-none focus:ring-2 focus:ring-[#616218]/20"
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-[#1c1c14]">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg('');
                    }}
                    className="h-11 w-full rounded-lg border border-[#c9c7b6] bg-white pl-3 pr-10 text-sm text-[#1c1c14] placeholder-[#797869] shadow-xs transition-all hover:border-[#797869] focus:border-[#616218] focus:outline-none focus:ring-2 focus:ring-[#616218]/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-[#797869] transition-colors hover:text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-[#616218] px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#494900] disabled:opacity-60"
              >
                {isSubmitting ? 'Please wait...' : 'Sign in'}
              </button>
              <p className="pt-1 text-center text-[11px] leading-relaxed text-[#797869]">
                Need help accessing your account? Contact the school office.
              </p>
            </form>
          </div>

          <div className="flex items-center justify-center gap-3 text-xs font-semibold text-[#616218]">
            <button
              type="button"
              onClick={() => setIsEnquireModalOpen(true)}
              className="flex cursor-pointer items-center gap-1 hover:underline"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Enquire Now</span>
            </button>
            <span className="text-[#c9c7b6]">•</span>
            <button
              type="button"
              onClick={() => setIsAppointmentModalOpen(true)}
              className="flex cursor-pointer items-center gap-1 hover:underline"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              <span>Book Appointment</span>
            </button>
          </div>
        </div>
      </section>

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

    </div>
  );
}
