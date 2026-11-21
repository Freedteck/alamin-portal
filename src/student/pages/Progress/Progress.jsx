import React, { useState, useEffect } from 'react';
import { Printer } from 'lucide-react';
import { Logo } from '../../../shared/components/Logo/Logo';
import { schoolStore, ACADEMIC_SESSIONS, subscribeSchoolSync } from '../../../shared/data/schoolData';

export function StudentProgressReports() {
  const [selectedSession, setSelectedSession] = useState(ACADEMIC_SESSIONS[0]);
  const [selectedTerm, setSelectedTerm] = useState('Term1');
  const [reportCard, setReportCard] = useState(null);

  useEffect(() => {
    const loadReportCard = () => {
      const storedUser = JSON.parse(localStorage.getItem('alamin_user') || '{}');
      const students = schoolStore.getStudents();
      if (students.length > 0) {
        const matched =
          students.find(
            (s) =>
              (storedUser.email && s.email?.toLowerCase() === storedUser.email.toLowerCase()) ||
              (storedUser.name && s.name?.toLowerCase() === storedUser.name.toLowerCase())
          ) || students[0];
        const generated = schoolStore.getStudentReportCard(matched.id, selectedTerm, selectedSession);
        setReportCard(generated);
      } else {
        setReportCard(null);
      }
    };
    loadReportCard();
    return subscribeSchoolSync(loadReportCard);
  }, [selectedTerm, selectedSession]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-['Poppins',sans-serif] pb-16">
      {/* Header with Print Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            My Academic Progress & Report Sheet
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            View your official terminal assessment results, continuous assessments, and teacher remarks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print My Report Card</span>
          </button>
        </div>
      </div>

      {/* Session & Term Selector (Hidden on Print) */}
      <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#1c1c14] block">Academic Session</label>
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
          <label className="text-xs font-semibold text-[#1c1c14] block">Academic Term</label>
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

      {/* Official Report Card */}
      {reportCard ? (
        <div
          id="student-official-report"
          className="rounded-lg border-2 border-[#616218] bg-white p-6 sm:p-10 shadow-md text-[#1c1c14] print:border-none print:shadow-none print:p-0"
        >
          {/* Header */}
          <div className="text-center border-b-2 border-[#616218] pb-5 mb-6">
            <div className="flex items-center justify-center mb-2">
              <Logo variant="dark" className="h-14 sm:h-16" showText={false} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1c1c14] uppercase">
              Al-Amin Group of Schools
            </h2>
            <p className="text-xs font-bold text-[#616218] uppercase tracking-widest mt-0.5">
              Knowledge · Integrity · Excellence
            </p>
            <p className="text-xs text-[#797869] mt-1">
              KM 12 Airport Road, Al-Amin Educational Campus · info@alamin.sch.ng
            </p>
            <div className="inline-block mt-3 px-4 py-1 rounded bg-[#f4f2e1] border border-[#c9c7b6] text-xs font-bold text-[#494900] uppercase tracking-wider">
              Term Academic Report Card · {reportCard.session} · {reportCard.term}
            </div>
          </div>

          {/* Student Information */}
          <div className="rounded-lg border border-[#c9c7b6] bg-[#faf8f0] p-4 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[#797869] block text-[11px]">Student Name</span>
                <span className="font-bold text-sm text-[#1c1c14]">{reportCard.student.name}</span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Admission Number</span>
                <span className="font-mono font-bold text-sm text-[#616218]">
                  {reportCard.student.admissionNumber}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Class</span>
                <span className="font-bold text-sm text-[#1c1c14]">
                  {reportCard.student.class}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Attendance Record</span>
                <span className="font-bold text-[#616218]">
                  {reportCard.daysPresent} / {reportCard.daysSchoolOpened} days present
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Date of Birth</span>
                <span className="font-semibold text-[#1c1c14]">
                  {reportCard.student.dateOfBirth || reportCard.student.dob || 'Not Provided'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Gender</span>
                <span className="font-semibold text-[#1c1c14]">
                  {reportCard.student.gender || 'Not Specified'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">State of Origin</span>
                <span className="font-semibold text-[#1c1c14]">
                  {reportCard.student.stateOfOrigin || 'Not Provided'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Local Government Area</span>
                <span className="font-semibold text-[#1c1c14]">
                  {reportCard.student.lga || 'Not Provided'}
                </span>
              </div>
            </div>
          </div>

          {/* Marks Table */}
          <div className="mb-6">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#616218] mb-2">
              Subject Continuous Assessments & Examinations
            </h3>
            <div className="overflow-x-auto border border-[#c9c7b6] rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#faf8f0] font-bold text-[#1c1c14] border-b border-[#c9c7b6] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-2 text-center">1st CA / 20</th>
                    <th className="py-2.5 px-2 text-center">2nd CA / 20</th>
                    <th className="py-2.5 px-2 text-center">Exam / 60</th>
                    <th className="py-2.5 px-2 text-center">Total / 100</th>
                    <th className="py-2.5 px-2 text-center">Grade</th>
                    <th className="py-2.5 px-2 text-center">Position</th>
                    <th className="py-2.5 px-3">Teacher Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c9c7b6]/60">
                  {reportCard.subjectScores.map((score, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#faf8f0]/40'}>
                      <td className="py-2 px-3 font-semibold text-[#1c1c14]">{score.subject}</td>
                      <td className="py-2 px-2 text-center font-mono">{score.ca1}</td>
                      <td className="py-2 px-2 text-center font-mono">{score.ca2}</td>
                      <td className="py-2 px-2 text-center font-mono">{score.exam}</td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-[#1c1c14]">
                        {score.total}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            score.grade?.startsWith('A')
                              ? 'bg-emerald-100 text-emerald-800'
                              : score.grade?.startsWith('B')
                              ? 'bg-blue-100 text-blue-800'
                              : score.grade?.startsWith('C')
                              ? 'bg-amber-100 text-amber-800'
                              : score.grade === '-'
                              ? 'bg-stone-100 text-stone-700'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {score.grade}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center font-medium text-[#797869]">
                        {score.position}
                      </td>
                      <td className="py-2 px-3 text-[#44443b] text-[11px]">{score.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] mb-6 text-center text-xs">
            <div>
              <span className="text-[#797869] block text-[10px] uppercase">Total Marks</span>
              <span className="font-bold text-sm text-[#1c1c14]">
                {reportCard.totalObtained} / {reportCard.maxTotal}
              </span>
            </div>
            <div>
              <span className="text-[#797869] block text-[10px] uppercase">Percentage Average</span>
              <span className="font-bold text-sm text-[#616218]">{reportCard.average}%</span>
            </div>
            <div>
              <span className="text-[#797869] block text-[10px] uppercase">Class Position</span>
              <span className="font-bold text-sm text-[#1c1c14]">{reportCard.position}</span>
            </div>
            <div>
              <span className="text-[#797869] block text-[10px] uppercase">Terminal Standing</span>
              <span className="font-bold text-sm text-emerald-700">{reportCard.overallRemark}</span>
            </div>
          </div>

          {/* Remarks & Signatures */}
          <div className="rounded-lg border border-[#c9c7b6] p-4 bg-[#faf8f0] space-y-3 text-xs">
            <div>
              <span className="font-bold text-[#616218] text-[11px] uppercase block">
                Class Teacher's Remark:
              </span>
              <p className="italic text-[#1c1c14] mt-0.5">"{reportCard.classTeacherRemark}"</p>
            </div>

            <div>
              <span className="font-bold text-[#616218] text-[11px] uppercase block">
                Principal's Remark:
              </span>
              <p className="italic text-[#1c1c14] mt-0.5">"{reportCard.principalRemark}"</p>
            </div>

            <div className="pt-4 border-t border-[#c9c7b6]/60 flex items-center justify-between text-[11px]">
              <div>
                Next Term Resumption Date:{' '}
                <strong className="text-[#1c1c14]">{reportCard.nextTermBegins}</strong>
              </div>
              <div className="text-[#797869]">Official Seal: Al-Amin Educational Examination Board</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-10 text-center text-xs text-[#797869]">
          No student academic record is available yet. Grades and report cards will appear once your profile is enrolled and assessments are recorded.
        </div>
      )}
    </div>
  );
}

export default StudentProgressReports;
