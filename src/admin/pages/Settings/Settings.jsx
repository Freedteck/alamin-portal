import { Button } from "../../../shared/components/Button/Button";
import { Logo } from "../../../shared/components/Logo/Logo";
import { Modal } from "../../../shared/components/Modal/Modal";
import { Pagination } from "../../../shared/components/Pagination/Pagination";
import { useState, useEffect, useMemo } from "react";
import { apiClient } from "../../../shared/lib/apiClient";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  Users,
  Award,
} from "lucide-react";
import {
  schoolStore,
  SCHOOL_CLASSES,
  SSS_DEPARTMENTS,
  isSeniorClass,
} from "../../../shared/data/schoolData";

export function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const [institutionName, setInstitutionName] = useState(
    "Al-Amin Group of Schools",
  );
  const [establishedYear, setEstablishedYear] = useState("2010");
  const [officialEmail, setOfficialEmail] = useState(
    "info@alaminschools.edu.ng",
  );
  const [phone, setPhone] = useState("+234 803 456 7890");
  const [address, setAddress] = useState(
    "Al-Amin Campus, 14 Ahmadu Bello Way, Nassarawa GRA",
  );
  const [website, setWebsite] = useState("www.alaminschools.edu.ng");
  const [registrationNumber, setRegistrationNumber] =
    useState("ASS-2010-008920");
  const [timezone, setTimezone] = useState("wat");
  const [dateFormat, setDateFormat] = useState("dd-mm-yyyy");
  const [academicTerm, setAcademicTerm] = useState("first-term");
  const [language, setLanguage] = useState("en");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [reportCardAlerts, setReportCardAlerts] = useState(true);
  const [attendanceAlerts, setAttendanceAlerts] = useState(true);
  const [autoBackup, setAutoBackup] = useState(true);
  const [sessionDuration, setSessionDuration] = useState("45");
  const [academicYear, setAcademicYear] = useState("2026-27");
  const [gradingSystem, setGradingSystem] = useState("ca-exam");
  const [attendanceThreshold, setAttendanceThreshold] = useState("75");
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [sessionTimeoutEnabled, setSessionTimeoutEnabled] = useState(true);
  const [sessionTimeoutDuration, setSessionTimeoutDuration] = useState("30");
  const [retentionPeriod, setRetentionPeriod] = useState("12");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [toast, setToast] = useState(null);

  const currentYear = new Date().getFullYear();
  const currentYearPrefix = String(currentYear).slice(-2);

  // Rollover & Session Promotion State
  const [rolloverCandidates, setRolloverCandidates] = useState([]);
  const [promotionsMap, setPromotionsMap] = useState({});
  const [currentSessionInput, setCurrentSessionInput] = useState("2026/2027");
  const [nextSessionInput, setNextSessionInput] = useState("2027/2028");
  const [passThreshold, setPassThreshold] = useState(45);
  const [rolloverFilterClass, setRolloverFilterClass] = useState("all");
  const [rolloverSearch, setRolloverSearch] = useState("");
  const [rolloverPage, setRolloverPage] = useState(1);
  const rolloverPageSize = 8;
  const [isLoadingRollover, setIsLoadingRollover] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [classesList, setClassesList] = useState([]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    apiClient
      .get("/settings")
      .then((data) => {
        if (!data) return;
        if (data.institutionName) setInstitutionName(data.institutionName);
        if (data.establishedYear) setEstablishedYear(data.establishedYear);
        if (data.officialEmail) setOfficialEmail(data.officialEmail);
        if (data.phone) setPhone(data.phone);
        if (data.address) setAddress(data.address);
        if (data.website) setWebsite(data.website);
        if (data.registrationNumber)
          setRegistrationNumber(data.registrationNumber);
        if (data.timezone) setTimezone(data.timezone);
        if (data.dateFormat) setDateFormat(data.dateFormat);
        if (data.academicTerm) setAcademicTerm(data.academicTerm);
        if (data.language) setLanguage(data.language);
        if (data.emailNotifications !== undefined)
          setEmailNotifications(data.emailNotifications);
        if (data.smsNotifications !== undefined)
          setSmsNotifications(data.smsNotifications);
        if (data.pushNotifications !== undefined)
          setPushNotifications(data.pushNotifications);
        if (data.autoBackup !== undefined) setAutoBackup(data.autoBackup);
        if (data.sessionDuration) setSessionDuration(data.sessionDuration);
        if (data.academicYear) setAcademicYear(data.academicYear);
        if (data.gradingSystem) setGradingSystem(data.gradingSystem);
        if (data.attendanceThreshold !== undefined)
          setAttendanceThreshold(data.attendanceThreshold);
        if (data.twoFactorAuth !== undefined)
          setTwoFactorAuth(data.twoFactorAuth);
        if (data.sessionTimeoutEnabled !== undefined)
          setSessionTimeoutEnabled(data.sessionTimeoutEnabled);
        if (data.sessionTimeoutDuration)
          setSessionTimeoutDuration(data.sessionTimeoutDuration);
      })
      .catch(() => {});
  }, []);

  const loadRolloverData = async () => {
    setIsLoadingRollover(true);
    try {
      const [classes, candidates] = await Promise.all([
        schoolStore.fetchClasses(),
        schoolStore.getPromotionCandidates(),
      ]);
      setClassesList(classes.map((item) => item.name || item));

      setRolloverCandidates(candidates);
      const initialMap = {};
      candidates.forEach((c) => {
        initialMap[c.id] = {
          studentId: c.id,
          action: c.suggestedAction,
          targetClass: c.suggestedClass,
          department:
            c.department || (isSeniorClass(c.suggestedClass) ? "Science" : ""),
        };
      });
      setPromotionsMap(initialMap);
    } catch (error) {
      console.error("Failed to load session rollover data:", error);
      showToast(error?.message || "Error loading session rollover candidates.");
    } finally {
      setIsLoadingRollover(false);
    }
  };

  useEffect(() => {
    if (activeTab === "rollover") {
      loadRolloverData();
    }
  }, [activeTab]);

  const handlePromotionAction = (studentId, action, candidate) => {
    setPromotionsMap((prev) => {
      const current = prev[studentId] || {};
      let targetClass = current.targetClass || candidate.suggestedClass;
      if (action === "graduate") {
        targetClass = "Graduated";
      } else if (action === "repeat") {
        targetClass = candidate.currentClass;
      } else if (action === "promote") {
        targetClass = candidate.suggestedClass;
      }
      return {
        ...prev,
        [studentId]: {
          studentId,
          action,
          targetClass,
          department: current.department || candidate.department || "Science",
        },
      };
    });
  };

  const handleTargetClass = (studentId, targetClass) => {
    setPromotionsMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { studentId, action: "promote" }),
        targetClass,
      },
    }));
  };

  const handleDepartmentChange = (studentId, department) => {
    setPromotionsMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { studentId, action: "promote" }),
        department,
      },
    }));
  };

  const handleApplyAllRecommendations = () => {
    const updated = {};
    rolloverCandidates.forEach((c) => {
      updated[c.id] = {
        studentId: c.id,
        action: c.suggestedAction,
        targetClass: c.suggestedClass,
        department:
          c.department || (isSeniorClass(c.suggestedClass) ? "Science" : ""),
      };
    });
    setPromotionsMap(updated);
    showToast("Applied system recommendations to all student records.");
  };

  const handleExecuteRollover = async () => {
    setIsRollingOver(true);
    try {
      const payload = {
        nextSession: nextSessionInput,
        promotions: Object.values(promotionsMap),
      };
      const res = await schoolStore.executeSessionRollover(payload);
      setIsConfirmModalOpen(false);
      showToast(
        `Session Rollover to ${nextSessionInput} completed! Promoted: ${res.promotedCount || 0}, Repeating: ${res.repeatCount || 0}, Graduated: ${res.graduatedCount || 0}.`,
      );
      await loadRolloverData();
    } catch (err) {
      showToast(err?.message || "Failed to execute session rollover.");
    } finally {
      setIsRollingOver(false);
    }
  };

  const rolloverMetrics = useMemo(() => {
    let promoteCount = 0;
    let repeatCount = 0;
    let graduateCount = 0;
    Object.values(promotionsMap).forEach((p) => {
      if (p.action === "graduate") graduateCount++;
      else if (p.action === "repeat") repeatCount++;
      else promoteCount++;
    });
    return {
      total: rolloverCandidates.length,
      promoted: promoteCount,
      repeating: repeatCount,
      graduating: graduateCount,
    };
  }, [promotionsMap, rolloverCandidates]);

  const filteredCandidates = useMemo(() => {
    return rolloverCandidates.filter((c) => {
      const matchesClass =
        rolloverFilterClass === "all" || c.currentClass === rolloverFilterClass;
      const matchesSearch =
        !rolloverSearch.trim() ||
        c.name.toLowerCase().includes(rolloverSearch.toLowerCase()) ||
        c.admissionNumber?.toLowerCase().includes(rolloverSearch.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [rolloverCandidates, rolloverFilterClass, rolloverSearch]);

  const paginatedCandidates = useMemo(() => {
    const start = (rolloverPage - 1) * rolloverPageSize;
    return filteredCandidates.slice(start, start + rolloverPageSize);
  }, [filteredCandidates, rolloverPage]);

  const handleSaveSettings = async () => {
    try {
      const payload = {
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
      };
      await apiClient.put("/settings", payload);
      showToast("Institution settings saved successfully to database!");
    } catch (err) {
      showToast(err?.message || "Unable to save settings to database.");
    }
  };

  const handleExportArchive = async () => {
    try {
      const [
        students,
        teachers,
        subjects,
        attendance,
        grades,
        assignments,
        announcements,
      ] = await Promise.all([
        apiClient.get("/students"),
        apiClient.get("/teachers"),
        apiClient.get("/subjects"),
        apiClient.get("/attendance"),
        apiClient.get("/grades"),
        apiClient.get("/assignments"),
        apiClient.get("/announcements"),
      ]);
      const snapshot = {
        exportedAt: new Date().toISOString(),
        institution: { institutionName, officialEmail, registrationNumber },
        students,
        teachers,
        subjects,
        attendance,
        grades,
        assignments,
        announcements,
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alamin-school-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Institution data export downloaded as JSON archive.");
    } catch (error) {
      console.error("Failed to export institution data:", error);
      showToast(error?.message || "Unable to export institution data.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif]">
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
          Configure preferences, notifications, and institutional identity for
          Al-Amin Group of Schools
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex border-b border-[#c9c7b6]/60 gap-2 mb-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "general" ? "border-[#616218] text-[#616218]" : "border-transparent text-[#797869] hover:text-[#1c1c14]"} `}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "notifications" ? "border-[#616218] text-[#616218]" : "border-transparent text-[#797869] hover:text-[#1c1c14]"} `}
          >
            Notifications
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("academic")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "academic" ? "border-[#616218] text-[#616218]" : "border-transparent text-[#797869] hover:text-[#1c1c14]"} `}
          >
            Academic
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rollover")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "rollover" ? "border-[#616218] text-[#616218]" : "border-transparent text-[#797869] hover:text-[#1c1c14]"} `}
          >
            Session & Rollover
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "security" ? "border-[#616218] text-[#616218]" : "border-transparent text-[#797869] hover:text-[#1c1c14]"} `}
          >
            Security
          </button>
        </div>

        {activeTab === "general" && (
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                  Institution Information
                </h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="institutionName"
                    >
                      Institution Name
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                      id="institutionName"
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="establishedYear"
                    >
                      Established Year
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                      id="establishedYear"
                      value={establishedYear}
                      onChange={(e) => setEstablishedYear(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="email"
                    >
                      Official Email
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                      id="email"
                      type="email"
                      value={officialEmail}
                      onChange={(e) => setOfficialEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="phone"
                    >
                      Phone Number
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="address"
                    >
                      Address
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="website"
                    >
                      Website
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="registrationNumber"
                    >
                      Registration Number
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs disabled:bg-[#faf8f0] disabled:text-[#797869] disabled:cursor-not-allowed"
                      id="registrationNumber"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium leading-none"
                    htmlFor="logo"
                  >
                    Official School Logo
                  </label>
                  <div className="flex items-center gap-4 p-3 bg-[#fdf9ec] rounded-xl border border-[#c9c7b6]/60">
                    <div className="p-2 bg-white rounded-lg border border-[#c9c7b6] shadow-xs">
                      <Logo variant="dark" className="h-10" showText={true} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold leading-none tracking-tight">
                  System Preferences
                </h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="timezone"
                    >
                      Time Zone
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                    >
                      <option value="wat">West Africa Time</option>
                      <option value="utc">UTC</option>
                      <option value="est">Eastern Standard Time</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="dateFormat"
                    >
                      Date Format
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value)}
                    >
                      <option value="dd-mm-yyyy">DD-MM-YYYY</option>
                      <option value="mm-dd-yyyy">MM-DD-YYYY</option>
                      <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="term"
                    >
                      Academic Term
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      value={academicTerm}
                      onChange={(e) => setAcademicTerm(e.target.value)}
                    >
                      <option value="first-term">First Term</option>
                      <option value="second-term">Second Term</option>
                      <option value="third-term">Third Term</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="language"
                    >
                      Language
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="ar">Arabic</option>
                      <option value="ha">Hausa</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                  Notification Preferences
                </h3>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none">
                      Email Notifications
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="h-5 w-9 rounded-full cursor-pointer accent-primary"
                  />
                </div>
                <hr className="my-4 border-t border-border" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none">
                      SMS Notifications
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via SMS
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={smsNotifications}
                    onChange={(e) => setSmsNotifications(e.target.checked)}
                    className="h-5 w-9 rounded-full cursor-pointer accent-primary"
                  />
                </div>
                <hr className="my-4 border-t border-border" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none">
                      Push Notifications
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Receive browser push notifications
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    className="h-5 w-9 cursor-pointer accent-primary"
                  />
                </div>
                <hr className="my-4 border-t border-border" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none">
                      Report Card Publication Alerts
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Notify guardians automatically when term results are
                      finalized
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={reportCardAlerts}
                    onChange={(e) => setReportCardAlerts(e.target.checked)}
                    className="h-5 w-9 cursor-pointer accent-primary"
                  />
                </div>
                <hr className="my-4 border-t border-border" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none">
                      Attendance Alerts
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Alert for low attendance
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={attendanceAlerts}
                    onChange={(e) => setAttendanceAlerts(e.target.checked)}
                    className="h-5 w-9 cursor-pointer accent-primary"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold leading-none tracking-tight">
                  Email Settings
                </h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="smtpServer"
                    >
                      SMTP Server
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      id="smtpServer"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="smtpPort"
                    >
                      SMTP Port
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      id="smtpPort"
                      placeholder="587"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="emailUsername"
                    >
                      Email Username
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      id="emailUsername"
                      placeholder="your-email@gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="emailPassword"
                    >
                      Email Password
                    </label>
                    <div className="relative">
                      <input
                        className="w-full h-10 pl-3 pr-10 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                        id="emailPassword"
                        type={showEmailPassword ? "text" : "password"}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPassword((prev) => !prev)}
                        aria-label={
                          showEmailPassword ? "Hide password" : "Show password"
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#797869] hover:text-[#1c1c14] rounded-md focus:outline-none focus:ring-2 focus:ring-[#616218]/20 transition-colors cursor-pointer"
                      >
                        {showEmailPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "academic" && (
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                  Academic Settings
                </h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="academicYear"
                    >
                      Current Academic Session
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                    >
                      <option value="2026-27">2026/2027 Session</option>
                      <option value="2025-26">2025/2026 Session</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="sessionDuration"
                    >
                      Default Period Duration in Minutes
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      id="sessionDuration"
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="gradingSystem"
                    >
                      Grading System
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      value={gradingSystem}
                      onChange={(e) => setGradingSystem(e.target.value)}
                    >
                      <option value="ca-exam">
                        1st CA + 2nd CA + Examination
                      </option>
                      <option value="letter">
                        WAEC and NECO Letter Grades
                      </option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium leading-none"
                      htmlFor="attendanceThreshold"
                    >
                      Minimum Attendance Percentage
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                      id="attendanceThreshold"
                      value={attendanceThreshold}
                      onChange={(e) => setAttendanceThreshold(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold leading-none tracking-tight">
                  Admission & ID Numbering Policy
                </h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">
                      Student Admission Format
                    </label>
                    <input
                      readOnly
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-[#faf8f0] text-sm font-mono font-bold text-[#494900] focus:outline-none shadow-xs"
                      value={`${currentYearPrefix}/ASS/JA001`}
                    />
                    <p className="text-[11px] text-[#797869] mt-1">
                      Dynamically derives from the calendar year (
                      {currentYearPrefix} for {currentYear}) + school code (ASS)
                      + class code + sequence number.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">
                      Staff ID Format
                    </label>
                    <input
                      readOnly
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-[#faf8f0] text-sm font-mono font-bold text-[#494900] focus:outline-none shadow-xs"
                      value="ASS/staff/001"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium leading-none">
                      Configured Secondary Levels
                    </label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[
                        { cls: "JSS 1", code: "JA" },
                        { cls: "JSS 2", code: "JB" },
                        { cls: "JSS 3", code: "JC" },
                        { cls: "SSS 1", code: "SA" },
                        { cls: "SSS 2", code: "SB" },
                        { cls: "SSS 3", code: "SC" },
                      ].map((lvl) => (
                        <div
                          key={lvl.cls}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#faf8f0] border border-[#c9c7b6]"
                        >
                          <span className="text-[#494900]">{lvl.cls}</span>
                          <span className="font-mono text-[#616218]">
                            {lvl.code}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "rollover" && (
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#616218]" />
                  <span>Academic Session Rollover & Promotion Policy</span>
                </h3>
                <p className="text-xs text-[#797869] mt-1.5">
                  Advance students to their subsequent academic level at the end
                  of the school year, manage repeating candidates, and record
                  graduates.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">
                      Current Session
                    </label>
                    <input
                      type="text"
                      value={currentSessionInput}
                      onChange={(e) => setCurrentSessionInput(e.target.value)}
                      placeholder="e.g. 2026/2027"
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] shadow-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">
                      Target New Session
                    </label>
                    <input
                      type="text"
                      value={nextSessionInput}
                      onChange={(e) => setNextSessionInput(e.target.value)}
                      placeholder="e.g. 2027/2028"
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] shadow-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">
                      Pass Benchmark (%)
                    </label>
                    <input
                      type="number"
                      min="30"
                      max="75"
                      value={passThreshold}
                      onChange={(e) =>
                        setPassThreshold(Number(e.target.value) || 45)
                      }
                      className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] shadow-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-lg bg-card border shadow-sm">
                <span className="text-xs text-[#797869] font-medium block">
                  Total Roster
                </span>
                <span className="text-2xl font-bold text-[#1c1c14] mt-1 block">
                  {rolloverMetrics.total}
                </span>
                <span className="text-[11px] text-[#797869]">
                  Eligible candidates
                </span>
              </div>
              <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200 shadow-sm">
                <span className="text-xs text-emerald-800 font-medium block">
                  Promoted
                </span>
                <span className="text-2xl font-bold text-emerald-900 mt-1 block">
                  {rolloverMetrics.promoted}
                </span>
                <span className="text-[11px] text-emerald-700">
                  Advancing next class
                </span>
              </div>
              <div className="p-4 rounded-lg bg-amber-50/60 border border-amber-200 shadow-sm">
                <span className="text-xs text-amber-800 font-medium block">
                  Repeating
                </span>
                <span className="text-2xl font-bold text-amber-900 mt-1 block">
                  {rolloverMetrics.repeating}
                </span>
                <span className="text-[11px] text-amber-700">
                  Retaining current class
                </span>
              </div>
              <div className="p-4 rounded-lg bg-purple-50/60 border border-purple-200 shadow-sm">
                <span className="text-xs text-purple-800 font-medium block">
                  Graduating
                </span>
                <span className="text-2xl font-bold text-purple-900 mt-1 block">
                  {rolloverMetrics.graduating}
                </span>
                <span className="text-[11px] text-purple-700">
                  Terminal SSS 3 alumni
                </span>
              </div>
            </div>

            {/* Candidate Roster Card */}
            <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#c9c7b6]/50">
                <div>
                  <h3 className="font-semibold leading-none tracking-tight">
                    Student Promotion Decision Roster
                  </h3>
                  <p className="text-xs text-[#797869] mt-1">
                    Review cumulative marks and configure individual promotions
                    before committing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAllRecommendations}
                  className="px-3 py-1.5 rounded-lg border border-[#c9c7b6] bg-[#faf8f0] hover:bg-white text-xs font-semibold text-[#616218] transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
                >
                  Reset All to Recommendations
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#797869] mr-1">
                    Class Filter:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRolloverFilterClass("all");
                      setRolloverPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      rolloverFilterClass === "all"
                        ? "bg-[#616218] text-white shadow-xs"
                        : "bg-[#faf8f0] text-[#797869] border border-[#c9c7b6]/80 hover:bg-white"
                    }`}
                  >
                    All Classes
                  </button>
                  {(classesList.length > 0 ? classesList : SCHOOL_CLASSES).map(
                    (cls) => {
                      const isSelected = rolloverFilterClass === cls;
                      return (
                        <button
                          type="button"
                          key={cls}
                          onClick={() => {
                            setRolloverFilterClass(cls);
                            setRolloverPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#616218] text-white shadow-xs"
                              : "bg-[#faf8f0] text-[#797869] border border-[#c9c7b6]/80 hover:bg-white"
                          }`}
                        >
                          {cls}
                        </button>
                      );
                    },
                  )}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-[#797869] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rolloverSearch}
                    onChange={(e) => {
                      setRolloverSearch(e.target.value);
                      setRolloverPage(1);
                    }}
                    placeholder="Search candidate or admission..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14] placeholder-[#797869] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] shadow-xs"
                  />
                </div>
              </div>

              {/* Roster Table */}
              <div className="overflow-x-auto border border-[#c9c7b6]/80 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#faf8f0] font-bold text-[#797869] border-b border-[#c9c7b6] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3.5">Student</th>
                      <th className="py-3 px-3">Current Class</th>
                      <th className="py-3 px-3">Average Mark</th>
                      <th className="py-3 px-3">Recommendation</th>
                      <th className="py-3 px-3">Promotion Action</th>
                      <th className="py-3 px-3.5">Target Placement / Stream</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c9c7b6]/40">
                    {paginatedCandidates.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-[#797869]"
                        >
                          No students found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedCandidates.map((candidate) => {
                        const promotion = promotionsMap[candidate.id] || {
                          action: candidate.suggestedAction,
                          targetClass: candidate.suggestedClass,
                          department: candidate.department || "Science",
                        };
                        const passed = candidate.averageScore >= passThreshold;
                        const isSeniorTarget = isSeniorClass(
                          promotion.targetClass,
                        );

                        return (
                          <tr
                            key={candidate.id}
                            className="hover:bg-[#faf8f0]/60 transition-colors"
                          >
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-[#1c1c14]">
                                {candidate.name}
                              </div>
                              <div className="font-mono text-[11px] text-[#797869]">
                                {candidate.admissionNumber}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-semibold text-[#48482d]">
                              {candidate.currentClass}
                              {candidate.department && (
                                <span className="block text-[10px] text-[#797869]">
                                  {candidate.department}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                  passed
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {candidate.averageScore}%
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  candidate.suggestedAction === "promote"
                                    ? "bg-emerald-50 text-emerald-800"
                                    : candidate.suggestedAction === "repeat"
                                      ? "bg-amber-50 text-amber-800"
                                      : "bg-purple-50 text-purple-800"
                                }`}
                              >
                                <Sparkles className="w-3 h-3" />
                                {candidate.suggestedAction === "promote" &&
                                  `Promote to ${candidate.suggestedClass}`}
                                {candidate.suggestedAction === "repeat" &&
                                  `Repeat ${candidate.currentClass}`}
                                {candidate.suggestedAction === "graduate" &&
                                  "Graduate (Alumni)"}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={promotion.action}
                                onChange={(e) =>
                                  handlePromotionAction(
                                    candidate.id,
                                    e.target.value,
                                    candidate,
                                  )
                                }
                                className="h-8 px-2.5 rounded-lg border border-[#c9c7b6] bg-white text-xs font-semibold text-[#1c1c14] focus:outline-none focus:ring-1 focus:ring-[#616218] shadow-xs cursor-pointer"
                              >
                                <option value="promote">Promote</option>
                                <option value="repeat">Repeat</option>
                                <option value="graduate">Graduate</option>
                              </select>
                            </td>
                            <td className="py-3 px-3.5">
                              {promotion.action === "graduate" ? (
                                <span className="inline-flex items-center gap-1.5 text-purple-800 font-semibold bg-purple-50 px-2 py-1 rounded border border-purple-200">
                                  <GraduationCap className="w-3.5 h-3.5" />
                                  <span>Graduate / Alumni</span>
                                </span>
                              ) : promotion.action === "repeat" ? (
                                <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                  Repeat {candidate.currentClass}
                                </span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={promotion.targetClass}
                                    onChange={(e) =>
                                      handleTargetClass(
                                        candidate.id,
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 px-2 rounded-lg border border-[#c9c7b6] bg-white text-xs font-semibold text-[#1c1c14] focus:outline-none focus:ring-1 focus:ring-[#616218] shadow-xs cursor-pointer"
                                  >
                                    {(classesList.length > 0
                                      ? classesList
                                      : SCHOOL_CLASSES
                                    ).map((cls) => (
                                      <option key={cls} value={cls}>
                                        {cls}
                                      </option>
                                    ))}
                                  </select>

                                  {isSeniorTarget && (
                                    <select
                                      value={promotion.department || "Science"}
                                      onChange={(e) =>
                                        handleDepartmentChange(
                                          candidate.id,
                                          e.target.value,
                                        )
                                      }
                                      className="h-8 px-2 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14] focus:outline-none focus:ring-1 focus:ring-[#616218] shadow-xs cursor-pointer"
                                    >
                                      {SSS_DEPARTMENTS.map((dept) => (
                                        <option key={dept} value={dept}>
                                          {dept}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredCandidates.length > rolloverPageSize && (
                <div className="pt-2">
                  <Pagination
                    currentPage={rolloverPage}
                    totalPages={Math.ceil(
                      filteredCandidates.length / rolloverPageSize,
                    )}
                    onPageChange={setRolloverPage}
                  />
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="rounded-lg border bg-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-sm text-[#1c1c14]">
                  Execute Annual Session Rollover
                </h4>
                <p className="text-xs text-[#797869] mt-0.5">
                  Advances active students into session {nextSessionInput} with
                  the promotional placements decided above.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={rolloverCandidates.length === 0}
                className="h-10 px-5 rounded-lg bg-[#616218] hover:bg-[#494900] disabled:bg-[#c9c7b6] text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Execute Session Rollover</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                  Security Settings
                </h3>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none">
                      Two-Factor Authentication
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={twoFactorAuth}
                    onChange={(e) => setTwoFactorAuth(e.target.checked)}
                    className="h-5 w-9 cursor-pointer accent-primary"
                  />
                </div>
                <hr className="my-4 border-t border-border" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none">
                      Auto Backup
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Automatically backup data daily
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={autoBackup}
                    onChange={(e) => setAutoBackup(e.target.checked)}
                    className="h-5 w-9 rounded-full cursor-pointer accent-primary"
                  />
                </div>
                <hr className="my-4 border-t border-border" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none">
                      Session Timeout
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Auto-logout after inactivity
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={sessionTimeoutEnabled}
                    onChange={(e) => setSessionTimeoutEnabled(e.target.checked)}
                    className="h-5 w-9 cursor-pointer accent-primary"
                  />
                </div>
                <hr className="my-4 border-t border-border" />
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium leading-none"
                    htmlFor="sessionTimeout"
                  >
                    Session Timeout Duration
                  </label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    value={sessionTimeoutDuration}
                    onChange={(e) => setSessionTimeoutDuration(e.target.value)}
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold leading-none tracking-tight">
                  Data Management
                </h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium leading-none">
                      Export Data
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Download a copy of all your data
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleExportArchive}>
                    Export
                  </Button>
                </div>
                <hr className="my-4 border-t border-border" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-sm font-medium leading-none">
                      Data Retention Period
                    </label>
                    <p className="text-sm text-muted-foreground">
                      How long to keep deleted records
                    </p>
                  </div>
                  <select
                    className="w-full sm:w-52 h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                    value={retentionPeriod}
                    onChange={(e) => setRetentionPeriod(e.target.value)}
                  >
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveSettings}>Save Changes</Button>
      </div>

      {/* Session Rollover Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Annual Session Rollover"
        subtitle={`Session transition from ${currentSessionInput} to ${nextSessionInput}`}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isRollingOver}
              className="h-10 px-4 text-xs font-semibold rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteRollover}
              disabled={isRollingOver}
              className="h-10 px-5 text-xs font-semibold rounded-lg bg-[#616218] hover:bg-[#494900] disabled:bg-[#c9c7b6] text-white shadow-xs inline-flex items-center gap-2 cursor-pointer"
            >
              {isRollingOver ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Processing Rollover...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Execute Rollover</span>
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs text-[#1c1c14]">
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-900 block">
                Please Verify Promotion Summary
              </span>
              <p className="text-amber-800 leading-relaxed">
                Executing session rollover will immediately advance student
                class assignments into academic session{" "}
                <strong>{nextSessionInput}</strong>.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] space-y-2">
            <div className="flex justify-between py-1 border-b border-[#c9c7b6]/50">
              <span className="text-[#797869]">Target Academic Session:</span>
              <span className="font-bold text-[#1c1c14]">
                {nextSessionInput}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#c9c7b6]/50">
              <span className="text-[#797869]">Students to be Promoted:</span>
              <span className="font-bold text-emerald-800">
                {rolloverMetrics.promoted}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#c9c7b6]/50">
              <span className="text-[#797869]">Students Repeating Class:</span>
              <span className="font-bold text-amber-800">
                {rolloverMetrics.repeating}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#797869]">
                Graduating Students (Alumni):
              </span>
              <span className="font-bold text-purple-800">
                {rolloverMetrics.graduating}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#797869]">
            Note: All historical assessment records and past report cards are
            preserved in the database.
          </p>
        </div>
      </Modal>
    </div>
  );
}
