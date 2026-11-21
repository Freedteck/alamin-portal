import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import {
  schoolStore,
  SCHOOL_CLASSES,
  ACADEMIC_SESSIONS,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';

export function RecordGrades() {
  const [selectedSession, setSelectedSession] = useState(ACADEMIC_SESSIONS[0]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Mathematics');
  const [selectedTerm, setSelectedTerm] = useState('Term1');
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [students, setStudents] = useState([]);
  const [gradesInput, setGradesInput] = useState({});
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [syncTick, setSyncTick] = useState(0);

  useEffect(() => {
    return subscribeSchoolSync(() => setSyncTick((t) => t + 1));
  }, []);

  useEffect(() => {
    let active = true;
    schoolStore.fetchCurrentTeacher().then((teacher) => {
      if (!active) return;
      setCurrentTeacher(teacher);
      const firstAssignment = teacher?.assignedClasses?.[0];
      setSelectedClass(firstAssignment?.class || SCHOOL_CLASSES[0] || 'JSS 1');
      setSelectedSubject(firstAssignment?.subject || 'Mathematics');
    }).catch((error) => {
      console.error('Failed to load current teacher:', error);
      if (active) {
        setCurrentTeacher(null);
        setSelectedClass(SCHOOL_CLASSES[0] || 'JSS 1');
      }
    });
    return () => { active = false; };
  }, [syncTick]);

  const teacherClasses = currentTeacher?.assignedClasses?.length
    ? [...new Set(currentTeacher.assignedClasses.map((assignment) => assignment.class))]
    : SCHOOL_CLASSES;
  const teacherSubjects = [...new Set(
    (currentTeacher?.assignedClasses || [])
      .filter((assignment) => assignment.class === selectedClass)
      .map((assignment) => assignment.subject)
      .filter(Boolean)
  )];

  useEffect(() => {
    if (teacherClasses.length > 0 && !teacherClasses.includes(selectedClass)) {
      setSelectedClass(teacherClasses[0]);
    }
  }, [teacherClasses]);

  useEffect(() => {
    if (teacherSubjects.length > 0 && !teacherSubjects.includes(selectedSubject)) {
      setSelectedSubject(teacherSubjects[0]);
    }
  }, [selectedClass, teacherSubjects.length]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClass, selectedSubject, selectedTerm, selectedSession]);

  useEffect(() => {
    let active = true;
    const loadClassGrades = async () => {
      try {
        const [stuRes, gradesRes] = await Promise.all([
          schoolStore.fetchStudents({ class: selectedClass, subject: selectedSubject }),
          schoolStore.fetchGrades()
        ]);
        if (!active) return;
        const allStudents = Array.isArray(stuRes) ? stuRes : (stuRes?.data || []);
        setStudents(allStudents);

        const existing = {};
        allStudents.forEach((student) => {
          const sessionKey = `${student.id}_${selectedSession}_${selectedTerm}_${selectedSubject}`;
          const legacyKey = `${student.id}_${selectedTerm}_${selectedSubject}`;
          const record = gradesRes?.[sessionKey] || gradesRes?.[legacyKey] ||
            gradesRes?.[student.id]?.[selectedSubject];
          if (record && record.isRecorded) {
            existing[student.id] = {
              ca1: record.ca1,
              ca2: record.ca2,
              exam: record.exam,
              remark: record.remark
            };
          } else {
            existing[student.id] = {
              ca1: 0,
              ca2: 0,
              exam: 0,
              remark: ''
            };
          }
        });
        setGradesInput(existing);
      } catch (error) {
        console.error('Failed to load students and grades:', error);
        setStudents([]);
        setGradesInput({});
      }
    };
    loadClassGrades();
    return () => { active = false; };
  }, [selectedClass, selectedSubject, selectedTerm, selectedSession, syncTick]);

  const handleScoreChange = (studentId, field, value) => {
    const num = Math.max(0, Number(value) || 0);
    setGradesInput((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: num
      }
    }));
  };

  const handleRemarkChange = (studentId, value) => {
    setGradesInput((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remark: value
      }
    }));
  };

  const calculateTotalAndGrade = (scores) => {
    const ca1 = Math.min(20, Number(scores?.ca1 || 0));
    const ca2 = Math.min(20, Number(scores?.ca2 || 0));
    const exam = Math.min(60, Number(scores?.exam || 0));
    const total = ca1 + ca2 + exam;

    let grade = 'F';
    let badge = 'bg-red-100 text-red-800';
    if (total >= 75) {
      grade = 'A';
      badge = 'bg-emerald-100 text-emerald-800';
    } else if (total >= 65) {
      grade = 'B';
      badge = 'bg-blue-100 text-blue-800';
    } else if (total >= 50) {
      grade = 'C';
      badge = 'bg-amber-100 text-amber-800';
    } else if (total >= 40) {
      grade = 'D';
      badge = 'bg-orange-100 text-orange-800';
    }

    return { total, grade, badge };
  };

  const handleSaveGrades = () => {
    students.forEach((student) => {
      const entry = gradesInput[student.id];
      if (entry) {
        schoolStore.saveGrade(student.id, selectedTerm, selectedSubject, entry, selectedSession);
      }
    });
    setToast(`Grades for ${selectedClass} ${selectedSubject} saved for ${selectedSession}!`);
    setTimeout(() => setToast(null), 3000);
  };

  const paginatedStudents = students.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Continuous Assessment & Grade Recording
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Record Continuous Assessment and Terminal Examination marks for Al-Amin students.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveGrades}
            className="h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save All Grades</span>
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#1c1c14]">Academic Session</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              {ACADEMIC_SESSIONS.map((sess) => (
                <option key={sess} value={sess}>
                  {sess}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#1c1c14]">Target Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              {teacherClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#1c1c14]">Subject Curriculum</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              {teacherSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#1c1c14]">Academic Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              <option value="Term1">First Term</option>
              <option value="Term2">Second Term</option>
              <option value="Term3">Third Term</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#c9c7b6]/50 mb-4">
          <div>
            <h2 className="text-base font-bold text-[#1c1c14]">
              {selectedSubject} Marks Register
            </h2>
            <p className="text-xs text-[#797869]">
              {selectedSession} · {selectedClass} · Grading Scale: A 75–100 · B 65–74 · C 50–64 · D 40–49 · F 0–39
            </p>
          </div>
          <span className="text-xs font-bold text-[#616218] px-2.5 py-1 rounded bg-[#faf8f0] border border-[#c9c7b6]">
            {students.length} Enrolled Students
          </span>
        </div>

        {students.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#797869]">
            No students are currently enrolled in {selectedSubject} for Class {selectedClass}. Enroll students from the Class Allocations page.
          </div>
        ) : (
          <>
          <div className="overflow-x-auto border border-[#c9c7b6]/60 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#faf8f0] text-xs font-bold text-[#1c1c14] border-b border-[#c9c7b6]/60 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Adm. No</th>
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3 text-center">1st CA / 20</th>
                  <th className="py-3 px-3 text-center">2nd CA / 20</th>
                  <th className="py-3 px-3 text-center">Exam / 60</th>
                  <th className="py-3 px-3 text-center">Total / 100</th>
                  <th className="py-3 px-3 text-center">Grade</th>
                  <th className="py-3 px-3">Subject Teacher Remarks</th>
                  <th className="py-3 px-3 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c9c7b6]/40">
                {paginatedStudents.map((student) => {
                  const scores = gradesInput[student.id] || { ca1: 0, ca2: 0, exam: 0 };
                  const { total, grade, badge } = calculateTotalAndGrade(scores);
                  return (
                    <tr key={student.id} className="hover:bg-[#fbf9f1] transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-xs text-[#616218]">
                        {student.admissionNumber}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#1c1c14]">
                        {student.name}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={scores.ca1 ?? ''}
                          onChange={(e) => handleScoreChange(student.id, 'ca1', e.target.value)}
                          className="w-16 h-10 text-center font-bold font-mono rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                        />
                      </td>

                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={scores.ca2 ?? ''}
                          onChange={(e) => handleScoreChange(student.id, 'ca2', e.target.value)}
                          className="w-16 h-10 text-center font-bold font-mono rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                        />
                      </td>

                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={scores.exam ?? ''}
                          onChange={(e) => handleScoreChange(student.id, 'exam', e.target.value)}
                          className="w-16 h-10 text-center font-bold font-mono rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                        />
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-base text-[#1c1c14]">
                        {total}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold ${badge}`}>
                          {grade}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={scores.remark || ''}
                          onChange={(e) => handleRemarkChange(student.id, e.target.value)}
                          placeholder="Teacher's remark..."
                          className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                        />
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end">
                          <TableActions
                            actions={[
                              {
                                label: 'Preview Terminal Report Sheet',
                                icon: FileText,
                                to: `/admin/reports?student=${student.id}`
                              }
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={students.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            itemLabel="students"
          />
          </>
        )}

        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#c9c7b6]/40">
          <span className="text-xs text-[#797869]">
            Continuous assessment marks automatically compile into the student's terminal report card.
          </span>
          <button
            type="button"
            onClick={handleSaveGrades}
            className="h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save All Grades</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecordGrades;
