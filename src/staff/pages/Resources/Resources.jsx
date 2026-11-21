import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  Video,
  Plus,
  Download,
  Eye,
  Upload,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { schoolStore, SCHOOL_CLASSES, subscribeSchoolSync } from '../../../shared/data/schoolData';
import { uploadSchoolFile, downloadSchoolFile } from '../../../shared/lib/storageService';

export function TeacherResources() {
  const [resources, setResources] = useState([]);
  const [subjectNames, setSubjectNames] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewModal, setViewModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentTeacher, setCurrentTeacher] = useState(null);

  const [form, setForm] = useState({
    title: '',
    type: 'document',
    subject: 'Mathematics',
    accessLevel: 'students',
    allClasses: true,
    classes: [],
    description: '',
    fileName: '',
    fileSize: '',
    fileObj: null
  });

  const refreshData = () => {
    const teachers = schoolStore.getTeachers();
    const saved = JSON.parse(localStorage.getItem('alamin_user') || '{}');
    const teacher =
      teachers.find((t) => t.email === saved.email || t.name === saved.name) ||
      teachers[0] || { name: 'Teaching Staff' };
    setCurrentTeacher(teacher);
    setResources(schoolStore.getResourcesForUser('teacher'));
    const subs = schoolStore.getSubjectNames();
    setSubjectNames(subs);
    setForm((prev) => ({ ...prev, subject: prev.subject || subs[0] || 'Mathematics' }));
  };

  useEffect(() => {
    refreshData();
    return subscribeSchoolSync(refreshData);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSubject, selectedClass]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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
      fileName: file.name,
      fileSize: sizeLabel,
      fileObj: file,
      title: prev.title || file.name.replace(/\.[^/.]+$/, '')
    }));
  };

  const toggleClass = (cls) => {
    setForm((prev) => {
      const exists = prev.classes.includes(cls);
      const next = exists ? prev.classes.filter((c) => c !== cls) : [...prev.classes, cls];
      return { ...prev, allClasses: false, classes: next };
    });
  };

  const handleAddResource = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.fileName) {
      showToast('Please enter a title and select a file to upload.');
      return;
    }

    const classes = form.allClasses
      ? ['All Classes']
      : form.classes.length > 0
      ? form.classes
      : ['All Classes'];

    const uploaded = form.fileObj
      ? await uploadSchoolFile('resources', form.fileObj)
      : { fileName: form.fileName, fileSize: form.fileSize || '1.0 MB', filePath: '', fileUrl: '' };

    schoolStore.addResource({
      title: form.title.trim(),
      type: form.type,
      subject: form.subject,
      description: form.description.trim() || 'Uploaded curriculum learning material.',
      accessLevel: form.accessLevel,
      classes,
      fileName: uploaded.fileName || form.fileName,
      fileSize: uploaded.fileSize || form.fileSize || '1.0 MB',
      filePath: uploaded.filePath || '',
      fileUrl: uploaded.fileUrl || '',
      uploadedBy: currentTeacher?.name || 'Teaching Staff'
    });

    setForm({
      title: '',
      type: 'document',
      subject: subjectNames[0] || 'Mathematics',
      accessLevel: 'students',
      allClasses: true,
      classes: [],
      description: '',
      fileName: '',
      fileSize: '',
      fileObj: null
    });
    setIsAddOpen(false);
    refreshData();
    showToast('Learning resource uploaded.');
  };

  const filtered = resources.filter((r) => {
    const matchesSearch =
      r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.fileName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || r.subject === selectedSubject;
    const classes = r.classes || ['All Classes'];
    const matchesClass =
      selectedClass === 'all' ||
      classes.includes('All Classes') ||
      classes.includes(selectedClass);
    return matchesSearch && matchesSubject && matchesClass;
  });

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4 text-sky-700" />;
      case 'guide':
        return <BookOpen className="w-4 h-4 text-emerald-700" />;
      default:
        return <FileText className="w-4 h-4 text-[#616218]" />;
    }
  };

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
            Resources
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Access curriculum study packets or upload new learning materials for specific secondary classes.
          </p>
        </div>

        <Button variant="primary" onClick={() => setIsAddOpen(true)} icon={<Plus className="w-4 h-4" />}>
          Upload Resource
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs">
        <div className="w-full md:w-80">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search learning resources..."
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
          >
            <option value="all">All Subjects</option>
            {subjectNames.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
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
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#faf8f0] border-b border-[#c9c7b6] text-[#1c1c14] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Resource Title</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">File</th>
                <th className="py-3.5 px-4">Target Classes</th>
                <th className="py-3.5 px-4">Uploaded By</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9c7b6]/50">
              {paginated.length > 0 ? (
                paginated.map((res) => (
                  <tr key={res.id} className="hover:bg-[#faf8f0]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        {getTypeIcon(res.type)}
                        <span className="font-semibold text-[#1c1c14]">{res.title}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#44443b]">{res.subject}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#797869]">
                      {res.fileName || 'material.pdf'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(res.classes || ['All Classes']).map((cls) => (
                          <span
                            key={cls}
                            className="px-2 py-0.5 rounded bg-[#faf8f0] border border-[#c9c7b6] text-[10px] font-semibold text-[#494900]"
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#797869]">{res.uploadedBy}</td>
                    <td className="py-3.5 px-4 text-right">
                      <TableActions
                        actions={[
                          {
                            label: 'View Resource',
                            icon: Eye,
                            onClick: () => setViewModal(res)
                          },
                          {
                            label: 'Download File',
                            icon: Download,
                            onClick: () => {
                              downloadSchoolFile(res);
                              showToast(`Downloading ${res.fileName || res.title}`);
                            }
                          }
                        ]}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-[#797869]">
                    No learning resources available.
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
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Upload Learning Resource"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddResource}>
              Upload Resource
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddResource} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Select File</label>
            <label className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-[#c9c7b6] bg-[#faf8f0] hover:bg-[#f4f2e1] cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-[#616218] mb-1.5" />
              <span className="text-xs font-semibold text-[#1c1c14]">
                {form.fileName ? form.fileName : 'Click to choose file'}
              </span>
              {form.fileSize && (
                <span className="text-[11px] text-[#797869] mt-0.5">{form.fileSize}</span>
              )}
              <input type="file" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. SSS 2 Physics Optics Guide"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Subject</label>
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                {subjectNames.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Visibility</label>
              <select
                value={form.accessLevel}
                onChange={(e) => setForm({ ...form, accessLevel: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                <option value="students">Students & Staff</option>
                <option value="staff">Staff Only</option>
                <option value="all">Everyone</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1c1c14]">Available Classes</label>
              <label className="flex items-center gap-2 text-xs font-medium text-[#616218] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allClasses}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      allClasses: e.target.checked,
                      classes: e.target.checked ? [] : form.classes
                    })
                  }
                  className="w-4 h-4 accent-[#616218] rounded"
                />
                <span>All Classes</span>
              </label>
            </div>
            {!form.allClasses && (
              <div className="grid grid-cols-3 gap-2">
                {SCHOOL_CLASSES.map((cls) => (
                  <label
                    key={cls}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                      form.classes.includes(cls)
                        ? 'bg-[#faf8f0] border-[#616218] font-semibold'
                        : 'bg-white border-[#c9c7b6]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.classes.includes(cls)}
                      onChange={() => toggleClass(cls)}
                      className="w-4 h-4 accent-[#616218] rounded"
                    />
                    <span>{cls}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Summary of learning resource..."
              className="w-full p-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!viewModal}
        onClose={() => setViewModal(null)}
        title="Resource Details"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewModal(null)}>
              Close
            </Button>
            {viewModal && (
              <Button
                variant="primary"
                onClick={() => {
                  downloadSchoolFile(viewModal);
                  showToast(`Downloading ${viewModal.fileName || viewModal.title}`);
                }}
                icon={<Download className="w-4 h-4" />}
              >
                Download
              </Button>
            )}
          </>
        }
      >
        {viewModal && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[#797869] block">Title</span>
              <span className="text-sm font-bold text-[#1c1c14]">{viewModal.title}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]">
              <div>
                <span className="text-[#797869] block">Subject</span>
                <span className="font-semibold text-[#1c1c14]">{viewModal.subject}</span>
              </div>
              <div>
                <span className="text-[#797869] block">File</span>
                <span className="font-mono text-[#1c1c14]">
                  {viewModal.fileName || 'material.pdf'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[#797869] block mb-1">Description</span>
              <p className="text-[#44443b] leading-relaxed">{viewModal.description}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TeacherResources;
