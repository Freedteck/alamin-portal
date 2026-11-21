import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserPlus,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  BookOpen,
  User,
  Users,
  ShieldCheck,
  Printer,
  Info,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  AlertCircle
} from 'lucide-react';
import {
  schoolStore,
  NIGERIAN_STATES_AND_LGAS,
  SCHOOL_CLASSES,
  SSS_DEPARTMENTS,
  isSeniorClass,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';

export function AdmitStudent() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [admittedStudent, setAdmittedStudent] = useState(null);
  const [syncTick, setSyncTick] = useState(0);
  const [showPortalPassword, setShowPortalPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    return subscribeSchoolSync(() => setSyncTick((t) => t + 1));
  }, []);

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    surname: '',
    gender: 'Male',
    dateOfBirth: '2010-05-15',
    bloodGroup: 'O+',
    genotype: 'AA',
    religion: 'Islam',

    stateOfOrigin: 'Kano',
    lga: 'Kano Municipal',
    residentialAddress: '',
    city: 'Kano',

    class: 'JSS 1',
    department: '',
    session: '2026/2027',
    entryTerm: 'First Term',
    enrolledSubjects: schoolStore.getSubjectsForClass('JSS 1', ''),
    portalEmail: '',
    portalPassword: '',

    parentFirstName: '',
    parentLastName: '',
    parentRelationship: 'Father',
    parentPhone: '',
    parentAltPhone: '',
    parentEmail: '',
    parentOccupation: '',
    emergencyContactFirstName: '',
    emergencyContactLastName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: 'Uncle'
  });

  const availableLgas = useMemo(() => {
    return NIGERIAN_STATES_AND_LGAS[formData.stateOfOrigin] || ['Central LGA'];
  }, [formData.stateOfOrigin]);

  const handleStateChange = (stateName) => {
    const lgas = NIGERIAN_STATES_AND_LGAS[stateName] || [];
    setFormData((prev) => ({
      ...prev,
      stateOfOrigin: stateName,
      lga: lgas[0] || ''
    }));
  };

  const eligibleSubjects = useMemo(
    () => schoolStore.getSubjectsForClass(formData.class, formData.department),
    [formData.class, formData.department, syncTick]
  );

  const allEligibleSelected =
    eligibleSubjects.length > 0 &&
    eligibleSubjects.every((sub) => formData.enrolledSubjects.includes(sub));

  const handleToggleSelectAllSubjects = () => {
    setFormData((prev) => ({
      ...prev,
      enrolledSubjects: allEligibleSelected ? [] : [...eligibleSubjects]
    }));
  };

  const handleClassChange = (nextClass) => {
    const senior = isSeniorClass(nextClass);
    const nextDepartment = senior ? (formData.department || SSS_DEPARTMENTS[0]) : '';
    const nextEligible = schoolStore.getSubjectsForClass(nextClass, nextDepartment);
    setFormData((prev) => {
      const kept = prev.enrolledSubjects.filter((s) => nextEligible.includes(s));
      return {
        ...prev,
        class: nextClass,
        department: nextDepartment,
        enrolledSubjects: kept.length > 0 ? kept : nextEligible.slice(0, 6)
      };
    });
  };

  const handleDepartmentChange = (nextDept) => {
    const nextEligible = schoolStore.getSubjectsForClass(formData.class, nextDept);
    setFormData((prev) => {
      const kept = prev.enrolledSubjects.filter((s) => nextEligible.includes(s));
      return {
        ...prev,
        department: nextDept,
        enrolledSubjects: kept.length > 0 ? kept : nextEligible
      };
    });
  };

  const handleSubjectToggle = (subject) => {
    setFormData((prev) => {
      const current = prev.enrolledSubjects;
      if (current.includes(subject)) {
        return { ...prev, enrolledSubjects: current.filter((s) => s !== subject) };
      } else {
        return { ...prev, enrolledSubjects: [...current, subject] };
      }
    });
  };

  const validateStep = (step) => {
    setSubmitError('');
    if (step === 1) {
      if (!formData.firstName.trim() || !formData.surname.trim()) {
        setSubmitError('Please enter Student First Name and Surname.');
        return false;
      }
      if (!formData.dateOfBirth) {
        setSubmitError('Please enter Student Date of Birth.');
        return false;
      }
    } else if (step === 2) {
      if (!formData.stateOfOrigin || !formData.lga) {
        setSubmitError('Please select State of Origin and LGA.');
        return false;
      }
      if (!formData.residentialAddress.trim()) {
        setSubmitError('Please enter Residential Street Address.');
        return false;
      }
    } else if (step === 3) {
      if (!formData.class) {
        setSubmitError('Please select an assigned class.');
        return false;
      }
      if (!formData.enrolledSubjects || formData.enrolledSubjects.length === 0) {
        setSubmitError('Please select at least one registered subject for this student.');
        return false;
      }
    } else if (step === 4) {
      if (!formData.parentFirstName.trim() || !formData.parentLastName.trim()) {
        setSubmitError('Please provide Parent / Guardian First Name and Surname.');
        return false;
      }
      if (!formData.parentPhone.trim()) {
        setSubmitError('Please provide Parent / Guardian Primary Phone Number.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setSubmitError('');
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopy = (value, field) => {
    if (!value || !navigator?.clipboard) return;
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 1800);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep < 5) {
      handleNext();
      return;
    }

    setSubmitError('');

    // Ensure all 4 preliminary steps are fully valid before submitting from review
    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s)) {
        setCurrentStep(s);
        return;
      }
    }

    const trimmedEmail = formData.portalEmail.trim().toLowerCase();
    const trimmedPassword = formData.portalPassword.trim();
    if (trimmedPassword && trimmedPassword.length < 6) {
      setSubmitError('Student portal password must be at least 6 characters (or leave blank to auto-generate).');
      return;
    }

    const fullName = `${formData.firstName.trim()} ${formData.middleName.trim() ? formData.middleName.trim() + ' ' : ''}${formData.surname.trim()}`;
    const parentFullName = `${formData.parentFirstName.trim()} ${formData.parentLastName.trim()}`.trim();
    const emergencyFullName = `${formData.emergencyContactFirstName.trim()} ${formData.emergencyContactLastName.trim()}`.trim();
    const emergencySummary = emergencyFullName
      ? `${emergencyFullName} (${formData.emergencyContactPhone || 'No Phone'}${formData.emergencyContactRelationship ? ` - ${formData.emergencyContactRelationship}` : ''})`
      : '';

    const studentToSave = {
      name: fullName,
      gender: formData.gender,
      dateOfBirth: formData.dateOfBirth,
      class: formData.class,
      department: isSeniorClass(formData.class) ? formData.department : '',
      stateOfOrigin: formData.stateOfOrigin,
      lga: formData.lga,
      address: formData.residentialAddress || `${formData.city}, ${formData.stateOfOrigin}`,
      parentName: parentFullName,
      parentPhone: formData.parentPhone,
      parentEmail: formData.parentEmail,
      parentOccupation: formData.parentOccupation,
      emergencyContact: emergencySummary,
      enrolledSubjects: formData.enrolledSubjects,
      enrollmentDate: new Date().toISOString().split('T')[0],
      ...(trimmedEmail ? { email: trimmedEmail } : {}),
      ...(trimmedPassword ? { portalPassword: trimmedPassword } : {})
    };

    setIsSubmitting(true);
    try {
      const saved = await schoolStore.createStudentAsync(studentToSave);
      setAdmittedStudent(saved);
      setIsSuccess(true);
    } catch (err) {
      setSubmitError(err?.message || 'Unable to enroll student. Please check the form details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { number: 1, title: 'Personal Details', desc: 'Bio & Identification' },
    { number: 2, title: 'Origin & Residence', desc: 'State & LGA details' },
    { number: 3, title: 'Academic Placement', desc: 'Class & Subjects' },
    { number: 4, title: 'Parent / Guardian', desc: 'Contacts & Emergency' },
    { number: 5, title: 'Review', desc: 'Verify Details' }
  ];

  if (isSuccess && admittedStudent) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 font-['Poppins',sans-serif] pb-12">
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 sm:p-8 shadow-xs text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <span className="text-xs font-semibold text-[#616218] uppercase tracking-wider">
            Admission Successful
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1c1c14] mt-1">
            Student Successfully Enrolled!
          </h1>
          <p className="text-sm text-[#797869] mt-2 max-w-xl mx-auto">
            {admittedStudent.name} has been formally admitted into{' '}
            <strong className="text-[#1c1c14]">{admittedStudent.class}</strong>{' '}
            at Al-Amin Group of Schools.
          </p>

          <div className="my-8 max-w-2xl mx-auto text-left rounded-lg border border-[#c9c7b6] bg-[#faf8f0] p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#c9c7b6]/60 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-base text-[#1c1c14]">
                  Al-Amin Group of Schools
                </h3>
                <p className="text-xs text-[#797869]">Official Student Admission Slip</p>
              </div>
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#616218] text-white">
                {admittedStudent.admissionNumber}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#1c1c14]">
              <div>
                <span className="text-[#797869] block text-[11px]">Student Full Name</span>
                <span className="font-bold text-sm">{admittedStudent.name}</span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Class</span>
                <span className="font-bold text-sm">{admittedStudent.class}</span>
              </div>
              {admittedStudent.department && (
                <div>
                  <span className="text-[#797869] block text-[11px]">Department</span>
                  <span className="font-bold text-sm">{admittedStudent.department}</span>
                </div>
              )}
              <div>
                <span className="text-[#797869] block text-[11px]">Date of Birth</span>
                <span className="font-medium">{admittedStudent.dateOfBirth}</span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">State of Origin</span>
                <span className="font-medium">{admittedStudent.stateOfOrigin}</span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Local Government Area</span>
                <span className="font-medium">{admittedStudent.lga}</span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Guardian Name</span>
                <span className="font-medium">{admittedStudent.parentName}</span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Guardian Phone</span>
                <span className="font-medium">{admittedStudent.parentPhone}</span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Enrolled Subjects</span>
                <span className="font-medium">
                  {admittedStudent.enrolledSubjects?.length || 0} Subjects Assigned
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#c9c7b6]/60">
              <div className="flex items-center gap-2 mb-2.5">
                <KeyRound className="w-4 h-4 text-[#616218]" />
                <h4 className="text-xs font-bold text-[#494900] uppercase tracking-wider">
                  Student Portal Login Credentials
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-white border border-[#c9c7b6]/70 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[#797869] block text-[11px]">Portal Email or Admission No.</span>
                    <span className="font-semibold text-[#1c1c14] break-all">
                      {admittedStudent.portalCredentials?.email || admittedStudent.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(admittedStudent.portalCredentials?.email || admittedStudent.email, 'slip-email')}
                    className="p-1.5 rounded border border-[#c9c7b6]/70 text-[#616218] hover:bg-[#faf8f0] shrink-0 cursor-pointer"
                    title="Copy portal email"
                  >
                    {copiedField === 'slip-email' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[#797869] block text-[11px]">Temporary Password</span>
                    <span className="font-mono font-bold text-[#1c1c14]">
                      {admittedStudent.portalCredentials?.temporaryPassword || 'Set by Administrator'}
                    </span>
                  </div>
                  {admittedStudent.portalCredentials?.temporaryPassword && (
                    <button
                      type="button"
                      onClick={() => handleCopy(admittedStudent.portalCredentials.temporaryPassword, 'slip-pass')}
                      className="p-1.5 rounded border border-[#c9c7b6]/70 text-[#616218] hover:bg-[#faf8f0] shrink-0 cursor-pointer"
                      title="Copy temporary password"
                    >
                      {copiedField === 'slip-pass' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-[#797869] mt-2">
                Hand these credentials to the student or parent. Students can sign in using either their{' '}
                <strong>Admission Number</strong> ({admittedStudent.admissionNumber}) or <strong>Portal Email</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white text-xs font-semibold text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#616218]" />
              Print Admission Slip
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false);
                setAdmittedStudent(null);
                setSubmitError('');
                setCurrentStep(1);
                setFormData((prev) => ({
                  ...prev,
                  firstName: '',
                  middleName: '',
                  surname: '',
                  portalEmail: '',
                  portalPassword: ''
                }));
              }}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white text-xs font-semibold text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#616218]" />
              Admit Another Student
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/students')}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Return to Student Roster
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-['Poppins',sans-serif] pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#c9c7b6]/60">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/students"
            className="p-2 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] transition-colors"
            title="Back to Students Roster"
          >
            <ArrowLeft className="w-4 h-4 text-[#616218]" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1c1c14] tracking-tight">
              Admit New Student
            </h1>
            <p className="text-xs sm:text-sm text-[#797869] mt-0.5 max-w-xl">
              Comprehensive Multi-Step Student Admission & Placement Form
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#616218] bg-[#f4f2e1] px-3 py-1.5 rounded-lg border border-[#c9c7b6]">
            Step {currentStep} of 5
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
          {steps.map((step) => {
            const isCompleted = currentStep > step.number;
            const isCurrent = currentStep === step.number;
            return (
              <div
                key={step.number}
                className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-[#faf8f0] border border-[#616218]/40'
                    : 'border border-transparent'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    isCompleted
                      ? 'bg-[#616218] text-white'
                      : isCurrent
                      ? 'bg-[#616218] text-white ring-2 ring-[#616218]/30'
                      : 'bg-[#ece7d0] text-[#797869]'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.number}
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-xs font-semibold truncate ${
                      isCurrent ? 'text-[#1c1c14]' : 'text-[#797869]'
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-[10px] text-[#797869] truncate hidden sm:block">
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && currentStep < 5 && e.target.tagName === 'INPUT') {
            e.preventDefault();
            handleNext();
          }
        }}
        className="space-y-6"
      >
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 sm:p-8 shadow-xs">
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-[#c9c7b6]/40 pb-3">
                <h2 className="text-lg font-bold text-[#1c1c14] flex items-center gap-2">
                  <User className="w-5 h-5 text-[#616218]" />
                  Step 1: Student Personal Identification
                </h2>
                <p className="text-xs text-[#797869] mt-0.5">
                  Full legal name, gender, and official identification details.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    First Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Amina"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    placeholder="Zahra"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    Surname <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                    placeholder="Bello"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    Gender <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    Date of Birth <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">Religion</label>
                  <select
                    value={formData.religion}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    <option value="Islam">Islam</option>
                    <option value="Christianity">Christianity</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    <option value="O+">O+</option>
                    <option value="A+">A+</option>
                    <option value="B+">B+</option>
                    <option value="AB+">AB+</option>
                    <option value="O-">O-</option>
                    <option value="A-">A-</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">Genotype</label>
                  <select
                    value={formData.genotype}
                    onChange={(e) => setFormData({ ...formData, genotype: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    <option value="AA">AA</option>
                    <option value="AS">AS</option>
                    <option value="AC">AC</option>
                    <option value="SS">SS</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-[#c9c7b6]/40 pb-3">
                <h2 className="text-lg font-bold text-[#1c1c14] flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#616218]" />
                  Step 2: State of Origin & Residential Details
                </h2>
                <p className="text-xs text-[#797869] mt-0.5">
                  Indigene verification, State of Origin, Local Government of Origin, and home address.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    State of Origin <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.stateOfOrigin}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    {Object.keys(NIGERIAN_STATES_AND_LGAS).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    Local Government of Origin <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.lga}
                    onChange={(e) => setFormData({ ...formData, lga: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    {availableLgas.map((lgaName) => (
                      <option key={lgaName} value={lgaName}>
                        {lgaName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]">
                  Residential Home Address <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.residentialAddress}
                  onChange={(e) => setFormData({ ...formData, residentialAddress: e.target.value })}
                  placeholder="14 Ahmadu Bello Way, Nassarawa GRA"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">City / Town</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Kano"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">Country</label>
                  <input
                    type="text"
                    disabled
                    value="Nigeria"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] text-sm bg-[#faf8f0] text-[#797869] disabled:cursor-not-allowed shadow-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-[#c9c7b6]/40 pb-3">
                <h2 className="text-lg font-bold text-[#1c1c14] flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#616218]" />
                  Step 3: Class Placement & Subject Allocations
                </h2>
                <p className="text-xs text-[#797869] mt-0.5">
                  Select student's class and subject curriculum.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    Assigned Class <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.class}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white font-semibold text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    {SCHOOL_CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>

                {isSeniorClass(formData.class) ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1c1c14]">
                      Department <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.department || SSS_DEPARTMENTS[0]}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white font-semibold text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    >
                      {SSS_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1c1c14]">
                      Admission Number
                    </label>
                    <div className="h-10 px-3 rounded-lg border border-dashed border-[#c9c7b6] bg-[#faf8f0] text-xs text-[#797869] flex items-center gap-2">
                      <Info className="w-4 h-4 text-[#616218] shrink-0" />
                      <span>Assigned automatically on enrollment</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[#c9c7b6]/40">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-[#1c1c14] uppercase tracking-wider">
                      Enrolled Subjects
                    </label>
                    <span className="text-xs font-semibold text-[#616218] tabular-nums">
                      {formData.enrolledSubjects.length} of {eligibleSubjects.length} selected
                    </span>
                  </div>

                  {eligibleSubjects.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAllSubjects}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-[#494900] hover:text-[#616218] cursor-pointer py-1 px-2 rounded-lg hover:bg-[#faf8f0] transition-colors"
                    >
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          allEligibleSelected
                            ? 'bg-[#616218] border-[#616218] text-white'
                            : 'bg-white border-[#c9c7b6]'
                        }`}
                      >
                        {allEligibleSelected && <Check className="w-3 h-3" />}
                      </span>
                      <span>Select All Subjects</span>
                    </button>
                  )}
                </div>

                {eligibleSubjects.length === 0 ? (
                  <div className="p-5 rounded-lg border border-dashed border-[#c9c7b6] bg-[#faf8f0] text-center text-xs text-[#797869]">
                    No subjects are configured for {formData.class}
                    {isSeniorClass(formData.class) && formData.department ? ` · ${formData.department}` : ''}.
                    Add subjects in Class Allocations.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                    {eligibleSubjects.map((subject) => {
                      const isSelected = formData.enrolledSubjects.includes(subject);
                      return (
                        <button
                          type="button"
                          key={subject}
                          onClick={() => handleSubjectToggle(subject)}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#f4f2e1] border-[#616218] text-[#494900] shadow-xs'
                              : 'bg-white border-[#c9c7b6]/70 text-[#797869] hover:bg-[#faf8f0]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isSelected
                                ? 'bg-[#616218] border-[#616218] text-white'
                                : 'border-[#c9c7b6]'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <span className="truncate">{subject}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/70 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-[#c9c7b6]/40 pb-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#616218]" />
                    <span className="text-xs font-bold text-[#1c1c14] uppercase tracking-wider">
                      Student Portal Login Credentials (Admin Provisioned)
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1c1c14]">
                      Portal Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={formData.portalEmail}
                      onChange={(e) => setFormData({ ...formData, portalEmail: e.target.value })}
                      placeholder="Leave blank to auto-generate from Admission No."
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1c1c14]">
                      Initial Password (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type={showPortalPassword ? 'text' : 'password'}
                        value={formData.portalPassword}
                        onChange={(e) => setFormData({ ...formData, portalPassword: e.target.value })}
                        placeholder="Leave blank to auto-generate (min 6 chars)"
                        className="w-full h-10 pl-3 pr-10 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPortalPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#797869] hover:text-[#1c1c14] cursor-pointer"
                        aria-label="Toggle portal password visibility"
                      >
                        {showPortalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-[#797869]">
                  Students cannot self-register. Login credentials will be generated upon enrollment and printed on the official Admission Slip.
                </p>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-[#c9c7b6]/40 pb-3">
                <h2 className="text-lg font-bold text-[#1c1c14] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#616218]" />
                  Step 4: Parent & Guardian Information
                </h2>
                <p className="text-xs text-[#797869] mt-0.5">
                  Parent/Guardian contact for academic notices, progress reports, and emergency contacts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    Parent / Guardian First Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.parentFirstName}
                    onChange={(e) => setFormData({ ...formData, parentFirstName: e.target.value })}
                    placeholder="Bello"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    Parent / Guardian Surname (Last Name) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.parentLastName}
                    onChange={(e) => setFormData({ ...formData, parentLastName: e.target.value })}
                    placeholder="Mohammed"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">Relationship</label>
                  <select
                    value={formData.parentRelationship}
                    onChange={(e) => setFormData({ ...formData, parentRelationship: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Legal Guardian">Legal Guardian</option>
                    <option value="Uncle / Relative">Uncle / Relative</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    Primary Phone Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    placeholder="+234 803 123 4567"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">Email Address</label>
                  <input
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                    placeholder="parent@alamin.sch.ng"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">
                    Occupation / Profession
                  </label>
                  <input
                    type="text"
                    value={formData.parentOccupation}
                    onChange={(e) => setFormData({ ...formData, parentOccupation: e.target.value })}
                    placeholder="Civil Servant"
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Dedicated Emergency Secondary Contact Section */}
              <div className="mt-6 pt-5 border-t border-[#c9c7b6]/60 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#1c1c14]">
                    Secondary Emergency Contact (Optional)
                  </h3>
                  <p className="text-xs text-[#797869] mt-0.5">
                    Separate individual to reach immediately if the primary parent or guardian is unavailable.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1c1c14]">
                      Emergency Contact First Name
                    </label>
                    <input
                      type="text"
                      value={formData.emergencyContactFirstName}
                      onChange={(e) => setFormData({ ...formData, emergencyContactFirstName: e.target.value })}
                      placeholder="Ibrahim"
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1c1c14]">
                      Emergency Contact Surname (Last Name)
                    </label>
                    <input
                      type="text"
                      value={formData.emergencyContactLastName}
                      onChange={(e) => setFormData({ ...formData, emergencyContactLastName: e.target.value })}
                      placeholder="Ahmed"
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1c1c14]">
                      Emergency Contact Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                      placeholder="+234 802 987 6543"
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1c1c14]">
                      Relationship to Student
                    </label>
                    <select
                      value={formData.emergencyContactRelationship}
                      onChange={(e) => setFormData({ ...formData, emergencyContactRelationship: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    >
                      <option value="Uncle">Uncle</option>
                      <option value="Aunt">Aunt</option>
                      <option value="Older Sibling">Older Sibling</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Neighbor">Neighbor</option>
                      <option value="Family Friend">Family Friend</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-[#c9c7b6]/40 pb-3">
                <h2 className="text-lg font-bold text-[#1c1c14] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#616218]" />
                  Step 5: Review & Confirm Admission
                </h2>
                <p className="text-xs text-[#797869] mt-0.5">
                  Please review all student, curriculum, and guardian details carefully before submitting enrollment.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/70 space-y-2.5 text-xs text-[#1c1c14]">
                  <div className="flex justify-between items-center border-b border-[#c9c7b6]/50 pb-2">
                    <span className="font-bold text-sm text-[#616218]">Personal & Origin Profile</span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-semibold text-[#616218] hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Student Full Name:</span>
                    <span className="font-bold text-sm">
                      {formData.firstName} {formData.middleName ? formData.middleName + ' ' : ''}{formData.surname}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[#797869] block">Gender:</span>
                      <span className="font-medium">{formData.gender}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">Date of Birth:</span>
                      <span className="font-medium">{formData.dateOfBirth}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">State of Origin:</span>
                      <span className="font-medium">{formData.stateOfOrigin}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">Local Government Area:</span>
                      <span className="font-medium">{formData.lga}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">Blood Group & Genotype:</span>
                      <span className="font-medium">{formData.bloodGroup} / {formData.genotype}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">Religion:</span>
                      <span className="font-medium">{formData.religion}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Residential Address:</span>
                    <span className="font-medium">{formData.residentialAddress || `${formData.city}, ${formData.stateOfOrigin}`}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/70 space-y-2.5 text-xs text-[#1c1c14]">
                  <div className="flex justify-between items-center border-b border-[#c9c7b6]/50 pb-2">
                    <span className="font-bold text-sm text-[#616218]">Academic Placement</span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-xs font-semibold text-[#616218] hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[#797869] block">Assigned Class:</span>
                      <span className="font-bold text-sm text-[#1c1c14]">
                        {formData.class}
                      </span>
                    </div>
                    {isSeniorClass(formData.class) && (
                      <div>
                        <span className="text-[#797869] block">Department:</span>
                        <span className="font-bold text-sm text-[#1c1c14]">
                          {formData.department}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-[#797869] block">Academic Session:</span>
                      <span className="font-medium">{formData.session}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">Entry Term:</span>
                      <span className="font-medium">{formData.entryTerm}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Admission Number:</span>
                    <span className="font-medium text-[#616218]">
                      Generated automatically upon enrollment
                    </span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Registered Subjects ({formData.enrolledSubjects.length}):</span>
                    <span className="font-medium">
                      {formData.enrolledSubjects.join(', ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/70 space-y-2 text-xs text-[#1c1c14]">
                  <div className="flex justify-between items-center border-b border-[#c9c7b6]/50 pb-2">
                    <span className="font-bold text-sm text-[#616218]">Parent / Guardian Contact</span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="text-xs font-semibold text-[#616218] hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[#797869] block">Guardian Name:</span>
                      <span className="font-semibold">{`${formData.parentFirstName} ${formData.parentLastName}`.trim() || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">Relationship:</span>
                      <span className="font-semibold">{formData.parentRelationship}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">Primary Phone:</span>
                      <span className="font-semibold">{formData.parentPhone || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">Occupation:</span>
                      <span className="font-semibold">{formData.parentOccupation || 'Not specified'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Email:</span>
                    <span className="font-semibold">{formData.parentEmail || 'Not specified'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/70 space-y-2 text-xs text-[#1c1c14]">
                  <div className="flex justify-between items-center border-b border-[#c9c7b6]/50 pb-2">
                    <span className="font-bold text-sm text-[#616218]">Secondary Emergency Contact</span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="text-xs font-semibold text-[#616218] hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[#797869] block">Contact Name:</span>
                      <span className="font-semibold">{`${formData.emergencyContactFirstName} ${formData.emergencyContactLastName}`.trim() || 'None provided'}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">Relationship:</span>
                      <span className="font-semibold">{formData.emergencyContactRelationship || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[#797869] block">Emergency Phone:</span>
                      <span className="font-semibold">{formData.emergencyContactPhone || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/70 space-y-2 text-xs text-[#1c1c14]">
                <div className="flex justify-between items-center border-b border-[#c9c7b6]/50 pb-2">
                  <span className="font-bold text-sm text-[#616218]">Portal Login Account</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-xs font-semibold text-[#616218] hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#797869] block">Portal Email:</span>
                    <span className="font-semibold">
                      {formData.portalEmail.trim() || 'Auto-generated from Admission Number'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Initial Password:</span>
                    <span className="font-semibold">
                      {formData.portalPassword.trim() ? 'Custom password specified' : 'Auto-generated temporary password'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {submitError && (
            <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-6 border-t border-[#c9c7b6]/50 mt-6">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white text-xs font-semibold text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous Step
              </button>
            ) : (
              <Link
                to="/admin/students"
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white text-xs font-semibold text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs transition-colors cursor-pointer"
              >
                Cancel
              </Link>
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Continue to Step {currentStep + 1}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting ? 'Enrolling Student...' : 'Confirm & Enroll Student'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
