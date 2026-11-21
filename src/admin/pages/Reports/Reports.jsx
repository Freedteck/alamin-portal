import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Logo } from '../../../shared/components/Logo/Logo';
import {
  schoolStore,
  SCHOOL_CLASSES,
  ACADEMIC_SESSIONS,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';

export function AdminReports() {
  const [searchParams] = useSearchParams();
  const studentParam = searchParams.get('student');

  const [students, setStudents] = useState([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSession, setSelectedSession] = useState(ACADEMIC_SESSIONS[0]);
  const [selectedTerm, setSelectedTerm] = useState('Term1');
  const [reportCard, setReportCard] = useState(null);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const res = await schoolStore.fetchStudents();
        if (!active) return;
        const list = Array.isArray(res) ? res : (res?.data || []);
        setStudents(list);
        if (studentParam && list.some((s) => s.id === studentParam)) {
          const target = list.find((s) => s.id === studentParam);
          setSelectedStudentId(studentParam);
          if (target) setSelectedClassFilter(target.class);
        } else if (list.length > 0 && !selectedStudentId) {
          setSelectedStudentId(list[0].id);
        } else if (list.length === 0) {
          setSelectedStudentId('');
          setReportCard(null);
        }
      } catch {
        const list = schoolStore.getStudents();
        setStudents(list);
      }
    };
    sync();
    const unsubscribe = subscribeSchoolSync(sync);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [studentParam]);

  useEffect(() => {
    let active = true;
    const updateCard = async () => {
      if (selectedStudentId) {
        const generated = await schoolStore.getStudentReportCard(selectedStudentId, selectedTerm, selectedSession);
        if (active) setReportCard(generated);
      } else {
        if (active) setReportCard(null);
      }
    };
    updateCard();
    const unsubscribe = subscribeSchoolSync(updateCard);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [selectedStudentId, selectedTerm, selectedSession]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-['Poppins',sans-serif] pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Terminal Academic Report Cards
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Official terminal report sheets, continuous assessment records, and psychomotor evaluations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Print Official Report Card</span>
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#797869]">Class</label>
            <select
              value={selectedClassFilter}
              onChange={(e) => {
                const cls = e.target.value;
                setSelectedClassFilter(cls);
                const matching = students.filter((s) => cls === 'all' || s.class === cls);
                if (matching.length > 0) setSelectedStudentId(matching[0].id);
              }}
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

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#797869]">Select Enrolled Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm font-semibold text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
            >
              {students.filter((st) => selectedClassFilter === 'all' || st.class === selectedClassFilter).length === 0 ? (
                <option value="">No students enrolled</option>
              ) : (
                students
                  .filter((st) => selectedClassFilter === 'all' || st.class === selectedClassFilter)
                  .map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#797869]">Academic Session</label>
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
            <label className="text-xs font-semibold text-[#797869]">Academic Term</label>
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

      {reportCard && reportCard.student ? (
        <div
          id="official-report-card"
          className="rounded-lg border-2 border-[#616218] bg-white p-6 sm:p-10 shadow-md text-[#1c1c14] print:border-none print:shadow-none print:p-0"
        >
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
              KM 12 Airport Road, Al-Amin Educational Campus · info@alamin.sch.ng · +234 803 000 1122
            </p>
            <div className="inline-block mt-3 px-4 py-1 rounded bg-[#f4f2e1] border border-[#c9c7b6] text-xs font-bold text-[#494900] uppercase tracking-wider">
              Student Terminal Academic Progress Report · {reportCard.term}
            </div>
          </div>

          <div className="rounded-lg border border-[#c9c7b6] bg-[#faf8f0] p-4 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[#797869] block text-[11px]">Student Full Name</span>
                <span className="font-bold text-sm text-[#1c1c14]">{reportCard.student?.name || 'Student'}</span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Admission Number</span>
                <span className="font-mono font-bold text-sm text-[#616218]">
                  {reportCard.student?.admissionNumber || '—'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Class</span>
                <span className="font-bold text-sm text-[#1c1c14]">
                  {reportCard.student?.class || '-'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Academic Session</span>
                <span className="font-bold text-sm text-[#1c1c14]">{reportCard.session || selectedSession}</span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">State of Origin</span>
                <span className="font-medium text-[#1c1c14]">
                  {reportCard.student?.stateOfOrigin || '-'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Local Government Area</span>
                <span className="font-medium text-[#1c1c14]">
                  {reportCard.student?.lga || '-'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Date of Birth</span>
                <span className="font-medium text-[#1c1c14]">
                  {reportCard.student?.dateOfBirth || reportCard.student?.dob || '-'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Gender</span>
                <span className="font-medium text-[#1c1c14]">
                  {reportCard.student?.gender || '-'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Term Attendance</span>
                <span className="font-bold text-[#616218]">
                  {reportCard.daysPresent ?? 0} of {reportCard.daysSchoolOpened ?? 0} days present
                </span>
              </div>
              <div>
                <span className="text-[#797869] block text-[11px]">Parent / Guardian</span>
                <span className="font-medium text-[#1c1c14] truncate block">
                  {reportCard.student?.parentName || '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#616218] mb-2">
              Academic Performance Breakdown
            </h3>
            <div className="overflow-x-auto border border-[#c9c7b6] rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#faf8f0] font-bold text-[#1c1c14] border-b border-[#c9c7b6] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Curriculum Subject</th>
                    <th className="py-2.5 px-2 text-center">1st CA / 20</th>
                    <th className="py-2.5 px-2 text-center">2nd CA / 20</th>
                    <th className="py-2.5 px-2 text-center">Exam / 60</th>
                    <th className="py-2.5 px-2 text-center">Total / 100</th>
                    <th className="py-2.5 px-2 text-center">Grade</th>
                    <th className="py-2.5 px-2 text-center">Position</th>
                    <th className="py-2.5 px-3">Subject Teacher Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c9c7b6]/60">
                  {(reportCard.subjectScores || []).map((score, idx) => (
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
              <span className="text-[#797869] block text-[10px] uppercase">Decision</span>
              <span className="font-bold text-sm text-[#616218]">{reportCard.overallRemark}</span>
            </div>
          </div>

          {((reportCard.affectiveDomain && reportCard.affectiveDomain.length > 0) ||
            (reportCard.psychomotorDomain && reportCard.psychomotorDomain.length > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-xs">
              {reportCard.affectiveDomain?.length > 0 && (
                <div className="rounded-lg border border-[#c9c7b6] p-3 bg-white">
                  <span className="font-bold text-[#616218] uppercase text-[11px] block mb-2">
                    Affective Domain
                  </span>
                  <div className="space-y-1.5">
                    {(reportCard.affectiveDomain || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px]">
                        <span className="text-[#44443b]">{item.trait}</span>
                        <span className="font-bold text-[#616218]">{item.score} / 5</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportCard.psychomotorDomain?.length > 0 && (
                <div className="rounded-lg border border-[#c9c7b6] p-3 bg-white">
                  <span className="font-bold text-[#616218] uppercase text-[11px] block mb-2">
                    Psychomotor Skills
                  </span>
                  <div className="space-y-1.5">
                    {(reportCard.psychomotorDomain || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px]">
                        <span className="text-[#44443b]">{item.skill}</span>
                        <span className="font-bold text-[#616218]">{item.score} / 5</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-[#c9c7b6] p-4 bg-[#faf8f0] space-y-3 text-xs">
            <div>
              <span className="font-bold text-[#616218] text-[11px] uppercase block">
                Class Teacher's Remark:
              </span>
              <p className="italic text-[#1c1c14] mt-0.5">"{reportCard.classTeacherRemark}"</p>
            </div>

            <div>
              <span className="font-bold text-[#616218] text-[11px] uppercase block">
                Principal's General Remark:
              </span>
              <p className="italic text-[#1c1c14] mt-0.5">"{reportCard.principalRemark}"</p>
            </div>

            <div className="pt-4 border-t border-[#c9c7b6]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[11px]">
              <div>
                <span className="text-[#797869]">Next Term Resumption Date:</span>{' '}
                <strong className="text-[#1c1c14]">{reportCard.nextTermBegins}</strong>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="h-6 border-b border-dashed border-[#1c1c14] w-28 mx-auto mb-1"></div>
                  <span className="text-[#797869] text-[10px]">Class Teacher Signature</span>
                </div>
                <div className="text-center">
                  <div className="h-6 border-b border-dashed border-[#1c1c14] w-28 mx-auto mb-1"></div>
                  <span className="text-[#797869] text-[10px]">Principal's Official Stamp</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-12 text-center text-xs text-[#797869]">
          {students.length === 0
            ? 'No students enrolled yet. Admit a student first to generate official academic report cards.'
            : 'Select an enrolled student above to load their official academic report card.'}
        </div>
      )}
    </div>
  );
}

export default AdminReports;
