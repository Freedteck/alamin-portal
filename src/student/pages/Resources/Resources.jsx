import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  FileText,
  Video,
  Download,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../../shared/components/Button/Button';
import { Modal } from '../../../shared/components/Modal/Modal';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { schoolStore, subscribeSchoolSync } from '../../../shared/data/schoolData';
import { downloadSchoolFile } from '../../../shared/lib/storageService';

export function StudentResources() {
  const [resources, setResources] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [totalResources, setTotalResources] = useState(0);
  const [activeStudent, setActiveStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const loadRequest = useRef(0);

  const [viewModal, setViewModal] = useState(null);
  const [toast, setToast] = useState(null);

  const loadResources = async () => {
    const requestId = ++loadRequest.current;
    try {
      const [student, result] = await Promise.all([
        schoolStore.fetchCurrentStudent(),
        schoolStore.fetchResources({
          page: currentPage,
          limit: pageSize,
          search: searchTerm,
          subject: selectedSubject
        })
      ]);
      if (requestId !== loadRequest.current) return;
      setActiveStudent(student);
      setResources(Array.isArray(result?.data) ? result.data : []);
      setSubjects(Array.isArray(result?.subjects) ? result.subjects : []);
      setTotalResources(result?.total || 0);
    } catch (error) {
      if (requestId !== loadRequest.current) return;
      console.error('Failed to load student resources:', error);
      setActiveStudent(null);
      setResources([]);
      setSubjects([]);
      setTotalResources(0);
    }
  };

  useEffect(() => {
    loadResources();
    const unsubscribe = subscribeSchoolSync(loadResources);
    return () => {
      loadRequest.current += 1;
      unsubscribe();
    };
  }, [currentPage, searchTerm, selectedSubject]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSubject]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

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

      {/* Header */}
      <div className="pb-2 border-b border-[#c9c7b6]/50">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
          Resources
        </h1>
        <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
          Curriculum notes, study guides, and past questions permitted for{' '}
          {activeStudent?.class || 'your class'}.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs">
        <div className="w-full md:w-80">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search study materials..."
          />
        </div>

        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
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

      {/* Table */}
      <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#faf8f0] border-b border-[#c9c7b6] text-[#1c1c14] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Resource Title</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">File</th>
                <th className="py-3.5 px-4">Size</th>
                <th className="py-3.5 px-4">Uploaded By</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9c7b6]/50">
              {resources.length > 0 ? (
                resources.map((res) => (
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
                    <td className="py-3.5 px-4 text-[#797869]">{res.fileSize || '1.0 MB'}</td>
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
                    No learning resources currently assigned to {activeStudent?.class || 'your class'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={totalResources}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* View Modal */}
      <Modal
        isOpen={!!viewModal}
        onClose={() => setViewModal(null)}
        title="Learning Resource Details"
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
                <span className="text-[#797869] block">File Name</span>
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

export default StudentResources;
