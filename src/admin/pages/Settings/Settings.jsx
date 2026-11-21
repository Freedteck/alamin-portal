import { Button } from '../../../shared/components/Button/Button';
import { Logo } from '../../../shared/components/Logo/Logo';
import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { schoolStore } from '../../../shared/data/schoolData';

const SETTINGS_STORAGE_KEY = 'alamin_settings_v1';

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function Settings() {
  const initial = loadSavedSettings();
  const [activeTab, setActiveTab] = useState('general');
  const [institutionName, setInstitutionName] = useState(initial.institutionName || 'Al-Amin Group of Schools');
  const [establishedYear, setEstablishedYear] = useState(initial.establishedYear || '2010');
  const [officialEmail, setOfficialEmail] = useState(initial.officialEmail || 'info@alaminschools.edu.ng');
  const [phone, setPhone] = useState(initial.phone || '+234 803 456 7890');
  const [address, setAddress] = useState(initial.address || 'Al-Amin Campus, 14 Ahmadu Bello Way, Nassarawa GRA');
  const [website, setWebsite] = useState(initial.website || 'www.alaminschools.edu.ng');
  const [registrationNumber, setRegistrationNumber] = useState(initial.registrationNumber || 'ASS-2010-008920');
  const [timezone, setTimezone] = useState(initial.timezone || 'wat');
  const [dateFormat, setDateFormat] = useState(initial.dateFormat || 'dd-mm-yyyy');
  const [academicTerm, setAcademicTerm] = useState(initial.academicTerm || 'first-term');
  const [language, setLanguage] = useState(initial.language || 'en');
  const [emailNotifications, setEmailNotifications] = useState(initial.emailNotifications ?? true);
  const [smsNotifications, setSmsNotifications] = useState(initial.smsNotifications ?? false);
  const [pushNotifications, setPushNotifications] = useState(initial.pushNotifications ?? true);
  const [reportCardAlerts, setReportCardAlerts] = useState(initial.reportCardAlerts ?? true);
  const [attendanceAlerts, setAttendanceAlerts] = useState(initial.attendanceAlerts ?? true);
  const [autoBackup, setAutoBackup] = useState(initial.autoBackup ?? true);
  const [sessionDuration, setSessionDuration] = useState(initial.sessionDuration || '45');
  const [academicYear, setAcademicYear] = useState(initial.academicYear || '2026-27');
  const [gradingSystem, setGradingSystem] = useState(initial.gradingSystem || 'ca-exam');
  const [attendanceThreshold, setAttendanceThreshold] = useState(initial.attendanceThreshold || '75');
  const [twoFactorAuth, setTwoFactorAuth] = useState(initial.twoFactorAuth ?? false);
  const [sessionTimeoutEnabled, setSessionTimeoutEnabled] = useState(initial.sessionTimeoutEnabled ?? true);
  const [sessionTimeoutDuration, setSessionTimeoutDuration] = useState(initial.sessionTimeoutDuration || '30');
  const [retentionPeriod, setRetentionPeriod] = useState(initial.retentionPeriod || '12');
  const [integrations, setIntegrations] = useState(
    initial.integrations || { googleWorkspace: false, whatsapp: false, zoom: false }
  );
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveSettings = () => {
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          institutionName,
          establishedYear,
          officialEmail,
          phone,
          address,
          website,
          registrationNumber,
          timezone,
          dateFormat,
          academicTerm,
          language,
          emailNotifications,
          smsNotifications,
          pushNotifications,
          reportCardAlerts,
          attendanceAlerts,
          autoBackup,
          sessionDuration,
          academicYear,
          gradingSystem,
          attendanceThreshold,
          twoFactorAuth,
          sessionTimeoutEnabled,
          sessionTimeoutDuration,
          retentionPeriod,
          integrations
        })
      );
      showToast('Institution settings saved successfully!');
    } catch {
      showToast('Unable to save settings locally.');
    }
  };

  const handleExportArchive = () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      institution: { institutionName, officialEmail, registrationNumber },
      students: schoolStore.getStudents(),
      teachers: schoolStore.getTeachers(),
      subjects: schoolStore.getSubjects(),
      attendance: schoolStore.getAttendance(),
      grades: schoolStore.getGrades(),
      assignments: schoolStore.getAssignments(),
      announcements: schoolStore.getAnnouncements()
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alamin-school-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Institution data export downloaded as JSON archive.');
  };

  const toggleIntegration = (key, label) => {
    setIntegrations((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      showToast(`${label} marked as ${next[key] ? 'Configured' : 'Not Configured'}. Click Save Changes to persist.`);
      return next;
    });
  };
    return (<div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif]">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
      <div className="pb-2 border-b border-[#c9c7b6]/50">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
          Institution Settings
        </h1>
        <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
          Configure preferences, notifications, and institutional identity for Al-Amin Group of Schools
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex border-b border-border gap-2 mb-4">
          <button type="button" onClick={() => setActiveTab('general')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'} `}>General</button>
          <button type="button" onClick={() => setActiveTab('notifications')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'notifications' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'} `}>Notifications</button>
          <button type="button" onClick={() => setActiveTab('academic')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'academic' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'} `}>Academic</button>
          <button type="button" onClick={() => setActiveTab('security')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'security' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'} `}>Security</button>
          <button type="button" onClick={() => setActiveTab('integrations')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'integrations' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'} `}>Integrations</button>
        </div>

        {activeTab === 'general' && (<div className="space-y-6"><div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                Institution Information
              </h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="institutionName">Institution Name</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed" id="institutionName" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="establishedYear">Established Year</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed" id="establishedYear" value={establishedYear} onChange={(e) => setEstablishedYear(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="email">Official Email</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed" id="email" type="email" value={officialEmail} onChange={(e) => setOfficialEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="phone">Phone Number</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed" id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium leading-none" htmlFor="address">Address</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed" id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="website">Website</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed" id="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="registrationNumber">Registration Number</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed" id="registrationNumber" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none"  htmlFor="logo">Official School Logo</label>
                <div className="flex items-center gap-4 p-3 bg-[#fdf9ec] rounded-xl border border-[#c9c7b6]/60">
                  <div className="p-2 bg-white rounded-lg border border-[#c9c7b6] shadow-xs">
                    <Logo variant="dark" className="h-10" showText={true} />
                  </div>
                  <span className="text-xs text-[#616218] font-semibold bg-[#e7e78f]/50 px-2.5 py-1 rounded-md">
                    Verified Crest Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm" >
            <div className="mb-4" >
              <h3 className="font-semibold leading-none tracking-tight" >System Preferences</h3>
            </div>
            <div  className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="timezone">Time Zone</label>
                  <select className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    <option value="wat">West Africa Time</option>
                    <option value="utc">UTC</option>
                    <option value="est">Eastern Standard Time</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="dateFormat">Date Format</label>
                  <select className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                    <option value="dd-mm-yyyy">DD-MM-YYYY</option>
                    <option value="mm-dd-yyyy">MM-DD-YYYY</option>
                    <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="term">Academic Term</label>
                  <select className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" value={academicTerm} onChange={(e) => setAcademicTerm(e.target.value)}>
                    <option value="first-term">First Term</option>
                    <option value="second-term">Second Term</option>
                    <option value="third-term">Third Term</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="language">Language</label>
                  <select className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                    <option value="ha">Hausa</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
              </div>
            </div>
          </div></div>)}

        {activeTab === 'notifications' && (<div className="space-y-6"><div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                Notification Preferences
              </h3>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none">Email Notifications</label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <input type="checkbox" role="switch" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} className="h-5 w-9 rounded-full cursor-pointer accent-primary" />
              </div>
              <hr className="my-4 border-t border-border" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none">SMS Notifications</label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via SMS
                  </p>
                </div>
                <input type="checkbox" role="switch" checked={smsNotifications} onChange={(e) => setSmsNotifications(e.target.checked)} className="h-5 w-9 rounded-full cursor-pointer accent-primary" />
              </div>
              <hr className="my-4 border-t border-border" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none">Push Notifications</label>
                  <p className="text-sm text-muted-foreground">
                    Receive browser push notifications
                  </p>
                </div>
                <input type="checkbox" role="switch" checked={pushNotifications} onChange={(e) => setPushNotifications(e.target.checked)} className="h-5 w-9 cursor-pointer accent-primary" />
              </div>
              <hr className="my-4 border-t border-border" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none">Report Card Publication Alerts</label>
                  <p className="text-sm text-muted-foreground">
                    Notify guardians automatically when term results are finalized
                  </p>
                </div>
                <input type="checkbox" role="switch" checked={reportCardAlerts} onChange={(e) => setReportCardAlerts(e.target.checked)} className="h-5 w-9 cursor-pointer accent-primary" />
              </div>
              <hr className="my-4 border-t border-border" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none" >Attendance Alerts</label>
                  <p className="text-sm text-muted-foreground">
                    Alert for low attendance
                  </p>
                </div>
                <input type="checkbox" role="switch" checked={attendanceAlerts} onChange={(e) => setAttendanceAlerts(e.target.checked)} className="h-5 w-9 cursor-pointer accent-primary" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm" >
            <div className="mb-4" >
              <h3 className="font-semibold leading-none tracking-tight" >Email Settings</h3>
            </div>
            <div  className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none"  htmlFor="smtpServer">SMTP Server</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" id="smtpServer" placeholder="smtp.gmail.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none"  htmlFor="smtpPort">SMTP Port</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" id="smtpPort" placeholder="587" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none"  htmlFor="emailUsername">Email Username</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" id="emailUsername" placeholder="your-email@gmail.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="emailPassword">Email Password</label>
                  <div className="relative">
                    <input className="w-full h-10 pl-3 pr-10 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" id="emailPassword" type={showEmailPassword ? 'text' : 'password'} placeholder="••••••••" />
                    <button
                      type="button"
                      onClick={() => setShowEmailPassword((prev) => !prev)}
                      aria-label={showEmailPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#797869] hover:text-[#1c1c14] rounded-md focus:outline-none focus:ring-2 focus:ring-[#616218]/20 transition-colors cursor-pointer"
                    >
                      {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div></div>)}

        {activeTab === 'academic' && (<div className="space-y-6"><div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                Academic Settings
              </h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="academicYear">Current Academic Session</label>
                  <select className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                    <option value="2026-27">2026/2027 Session</option>
                    <option value="2025-26">2025/2026 Session</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="sessionDuration">Default Period Duration in Minutes</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" id="sessionDuration" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="gradingSystem">Grading System</label>
                  <select className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" value={gradingSystem} onChange={(e) => setGradingSystem(e.target.value)}>
                    <option value="ca-exam">1st CA + 2nd CA + Examination</option>
                    <option value="letter">WAEC and NECO Letter Grades</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="attendanceThreshold">Minimum Attendance Percentage</label>
                  <input className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" id="attendanceThreshold" value={attendanceThreshold} onChange={(e) => setAttendanceThreshold(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="font-semibold leading-none tracking-tight">Admission & ID Numbering Policy</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Student Admission Format</label>
                  <input readOnly className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-[#faf8f0] text-sm font-mono font-bold text-[#494900] focus:outline-none shadow-xs" value="26/ASS/JA001" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Staff ID Format</label>
                  <input readOnly className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-[#faf8f0] text-sm font-mono font-bold text-[#494900] focus:outline-none shadow-xs" value="ASS/staff/001" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium leading-none">Configured Secondary Levels</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { cls: 'JSS 1', code: 'JA' },
                      { cls: 'JSS 2', code: 'JB' },
                      { cls: 'JSS 3', code: 'JC' },
                      { cls: 'SSS 1', code: 'SA' },
                      { cls: 'SSS 2', code: 'SB' },
                      { cls: 'SSS 3', code: 'SC' }
                    ].map((lvl) => (
                      <div key={lvl.cls} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#faf8f0] border border-[#c9c7b6]">
                        <span className="text-[#494900]">{lvl.cls}</span>
                        <span className="font-mono text-[#616218]">{lvl.code}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div></div>)}

        {activeTab === 'security' && (<div className="space-y-6"><div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                Security Settings
              </h3>
            </div>
            <div  className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none" >Two-Factor Authentication</label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <input type="checkbox" role="switch" checked={twoFactorAuth} onChange={(e) => setTwoFactorAuth(e.target.checked)} className="h-5 w-9 cursor-pointer accent-primary" />
              </div>
              <hr className="my-4 border-t border-border" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none" >Auto Backup</label>
                  <p className="text-sm text-muted-foreground">
                    Automatically backup data daily
                  </p>
                </div>
                <input type="checkbox" role="switch" checked={autoBackup} onChange={(e) => setAutoBackup(e.target.checked)} className="h-5 w-9 rounded-full cursor-pointer accent-primary" />
              </div>
              <hr className="my-4 border-t border-border" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none" >Session Timeout</label>
                  <p className="text-sm text-muted-foreground">
                    Auto-logout after inactivity
                  </p>
                </div>
                <input type="checkbox" role="switch" checked={sessionTimeoutEnabled} onChange={(e) => setSessionTimeoutEnabled(e.target.checked)} className="h-5 w-9 cursor-pointer accent-primary" />
              </div>
              <hr className="my-4 border-t border-border" />
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none"  htmlFor="sessionTimeout">Session Timeout Duration</label>
                <select className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" value={sessionTimeoutDuration} onChange={(e) => setSessionTimeoutDuration(e.target.value)}>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm" >
            <div className="mb-4" >
              <h3 className="font-semibold leading-none tracking-tight" >Data Management</h3>
            </div>
            <div  className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium leading-none" >Export Data</label>
                  <p className="text-sm text-muted-foreground">
                    Download a copy of all your data
                  </p>
                </div>
                <Button variant="outline" onClick={handleExportArchive}>Export</Button>
              </div>
              <hr className="my-4 border-t border-border" />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="text-sm font-medium leading-none">Data Retention Period</label>
                  <p className="text-sm text-muted-foreground">
                    How long to keep deleted records
                  </p>
                </div>
                <select className="w-full sm:w-52 h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs" value={retentionPeriod} onChange={(e) => setRetentionPeriod(e.target.value)}>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="permanent">Permanent</option>
                </select>
              </div>
            </div>
          </div></div>)}

        {activeTab === 'integrations' && (<div className="space-y-6"><div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="font-semibold leading-none tracking-tight">Third-Party Integrations</h3>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center font-bold text-blue-700 text-xs">GW</div>
                  <div>
                    <label className="text-sm font-medium leading-none">Google Workspace</label>
                    <p className="text-sm text-muted-foreground">
                      Sync with Google Calendar and Gmail
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${integrations.googleWorkspace ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-stone-100 text-stone-700 border-stone-200'}`}>
                    {integrations.googleWorkspace ? 'Configured' : 'Not Configured'}
                  </span>
                  <Button variant="outline" onClick={() => toggleIntegration('googleWorkspace', 'Google Workspace')}>
                    {integrations.googleWorkspace ? 'Disable' : 'Configure'}
                  </Button>
                </div>
              </div>
              <hr className="my-4 border-t border-border" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center font-bold text-green-700 text-xs">WA</div>
                  <div>
                    <label className="text-sm font-medium leading-none">WhatsApp Business</label>
                    <p className="text-sm text-muted-foreground">
                      Send parent notifications via WhatsApp
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${integrations.whatsapp ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-stone-100 text-stone-700 border-stone-200'}`}>
                    {integrations.whatsapp ? 'Configured' : 'Not Configured'}
                  </span>
                  <Button variant="outline" onClick={() => toggleIntegration('whatsapp', 'WhatsApp Business')}>
                    {integrations.whatsapp ? 'Disable' : 'Configure'}
                  </Button>
                </div>
              </div>
              <hr className="my-4 border-t border-border" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center font-bold text-purple-700 text-xs">ZM</div>
                  <div>
                    <label className="text-sm font-medium leading-none">Zoom</label>
                    <p className="text-sm text-muted-foreground">
                      Schedule and manage virtual parent-teacher conferences
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${integrations.zoom ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-stone-100 text-stone-700 border-stone-200'}`}>
                    {integrations.zoom ? 'Configured' : 'Not Configured'}
                  </span>
                  <Button variant="outline" onClick={() => toggleIntegration('zoom', 'Zoom')}>
                    {integrations.zoom ? 'Disable' : 'Configure'}
                  </Button>
                </div>
              </div>
            </div>
          </div></div>)}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveSettings}>
          Save Changes
        </Button>
      </div>
    </div>);
}
