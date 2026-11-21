import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { ProfileAvatar } from '../../../shared/components/ProfileAvatar/ProfileAvatar';
import {
  UserPlus,
  Eye,
  EyeOff,
  Layers,
  CheckCircle2,
  Trash2,
  Plus,
  KeyRound,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { schoolData, schoolStore, SCHOOL_CLASSES, subscribeSchoolSync } from '../../../shared/data/schoolData';

export function TeacherManagement() {
  const [teachers, setTeachers] = useState([]);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [teacherStats, setTeacherStats] = useState({
    totalTeachers: 0,
    activeTeachers: 0,
    totalAllocations: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [allocationTeacher, setAllocationTeacher] = useState(null);
  const [allocClass, setAllocClass] = useState('SSS 1');
  const [allocSubject, setAllocSubject] = useState('Mathematics');

  const [newTeacher, setNewTeacher] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    qualification: '',
    primarySubject: 'Mathematics',
    primaryClass: 'SSS 1',
    portalPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [createdTeacherCreds, setCreatedTeacherCreds] = useState(null);

  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingCreds, setIsResettingCreds] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  const [subjectNames, setSubjectNames] = useState([]);
  const [subjectCatalog, setSubjectCatalog] = useState([]);
  const [classNames, setClassNames] = useState(SCHOOL_CLASSES);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedSubject, selectedClass, pageSize]);

  const loadTeachers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, subjectResult, classResult] = await Promise.all([
        schoolStore.fetchTeachers({
          page: currentPage,
          limit: pageSize,
          search: debouncedSearch,
          class: selectedClass,
          subject: selectedSubject
        }),
        schoolStore.fetchSubjects(),
        schoolStore.fetchClasses()
      ]);
      if (res && res.data) {
        setTeachers(res.data);
        setTotalTeachers(res.total || 0);
        if (res.stats) {
          setTeacherStats(res.stats);
        }
      } else if (Array.isArray(res)) {
        setTeachers(res);
        setTotalTeachers(res.length);
      }
      const availableSubjects = Array.isArray(subjectResult) ? subjectResult : [];
      setSubjectCatalog(availableSubjects);
      setSubjectNames(availableSubjects.map((subject) => subject.name));
      if (Array.isArray(classResult)) {
        setClassNames(classResult.map((item) => item.name || item));
      }
    } catch (err) {
      console.error('Failed to load teachers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, selectedClass, selectedSubject]);

  const getSubjectsForClass = (className) =>
    subjectCatalog
      .filter((subject) =>
        subject.allClasses || (Array.isArray(subject.classes) && subject.classes.includes(className))
      )
      .map((subject) => subject.name);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    return subscribeSchoolSync((topic) => {
      if (topic === 'teachers' || topic === 'subjects' || topic === 'classes' || !topic) {
        loadTeachers();
      }
    });
  }, [loadTeachers]);

  const handleCopy = (value, label) => {
    if (!value || !navigator?.clipboard) return;
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(''), 1800);
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!newTeacher.firstName.trim() || !newTeacher.lastName.trim()) {
      setAddError('First name and surname (last name) are required.');
      return;
    }
    if (!newTeacher.email.trim()) {
      setAddError('School email is required.');
      return;
    }
    const trimmedPass = newTeacher.portalPassword.trim();
    if (trimmedPass && trimmedPass.length < 6) {
      setAddError('Initial portal password must be at least 6 characters (or leave blank to auto-generate).');
      return;
    }

    const fullName = `${newTeacher.firstName.trim()} ${newTeacher.lastName.trim()}`.trim();

    const teacherObj = {
      name: fullName,
      email: newTeacher.email.trim().toLowerCase(),
      phone: newTeacher.phone.trim() || '-',
      qualification: newTeacher.qualification.trim() || '-',
      status: 'active',
      assignedClasses: [
        { class: newTeacher.primaryClass, subject: newTeacher.primarySubject }
      ],
      ...(trimmedPass ? { portalPassword: trimmedPass } : {})
    };

    setIsSubmitting(true);
    try {
      const created = await schoolStore.createTeacherAsync(teacherObj);
      loadTeachers();
      setIsAddDialogOpen(false);
      setNewTeacher({
        title: 'Mr.',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        qualification: '',
        primarySubject: 'Mathematics',
        primaryClass: 'SSS 1',
        portalPassword: ''
      });
      setShowNewPassword(false);
      if (created?.portalCredentials) {
        setCreatedTeacherCreds({
          name: created.name || created.teacher?.name || fullName,
          staffId: created.staffId || created.teacher?.staffId || '',
          email: created.portalCredentials.email,
          temporaryPassword: created.portalCredentials.temporaryPassword
        });
      }
    } catch (err) {
      setAddError(err?.message || 'Unable to create teacher account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetTeacherPassword = async (e) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    const trimmed = resetPasswordInput.trim();
    if (trimmed && trimmed.length < 6) {
      setResetResult({ error: 'Password must be at least 6 characters (or leave blank to auto-generate).' });
      return;
    }
    setIsResettingCreds(true);
    setResetResult(null);
    try {
      const result = await schoolStore.resetTeacherCredentials(selectedTeacher.id, {
        ...(trimmed ? { password: trimmed } : {})
      });
      setResetResult({ credentials: result.credentials });
      setResetPasswordInput('');
    } catch (err) {
      setResetResult({ error: err?.message || 'Failed to update portal credentials.' });
    } finally {
      setIsResettingCreds(false);
    }
  };

  const handleAssignClassSubject = async (e) => {
    e.preventDefault();
    if (!allocationTeacher) return;
    await schoolData.assignTeacherClass(allocationTeacher.id, {
      class: allocClass,
      subject: allocSubject
    });
    await loadTeachers();
    const updated = await schoolStore.fetchTeacherById(allocationTeacher.id);
    setAllocationTeacher(updated);
    if (selectedTeacher && selectedTeacher.id === allocationTeacher.id) {
      setSelectedTeacher(updated);
    }
  };

  const handleRemoveAllocation = async (teacherId, classSubject) => {
    try {
      await schoolData.removeTeacherClass(teacherId, classSubject);
      await loadTeachers();
      const updated = await schoolStore.fetchTeacherById(teacherId);
      if (allocationTeacher && allocationTeacher.id === teacherId) {
        setAllocationTeacher(updated);
      }
      if (selectedTeacher && selectedTeacher.id === teacherId) {
        setSelectedTeacher(updated);
      }
    } catch {
      // Error handled by optimistic state and notification
    }
  };

  const handleToggleClassTeacherRole = async (teacherId, className) => {
    const t = teachers.find((tch) => tch.id === teacherId);
    const current = t?.classTeacherOf || [];
    const isAlready = current.includes(className);
    try {
      await schoolStore.assignClassTeacher(className, isAlready ? null : teacherId);
      await loadTeachers();
      const updated = await schoolStore.fetchTeacherById(teacherId);
      if (selectedTeacher && selectedTeacher.id === teacherId) {
        setSelectedTeacher(updated);
      }
    } catch {
      // Error handled
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Teachers & Staff
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Manage teachers, Staff IDs, and subject assignments across JSS 1 to SSS 3
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/admin/classes">
            <Button variant="outline">
              <Layers className="w-4 h-4" />
              <span>Class Allocations</span>
            </Button>
          </Link>
          <Button
            onClick={() => {
              setAddError('');
              setIsAddDialogOpen(true);
            }}
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Teacher</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">Total Teachers</span>
          <div className="text-2xl font-bold text-[#1c1c14] tabular-nums mt-1">{teacherStats.totalTeachers}</div>
          <span className="text-[11px] text-[#616218] font-medium">Secondary School Teachers</span>
        </div>
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">Active Staff</span>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
            {teacherStats.activeTeachers}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Currently teaching</span>
        </div>
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">Class Allocations</span>
          <div className="text-2xl font-bold text-[#494900] tabular-nums mt-1">
            {teacherStats.totalAllocations}
          </div>
          <span className="text-[11px] text-[#797869]">Subject-class pairings</span>
        </div>
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">Classes per Teacher</span>
          <div className="text-2xl font-bold text-[#1c1c14] tabular-nums mt-1">
            {teacherStats.totalTeachers > 0 ? (teacherStats.totalAllocations / teacherStats.totalTeachers).toFixed(1) : 0}
          </div>
          <span className="text-[11px] text-[#797869]">Average teaching load</span>
        </div>
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search teachers by name, Staff ID, or email..."
              onClear={() => setSearchTerm('')}
            />
          </div>
          <div className="w-full sm:w-44 shrink-0">
            <select
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="all">All Classes</option>
              {classNames.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-56 shrink-0">
            <select
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="all">All Subjects</option>
              {subjectNames.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#c9c7b6]/40">
          <div>
            <h2 className="text-base font-bold text-[#1c1c14]">
              Teachers Directory
            </h2>
            <p className="text-xs text-[#797869]">
              Inspect qualifications and manage subject allocations across classes
            </p>
          </div>
          <span className="text-xs font-semibold text-[#616218]">
            {filteredTeachers.length} Staff
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-[#c9c7b6]/60 bg-[#fdf9ec] text-xs font-bold text-[#494900] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-5">Staff ID</th>
                <th className="py-3 px-4">Teacher Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-center">Assigned Subjects</th>
                <th className="py-3 px-4 text-center">Class Teacher</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9c7b6]/40">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-[#797869]">
                    Loading teachers...
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-[#797869]">
                    No teachers found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                teachers.map((teacher) => {
                  const assigned = teacher.assignedClasses || [];
                  const classTeacherList = teacher.classTeacherOf || [];
                  return (
                    <tr key={teacher.id} className="hover:bg-[#fbf8ed] transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs font-bold text-[#616218]">
                        {teacher.staffId || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <ProfileAvatar name={teacher.name} size="sm" shape="rounded" />
                          <span className="font-semibold text-[#1c1c14]">{teacher.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#797869]">
                        {teacher.email}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#f4f0db] text-[#494900]">
                          {assigned.length} {assigned.length === 1 ? 'subject' : 'subjects'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {classTeacherList.length > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fdf9ec] text-[#616218] border border-[#c9c7b6]/80">
                            {classTeacherList.join(', ')}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <TableActions
                          actions={[
                            {
                              label: 'View Teacher Profile',
                              icon: Eye,
                              onClick: () => {
                                setResetResult(null);
                                setResetPasswordInput('');
                                setSelectedTeacher(teacher);
                              }
                            },
                            {
                              label: 'Assign Class & Subject',
                              icon: Plus,
                              onClick: () => setAllocationTeacher(teacher)
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={totalTeachers}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="teachers"
        />
      </div>

      <Modal
        isOpen={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false);
          setAddError('');
        }}
        title="Add New Teacher"
        subtitle="Create a staff profile, assign a class & subject, and provision portal login credentials."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setAddError('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-teacher-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Provisioning Account...' : 'Save Teacher'}
            </Button>
          </>
        }
      >
        <form id="add-teacher-form" onSubmit={handleAddTeacher} className="space-y-5 font-['Poppins',sans-serif]">
          {addError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{addError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]" htmlFor="t-fname">
                  First Name *
                </label>
                <input
                  required
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  id="t-fname"
                  value={newTeacher.firstName}
                  onChange={(e) => setNewTeacher({ ...newTeacher, firstName: e.target.value })}
                  placeholder="e.g. Ibrahim"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]" htmlFor="t-lname">
                  Surname (Last Name) *
                </label>
                <input
                  required
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  id="t-lname"
                  value={newTeacher.lastName}
                  onChange={(e) => setNewTeacher({ ...newTeacher, lastName: e.target.value })}
                  placeholder="e.g. Musa"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]" htmlFor="t-email">
                  School Email *
                </label>
                <input
                  required
                  type="email"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  id="t-email"
                  value={newTeacher.email}
                  onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                  placeholder="teacher@alamin.sch.ng"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]" htmlFor="t-phone">
                  Phone Number
                </label>
                <input
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  id="t-phone"
                  value={newTeacher.phone}
                  onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                  placeholder="+234 803 123 4567"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14]" htmlFor="t-qual">
                Teaching Qualification
              </label>
              <input
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                id="t-qual"
                value={newTeacher.qualification}
                onChange={(e) => setNewTeacher({ ...newTeacher, qualification: e.target.value })}
                placeholder="B.Sc. Ed Mathematics, TRCN Certified"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]" htmlFor="t-primary-class">
                  Initial Class Assignment
                </label>
                <select
                  id="t-primary-class"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  value={newTeacher.primaryClass}
                  onChange={(e) => {
                    const cls = e.target.value;
                    const classSubs = getSubjectsForClass(cls);
                    setNewTeacher({
                      ...newTeacher,
                      primaryClass: cls,
                      primarySubject: classSubs.includes(newTeacher.primarySubject)
                        ? newTeacher.primarySubject
                        : (classSubs[0] || '')
                    });
                  }}
                >
                  {classNames.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]" htmlFor="t-primary-sub">
                  Initial Subject Assignment
                </label>
                <select
                  id="t-primary-sub"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  value={newTeacher.primarySubject}
                  onChange={(e) => setNewTeacher({ ...newTeacher, primarySubject: e.target.value })}
                >
                  {getSubjectsForClass(newTeacher.primaryClass).map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-[#c9c7b6]/40">
              <label className="text-xs font-semibold text-[#1c1c14]" htmlFor="t-portal-password">
                Initial Portal Password (Optional)
              </label>
              <div className="relative">
                <input
                  id="t-portal-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newTeacher.portalPassword}
                  onChange={(e) => setNewTeacher({ ...newTeacher, portalPassword: e.target.value })}
                  placeholder="Leave blank to auto-generate (min 6 characters)"
                  className="w-full h-10 pl-3 pr-10 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#797869] hover:text-[#1c1c14] cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#797869]">
                Teachers cannot self-register. Their login credentials will be displayed right after saving.
              </p>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!allocationTeacher}
        onClose={() => setAllocationTeacher(null)}
        title="Class Allocations"
        subtitle={allocationTeacher ? (allocationTeacher.name || '') : ''}
        size="md"
        footer={
          <Button
            variant="outline"
            onClick={() => setAllocationTeacher(null)}
          >
            Done
          </Button>
        }
      >
        {allocationTeacher && (
          <div className="space-y-6 font-['Poppins',sans-serif]">
            <p className="text-xs text-[#797869] leading-relaxed">
              Assign a teacher to teach multiple classes and subjects across Al-Amin Group of Schools.
            </p>

            <form onSubmit={handleAssignClassSubject} className="p-4 bg-[#fdf9ec] rounded-xl border border-[#c9c7b6]/60 space-y-4">
              <div className="text-xs font-bold text-[#494900] uppercase tracking-wider">
                Assign Class & Subject
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#1c1c14]">Target Class</label>
                  <select
                    value={allocClass}
                    onChange={(e) => {
                      const cls = e.target.value;
                      setAllocClass(cls);
                      const subs = getSubjectsForClass(cls);
                      if (!subs.includes(allocSubject)) {
                        setAllocSubject(subs[0] || '');
                      }
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    {classNames.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#1c1c14]">Subject</label>
                  <select
                    value={allocSubject}
                    onChange={(e) => setAllocSubject(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    {getSubjectsForClass(allocClass).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button type="submit">
                  <Plus className="w-4 h-4" />
                  <span>Add Allocation</span>
                </Button>
              </div>
            </form>

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-[#1c1c14] uppercase tracking-wider">
                Current Allocations
              </h4>
              <div className="space-y-2">
                {(allocationTeacher.assignedClasses || []).map((alloc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#c9c7b6]/60 bg-white hover:bg-[#fbf8ed] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#616218] text-white">
                        {alloc.class}
                      </span>
                      <span className="text-xs font-semibold text-[#1c1c14]">
                        {alloc.subject}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAllocation(allocationTeacher.id, alloc)}
                      className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove class allocation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
        title="Teacher Profile"
        subtitle={selectedTeacher ? (selectedTeacher.name || '') : ''}
        size="md"
        footer={
          selectedTeacher && (
            <>
              <Button
                variant="outline"
                onClick={() => setSelectedTeacher(null)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  const t = selectedTeacher;
                  setSelectedTeacher(null);
                  setAllocationTeacher(t);
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Manage Allocations</span>
              </Button>
            </>
          )
        }
      >
        {selectedTeacher && (
          <div className="space-y-6 font-['Poppins',sans-serif]">
            <div className="flex items-center gap-4 p-4 bg-[#fdf9ec] rounded-xl border border-[#c9c7b6]/70">
              <ProfileAvatar name={selectedTeacher.name || 'Teacher'} size="lg" shape="rounded" />
              <div>
                <h3 className="text-base font-bold text-[#1c1c14]">{selectedTeacher.name || 'Teacher Profile'}</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 mt-1">
                  Active Staff
                </span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-3 p-4 rounded-xl border border-[#c9c7b6]/60 bg-white">
                <h4 className="font-bold border-b border-[#c9c7b6]/40 pb-2 uppercase tracking-wider text-[11px] text-[#616218]">
                  Staff Identity & Contact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#797869] block">Staff ID</span>
                    <span className="font-mono font-bold text-[#616218]">
                      {selectedTeacher.staffId || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Qualification</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedTeacher.qualification || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Phone Number</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedTeacher.phone || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Email Address</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedTeacher.email || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-xl border border-[#c9c7b6]/60 bg-white">
                <h4 className="font-bold text-[#616218] uppercase tracking-wider text-[11px] border-b border-[#c9c7b6]/40 pb-2">
                  Assigned Classes & Subjects
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(selectedTeacher.assignedClasses || []).map((alloc, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-[#c9c7b6]/60 bg-[#fdf9ec] flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-[#494900] block">{alloc.class}</span>
                        <span className="text-xs text-[#1c1c14] font-medium">{alloc.subject}</span>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-[#616218]" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-xl border border-[#c9c7b6]/60 bg-white">
                <div className="flex items-center justify-between border-b border-[#c9c7b6]/40 pb-2">
                  <h4 className="font-bold text-[#616218] uppercase tracking-wider text-[11px]">
                    Class Teacher Appointments
                  </h4>
                  <span className="text-[11px] font-semibold text-[#797869]">
                    {(selectedTeacher.classTeacherOf || []).length} Classes
                  </span>
                </div>
                <p className="text-[11px] text-[#797869]">
                  Appoint this teacher as the Class Teacher for specific classrooms:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {classNames.map((cls) => {
                    const isAssigned = (selectedTeacher.classTeacherOf || []).includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => handleToggleClassTeacherRole(selectedTeacher.id, cls)}
                        className={`px-3 py-2 rounded-lg border text-xs font-bold text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isAssigned
                            ? 'bg-[#616218] text-white border-[#616218]'
                            : 'bg-white text-[#1c1c14] border-[#c9c7b6] hover:bg-[#faf8f0]'
                        }`}
                      >
                        <span>{cls}</span>
                        {isAssigned ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-[#797869]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleResetTeacherPassword} className="space-y-3 p-4 rounded-xl border border-[#c9c7b6]/60 bg-[#fdf9ec]">
                <div className="flex items-center gap-2 border-b border-[#c9c7b6]/40 pb-2">
                  <KeyRound className="w-4 h-4 text-[#616218]" />
                  <h4 className="font-bold text-[#616218] uppercase tracking-wider text-[11px]">
                    Portal Access & Password Reset
                  </h4>
                </div>
                <p className="text-[11px] text-[#797869]">
                  Teacher can sign in with <strong>{selectedTeacher.email}</strong> or Staff ID{' '}
                  <strong className="font-mono">{selectedTeacher.staffId}</strong>.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetPasswordInput}
                      onChange={(e) => setResetPasswordInput(e.target.value)}
                      placeholder="New password (leave blank to auto-generate)"
                      className="w-full h-9 pl-3 pr-9 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-xs focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#797869] hover:text-[#1c1c14] cursor-pointer"
                    >
                      {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <Button type="submit" disabled={isResettingCreds}>
                    {isResettingCreds ? 'Updating...' : 'Reset Password'}
                  </Button>
                </div>

                {resetResult?.error && (
                  <p className="text-[11px] text-rose-700 font-medium">{resetResult.error}</p>
                )}

                {resetResult?.credentials && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Updated Login Credentials
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Email: <strong>{resetResult.credentials.email}</strong></span>
                      <button
                        type="button"
                        onClick={() => handleCopy(resetResult.credentials.email, 'reset-email')}
                        className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'reset-email' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Temporary Password: <strong className="font-mono">{resetResult.credentials.temporaryPassword}</strong></span>
                      <button
                        type="button"
                        onClick={() => handleCopy(resetResult.credentials.temporaryPassword, 'reset-pass')}
                        className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'reset-pass' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!createdTeacherCreds}
        onClose={() => setCreatedTeacherCreds(null)}
        title="Teacher Account Provisioned"
        subtitle={createdTeacherCreds ? `${createdTeacherCreds.name || ''} (${createdTeacherCreds.staffId || ''})` : ''}
        size="md"
        footer={
          <Button onClick={() => setCreatedTeacherCreds(null)}>
            Done
          </Button>
        }
      >
        {createdTeacherCreds && (
          <div className="space-y-4 font-['Poppins',sans-serif] text-xs">
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p>
                Share these login details with the teacher. They can sign in using either their{' '}
                <strong>School Email</strong> or <strong>Staff ID</strong>.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-[#c9c7b6] bg-[#fdf9ec] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[#797869] block text-[11px]">Staff ID</span>
                  <span className="font-mono font-bold text-sm text-[#616218]">{createdTeacherCreds.staffId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(createdTeacherCreds.staffId, 'cred-staffid')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] cursor-pointer"
                >
                  {copiedField === 'cred-staffid' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'cred-staffid' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[#797869] block text-[11px]">Login Email</span>
                  <span className="font-semibold text-sm text-[#1c1c14]">{createdTeacherCreds.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(createdTeacherCreds.email, 'cred-email')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] cursor-pointer"
                >
                  {copiedField === 'cred-email' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'cred-email' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[#797869] block text-[11px]">Temporary Password</span>
                  <span className="font-mono font-bold text-sm text-[#1c1c14]">{createdTeacherCreds.temporaryPassword}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(createdTeacherCreds.temporaryPassword, 'cred-pass')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] cursor-pointer"
                >
                  {copiedField === 'cred-pass' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'cred-pass' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TeacherManagement;
