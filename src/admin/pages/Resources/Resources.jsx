import React, { useState, useEffect } from 'react';
import {
  FileText,
  BookOpen,
  Video,
  Plus,
  Download,
  Eye,
  Trash2,
  Wrench,
  Package,
  Upload,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { schoolStore, SCHOOL_CLASSES, subscribeSchoolSync } from '../../../shared/data/schoolData';
import { uploadSchoolFile, downloadSchoolFile } from '../../../shared/lib/storageService';

const ACCESS_LABELS = {
  all: { label: 'Everyone', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  staff: { label: 'Staff Only', style: 'bg-amber-50 text-amber-800 border-amber-200' },
  students: { label: 'Students & Staff', style: 'bg-sky-50 text-sky-800 border-sky-200' },
  admin: { label: 'Admin Only', style: 'bg-rose-50 text-rose-800 border-rose-200' }
};

export function AdminResources() {
  const [activeTab, setActiveTab] = useState('resources');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [resources, setResources] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [subjectNames, setSubjectNames] = useState([]);

  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [viewResourceModal, setViewResourceModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const [resourceForm, setResourceForm] = useState({
    title: '',
    type: 'document',
    subject: '',
    description: '',
    accessLevel: 'students',
    allClasses: true,
    classes: [],
    fileName: '',
    fileSize: '',
    fileObj: null
  });

  const [equipmentForm, setEquipmentForm] = useState({
    name: '',
    category: 'Laboratory',
    quantity: '1',
    location: '',
    condition: 'excellent'
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    itemName: '',
    issue: '',
    priority: 'medium'
  });

  const refreshData = async () => {
    try {
      const [rRes, eRes, mRes, subRes] = await Promise.all([
        schoolStore.fetchResources(),
        schoolStore.fetchEquipment(),
        schoolStore.fetchMaintenance(),
        schoolStore.fetchSubjects()
      ]);
      setResources(Array.isArray(rRes) ? rRes : []);
      setEquipment(Array.isArray(eRes) ? eRes : []);
      setMaintenance(Array.isArray(mRes) ? mRes : []);
      const subs = Array.isArray(subRes) ? subRes.map((s) => s.name || s) : schoolStore.getSubjectNames();
      setSubjectNames(subs);
      setResourceForm((prev) => ({
        ...prev,
        subject: prev.subject || subs[0] || 'Mathematics'
      }));
    } catch {
      setResources(schoolStore.getResources());
      setEquipment(schoolStore.getEquipment());
      setMaintenance(schoolStore.getMaintenance());
      setSubjectNames(schoolStore.getSubjectNames());
    }
  };

  useEffect(() => {
    refreshData();
    return subscribeSchoolSync(refreshData);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSubject, selectedType, activeTab]);

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

  const handleResourceFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResourceForm((prev) => ({
      ...prev,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      fileObj: file,
      title: prev.title || file.name.replace(/\.[^/.]+$/, '')
    }));
  };

  const handleToggleResourceClass = (cls) => {
    setResourceForm((prev) => {
      const exists = prev.classes.includes(cls);
      const next = exists ? prev.classes.filter((c) => c !== cls) : [...prev.classes, cls];
      return { ...prev, allClasses: false, classes: next };
    });
  };

  const handleAddResource = async (e) => {
    e.preventDefault();
    if (!resourceForm.title.trim()) {
      showToast('Please enter a resource title.');
      return;
    }
    if (!resourceForm.fileName) {
      showToast('Please select a file to upload.');
      return;
    }
    const targetClasses = resourceForm.allClasses
      ? ['All Classes']
      : resourceForm.classes.length > 0
      ? resourceForm.classes
      : ['All Classes'];

    const uploaded = resourceForm.fileObj
      ? await uploadSchoolFile('resources', resourceForm.fileObj)
      : { fileName: resourceForm.fileName, fileSize: resourceForm.fileSize || '1.2 MB', filePath: '', fileUrl: '' };

    schoolStore.addResource({
      title: resourceForm.title.trim(),
      type: resourceForm.type,
      subject: resourceForm.subject || subjectNames[0] || 'Mathematics',
      description: resourceForm.description.trim() || 'School curriculum learning material.',
      accessLevel: resourceForm.accessLevel,
      classes: targetClasses,
      fileName: uploaded.fileName || resourceForm.fileName,
      fileSize: uploaded.fileSize || resourceForm.fileSize || '1.2 MB',
      filePath: uploaded.filePath || '',
      fileUrl: uploaded.fileUrl || '',
      uploadedBy: 'School Administration'
    });

    setResourceForm({
      title: '',
      type: 'document',
      subject: subjectNames[0] || 'Mathematics',
      description: '',
      accessLevel: 'students',
      allClasses: true,
      classes: [],
      fileName: '',
      fileSize: '',
      fileObj: null
    });
    setIsAddResourceOpen(false);
    refreshData();
    showToast('Learning resource uploaded and access permissions saved.');
  };

  const handleAddEquipment = (e) => {
    e.preventDefault();
    if (!equipmentForm.name.trim()) {
      showToast('Please enter equipment name.');
      return;
    }
    const qty = Math.max(1, Number(equipmentForm.quantity) || 1);
    schoolStore.addEquipment({
      name: equipmentForm.name.trim(),
      category: equipmentForm.category,
      quantity: qty,
      available: qty,
      location: equipmentForm.location.trim() || 'Main Science Store',
      condition: equipmentForm.condition
    });
    setEquipmentForm({
      name: '',
      category: 'Laboratory',
      quantity: '1',
      location: '',
      condition: 'excellent'
    });
    setIsAddEquipmentOpen(false);
    refreshData();
    showToast('School equipment added.');
  };

  const handleAddMaintenance = (e) => {
    e.preventDefault();
    if (!maintenanceForm.itemName.trim() || !maintenanceForm.issue.trim()) {
      showToast('Please provide the equipment name and issue description.');
      return;
    }
    schoolStore.addMaintenance({
      itemName: maintenanceForm.itemName.trim(),
      issue: maintenanceForm.issue.trim(),
      priority: maintenanceForm.priority,
      reportedBy: 'School Administration'
    });
    setMaintenanceForm({ itemName: '', issue: '', priority: 'medium' });
    setIsMaintenanceModalOpen(false);
    refreshData();
    showToast('Maintenance request logged.');
  };

  const handleMaintenanceStatusChange = (id, status) => {
    schoolStore.updateMaintenanceStatus(id, status);
    refreshData();
    showToast('Maintenance status updated.');
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.kind === 'resource') {
      schoolStore.deleteResource(confirmDelete.id);
      showToast('Learning resource deleted.');
    } else if (confirmDelete.kind === 'equipment') {
      schoolStore.deleteEquipment(confirmDelete.id);
      showToast('Equipment record removed.');
    }
    setConfirmDelete(null);
    refreshData();
  };

  const filteredResources = resources.filter((r) => {
    const matchesSearch =
      r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.fileName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || r.subject === selectedSubject;
    const matchesType = selectedType === 'all' || r.type === selectedType;
    return matchesSearch && matchesSubject && matchesType;
  });

  const filteredEquipment = equipment.filter(
    (e) =>
      e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMaintenance = maintenance.filter((m) => {
    const label = m.itemName || m.equipmentName || '';
    return (
      label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.issue?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const activeList =
    activeTab === 'resources'
      ? filteredResources
      : activeTab === 'equipment'
      ? filteredEquipment
      : filteredMaintenance;

  const paginatedList = activeList.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getTypeIcon = (type) => {
    switch (type) {
      case 'document':
        return <FileText className="w-4 h-4 text-[#616218]" />;
      case 'video':
        return <Video className="w-4 h-4 text-sky-700" />;
      case 'guide':
        return <BookOpen className="w-4 h-4 text-emerald-700" />;
      default:
        return <FileText className="w-4 h-4 text-[#797869]" />;
    }
  };

  const getAccessBadge = (accessLevel) => {
    const cfg = ACCESS_LABELS[accessLevel] || ACCESS_LABELS.all;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${cfg.style}`}
      >
        <ShieldCheck className="w-3 h-3" />
        <span>{cfg.label}</span>
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
            Resources
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Manage curriculum files, class access permissions, school equipment, and maintenance requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'resources' && (
            <Button
              variant="primary"
              onClick={() => setIsAddResourceOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Resource
            </Button>
          )}
          {activeTab === 'equipment' && (
            <Button
              variant="primary"
              onClick={() => setIsAddEquipmentOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Equipment
            </Button>
          )}
          {activeTab === 'maintenance' && (
            <Button
              variant="primary"
              onClick={() => setIsMaintenanceModalOpen(true)}
              icon={<Wrench className="w-4 h-4" />}
            >
              Report Maintenance
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#797869] uppercase tracking-wider">
              Learning Resources
            </p>
            <p className="text-2xl font-bold text-[#1c1c14] mt-1 tabular-nums">
              {resources.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] flex items-center justify-center text-[#616218]">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#797869] uppercase tracking-wider">
              School Equipment
            </p>
            <p className="text-2xl font-bold text-[#1c1c14] mt-1 tabular-nums">
              {equipment.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#faf8f0] border border-[#c9c7b6] flex items-center justify-center text-[#616218]">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#797869] uppercase tracking-wider">
              Open Maintenance
            </p>
            <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
              {maintenance.filter((m) => m.status !== 'completed').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Wrench className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#c9c7b6]/60 pb-2">
        {[
          { id: 'resources', label: 'Learning Resources', icon: BookOpen },
          { id: 'equipment', label: 'Equipment', icon: Package },
          { id: 'maintenance', label: 'Maintenance', icon: Wrench }
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
            placeholder={`Search ${activeTab}...`}
          />
        </div>

        {activeTab === 'resources' && (
          <div className="flex flex-wrap gap-3">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14] focus:outline-none focus:ring-1 focus:ring-[#616218]"
            >
              <option value="all">All Subjects</option>
              {subjectNames.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14] focus:outline-none focus:ring-1 focus:ring-[#616218]"
            >
              <option value="all">All Types</option>
              <option value="document">Document</option>
              <option value="video">Video Lesson</option>
              <option value="guide">Study Guide</option>
            </select>
          </div>
        )}
      </div>

      {activeTab === 'resources' && (
        <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#faf8f0] border-b border-[#c9c7b6] text-[#1c1c14] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Resource Title</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">File</th>
                  <th className="py-3.5 px-4">Access</th>
                  <th className="py-3.5 px-4">Classes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c9c7b6]/50">
                {paginatedList.length > 0 ? (
                  paginatedList.map((res) => (
                    <tr key={res.id} className="hover:bg-[#faf8f0]/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {getTypeIcon(res.type)}
                          <span className="font-semibold text-[#1c1c14]">{res.title}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#44443b] font-medium">{res.subject}</td>
                      <td className="py-3.5 px-4 text-[#797869] font-mono text-[11px]">
                        {res.fileName || 'resource.pdf'}
                      </td>
                      <td className="py-3.5 px-4">{getAccessBadge(res.accessLevel)}</td>
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
                      <td className="py-3.5 px-4 text-right">
                        <TableActions
                          actions={[
                            {
                              label: 'View Resource',
                              icon: Eye,
                              onClick: () => setViewResourceModal(res)
                            },
                            {
                              label: 'Download File',
                              icon: Download,
                              onClick: () => {
                                downloadSchoolFile(res);
                                showToast(`Downloading ${res.fileName || res.title}`);
                              }
                            },
                            {
                              label: 'Delete Resource',
                              icon: Trash2,
                              danger: true,
                              onClick: () =>
                                setConfirmDelete({
                                  kind: 'resource',
                                  id: res.id,
                                  title: res.title
                                })
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-[#797869]">
                      No learning resources match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredResources.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#faf8f0] border-b border-[#c9c7b6] text-[#1c1c14] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Equipment Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Quantity</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Condition</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c9c7b6]/50">
                {paginatedList.length > 0 ? (
                  paginatedList.map((eq) => (
                    <tr key={eq.id} className="hover:bg-[#faf8f0]/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#1c1c14]">{eq.name}</td>
                      <td className="py-3.5 px-4 text-[#44443b]">{eq.category}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#616218]">
                        {eq.available ?? eq.quantity} / {eq.quantity}
                      </td>
                      <td className="py-3.5 px-4 text-[#44443b]">{eq.location}</td>
                      <td className="py-3.5 px-4 capitalize">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#faf8f0] border border-[#c9c7b6] text-[#494900]">
                          {eq.condition}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <TableActions
                          actions={[
                            {
                              label: 'Report Issue',
                              icon: Wrench,
                              onClick: () => {
                                setMaintenanceForm({
                                  itemName: eq.name,
                                  issue: '',
                                  priority: 'medium'
                                });
                                setIsMaintenanceModalOpen(true);
                              }
                            },
                            {
                              label: 'Remove Equipment',
                              icon: Trash2,
                              danger: true,
                              onClick: () =>
                                setConfirmDelete({
                                  kind: 'equipment',
                                  id: eq.id,
                                  title: eq.name
                                })
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-[#797869]">
                      No school equipment records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredEquipment.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#faf8f0] border-b border-[#c9c7b6] text-[#1c1c14] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Equipment Item</th>
                  <th className="py-3.5 px-4">Issue Description</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Reported Date</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c9c7b6]/50">
                {paginatedList.length > 0 ? (
                  paginatedList.map((mnt) => (
                    <tr key={mnt.id} className="hover:bg-[#faf8f0]/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#1c1c14]">
                        {mnt.itemName || mnt.equipmentName}
                      </td>
                      <td className="py-3.5 px-4 text-[#44443b] max-w-xs">{mnt.issue}</td>
                      <td className="py-3.5 px-4 capitalize font-semibold text-[#1c1c14]">
                        {mnt.priority}
                      </td>
                      <td className="py-3.5 px-4 text-[#797869]">{mnt.reportedDate}</td>
                      <td className="py-3.5 px-4">
                        <select
                          value={mnt.status}
                          onChange={(e) => handleMaintenanceStatusChange(mnt.id, e.target.value)}
                          className="h-9 px-2.5 rounded-lg border border-[#c9c7b6] bg-white text-xs font-semibold text-[#1c1c14]"
                        >
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-[#797869]">
                      No maintenance requests recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredMaintenance.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <Modal
        isOpen={isAddResourceOpen}
        onClose={() => setIsAddResourceOpen(false)}
        title="Add Learning Resource"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddResourceOpen(false)}>
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
            <label className="text-xs font-semibold text-[#1c1c14] block">Resource File</label>
            <label className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-[#c9c7b6] bg-[#faf8f0] hover:bg-[#f4f2e1] cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-[#616218] mb-1.5" />
              <span className="text-xs font-semibold text-[#1c1c14]">
                {resourceForm.fileName ? resourceForm.fileName : 'Click to choose file'}
              </span>
              {resourceForm.fileSize && (
                <span className="text-[11px] text-[#797869] mt-0.5">{resourceForm.fileSize}</span>
              )}
              <input
                type="file"
                className="hidden"
                onChange={handleResourceFileChange}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Resource Title</label>
            <input
              type="text"
              required
              value={resourceForm.title}
              onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
              placeholder="e.g. SSS 2 Quadratic Equations Packet"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14] focus:outline-none focus:ring-1 focus:ring-[#616218]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Subject</label>
              <select
                value={resourceForm.subject}
                onChange={(e) => setResourceForm({ ...resourceForm, subject: e.target.value })}
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
              <label className="text-xs font-semibold text-[#1c1c14] block">Resource Type</label>
              <select
                value={resourceForm.type}
                onChange={(e) => setResourceForm({ ...resourceForm, type: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                <option value="document">Document</option>
                <option value="video">Video Lesson</option>
                <option value="guide">Study Guide</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Access Control</label>
            <select
              value={resourceForm.accessLevel}
              onChange={(e) => setResourceForm({ ...resourceForm, accessLevel: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            >
              <option value="all">Everyone</option>
              <option value="students">Students & Staff</option>
              <option value="staff">Staff Only</option>
              <option value="admin">Admin Only</option>
            </select>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1c1c14]">Available Classes</label>
              <label className="flex items-center gap-2 text-xs font-medium text-[#616218] cursor-pointer">
                <input
                  type="checkbox"
                  checked={resourceForm.allClasses}
                  onChange={(e) =>
                    setResourceForm({
                      ...resourceForm,
                      allClasses: e.target.checked,
                      classes: e.target.checked ? [] : resourceForm.classes
                    })
                  }
                  className="w-4 h-4 accent-[#616218] rounded cursor-pointer"
                />
                <span>All Classes</span>
              </label>
            </div>
            {!resourceForm.allClasses && (
              <div className="grid grid-cols-3 gap-2">
                {SCHOOL_CLASSES.map((cls) => (
                  <label
                    key={cls}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                      resourceForm.classes.includes(cls)
                        ? 'bg-[#faf8f0] border-[#616218] text-[#1c1c14] font-semibold'
                        : 'bg-white border-[#c9c7b6] text-[#44443b]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={resourceForm.classes.includes(cls)}
                      onChange={() => handleToggleResourceClass(cls)}
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
              value={resourceForm.description}
              onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
              placeholder="Brief overview of the resource contents..."
              className="w-full p-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14] focus:outline-none focus:ring-1 focus:ring-[#616218]"
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isAddEquipmentOpen}
        onClose={() => setIsAddEquipmentOpen(false)}
        title="Add School Equipment"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddEquipmentOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddEquipment}>
              Save Equipment
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddEquipment} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Equipment Name</label>
            <input
              type="text"
              required
              value={equipmentForm.name}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
              placeholder="e.g. Digital Compound Microscope"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Category</label>
              <select
                value={equipmentForm.category}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, category: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              >
                <option value="Laboratory">Laboratory</option>
                <option value="ICT & Computing">ICT & Computing</option>
                <option value="Audio-Visual">Audio-Visual</option>
                <option value="Library">Library</option>
                <option value="Sports">Sports</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1c1c14] block">Quantity</label>
              <input
                type="number"
                min="1"
                value={equipmentForm.quantity}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, quantity: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Location</label>
            <input
              type="text"
              value={equipmentForm.location}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, location: e.target.value })}
              placeholder="e.g. Biology Lab"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Condition</label>
            <select
              value={equipmentForm.condition}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, condition: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            >
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="needs-repair">Needs Repair</option>
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        title="Report Maintenance Request"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsMaintenanceModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddMaintenance}>
              Submit Request
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddMaintenance} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Equipment Item</label>
            <input
              type="text"
              required
              value={maintenanceForm.itemName}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, itemName: e.target.value })}
              placeholder="Enter equipment name"
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Priority</label>
            <select
              value={maintenanceForm.priority}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, priority: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1c1c14] block">Issue Details</label>
            <textarea
              rows={4}
              required
              value={maintenanceForm.issue}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, issue: e.target.value })}
              placeholder="Describe the fault or repair needed..."
              className="w-full p-3 rounded-lg border border-[#c9c7b6] bg-white text-xs text-[#1c1c14]"
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!viewResourceModal}
        onClose={() => setViewResourceModal(null)}
        title="Resource Details"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewResourceModal(null)}>
              Close
            </Button>
            {viewResourceModal && (
              <Button
                variant="primary"
                onClick={() => {
                  downloadSchoolFile(viewResourceModal);
                  showToast(`Downloading ${viewResourceModal.fileName || viewResourceModal.title}`);
                }}
                icon={<Download className="w-4 h-4" />}
              >
                Download
              </Button>
            )}
          </>
        }
      >
        {viewResourceModal && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[#797869] block">Title</span>
              <span className="text-sm font-bold text-[#1c1c14]">{viewResourceModal.title}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]">
              <div>
                <span className="text-[#797869] block">Subject</span>
                <span className="font-semibold text-[#1c1c14]">{viewResourceModal.subject}</span>
              </div>
              <div>
                <span className="text-[#797869] block">Type</span>
                <span className="font-semibold text-[#1c1c14] capitalize">
                  {viewResourceModal.type}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block">File Name</span>
                <span className="font-mono text-[#1c1c14]">
                  {viewResourceModal.fileName || 'material.pdf'}
                </span>
              </div>
              <div>
                <span className="text-[#797869] block">File Size</span>
                <span className="font-semibold text-[#1c1c14]">
                  {viewResourceModal.fileSize || '1.4 MB'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[#797869] block mb-1">Access Control</span>
              {getAccessBadge(viewResourceModal.accessLevel)}
            </div>
            <div>
              <span className="text-[#797869] block mb-1">Assigned Classes</span>
              <div className="flex flex-wrap gap-1.5">
                {(viewResourceModal.classes || ['All Classes']).map((cls) => (
                  <span
                    key={cls}
                    className="px-2.5 py-1 rounded bg-[#faf8f0] border border-[#c9c7b6] font-semibold text-[#494900]"
                  >
                    {cls}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[#797869] block mb-1">Description</span>
              <p className="text-[#44443b] leading-relaxed">{viewResourceModal.description}</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        variant="confirm"
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Removal"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-xs text-[#44443b]">
          Are you sure you want to remove <strong>{confirmDelete?.title}</strong>?
        </p>
      </Modal>
    </div>
  );
}

export default AdminResources;
