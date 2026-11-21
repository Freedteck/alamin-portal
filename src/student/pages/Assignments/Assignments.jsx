import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Download,
  Paperclip,
  BookOpen
} from 'lucide-react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { schoolStore, subscribeSchoolSync } from '../../../shared/data/schoolData';
import { uploadSchoolFile, downloadSchoolFile } from '../../../shared/lib/storageService';

export function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [activeStudent, setActiveStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const loadRequest = useRef(0);

  const [submitModal, setSubmitModal] = useState(null);
  const [submitForm, setSubmitForm] = useState({ notes: '', fileName: '', fileObj: null });
  const [toast, setToast] = useState(null);

  const loadData = async () => {
    const requestId = ++loadRequest.current;
    try {
      const aRes = await schoolStore.fetchAssignments({
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        subject: filterSubject
      });
      if (requestId !== loadRequest.current) return;
      setAssignments(Array.isArray(aRes?.data) ? aRes.data : []);
      setSubjects(Array.isArray(aRes?.subjects) ? aRes.subjects : []);
      setTotalAssignments(aRes?.total || 0);
    } catch (error) {
      if (requestId !== loadRequest.current) return;
      console.error('Failed to load student assignments:', error);
      setAssignments([]);
      setSubjects([]);
      setTotalAssignments(0);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeSchoolSync(loadData);
    return () => {
      loadRequest.current += 1;
      unsubscribe();
    };
  }, [currentPage, searchTerm, filterSubject]);

  useEffect(() => {
    let active = true;
    schoolStore.fetchCurrentStudent()
      .then((student) => {
        if (active) setActiveStudent(student);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Failed to load current student:', error);
        setActiveStudent(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSubject]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openSubmitModal = (asg) => {
    const existing = asg.submissions?.find((s) => s.studentId === activeStudent?.id);
    setSubmitForm({
      notes: existing?.notes || '',
      fileName: existing?.fileName || '',
      fileObj: null
    });
    setSubmitModal(asg);
  };

  const handleSubmissionFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitForm((prev) => ({ ...prev, fileName: file.name, fileObj: file }));
  };

  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (!submitModal || !activeStudent) return;
    if (!submitForm.fileName && !submitForm.notes.trim()) {
      showToast('Please attach a file or enter submission notes.');
      return;
    }

    const uploaded = submitForm.fileObj
      ? await uploadSchoolFile('submissions', submitForm.fileObj)
      : { fileName: submitForm.fileName, filePath: '', fileUrl: '' };

    schoolStore.submitStudentAssignment(submitModal.id, activeStudent, {
      notes: submitForm.notes.trim(),
      fileName: uploaded.fileName || submitForm.fileName,
      filePath: uploaded.filePath || '',
      fileUrl: uploaded.fileUrl || ''
    });
    setSubmitModal(null);
    loadData();
    showToast('Assignment submitted successfully.');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Assignments
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Download class worksheets, upload completed homework, and check teacher feedback.
          </p>
        </div>

        <Link
          to="/student/resources"
          className="h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] text-xs font-semibold text-[#1c1c14] inline-flex items-center gap-2 transition-colors"
        >
          <BookOpen className="w-4 h-4 text-[#616218]" />
          <span>Study Resources</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs">
        <div className="w-full md:w-80">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search coursework..."
          />
        </div>

        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
        >
          <option value="all">All Subjects</option>
          {subjects.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>
      </div>

      {/* Assignment Cards */}
      <div className="space-y-4">
        {assignments.length > 0 ? (
          assignments.map((asg) => {
            const mySub = asg.submissions?.find((s) => s.studentId === activeStudent?.id);
            const worksheet = asg.attachmentName || asg.attachments?.[0] || null;
            return (
              <div
                key={asg.id}
                className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#faf8f0] border border-[#c9c7b6] text-[10px] font-bold text-[#494900]">
                        {asg.subject}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-[#c9c7b6] text-[10px] font-semibold text-[#797869]">
                        {asg.class}
                      </span>
                      {mySub ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-[#1c1c14]">{asg.title}</h3>
                    <p className="text-xs text-[#44443b] leading-relaxed">{asg.description}</p>
                  </div>

                  <div className="text-xs text-[#797869] sm:text-right shrink-0 space-y-1">
                    <div>
                      Due Date: <strong className="text-[#1c1c14]">{asg.dueDate}</strong>
                    </div>
                    <div>Max Marks: {asg.totalMarks || 20}</div>
                  </div>
                </div>

                {mySub && (
                  <div className="p-3 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] text-xs space-y-1">
                    <div className="font-semibold text-[#494900]">
                      Submitted on {mySub.submittedAt}
                      {mySub.fileName ? ` · File: ${mySub.fileName}` : ''}
                    </div>
                    {mySub.feedback && <div className="text-[#44443b]">{mySub.feedback}</div>}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#c9c7b6]/40">
                  {worksheet ? (
                    <button
                      type="button"
                      onClick={() => {
                        downloadSchoolFile({
                          fileUrl: asg.attachmentUrl,
                          filePath: asg.attachmentPath,
                          fileName: worksheet,
                          title: asg.title,
                          description: asg.description
                        });
                        showToast(`Downloading ${worksheet}`);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#616218] hover:underline cursor-pointer"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Download Worksheet ({worksheet})</span>
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-xs text-[#797869]">No worksheet attached</span>
                  )}

                  <Button
                    variant={mySub ? 'outline' : 'primary'}
                    onClick={() => openSubmitModal(asg)}
                    icon={<Upload className="w-4 h-4" />}
                  >
                    {mySub ? 'Update Submission' : 'Submit Work'}
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-10 text-center text-xs text-[#797869]">
            <FileText className="w-8 h-8 mx-auto mb-2 text-[#c9c7b6]" />
            No coursework assignments found for your class.
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalAssignments}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      {/* Submit Work Modal */}
      <Modal
        isOpen={!!submitModal}
        onClose={() => setSubmitModal(null)}
        title="Submit Assignment"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setSubmitModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmitWork}>
              Submit Assignment
            </Button>
          </>
        }
      >
        {submitModal && (
          <form onSubmit={handleSubmitWork} className="space-y-4">
            <div className="p-3 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] text-xs">
              <div className="font-bold text-[#1c1c14]">{submitModal.title}</div>
              <div className="text-[#616218] mt-0.5">
                {submitModal.subject} · Due {submitModal.dueDate}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">
                Upload Solution File
              </label>
              <label className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-[#c9c7b6] bg-[#faf8f0] hover:bg-[#f4f2e1] cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-[#616218] mb-1.5" />
                <span className="text-xs font-semibold text-[#1c1c14]">
                  {submitForm.fileName ? submitForm.fileName : 'Click to attach your completed work'}
                </span>
                <input type="file" className="hidden" onChange={handleSubmissionFile} />
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">
                Notes for Teacher
              </label>
              <textarea
                rows={4}
                value={submitForm.notes}
                onChange={(e) => setSubmitForm({ ...submitForm, notes: e.target.value })}
                placeholder="Write a brief note or solution summary..."
                className="w-full p-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default StudentAssignments;
