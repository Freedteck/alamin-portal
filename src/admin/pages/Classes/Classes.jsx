import React, { useState, useEffect } from 'react';
import {
  Trash2,
  CheckCircle2,
  Plus,
  AlertTriangle,
  BookOpen,
  Pencil,
  GraduationCap,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Modal } from '../../../shared/components/Modal/Modal';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import { ProfileAvatar } from '../../../shared/components/ProfileAvatar/ProfileAvatar';
import { Button } from '../../../shared/components/Button/Button';
import {
  schoolStore,
  SCHOOL_CLASSES,
  SSS_DEPARTMENTS,
  isSeniorClass,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';

export function ClassScheduling() {
  const [activeTab, setActiveTab] = useState('classes'); // 'classes' | 'teachers' | 'subjects'
  const [selectedClass, setSelectedClass] = useState(SCHOOL_CLASSES[0] || 'JSS 1');
  const [teachersList, setTeachersList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [studentListTotal, setStudentListTotal] = useState(0);
  const [subjectsList, setSubjectsList] = useState([]);
  const [classCounts, setClassCounts] = useState({});
  const [subjectCounts, setSubjectCounts] = useState({});
  const [enrollmentStudents, setEnrollmentStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignMode, setAssignMode] = useState('teacher');
  const [assignForm, setAssignForm] = useState({
    teacherId: '',
    class: SCHOOL_CLASSES[0] || 'JSS 1',
    subject: ''
  });

  const [enrollClassFilter, setEnrollClassFilter] = useState(SCHOOL_CLASSES[0] || 'JSS 1');
  const [enrollForm, setEnrollForm] = useState({
    studentId: '',
    subject: ''
  });

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    allClasses: true,
    classes: [...SCHOOL_CLASSES],
    allDepartments: true,
    departments: [...SSS_DEPARTMENTS]
  });
  const [subjectToDelete, setSubjectToDelete] = useState(null);

  const [notification, setNotification] = useState(null);
  const [allocToRemove, setAllocToRemove] = useState(null);
  const [rosterPage, setRosterPage] = useState(1);
  const [subjectsPage, setSubjectsPage] = useState(1);
  const rosterPageSize = 5;
  const subjectsPageSize = 6;

  const [classesList, setClassesList] = useState([]);
  const [classObjects, setClassObjects] = useState([]);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCategory, setNewClassCategory] = useState('Junior');
  const [addClassError, setAddClassError] = useState('');

  const [isClassTeacherModalOpen, setIsClassTeacherModalOpen] = useState(false);
  const [targetClassForTeacher, setTargetClassForTeacher] = useState('');
  const [selectedTeacherForClass, setSelectedTeacherForClass] = useState('');

  const availableClasses = classesList.length > 0 ? classesList : SCHOOL_CLASSES;

  const loadData = async () => {
    try {
      const [t, sub, overview] = await Promise.all([
        schoolStore.fetchTeachers({ page: 1, limit: 100 }),
        schoolStore.fetchSubjects(),
        schoolStore.fetchClassOverviewSummary()
      ]);
      if (t) setTeachersList(Array.isArray(t) ? t : (t.data || []));
      if (sub) setSubjectsList(sub);
      if (overview) {
        setClassesList(overview.classes.map((c) => c.name || c));
        setClassObjects(overview.classes);
        setClassCounts(overview.classCounts || {});
        setSubjectCounts(overview.subjectCounts || {});
      }
    } catch (error) {
      console.error('Failed to load class management data:', error);
      setTeachersList([]);
      setStudentsList([]);
      setSubjectsList([]);
      setClassesList([]);
      setClassObjects([]);
    }
  };

  const loadRoster = async () => {
    try {
      const result = await schoolStore.fetchStudents({
        class: selectedClass,
        page: rosterPage,
        limit: rosterPageSize
      });
      setStudentsList(Array.isArray(result) ? result : result?.data || []);
      setStudentListTotal(Array.isArray(result) ? result.length : result?.total || 0);
    } catch (error) {
      console.error('Failed to load class roster:', error);
      setStudentsList([]);
      setStudentListTotal(0);
    }
  };

  useEffect(() => {
    loadRoster();
    return subscribeSchoolSync(loadRoster);
  }, [selectedClass, rosterPage]);

  useEffect(() => {
    if (!isAssignModalOpen || assignMode !== 'student') return;
    let active = true;
    schoolStore.fetchStudents({
      class: enrollClassFilter,
      search: studentSearch,
      page: 1,
      limit: 100
    }).then((result) => {
      if (!active) return;
      const rows = Array.isArray(result) ? result : result?.data || [];
      setEnrollmentStudents(rows);
      setEnrollForm((current) => ({
        ...current,
        studentId: rows.some((student) => student.id === current.studentId)
          ? current.studentId
          : rows[0]?.id || ''
      }));
    }).catch((error) => {
      console.error('Failed to load students for class enrollment:', error);
      if (active) setEnrollmentStudents([]);
    });
    return () => { active = false; };
  }, [isAssignModalOpen, assignMode, enrollClassFilter, studentSearch]);

  const openAssignClassTeacherModal = (className, currentTeacherId = '') => {
    setTargetClassForTeacher(className);
    setSelectedTeacherForClass(currentTeacherId || '');
    setIsClassTeacherModalOpen(true);
  };

  const handleSaveClassTeacher = async (e) => {
    e.preventDefault();
    try {
      const res = await schoolStore.assignClassTeacher(targetClassForTeacher, selectedTeacherForClass || null);
      if (res?.error) {
        showNotification(res.error);
      } else {
        const tch = teachersList.find((t) => t.id === selectedTeacherForClass);
        showNotification(
          selectedTeacherForClass
            ? `Assigned ${tch?.name || 'teacher'} as Class Teacher for ${targetClassForTeacher}.`
            : `Unassigned Class Teacher for ${targetClassForTeacher}.`
        );
        setIsClassTeacherModalOpen(false);
        loadData();
      }
    } catch (err) {
      showNotification(err?.message || 'Failed to update Class Teacher.');
    }
  };

  const handleUnassignClassTeacher = async (className) => {
    try {
      const res = await schoolStore.assignClassTeacher(className, null);
      if (res?.error) {
        showNotification(res.error);
      } else {
        showNotification(`Unassigned Class Teacher for ${className}.`);
        loadData();
      }
    } catch (err) {
      showNotification(err?.message || 'Failed to unassign Class Teacher.');
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      setAddClassError('Please enter a class name.');
      return;
    }
    setAddClassError('');
    try {
      const res = await schoolStore.addClass({
        name: newClassName.trim(),
        category: newClassCategory
      });
      if (res?.error) {
        setAddClassError(res.error);
      } else {
        showNotification(`Class "${newClassName.trim()}" created successfully!`);
        setSelectedClass(newClassName.trim());
        setNewClassName('');
        setIsAddClassModalOpen(false);
        loadData();
      }
    } catch (err) {
      setAddClassError(err?.message || 'Failed to create class.');
    }
  };

  useEffect(() => {
    loadData();
    return subscribeSchoolSync(loadData);
  }, []);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const getSubjectsForClass = (className, department = '') =>
    subjectsList
      .filter((subject) =>
        subject.allClasses || (Array.isArray(subject.classes) && subject.classes.includes(className))
      )
      .filter((subject) =>
        !department || subject.allDepartments || !Array.isArray(subject.departments) ||
        subject.departments.includes(department)
      )
      .map((subject) => subject.name);
  const teacherAvailableSubjects = getSubjectsForClass(assignForm.class);
  const selectedEnrollStudent = enrollmentStudents.find((s) => s.id === enrollForm.studentId);
  const studentAvailableSubjects = getSubjectsForClass(
    selectedEnrollStudent?.class || enrollClassFilter,
    selectedEnrollStudent?.department || ''
  );

  const isSeniorOnlySelection =
    !subjectForm.allClasses &&
    subjectForm.classes.length > 0 &&
    subjectForm.classes.every((cls) => isSeniorClass(cls));

  const handleAssignTeacher = (e) => {
    e.preventDefault();
    if (!assignForm.teacherId || !assignForm.subject) return;

    schoolStore.assignTeacherClass(assignForm.teacherId, {
      class: assignForm.class,
      subject: assignForm.subject
    });
    loadData();
    setIsAssignModalOpen(false);
    showNotification(`Teacher assigned to ${assignForm.class} ${assignForm.subject}.`);
  };

  useEffect(() => {
    setRosterPage(1);
  }, [selectedClass]);

  useEffect(() => {
    setSubjectsPage(1);
  }, [subjectSearch]);

  const confirmRemoveTeacherClass = async () => {
    if (!allocToRemove) return;
    try {
      await schoolStore.removeTeacherClass(allocToRemove.teacherId, allocToRemove.classSubject);
      loadData();
      setAllocToRemove(null);
      showNotification('Allocation removed.');
    } catch (err) {
      showNotification(err?.message || 'Failed to remove allocation.');
    }
  };

  const handleEnrollStudent = (e) => {
    e.preventDefault();
    if (!enrollForm.studentId || !enrollForm.subject) return;

    schoolStore.addStudentToClassSubject(enrollForm.studentId, enrollForm.subject);
    loadData();
    setIsAssignModalOpen(false);
    showNotification('Student successfully added to class subject roster.');
  };

  const openAddSubjectModal = () => {
    setEditingSubject(null);
    setSubjectForm({
      name: '',
      allClasses: true,
      classes: [...availableClasses],
      allDepartments: true,
      departments: [...SSS_DEPARTMENTS]
    });
    setIsSubjectModalOpen(true);
  };

  const openEditSubjectModal = (sub) => {
    setEditingSubject(sub);
    setSubjectForm({
      name: sub.name,
      allClasses: !!sub.allClasses,
      classes: sub.allClasses ? [...availableClasses] : [...(sub.classes || [])],
      allDepartments: !!sub.allDepartments,
      departments: sub.allDepartments ? [...SSS_DEPARTMENTS] : [...(sub.departments || [])]
    });
    setIsSubjectModalOpen(true);
  };

  const toggleSubjectClass = (cls) => {
    setSubjectForm((prev) => {
      const exists = prev.classes.includes(cls);
      const nextClasses = exists
        ? prev.classes.filter((c) => c !== cls)
        : [...prev.classes, cls];
      return {
        ...prev,
        allClasses: nextClasses.length === availableClasses.length,
        classes: nextClasses
      };
    });
  };

  const toggleAllClasses = () => {
    setSubjectForm((prev) => {
      const nextAll = !prev.allClasses;
      return {
        ...prev,
        allClasses: nextAll,
        classes: nextAll ? [...availableClasses] : []
      };
    });
  };

  const toggleSubjectDepartment = (dept) => {
    setSubjectForm((prev) => {
      const exists = prev.departments.includes(dept);
      const nextDepts = exists
        ? prev.departments.filter((d) => d !== dept)
        : [...prev.departments, dept];
      return {
        ...prev,
        allDepartments: nextDepts.length === SSS_DEPARTMENTS.length,
        departments: nextDepts
      };
    });
  };

  const toggleAllDepartments = () => {
    setSubjectForm((prev) => {
      const nextAll = !prev.allDepartments;
      return {
        ...prev,
        allDepartments: nextAll,
        departments: nextAll ? [...SSS_DEPARTMENTS] : []
      };
    });
  };

  const handleSaveSubject = (e) => {
    e.preventDefault();
    const cleanName = subjectForm.name.trim();
    if (!cleanName) return;

    if (!subjectForm.allClasses && subjectForm.classes.length === 0) {
      showNotification('Please select at least one class or choose All Classes.');
      return;
    }

    if (isSeniorOnlySelection && !subjectForm.allDepartments && subjectForm.departments.length === 0) {
      showNotification('Please select at least one department or choose All Departments.');
      return;
    }

    const payload = {
      name: cleanName,
      allClasses: subjectForm.allClasses,
      classes: subjectForm.allClasses ? [...availableClasses] : subjectForm.classes,
      allDepartments: isSeniorOnlySelection ? subjectForm.allDepartments : true,
      departments: isSeniorOnlySelection
        ? (subjectForm.allDepartments ? [...SSS_DEPARTMENTS] : subjectForm.departments)
        : [...SSS_DEPARTMENTS]
    };

    if (editingSubject) {
      schoolStore.updateSubject(editingSubject.id, payload);
      showNotification(`Updated subject "${cleanName}".`);
    } else {
      schoolStore.addSubject(payload);
      showNotification(`Added subject "${cleanName}" to school catalog.`);
    }

    loadData();
    setIsSubjectModalOpen(false);
    setEditingSubject(null);
  };

  const confirmDeleteSubject = () => {
    if (!subjectToDelete) return;
    schoolStore.deleteSubject(subjectToDelete.id);
    loadData();
    showNotification(`Removed "${subjectToDelete?.name || ''}" from school catalog.`);
    setSubjectToDelete(null);
  };

  const classAllocations = (teachersList || []).flatMap((teacher) =>
    (teacher?.assignedClasses || [])
      .filter((ac) => ac && ac.class === selectedClass)
      .map((ac) => ({
        teacherId: teacher?.id,
        teacherName: teacher?.name || 'Staff',
        teacherEmail: teacher?.email || '',
        qualification: teacher?.qualification || '',
        subject: ac.subject,
        class: ac.class
      }))
  );

  const classStudents = studentsList || [];
  const paginatedRoster = classStudents;

  const currentClassObject = (classObjects || []).find((c) => c.name === selectedClass) || null;
  const currentClassTeacher =
    teachersList.find((t) => t.id === currentClassObject?.classTeacherId) ||
    teachersList.find((t) => Array.isArray(t.classTeacherOf) && t.classTeacherOf.includes(selectedClass)) ||
    null;

  const filteredSubjects = (subjectsList || []).filter((sub) => {
    if (!sub) return false;
    const subName = sub.name || String(sub || '');
    const term = (subjectSearch || '').toLowerCase();
    return (
      subName.toLowerCase().includes(term) ||
      (sub.classes || []).some((c) => String(c?.name || c || '').toLowerCase().includes(term))
    );
  });
  const paginatedSubjects = filteredSubjects.slice(
    (subjectsPage - 1) * subjectsPageSize,
    subjectsPage * subjectsPageSize
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Class Allocations & Subject Catalog
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Manage curriculum subjects, multi-subject teacher rosters, and student class enrollments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openAddSubjectModal}
            className="h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] text-[#1c1c14] text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-[#616218]" />
            <span>Add Subject</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const clsSubjects = getSubjectsForClass(selectedClass);
              const firstInClass = studentsList.find((s) => s.class === selectedClass);
              const stuSubjects = getSubjectsForClass(
                firstInClass?.class || selectedClass,
                firstInClass?.department || ''
              );
              setAssignMode('teacher');
              setAssignForm({
                teacherId: teachersList[0]?.id || '',
                class: selectedClass,
                subject: clsSubjects[0] || ''
              });
              setEnrollClassFilter(selectedClass);
              setStudentSearch('');
              setEnrollForm({
                studentId: firstInClass?.id || '',
                subject: stuSubjects[0] || clsSubjects[0] || ''
              });
              setIsAssignModalOpen(true);
            }}
            className="h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Assign to Class</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-[#c9c7b6]/60 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('classes')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'classes'
              ? 'border-[#616218] text-[#616218]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          View by Class
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('teachers')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'teachers'
              ? 'border-[#616218] text-[#616218]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          View by Teacher
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('subjects')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'subjects'
              ? 'border-[#616218] text-[#616218]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          Subject Catalog
        </button>
      </div>

      {activeTab === 'classes' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#797869] mr-1">Select Class:</span>
            {(classesList.length > 0 ? classesList : SCHOOL_CLASSES).map((cls) => {
              const isSelected = selectedClass === cls;
              const count = classCounts[cls] || 0;
              return (
                <button
                  type="button"
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#616218] text-white shadow-xs'
                      : 'bg-white text-[#48482d] border border-[#c9c7b6] hover:bg-[#faf8f0]'
                  }`}
                >
                  {cls}
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-sm text-[10px] ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-[#faf8f0] text-[#797869]'
                    }`}
                  >
                    {count} students
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setAddClassError('');
                setNewClassName('');
                setIsAddClassModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg text-xs font-bold text-[#616218] border border-dashed border-[#616218] bg-white hover:bg-[#faf8f0] inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Class</span>
            </button>
          </div>

          {/* Appointed Class Teacher Banner */}
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {currentClassTeacher ? (
                <ProfileAvatar name={currentClassTeacher.name} size="md" shape="rounded" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#faf8f0] border border-dashed border-[#c9c7b6] flex items-center justify-center text-[#797869]">
                  <GraduationCap className="w-5 h-5 text-[#616218]" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#797869]">
                    Appointed Class Teacher
                  </span>
                  <span
                    className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                      currentClassTeacher
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-[#faf8f0] text-stone-500 border border-[#c9c7b6]/60'
                    }`}
                  >
                    {currentClassTeacher ? 'Assigned' : 'Unassigned'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#1c1c14] mt-0.5">
                  {currentClassTeacher ? currentClassTeacher.name : `No Class Teacher for ${selectedClass}`}
                </h3>
                <p className="text-xs text-[#797869]">
                  {currentClassTeacher ? (
                    <>
                      Staff ID: <span className="font-mono text-[#616218] font-bold">{currentClassTeacher.staffId || '-'}</span> • {currentClassTeacher.qualification || 'Class Master'} • {currentClassTeacher.email}
                    </>
                  ) : (
                    `Assign an educator to take daily attendance registers and manage roll calls for ${selectedClass}.`
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {currentClassTeacher ? (
                <>
                  <button
                    type="button"
                    onClick={() => openAssignClassTeacherModal(selectedClass, currentClassTeacher.id)}
                    className="h-9 px-3 rounded-lg border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] text-[#1c1c14] text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#616218]" />
                    <span>Change Teacher</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnassignClassTeacher(selectedClass)}
                    className="h-9 px-3 rounded-lg border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Unassign</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => openAssignClassTeacherModal(selectedClass, '')}
                  className="h-9 px-3.5 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Class Teacher</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#c9c7b6]/50 mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#1c1c14]">
                    {selectedClass} Subject Allocations
                  </h2>
                  <p className="text-xs text-[#797869]">
                    Teachers assigned to curriculum subjects in Class {selectedClass}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#faf8f0] text-[#616218] border border-[#c9c7b6]">
                  {classAllocations.length} Active Subjects
                </span>
              </div>

              {classAllocations.length === 0 ? (
                <div className="py-8 text-center text-[#797869] text-xs">
                  No teachers have been assigned to {selectedClass} yet. Click "Assign to Class" above.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {classAllocations.map((alloc, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/70 hover:border-[#616218]/50 transition-colors relative group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-white text-[#494900] border border-[#c9c7b6]/60">
                            {alloc.subject}
                          </span>
                          <h3 className="font-bold text-sm text-[#1c1c14] pt-1">
                            {alloc.teacherName}
                          </h3>
                          <p className="text-[11px] text-[#797869]">{alloc.qualification}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setAllocToRemove({
                              teacherId: alloc.teacherId,
                              teacherName: alloc.teacherName,
                              classSubject: { class: alloc.class, subject: alloc.subject }
                            })
                          }
                          className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded transition-all cursor-pointer"
                          title="Remove allocation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#c9c7b6]/40 flex items-center justify-between text-[11px] text-[#797869]">
                        <span>Class: {alloc.class}</span>
                        <span className="font-medium text-[#616218]">
                          {subjectCounts[`${selectedClass}::${alloc.subject}`] || 0} Students Enrolled
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#c9c7b6]/50 mb-3">
                  <h2 className="text-base font-bold text-[#1c1c14]">
                    Class {selectedClass} Roster
                  </h2>
                  <span className="text-xs font-semibold text-[#616218]">
                    {studentListTotal} Students
                  </span>
                </div>

                <div className="overflow-x-auto">
                  {paginatedRoster.length === 0 ? (
                    <p className="text-xs text-[#797869] text-center py-6">
                      No students currently placed in {selectedClass}.
                    </p>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="text-[10px] font-bold uppercase tracking-wider text-[#797869] border-b border-[#c9c7b6]/40">
                        <tr>
                          <th className="py-2 pr-2">Adm. No</th>
                          <th className="py-2 px-2">Student Name</th>
                          <th className="py-2 pl-2 text-right">Subjects</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c9c7b6]/30">
                        {paginatedRoster.map((student) => (
                          <tr key={student.id}>
                            <td className="py-2.5 pr-2 font-mono font-bold text-[#616218]">
                              {student.admissionNumber}
                            </td>
                            <td className="py-2.5 px-2 font-semibold text-[#1c1c14]">
                              {student.name}
                            </td>
                            <td className="py-2.5 pl-2 text-right">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#faf8f0] text-[#494900] border border-[#c9c7b6]/60">
                                {student.enrolledSubjects?.length || 0}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <Pagination
                currentPage={rosterPage}
                totalItems={studentListTotal}
                pageSize={rosterPageSize}
                onPageChange={setRosterPage}
                itemLabel="students"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teachers' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#c9c7b6]/50 mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1c1c14]">
                  Teachers & Multi-Class Assignments
                </h2>
                <p className="text-xs text-[#797869]">
                  A single teacher can handle multiple subjects and classes across JSS and SSS levels.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#616218] bg-[#faf8f0] px-3 py-1.5 rounded-lg border border-[#c9c7b6]">
                {teachersList.length} Teachers Assigned
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teachersList.map((teacher) => (
                <div
                  key={teacher.id}
                  className="rounded-lg border border-[#c9c7b6] bg-[#faf8f0] p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-[#1c1c14]">{teacher.name}</h3>
                      <p className="text-xs text-[#797869]">{teacher.qualification}</p>
                      <p className="text-[11px] text-[#616218] mt-0.5">{teacher.email}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#e7e78f]/50 text-[#494900]">
                      {teacher.assignedClasses?.length || 0} Classes
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-[#797869] uppercase tracking-wider block">
                      Assigned Subjects & Classes
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {(teacher.assignedClasses || []).map((ac, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-white border border-[#c9c7b6] text-xs"
                        >
                          <span className="font-medium text-[#1c1c14] truncate">{ac.subject}</span>
                          <span className="font-bold text-[#616218] shrink-0 ml-2">{ac.class}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#c9c7b6]/50 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-[#797869] uppercase tracking-wider">
                      Class Teacher Role
                    </span>
                    {teacher.classTeacherOf && teacher.classTeacherOf.length > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#fdf9ec] text-[#616218] border border-[#c9c7b6]/70">
                        {teacher.classTeacherOf.join(', ')}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#797869] italic">None</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 w-full">
              <SearchInput
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                onClear={() => setSubjectSearch('')}
                placeholder="Search subjects by name or class..."
              />
            </div>
            <button
              type="button"
              onClick={openAddSubjectModal}
              className="h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subject</span>
            </button>
          </div>

          <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#c9c7b6]/50 mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1c1c14]">Registered School Subjects</h2>
                <p className="text-xs text-[#797869]">
                  Only subjects configured here appear during student admission and class allocations.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#616218] bg-[#faf8f0] px-3 py-1.5 rounded-lg border border-[#c9c7b6]">
                {subjectsList.length} Subjects
              </span>
            </div>

            <div className="overflow-x-auto border border-[#c9c7b6]/70 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#faf8f0] text-xs font-bold text-[#797869] border-b border-[#c9c7b6] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Subject Name</th>
                    <th className="py-3 px-4">Assigned Classes</th>
                    <th className="py-3 px-4">SSS Departments</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c9c7b6]/40">
                  {paginatedSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-[#797869]">
                        No subjects found matching your filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedSubjects.map((sub) => {
                      const seniorOnly =
                        !sub.allClasses &&
                        (sub.classes || []).length > 0 &&
                        (sub.classes || []).every((c) => isSeniorClass(c));
                      return (
                        <tr key={sub.id} className="hover:bg-[#faf8f0]/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-[#1c1c14]">{sub.name}</td>
                          <td className="py-3.5 px-4 text-xs">
                            {sub.allClasses ? (
                              <span className="px-2.5 py-0.5 rounded bg-[#f4f2e1] text-[#494900] border border-[#c9c7b6] font-semibold">
                                All Classes
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {(sub.classes || []).map((cls) => (
                                  <span
                                    key={cls}
                                    className="px-2 py-0.5 rounded bg-white text-[#1c1c14] border border-[#c9c7b6] font-medium text-[11px]"
                                  >
                                    {cls}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {!seniorOnly ? (
                              <span className="text-[#797869]">All Levels</span>
                            ) : sub.allDepartments ? (
                              <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                All Departments
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {(sub.departments || []).map((dept) => (
                                  <span
                                    key={dept}
                                    className="px-2 py-0.5 rounded bg-[#faf8f0] text-[#494900] border border-[#c9c7b6] font-semibold text-[11px]"
                                  >
                                    {dept}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <TableActions
                              actions={[
                                {
                                  label: 'Edit Subject',
                                  icon: Pencil,
                                  onClick: () => openEditSubjectModal(sub)
                                },
                                {
                                  label: 'Delete Subject',
                                  icon: Trash2,
                                  danger: true,
                                  onClick: () => setSubjectToDelete(sub)
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
              <Pagination
                currentPage={subjectsPage}
                totalItems={filteredSubjects.length}
                pageSize={subjectsPageSize}
                onPageChange={setSubjectsPage}
                itemLabel="subjects"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal to Add New Class */}
      <Modal
        isOpen={isAddClassModalOpen}
        onClose={() => setIsAddClassModalOpen(false)}
        title="Add New School Class"
      >
        <form onSubmit={handleCreateClass} className="space-y-4 font-['Poppins',sans-serif]">
          {addClassError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {addClassError}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Class Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Primary 1, JSS 1 Gold, SSS 1 Commercial"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1c1c14] mb-1.5">Category</label>
            <select
              value={newClassCategory}
              onChange={(e) => setNewClassCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
            >
              <option value="Junior">Junior Secondary</option>
              <option value="Senior">Senior Secondary</option>
              <option value="Primary">Primary</option>
              <option value="Pre-School">Pre-School / Nursery</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddClassModalOpen(false)}
              className="px-4 py-2 border border-[#c9c7b6] text-[#48482d] hover:bg-[#ece7d0] rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#616218] hover:bg-[#494900] text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              Create Class
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title={editingSubject ? 'Edit Subject' : 'Add Subject'}
        subtitle="Define which classes and SSS departments offer this subject"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsSubjectModalOpen(false)}
              className="h-10 px-4 text-xs font-semibold rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="subject-catalog-form"
              className="h-10 px-4 text-xs font-semibold rounded-lg bg-[#616218] hover:bg-[#494900] text-white shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              {editingSubject ? 'Save Changes' : 'Save Subject'}
            </button>
          </>
        }
      >
        <form id="subject-catalog-form" onSubmit={handleSaveSubject} className="space-y-5 text-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14]">Subject Name</label>
            <input
              type="text"
              required
              value={subjectForm.name}
              onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
              placeholder="e.g. Further Mathematics"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1c1c14]">Available Classes</label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#616218] cursor-pointer">
                <input
                  type="checkbox"
                  checked={subjectForm.allClasses}
                  onChange={toggleAllClasses}
                  className="w-4 h-4 accent-[#616218] cursor-pointer"
                />
                <span>All Classes</span>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]">
              {availableClasses.map((cls) => {
                const checked = subjectForm.allClasses || subjectForm.classes.includes(cls);
                return (
                  <label
                    key={cls}
                    className={`flex items-center gap-2 p-2 rounded-md border text-xs font-semibold cursor-pointer transition-colors ${
                      checked
                        ? 'bg-white border-[#616218] text-[#1c1c14]'
                        : 'bg-white/60 border-[#c9c7b6]/70 text-[#797869]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSubjectClass(cls)}
                      className="w-4 h-4 accent-[#616218] cursor-pointer"
                    />
                    <span>{cls}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {isSeniorOnlySelection && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#1c1c14]">SSS Departments</label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#616218] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subjectForm.allDepartments}
                    onChange={toggleAllDepartments}
                    className="w-4 h-4 accent-[#616218] cursor-pointer"
                  />
                  <span>All Departments</span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]">
                {SSS_DEPARTMENTS.map((dept) => {
                  const checked = subjectForm.allDepartments || subjectForm.departments.includes(dept);
                  return (
                    <label
                      key={dept}
                      className={`flex items-center gap-2 p-2 rounded-md border text-xs font-semibold cursor-pointer transition-colors ${
                        checked
                          ? 'bg-white border-[#616218] text-[#1c1c14]'
                          : 'bg-white/60 border-[#c9c7b6]/70 text-[#797869]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSubjectDepartment(dept)}
                        className="w-4 h-4 accent-[#616218] cursor-pointer"
                      />
                      <span>{dept}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign to Class"
        subtitle="Select whether to assign a teacher or add a student to a class subject"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="h-10 px-4 text-xs font-semibold rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={assignMode === 'teacher' ? 'assign-teacher-form' : 'enroll-student-class-form'}
              className="h-10 px-4 text-xs font-semibold rounded-lg bg-[#616218] hover:bg-[#494900] text-white shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              {assignMode === 'teacher' ? 'Confirm Assignment' : 'Enroll Student'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1c1c14] block">Assignment Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  assignMode === 'teacher'
                    ? 'border-[#616218] bg-[#faf8f0]'
                    : 'border-[#c9c7b6] bg-white hover:bg-[#faf8f0]/60'
                }`}
              >
                <input
                  type="radio"
                  name="assignMode"
                  value="teacher"
                  checked={assignMode === 'teacher'}
                  onChange={() => setAssignMode('teacher')}
                  className="accent-[#616218] w-4 h-4 shrink-0 cursor-pointer"
                />
                <span className="text-xs font-semibold text-[#1c1c14]">Assign Teacher to Class</span>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  assignMode === 'student'
                    ? 'border-[#616218] bg-[#faf8f0]'
                    : 'border-[#c9c7b6] bg-white hover:bg-[#faf8f0]/60'
                }`}
              >
                <input
                  type="radio"
                  name="assignMode"
                  value="student"
                  checked={assignMode === 'student'}
                  onChange={() => setAssignMode('student')}
                  className="accent-[#616218] w-4 h-4 shrink-0 cursor-pointer"
                />
                <span className="text-xs font-semibold text-[#1c1c14]">Add Student to Class Subject</span>
              </label>
            </div>
          </div>

          {assignMode === 'teacher' ? (
            <form id="assign-teacher-form" onSubmit={handleAssignTeacher} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]">Select Teacher</label>
                <select
                  required
                  value={assignForm.teacherId}
                  onChange={(e) => setAssignForm({ ...assignForm, teacherId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                >
                  {teachersList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">Class Level</label>
                  <select
                    value={assignForm.class}
                    onChange={(e) => {
                      const nextCls = e.target.value;
                      const validSubs = getSubjectsForClass(nextCls);
                      setAssignForm({
                        ...assignForm,
                        class: nextCls,
                        subject: validSubs.includes(assignForm.subject) ? assignForm.subject : (validSubs[0] || '')
                      });
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1c1c14]">Subject</label>
                  <select
                    required
                    value={assignForm.subject}
                    onChange={(e) => setAssignForm({ ...assignForm, subject: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    {teacherAvailableSubjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </form>
          ) : (
            <form id="enroll-student-class-form" onSubmit={handleEnrollStudent} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]">Class</label>
                <select
                  value={enrollClassFilter}
                  onChange={(e) => {
                    const nextCls = e.target.value;
                    setEnrollClassFilter(nextCls);
                    setStudentSearch('');
                    const subs = getSubjectsForClass(
                      nextCls,
                      ''
                    );
                    setEnrollForm({
                      studentId: '',
                      subject: subs[0] || ''
                    });
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]">Search student</label>
                <input
                  type="search"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search by name, email or admission number"
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]">Select Student</label>
                <select
                  required
                  value={enrollForm.studentId}
                  onChange={(e) => {
                    const stuId = e.target.value;
                    const stu = enrollmentStudents.find((s) => s.id === stuId);
                    const subs = getSubjectsForClass(
                      stu?.class || enrollClassFilter,
                      stu?.department || ''
                    );
                    setEnrollForm({
                      studentId: stuId,
                      subject: subs.includes(enrollForm.subject) ? enrollForm.subject : (subs[0] || '')
                    });
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                >
                  {enrollmentStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              {selectedEnrollStudent && (
                <div className="p-2.5 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/60 text-xs flex items-center justify-between">
                  <span className="text-[#797869]">Admission Number</span>
                  <span className="font-mono font-bold text-[#616218]">
                    {selectedEnrollStudent.admissionNumber}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c14]">Target Subject</label>
                <select
                  required
                  value={enrollForm.subject}
                  onChange={(e) => setEnrollForm({ ...enrollForm, subject: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                >
                  {studentAvailableSubjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!allocToRemove}
        onClose={() => setAllocToRemove(null)}
        variant="confirm"
        title="Remove Teaching Allocation"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAllocToRemove(null)}
              className="h-10 px-4 text-xs font-semibold rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRemoveTeacherClass}
              className="h-10 px-4 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              Remove Allocation
            </button>
          </>
        }
      >
        {allocToRemove && (
          <div className="flex items-start gap-3 text-xs text-[#44443b] leading-relaxed">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[#1c1c14] mb-1">
                Remove {allocToRemove?.classSubject?.subject || ''} from {allocToRemove?.classSubject?.class || ''}?
              </p>
              <p>
                {allocToRemove?.teacherName || 'Staff'} will no longer be assigned to teach this subject for {allocToRemove?.classSubject?.class || ''}.
              </p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!subjectToDelete}
        onClose={() => setSubjectToDelete(null)}
        variant="confirm"
        title="Remove Subject from Catalog"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSubjectToDelete(null)}
              className="h-10 px-4 text-xs font-semibold rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteSubject}
              className="h-10 px-4 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              Delete Subject
            </button>
          </>
        }
      >
        {subjectToDelete && (
          <div className="flex items-start gap-3 text-xs text-[#44443b] leading-relaxed">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[#1c1c14] mb-1">
                Delete "{subjectToDelete?.name || 'Subject'}"?
              </p>
              <p>
                This subject will no longer appear in admission enrollments or new class allocations.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Class Teacher Modal */}
      <Modal
        isOpen={isClassTeacherModalOpen}
        onClose={() => setIsClassTeacherModalOpen(false)}
        title={`Appoint Class Teacher for ${targetClassForTeacher}`}
        subtitle="Only the appointed Class Teacher can mark student morning roll call registers."
      >
        <form onSubmit={handleSaveClassTeacher} className="space-y-4 font-['Poppins',sans-serif]">
          <div>
            <label className="text-xs font-bold text-[#1c1c14] block mb-1.5">
              Select Educator
            </label>
            <select
              value={selectedTeacherForClass}
              onChange={(e) => setSelectedTeacherForClass(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              <option value="">-- Leave Unassigned --</option>
              {teachersList.map((t) => {
                const already = Array.isArray(t.classTeacherOf) && t.classTeacherOf.length > 0;
                const note = already ? ` (Class Teacher of: ${t.classTeacherOf.join(', ')})` : '';
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} • {t.staffId || 'Staff'}{note}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-[#797869] mt-1.5 leading-relaxed">
              * Note: A teacher can be assigned as the Class Teacher of multiple classes, but each class can only have one Class Teacher.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#c9c7b6]/40">
            <button
              type="button"
              onClick={() => setIsClassTeacherModalOpen(false)}
              className="h-9 px-4 text-xs font-semibold rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 text-xs font-semibold rounded-lg bg-[#616218] hover:bg-[#494900] text-white shadow-xs cursor-pointer"
            >
              Save Appointment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ClassScheduling;
