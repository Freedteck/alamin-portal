import React, { useState, useEffect } from 'react';
import {
  FileText,
  FolderOpen,
  Upload,
  Download,
  Eye,
  Trash2,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { schoolStore, SCHOOL_CLASSES, subscribeSchoolSync } from '../../../shared/data/schoolData';
import { uploadSchoolFile, downloadSchoolFile } from '../../../shared/lib/storageService';

const ACCESS_META = {
  all: { label: 'Everyone', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  staff: { label: 'Staff Only', style: 'bg-amber-50 text-amber-800 border-amber-200' },
  students: { label: 'Students & Staff', style: 'bg-sky-50 text-sky-800 border-sky-200' },
  admin: { label: 'Admin Only', style: 'bg-rose-50 text-rose-800 border-rose-200' }
};

export function AdminDocuments() {
  const [activeTab, setActiveTab] = useState('documents');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAccess, setSelectedAccess] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [documents, setDocuments] = useState([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [viewDocModal, setViewDocModal] = useState(null);
  const [editAccessDoc, setEditAccessDoc] = useState(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null);
  const [toast, setToast] = useState(null);

  const [uploadForm, setUploadForm] = useState({
    name: '',
    category: 'Policy & Handbook',
    accessLevel: 'all',
    allClasses: true,
    allowedClasses: [],
    description: '',
    fileName: '',
    size: '',
    fileObj: null
  });

  const [accessForm, setAccessForm] = useState({
    accessLevel: 'all',
    allClasses: true,
    allowedClasses: []
  });

  const refreshDocuments = () => {
    setDocuments(schoolStore.getDocuments());
  };

  useEffect(() => {
    refreshDocuments();
    return subscribeSchoolSync(refreshDocuments);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedAccess, activeTab]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '1.0 MB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toUpperCase() || 'PDF';
    setUploadForm((prev) => ({
      ...prev,
      fileName: file.name,
      size: formatFileSize(file.size),
      type: ext,
      fileObj: file,
      name: prev.name || file.name.replace(/\.[^/.]+$/, '')
    }));
  };

  const toggleUploadClass = (cls) => {
    setUploadForm((prev) => {
      const exists = prev.allowedClasses.includes(cls);
      const next = exists
        ? prev.allowedClasses.filter((c) => c !== cls)
        : [...prev.allowedClasses, cls];
      return { ...prev, allClasses: false, allowedClasses: next };
    });
  };

  const toggleEditAccessClass = (cls) => {
    setAccessForm((prev) => {
      const exists = prev.allowedClasses.includes(cls);
      const next = exists
        ? prev.allowedClasses.filter((c) => c !== cls)
        : [...prev.allowedClasses, cls];
      return { ...prev, allClasses: false, allowedClasses: next };
    });
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!uploadForm.name.trim()) {
      showToast('Please enter a document name.');
      return;
    }
    if (!uploadForm.fileName) {
      showToast('Please attach a document file.');
      return;
    }

    const classes = uploadForm.allClasses
      ? ['All Classes']
      : uploadForm.allowedClasses.length > 0
      ? uploadForm.allowedClasses
      : ['All Classes'];

    const uploaded = uploadForm.fileObj
      ? await uploadSchoolFile('documents', uploadForm.fileObj)
      : { fileName: uploadForm.fileName, fileSize: uploadForm.size || '1.1 MB', filePath: '', fileUrl: '' };

    const ext = (uploaded.fileName || uploadForm.fileName).split('.').pop()?.toUpperCase() || 'PDF';

    schoolStore.addDocument({
      name: uploadForm.name.trim(),
      category: uploadForm.category,
      type: ext,
      size: uploaded.fileSize || uploadForm.size || '1.1 MB',
      fileName: uploaded.fileName || uploadForm.fileName,
      filePath: uploaded.filePath || '',
      fileUrl: uploaded.fileUrl || '',
      folderId: uploadForm.category,
      accessLevel: uploadForm.accessLevel,
      allowedClasses: classes,
      description: uploadForm.description.trim() || 'Official school document.',
      uploadedBy: 'School Administration'
    });

    setUploadForm({
      name: '',
      category: 'Policy & Handbook',
      accessLevel: 'all',
      allClasses: true,
      allowedClasses: [],
      description: '',
      fileName: '',
      size: '',
      fileObj: null
    });
    setIsUploadOpen(false);
    refreshDocuments();
    showToast('Document uploaded and access policy configured.');
  };

  const openEditAccess = (doc) => {
    const classes = doc.allowedClasses || ['All Classes'];
    const isAll = classes.includes('All Classes');
    setEditAccessDoc(doc);
    setAccessForm({
      accessLevel: doc.accessLevel || 'all',
      allClasses: isAll,
      allowedClasses: isAll ? [] : classes
    });
  };

  const handleSaveAccess = (e) => {
    e.preventDefault();
    if (!editAccessDoc) return;
    const classes = accessForm.allClasses
      ? ['All Classes']
      : accessForm.allowedClasses.length > 0
      ? accessForm.allowedClasses
      : ['All Classes'];
    schoolStore.updateDocumentAccess(editAccessDoc.id, accessForm.accessLevel, classes);
    setEditAccessDoc(null);
    refreshDocuments();
    showToast('Document access permissions updated.');
  };

  const handleDeleteDocument = () => {
    if (!confirmDeleteDoc) return;
    schoolStore.deleteDocument(confirmDeleteDoc.id);
    setConfirmDeleteDoc(null);
    refreshDocuments();
    showToast('Document removed from archive.');
  };

  const categories = Array.from(new Set(documents.map((d) => d.category).filter(Boolean)));

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.fileName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesAccess = selectedAccess === 'all' || doc.accessLevel === selectedAccess;
    return matchesSearch && matchesCategory && matchesAccess;
  });

  const paginatedDocs = filteredDocs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getAccessBadge = (level) => {
    const meta = ACCESS_META[level] || ACCESS_META.all;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${meta.style}`}
      >
        <ShieldCheck className="w-3 h-3" />
        <span>{meta.label}</span>
      </span>
    );
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
            Documents
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Official school handbooks, circulars, and academic records with role and class access control.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsUploadOpen(true)}
          icon={<Upload className="w-4 h-4" />}
        >
          Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#797869] uppercase tracking-wider">
              Total Documents
            </p>
            <p className="text-2xl font-bold text-[#1c1c14] mt-1 tabular-nums">
              {documents.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] flex items-center justify-center text-[#616218]">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#797869] uppercase tracking-wider">
              Categories
            </p>
            <p className="text-2xl font-bold text-[#1c1c14] mt-1 tabular-nums">
              {categories.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] flex items-center justify-center text-[#616218]">
            <FolderOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#797869] uppercase tracking-wider">
              Restricted Files
            </p>
            <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
              {documents.filter((d) => d.accessLevel === 'staff' || d.accessLevel === 'admin').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#c9c7b6]/60 pb-2">
        {[
          { id: 'documents', label: 'Documents', icon: FileText },
          { id: 'folders', label: 'Folders', icon: FolderOpen },
          { id: 'access', label: 'Access Control', icon: Shield }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-10 px-4 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#616218] text-white shadow-xs'
                  : 'bg-white border border-[#c9c7b6] text-[#44443b] hover:bg-[#faf8f0]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs">
        <div className="w-full md:w-80">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents by title or category..."
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={selectedAccess}
            onChange={(e) => setSelectedAccess(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
          >
            <option value="all">All Permissions</option>
            <option value="students">Students & Staff</option>
            <option value="staff">Staff Only</option>
            <option value="admin">Admin Only</option>
          </select>
        </div>
      </div>

      {activeTab === 'documents' && (
        <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#faf8f0] border-b border-[#c9c7b6] text-[#1c1c14] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Document Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">File</th>
                  <th className="py-3.5 px-4">Access Level</th>
                  <th className="py-3.5 px-4">Upload Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c9c7b6]/50">
                {paginatedDocs.length > 0 ? (
                  paginatedDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#faf8f0]/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#1c1c14]">{doc.name}</td>
                      <td className="py-3.5 px-4 text-[#44443b]">{doc.category}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#797869]">
                        {doc.fileName || `${doc.name}.pdf`}
                      </td>
                      <td className="py-3.5 px-4">{getAccessBadge(doc.accessLevel)}</td>
                      <td className="py-3.5 px-4 text-[#797869]">{doc.uploadDate}</td>
                      <td className="py-3.5 px-4 text-right">
                        <TableActions
                          actions={[
                            {
                              label: 'View Document',
                              icon: Eye,
                              onClick: () => setViewDocModal(doc)
                            },
                            {
                              label: 'Edit Access',
                              icon: Shield,
                              onClick: () => openEditAccess(doc)
                            },
                            {
                              label: 'Download File',
                              icon: Download,
                              onClick: () => {
                                downloadSchoolFile({
                                  ...doc,
                                  title: doc.name
                                });
                                showToast(`Downloading ${doc.fileName || doc.name}`);
                              }
                            },
                            {
                              label: 'Delete Document',
                              icon: Trash2,
                              danger: true,
                              onClick: () => setConfirmDeleteDoc(doc)
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-[#797869]">
                      No documents found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredDocs.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {activeTab === 'folders' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const count = documents.filter((d) => d.category === cat).length;
            return (
              <div
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setActiveTab('documents');
                }}
                className="p-5 rounded-lg border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] shadow-xs cursor-pointer transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] flex items-center justify-center text-[#616218]">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#1c1c14]">{cat}</div>
                    <div className="text-xs text-[#797869]">{count} files</div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#616218]">Open</span>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'access' && (
        <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#c9c7b6] bg-[#faf8f0]">
            <h2 className="text-sm font-bold text-[#1c1c14]">Document Access Permissions</h2>
            <p className="text-xs text-[#797869] mt-0.5">
              Control which portal roles and secondary classes can view or download each school document.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#faf8f0] border-b border-[#c9c7b6] text-[#1c1c14] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Document</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Permitted Role</th>
                  <th className="py-3.5 px-4">Permitted Classes</th>
                  <th className="py-3.5 px-4 text-right">Edit Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c9c7b6]/50">
                {paginatedDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#faf8f0]/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-[#1c1c14]">{doc.name}</td>
                    <td className="py-3.5 px-4 text-[#44443b]">{doc.category}</td>
                    <td className="py-3.5 px-4">{getAccessBadge(doc.accessLevel)}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(doc.allowedClasses || ['All Classes']).map((cls) => (
                          <span
                            key={cls}
                            className="px-2 py-0.5 rounded bg-[#faf8f0] border border-[#c9c7b6] text-[10px] font-semibold text-[#494900]"
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button variant="outline" onClick={() => openEditAccess(doc)}>
                        Configure
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredDocs.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Document"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUploadDocument}>
              Upload Document
            </Button>
          </>
        }
      >
        <form onSubmit={handleUploadDocument} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Select File</label>
            <label className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-[#c9c7b6] bg-[#faf8f0] hover:bg-[#f4f2e1] cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-[#616218] mb-1.5" />
              <span className="text-xs font-semibold text-[#1c1c14]">
                {uploadForm.fileName ? uploadForm.fileName : 'Click to choose document file'}
              </span>
              {uploadForm.size && (
                <span className="text-[11px] text-[#797869] mt-0.5">{uploadForm.size}</span>
              )}
              <input type="file" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Document Title</label>
            <input
              type="text"
              required
              value={uploadForm.name}
              onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
              placeholder="e.g. Second Term Examination Timetable"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Category</label>
              <select
                value={uploadForm.category}
                onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                <option value="Policy & Handbook">Policy & Handbook</option>
                <option value="Academic Circulars">Academic Circulars</option>
                <option value="Examination Guidelines">Examination Guidelines</option>
                <option value="Staff Administration">Staff Administration</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Who Can Access</label>
              <select
                value={uploadForm.accessLevel}
                onChange={(e) => setUploadForm({ ...uploadForm, accessLevel: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                <option value="all">Everyone</option>
                <option value="students">Students & Staff</option>
                <option value="staff">Staff Only</option>
                <option value="admin">Admin Only</option>
              </select>
            </div>
          </div>

          {(uploadForm.accessLevel === 'all' || uploadForm.accessLevel === 'students') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#1c1c14]">Student Class Access</label>
                <label className="flex items-center gap-2 text-xs font-medium text-[#616218] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uploadForm.allClasses}
                    onChange={(e) =>
                      setUploadForm({
                        ...uploadForm,
                        allClasses: e.target.checked,
                        allowedClasses: e.target.checked ? [] : uploadForm.allowedClasses
                      })
                    }
                    className="w-4 h-4 accent-[#616218] rounded"
                  />
                  <span>All Classes</span>
                </label>
              </div>
              {!uploadForm.allClasses && (
                <div className="grid grid-cols-3 gap-2">
                  {SCHOOL_CLASSES.map((cls) => (
                    <label
                      key={cls}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                        uploadForm.allowedClasses.includes(cls)
                          ? 'bg-[#faf8f0] border-[#616218] font-semibold'
                          : 'bg-white border-[#c9c7b6]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={uploadForm.allowedClasses.includes(cls)}
                        onChange={() => toggleUploadClass(cls)}
                        className="w-4 h-4 accent-[#616218] rounded"
                      />
                      <span>{cls}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Notes</label>
            <textarea
              rows={3}
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder="Optional summary for staff and students..."
              className="w-full p-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!editAccessDoc}
        onClose={() => setEditAccessDoc(null)}
        title="Configure Document Access"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditAccessDoc(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveAccess}>
              Save Permissions
            </Button>
          </>
        }
      >
        {editAccessDoc && (
          <form onSubmit={handleSaveAccess} className="space-y-4">
            <div className="p-3 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]">
              <span className="text-[11px] text-[#797869] block">Document</span>
              <span className="text-sm font-bold text-[#1c1c14]">{editAccessDoc.name}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Role Access</label>
              <select
                value={accessForm.accessLevel}
                onChange={(e) => setAccessForm({ ...accessForm, accessLevel: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                <option value="all">Everyone</option>
                <option value="students">Students & Staff</option>
                <option value="staff">Staff Only</option>
                <option value="admin">Admin Only</option>
              </select>
            </div>

            {(accessForm.accessLevel === 'all' || accessForm.accessLevel === 'students') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#1c1c14]">Allowed Classes</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-[#616218] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accessForm.allClasses}
                      onChange={(e) =>
                        setAccessForm({
                          ...accessForm,
                          allClasses: e.target.checked,
                          allowedClasses: e.target.checked ? [] : accessForm.allowedClasses
                        })
                      }
                      className="w-4 h-4 accent-[#616218] rounded"
                    />
                    <span>All Classes</span>
                  </label>
                </div>
                {!accessForm.allClasses && (
                  <div className="grid grid-cols-3 gap-2">
                    {SCHOOL_CLASSES.map((cls) => (
                      <label
                        key={cls}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                          accessForm.allowedClasses.includes(cls)
                            ? 'bg-[#faf8f0] border-[#616218] font-semibold'
                            : 'bg-white border-[#c9c7b6]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={accessForm.allowedClasses.includes(cls)}
                          onChange={() => toggleEditAccessClass(cls)}
                          className="w-4 h-4 accent-[#616218] rounded"
                        />
                        <span>{cls}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </Modal>

      <Modal
        isOpen={!!viewDocModal}
        onClose={() => setViewDocModal(null)}
        title="Document Details"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewDocModal(null)}>
              Close
            </Button>
            {viewDocModal && (
              <Button
                variant="primary"
                onClick={() => {
                  downloadSchoolFile({ ...viewDocModal, title: viewDocModal.name });
                  showToast(`Downloading ${viewDocModal.fileName || viewDocModal.name}`);
                }}
                icon={<Download className="w-4 h-4" />}
              >
                Download
              </Button>
            )}
          </>
        }
      >
        {viewDocModal && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[#797869] block">Title</span>
              <span className="text-sm font-bold text-[#1c1c14]">{viewDocModal.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]">
              <div>
                <span className="text-[#797869] block">Category</span>
                <span className="font-semibold text-[#1c1c14]">{viewDocModal.category}</span>
              </div>
              <div>
                <span className="text-[#797869] block">Uploaded</span>
                <span className="font-semibold text-[#1c1c14]">{viewDocModal.uploadDate}</span>
              </div>
              <div>
                <span className="text-[#797869] block">File Name</span>
                <span className="font-mono text-[#1c1c14]">
                  {viewDocModal.fileName || `${viewDocModal.name}.pdf`}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block">File Size</span>
                <span className="font-semibold text-[#1c1c14]">{viewDocModal.size}</span>
              </div>
            </div>
            <div>
              <span className="text-[#797869] block mb-1">Access Policy</span>
              {getAccessBadge(viewDocModal.accessLevel)}
            </div>
            <div>
              <span className="text-[#797869] block mb-1">Permitted Classes</span>
              <div className="flex flex-wrap gap-1.5">
                {(viewDocModal.allowedClasses || ['All Classes']).map((cls) => (
                  <span
                    key={cls}
                    className="px-2.5 py-1 rounded bg-[#faf8f0] border border-[#c9c7b6] font-semibold text-[#494900]"
                  >
                    {cls}
                  </span>
                ))}
              </div>
            </div>
            {viewDocModal.description && (
              <div>
                <span className="text-[#797869] block mb-1">Summary</span>
                <p className="text-[#44443b] leading-relaxed">{viewDocModal.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        variant="confirm"
        isOpen={!!confirmDeleteDoc}
        onClose={() => setConfirmDeleteDoc(null)}
        title="Delete Document"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDeleteDoc(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteDocument}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-xs text-[#44443b]">
          Are you sure you want to delete <strong>{confirmDeleteDoc?.name}</strong>?
        </p>
      </Modal>
    </div>
  );
}

export default AdminDocuments;
