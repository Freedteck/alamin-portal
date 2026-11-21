import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Upload,
  CheckCircle2,
  Calendar,
  Paperclip
} from 'lucide-react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { schoolStore, SCHOOL_CLASSES, subscribeSchoolSync } from '../../../shared/data/schoolData';
import { uploadSchoolFile, downloadSchoolFile } from '../../../shared/lib/storageService';

export function StaffAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewAssignment, setViewAssignment] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    title: '',
    class: 'SSS 2',
    subject: 'Mathematics',
    dueDate: '',
    totalMarks: '20',
    description: '',
    attachmentName: '',
    attachmentSize: '',
    attachmentPath: '',
    attachmentUrl: '',
    fileObj: null
  });

  const refreshData = () => {
    setAssignments(schoolStore.getAssignments());
  };

  useEffect(() => {
    refreshData();
    return subscribeSchoolSync(refreshData);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterClass]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const classSubjects = schoolStore.getSubjectsForClass(form.class);
  const subjectOptions = classSubjects.length > 0 ? classSubjects : schoolStore.getSubjectNames();

  const openCreateModal = () => {
    const subs = schoolStore.getSubjectsForClass('SSS 2');
    setEditingId(null);
    setForm({
      title: '',
      class: 'SSS 2',
      subject: subs[0] || 'Mathematics',
      dueDate: '',
      totalMarks: '20',
      description: '',
      attachmentName: '',
      attachmentSize: '',
      attachmentPath: '',
      attachmentUrl: '',
      fileObj: null
    });
    setIsModalOpen(true);
  };

  const openEditModal = (asg) => {
    setEditingId(asg.id);
    setForm({
      title: asg.title || '',
      class: asg.class || 'SSS 2',
      subject: asg.subject || 'Mathematics',
      dueDate: asg.dueDate || '',
      totalMarks: String(asg.totalMarks || 20),
      description: asg.description || '',
      attachmentName: asg.attachmentName || asg.attachments?.[0] || '',
      attachmentSize: asg.attachmentSize || '',
      attachmentPath: asg.attachmentPath || '',
      attachmentUrl: asg.attachmentUrl || '',
      fileObj: null
    });
    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeLabel =
      file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    setForm((prev) => ({
      ...prev,
      attachmentName: file.name,
      attachmentSize: sizeLabel,
      fileObj: file
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.dueDate) {
      showToast('Please enter assignment title and due date.');
      return;
    }

    const uploaded = form.fileObj
      ? await uploadSchoolFile('assignments', form.fileObj)
      : {
          fileName: form.attachmentName,
          fileSize: form.attachmentSize,
          filePath: form.attachmentPath,
          fileUrl: form.attachmentUrl
        };

    const payload = {
      title: form.title.trim(),
      class: form.class,
      subject: form.subject,
      dueDate: form.dueDate,
      totalMarks: Number(form.totalMarks) || 20,
      description: form.description.trim() || 'Complete all questions neatly.',
      attachmentName: uploaded.fileName || undefined,
      attachmentSize: uploaded.fileSize || undefined,
      attachmentPath: uploaded.filePath || undefined,
      attachmentUrl: uploaded.fileUrl || undefined,
      attachments: uploaded.fileName ? [uploaded.fileName] : []
    };

    if (editingId) {
      schoolStore.updateAssignment(editingId, payload);
      showToast('Assignment updated.');
    } else {
      schoolStore.addAssignment(payload);
      showToast('Assignment published to students.');
    }

    setIsModalOpen(false);
    refreshData();
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    schoolStore.deleteAssignment(confirmDelete.id);
    setConfirmDelete(null);
    refreshData();
    showToast('Assignment removed.');
  };

  const filtered = assignments.filter((a) => {
    const matchSearch =
      a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchClass = filterClass === 'all' || a.class === filterClass;
    return matchSearch && matchClass;
  });

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Assignments
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Create class coursework with worksheet uploads and track student submissions.
          </p>
        </div>

        <Button variant="primary" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
          Create Assignment
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs">
        <div className="w-full md:w-80">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search assignments by title or subject..."
          />
        </div>

        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
        >
          <option value="all">All Classes</option>
          {SCHOOL_CLASSES.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#faf8f0] border-b border-[#c9c7b6] text-[#1c1c14] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Assignment Title</th>
                <th className="py-3.5 px-4">Class</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Attachment</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Submissions</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9c7b6]/50">
              {paginated.length > 0 ? (
                paginated.map((asg) => {
                  const fileLabel = asg.attachmentName || asg.attachments?.[0] || null;
                  return (
                    <tr key={asg.id} className="hover:bg-[#faf8f0]/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#1c1c14]">{asg.title}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-[#faf8f0] border border-[#c9c7b6] font-semibold text-[#494900]">
                          {asg.class}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#44443b]">{asg.subject}</td>
                      <td className="py-3.5 px-4 text-[#797869]">
                        {fileLabel ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#616218]">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>{fileLabel}</span>
                          </span>
                        ) : (
                          'None'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#44443b]">{asg.dueDate}</td>
                      <td className="py-3.5 px-4 font-semibold text-[#616218]">
                        {asg.submissions?.length || asg.submittedStudents || 0} /{' '}
                        {asg.totalStudents || 35}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <TableActions
                          actions={[
                            {
                              label: 'View Submissions',
                              icon: Eye,
                              onClick: () => setViewAssignment(asg)
                            },
                            {
                              label: 'Edit Assignment',
                              icon: Edit3,
                              onClick: () => openEditModal(asg)
                            },
                            {
                              label: 'Delete Assignment',
                              icon: Trash2,
                              danger: true,
                              onClick: () => setConfirmDelete(asg)
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-[#797869]">
                    No assignments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Assignment' : 'Create Assignment'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {editingId ? 'Save Changes' : 'Publish Assignment'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Assignment Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Quadratic Equations Exercise 4"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Target Class</label>
              <select
                value={form.class}
                onChange={(e) => {
                  const nextCls = e.target.value;
                  const nextSubs = schoolStore.getSubjectsForClass(nextCls);
                  setForm({
                    ...form,
                    class: nextCls,
                    subject: nextSubs[0] || form.subject
                  });
                }}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                {SCHOOL_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Subject</label>
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                {subjectOptions.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Due Date</label>
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Total Marks</label>
              <input
                type="number"
                min="1"
                value={form.totalMarks}
                onChange={(e) => setForm({ ...form, totalMarks: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">
              Upload Question Sheet or Worksheet
            </label>
            <label className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-[#c9c7b6] bg-[#faf8f0] hover:bg-[#f4f2e1] cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-[#616218] mb-1.5" />
              <span className="text-xs font-semibold text-[#1c1c14]">
                {form.attachmentName ? form.attachmentName : 'Click to upload worksheet file'}
              </span>
              {form.attachmentSize && (
                <span className="text-[11px] text-[#797869] mt-0.5">{form.attachmentSize}</span>
              )}
              <input type="file" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Instructions</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Write instructions for students..."
              className="w-full p-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!viewAssignment}
        onClose={() => setViewAssignment(null)}
        title="Assignment Details & Submissions"
        size="md"
        footer={
          <Button variant="outline" onClick={() => setViewAssignment(null)}>
            Close
          </Button>
        }
      >
        {viewAssignment && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[#797869] block">Title</span>
              <span className="text-sm font-bold text-[#1c1c14]">{viewAssignment.title}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]">
              <div>
                <span className="text-[#797869] block">Class</span>
                <span className="font-semibold text-[#1c1c14]">{viewAssignment.class}</span>
              </div>
              <div>
                <span className="text-[#797869] block">Subject</span>
                <span className="font-semibold text-[#1c1c14]">{viewAssignment.subject}</span>
              </div>
              <div>
                <span className="text-[#797869] block">Due Date</span>
                <span className="font-semibold text-[#1c1c14] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#616218]" />
                  {viewAssignment.dueDate}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block">Worksheet File</span>
                <span className="font-mono text-[#616218]">
                  {viewAssignment.attachmentName ||
                    viewAssignment.attachments?.[0] ||
                    'No file attached'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[#797869] block mb-1">Instructions</span>
              <p className="text-[#44443b] leading-relaxed">{viewAssignment.description}</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#c9c7b6]/50">
              <div className="font-bold text-[#1c1c14]">
                Student Submissions ({(viewAssignment.submissions || []).length})
              </div>
              {(viewAssignment.submissions || []).length > 0 ? (
                viewAssignment.submissions.map((sub, idx) => (
                  <div
                    key={sub.id || idx}
                    className="p-3 rounded-lg border border-[#c9c7b6] bg-[#faf8f0] space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-[#1c1c14]">
                      <span>{sub.studentName}</span>
                      <span className="text-[#616218]">{sub.submittedAt}</span>
                    </div>
                    {sub.fileName && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadSchoolFile({
                            fileName: sub.fileName,
                            filePath: sub.filePath,
                            fileUrl: sub.fileUrl,
                            title: `${sub.studentName} Submission`
                          })
                        }
                        className="font-mono text-[11px] text-[#494900] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{sub.fileName}</span>
                      </button>
                    )}
                    {sub.notes && <p className="text-[#44443b]">{sub.notes}</p>}
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-[#c9c7b6] text-center text-[#797869]">
                  No student submissions uploaded yet.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        variant="confirm"
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Assignment"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-xs text-[#44443b]">
          Delete assignment <strong>{confirmDelete?.title}</strong>?
        </p>
      </Modal>
    </div>
  );
}

export default StaffAssignments;
