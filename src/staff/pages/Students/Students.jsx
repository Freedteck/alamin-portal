import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { Modal } from '../../../shared/components/Modal/Modal';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import {
  UserPlus,
  Award,
  CheckCircle2,
  Eye,
  UserCheck
} from 'lucide-react';
import {
  schoolStore,
  SCHOOL_CLASSES,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';

export function StaffStudents() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [students, setStudents] = useState([]);
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollClassFilter, setEnrollClassFilter] = useState('all');
  const [enrollForm, setEnrollForm] = useState({
    studentId: '',
    subject: 'Mathematics'
  });
  const [toast, setToast] = useState(null);

  const loadData = () => {
    const saved = JSON.parse(localStorage.getItem('alamin_user') || '{}');
    const allStudents = schoolStore.getStudents();
    const allTeachers = schoolStore.getTeachers();
    setStudents(allStudents);

    const teacher =
      allTeachers.find(
        (t) =>
          (saved.email && t.email?.toLowerCase() === saved.email.toLowerCase()) ||
          (saved.name && t.name?.toLowerCase() === saved.name.toLowerCase())
      ) ||
      allTeachers[0] ||
      null;
    setCurrentTeacher(teacher);
  };

  useEffect(() => {
    loadData();
    return subscribeSchoolSync(loadData);
  }, []);

  const handleEnrollStudent = (e) => {
    e.preventDefault();
    if (!enrollForm.studentId || !enrollForm.subject) return;

    schoolStore.addStudentToClassSubject(enrollForm.studentId, enrollForm.subject);
    loadData();
    setIsEnrollModalOpen(false);
    setToast('Student successfully added to your subject class roster!');
    setTimeout(() => setToast(null), 3000);
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.parentName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesClass = selectedClass === 'all' || student.class === selectedClass;
    const matchesSubject =
      selectedSubject === 'all' || (student.enrolledSubjects || []).includes(selectedSubject);

    return matchesSearch && matchesClass && matchesSubject;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClass, selectedSubject]);

  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            My Students & Class Rosters
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            View students enrolled across your assigned classes and subject rosters.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setEnrollClassFilter('all');
              setEnrollForm({
                studentId: students[0]?.id || '',
                subject: currentTeacher?.assignedClasses?.[0]?.subject || 'Mathematics'
              });
              setIsEnrollModalOpen(true);
            }}
            className="h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student to My Class</span>
          </button>
        </div>
      </div>

      {/* Teacher Assigned Teaching Load Banner */}
      {currentTeacher && (
        <div className="p-4 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#797869] font-semibold mr-1">My Teaching Allocations:</span>
            {(currentTeacher.assignedClasses || []).map((ac, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedClass(ac.class);
                  setSelectedSubject(ac.subject);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  selectedClass === ac.class && selectedSubject === ac.subject
                    ? 'bg-[#616218] text-white shadow-xs'
                    : 'bg-white text-[#494900] border border-[#c9c7b6]/60 hover:bg-[#f4f2e1]'
                }`}
              >
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    selectedClass === ac.class && selectedSubject === ac.subject
                      ? 'bg-white/20 text-white'
                      : 'bg-[#faf8f0] text-[#616218]'
                  }`}
                >
                  {ac.class}
                </span>
                <span>{ac.subject}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="w-full">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search students by name or admission number..."
              onClear={() => setSearchTerm('')}
            />
          </div>

          <div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              <option value="all">All Classes</option>
              {SCHOOL_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              <option value="all">All Subjects</option>
              {schoolStore.getSubjectNames().map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student List Table */}
      <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#c9c7b6]/50 mb-4">
          <h2 className="text-base font-bold text-[#1c1c14]">
            Enrolled Students
          </h2>
          <div className="flex items-center gap-2">
            <Link
              to="/teacher/grades"
              className="text-xs font-semibold text-[#616218] hover:underline flex items-center gap-1"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Record Grades</span>
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto border border-[#c9c7b6]/60 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#faf8f0] text-xs font-bold text-[#1c1c14] border-b border-[#c9c7b6]/60 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Adm. No</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Guardian Name</th>
                <th className="py-3 px-4">Guardian Phone</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9c7b6]/40">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#797869] text-xs">
                    No students match the selected class or subject filter.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-[#fbf9f1] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-xs text-[#616218]">
                      {student.admissionNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#1c1c14]">
                      {student.name}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#797869]">
                      {student.gender}
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-[#1c1c14]">
                      <span className="px-2.5 py-0.5 rounded bg-[#faf8f0] border border-[#c9c7b6]/60">
                        {student.class}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-[#1c1c14]">
                      {student.parentName}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#797869]">
                      {student.parentPhone}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <TableActions
                        actions={[
                          {
                            label: 'View Profile',
                            icon: Eye,
                            onClick: () => setSelectedStudent(student)
                          },
                          {
                            label: 'Check Attendance',
                            icon: UserCheck,
                            to: `/teacher/attendance?student=${student.id}`
                          },
                          {
                            label: 'Record Grades',
                            icon: Award,
                            to: '/teacher/grades'
                          }
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredStudents.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            itemLabel="students"
          />
        </div>
      </div>

      {/* Enroll Student to Teacher Class Right Panel */}
      <Modal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title="Add Student to My Teaching Roster"
        subtitle="Enroll a student into your subject class for attendance and grade recording"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(false)}
              className="h-10 px-4 text-xs font-semibold rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="teacher-enroll-student-form"
              className="h-10 px-4 text-xs font-semibold rounded-lg bg-[#616218] hover:bg-[#494900] text-white shadow-xs inline-flex items-center justify-center cursor-pointer"
            >
              Enroll Student
            </button>
          </>
        }
      >
        <form id="teacher-enroll-student-form" onSubmit={handleEnrollStudent} className="space-y-5 text-sm">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1c1c14]">Filter by Class</label>
            <select
              value={enrollClassFilter}
              onChange={(e) => {
                const nextCls = e.target.value;
                setEnrollClassFilter(nextCls);
                const candidates = nextCls === 'all' ? students : students.filter((s) => s.class === nextCls);
                if (candidates[0]) {
                  setEnrollForm((prev) => ({ ...prev, studentId: candidates[0].id }));
                }
              }}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              <option value="all">All Classes</option>
              {SCHOOL_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1c1c14]">Select Student</label>
            <select
              required
              value={enrollForm.studentId}
              onChange={(e) => setEnrollForm({ ...enrollForm, studentId: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              {(enrollClassFilter === 'all' ? students : students.filter((s) => s.class === enrollClassFilter)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {(() => {
              const selectedObj = students.find((s) => s.id === enrollForm.studentId);
              if (!selectedObj) return null;
              return (
                <div className="grid grid-cols-2 gap-3 p-2.5 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/60 text-xs">
                  <div>
                    <span className="text-[#797869] block">Admission Number</span>
                    <span className="font-mono font-bold text-[#616218]">{selectedObj.admissionNumber}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Class</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedObj.class}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1c1c14]">Curriculum Subject</label>
            <select
              value={enrollForm.subject}
              onChange={(e) => setEnrollForm({ ...enrollForm, subject: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] text-sm focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              {(() => {
                const selectedObj = students.find((s) => s.id === enrollForm.studentId);
                const validSubjects = selectedObj
                  ? schoolStore.getSubjectsForClass(selectedObj.class, selectedObj.department)
                  : schoolStore.getSubjectNames();
                return (validSubjects.length > 0 ? validSubjects : schoolStore.getSubjectNames()).map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ));
              })()}
            </select>
          </div>

          <p className="text-xs text-[#797869] bg-[#faf8f0] p-3.5 rounded-xl border border-[#c9c7b6]/60 leading-relaxed">
            Adding the student enables you to mark their daily attendance and enter their 1st CA, 2nd CA, and examination scores.
          </p>

        </form>
      </Modal>

      {/* Student Detail Right Panel */}
      {selectedStudent && (
        <Modal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          title="Student Profile"
          subtitle={selectedStudent.name}
          size="md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="h-10 px-4 text-xs font-semibold rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs inline-flex items-center justify-center cursor-pointer"
              >
                Close
              </button>
              <Link
                to={`/teacher/attendance?student=${selectedStudent.id}`}
                className="h-10 px-4 text-xs font-semibold rounded-lg bg-[#616218] hover:bg-[#494900] text-white shadow-xs inline-flex items-center justify-center gap-2"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Check Attendance
              </Link>
            </>
          }
        >
          <div className="space-y-5 text-xs">
            <div className="p-4 bg-[#faf8f0] rounded-xl border border-[#c9c7b6]/60 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[#797869] block mb-0.5">Full Name</span>
                <span className="font-bold text-sm text-[#1c1c14]">{selectedStudent.name}</span>
              </div>
              <div>
                <span className="text-[#797869] block mb-0.5">Admission Number</span>
                <span className="text-[#616218] font-mono font-bold text-sm">
                  {selectedStudent.admissionNumber}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block mb-0.5">Class</span>
                <span className="font-bold text-[#1c1c14]">{selectedStudent.class}</span>
              </div>
              <div>
                <span className="text-[#797869] block mb-0.5">Gender</span>
                <span className="font-semibold text-[#1c1c14]">{selectedStudent.gender}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-[#c9c7b6]/60 bg-white">
              <div>
                <span className="text-[#797869] block mb-0.5">State of Origin</span>
                <span className="font-semibold text-[#1c1c14]">{selectedStudent.stateOfOrigin}</span>
              </div>
              <div>
                <span className="text-[#797869] block mb-0.5">Local Government Area</span>
                <span className="font-semibold text-[#1c1c14]">{selectedStudent.lga}</span>
              </div>
              <div>
                <span className="text-[#797869] block mb-0.5">Date of Birth</span>
                <span className="font-semibold text-[#1c1c14]">
                  {selectedStudent.dateOfBirth || selectedStudent.dob || 'Not Provided'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block mb-0.5">Guardian Name</span>
                <span className="font-semibold text-[#1c1c14]">{selectedStudent.parentName}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[#797869] block mb-0.5">Guardian Phone</span>
                <span className="font-semibold text-[#1c1c14]">{selectedStudent.parentPhone}</span>
              </div>
            </div>

            <div>
              <span className="text-[#797869] block font-semibold mb-2">Enrolled Subjects</span>
              <div className="flex flex-wrap gap-1.5">
                {(selectedStudent.enrolledSubjects || []).map((sub) => (
                  <span
                    key={sub}
                    className="px-2.5 py-1 rounded-md bg-[#faf8f0] border border-[#c9c7b6]/60 font-medium text-[#1c1c14]"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default StaffStudents;
