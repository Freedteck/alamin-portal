import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
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

export function StudentDocuments() {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [activeStudent, setActiveStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const loadRequest = useRef(0);

  const [viewDoc, setViewDoc] = useState(null);
  const [toast, setToast] = useState(null);

  const loadDocuments = async () => {
    const requestId = ++loadRequest.current;
    try {
      const [student, result] = await Promise.all([
        schoolStore.fetchCurrentStudent(),
        schoolStore.fetchDocuments({
          page: currentPage,
          limit: pageSize,
          search: searchTerm,
          category: selectedCategory
        })
      ]);
      if (requestId !== loadRequest.current) return;
      setActiveStudent(student);
      setDocuments(Array.isArray(result?.data) ? result.data : []);
      setCategories(Array.isArray(result?.categories) ? result.categories : []);
      setTotalDocuments(result?.total || 0);
    } catch (error) {
      if (requestId !== loadRequest.current) return;
      console.error('Failed to load student documents:', error);
      setActiveStudent(null);
      setDocuments([]);
      setCategories([]);
      setTotalDocuments(0);
    }
  };

  useEffect(() => {
    loadDocuments();
    const unsubscribe = subscribeSchoolSync(loadDocuments);
    return () => {
      loadRequest.current += 1;
      unsubscribe();
    };
  }, [currentPage, searchTerm, selectedCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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
          Documents
        </h1>
        <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
          School handbooks, examination schedules, and notices accessible to{' '}
          {activeStudent?.class || 'students'}.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-lg border border-[#c9c7b6] shadow-xs">
        <div className="w-full md:w-80">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents..."
          />
        </div>

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
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#faf8f0] border-b border-[#c9c7b6] text-[#1c1c14] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Document Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">File</th>
                <th className="py-3.5 px-4">Size</th>
                <th className="py-3.5 px-4">Upload Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9c7b6]/50">
              {documents.length > 0 ? (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#faf8f0]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#616218]" />
                        <span className="font-semibold text-[#1c1c14]">{doc.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#44443b]">{doc.category}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#797869]">
                      {doc.fileName || `${doc.name}.pdf`}
                    </td>
                    <td className="py-3.5 px-4 text-[#797869]">{doc.size}</td>
                    <td className="py-3.5 px-4 text-[#797869]">{doc.uploadDate}</td>
                    <td className="py-3.5 px-4 text-right">
                      <TableActions
                        actions={[
                          {
                            label: 'View Document',
                            icon: Eye,
                            onClick: () => setViewDoc(doc)
                          },
                          {
                            label: 'Download File',
                            icon: Download,
                            onClick: () => {
                              downloadSchoolFile({ ...doc, title: doc.name });
                              showToast(`Downloading ${doc.fileName || doc.name}`);
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
                    No documents permitted for your class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={totalDocuments}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* View Modal */}
      <Modal
        isOpen={!!viewDoc}
        onClose={() => setViewDoc(null)}
        title="Document Details"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewDoc(null)}>
              Close
            </Button>
            {viewDoc && (
              <Button
                variant="primary"
                onClick={() => {
                  downloadSchoolFile({ ...viewDoc, title: viewDoc.name });
                  showToast(`Downloading ${viewDoc.fileName || viewDoc.name}`);
                }}
                icon={<Download className="w-4 h-4" />}
              >
                Download
              </Button>
            )}
          </>
        }
      >
        {viewDoc && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[#797869] block">Title</span>
              <span className="text-sm font-bold text-[#1c1c14]">{viewDoc.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]">
              <div>
                <span className="text-[#797869] block">Category</span>
                <span className="font-semibold text-[#1c1c14]">{viewDoc.category}</span>
              </div>
              <div>
                <span className="text-[#797869] block">File Size</span>
                <span className="font-semibold text-[#1c1c14]">{viewDoc.size}</span>
              </div>
            </div>
            {viewDoc.description && (
              <div>
                <span className="text-[#797869] block mb-1">Summary</span>
                <p className="text-[#44443b] leading-relaxed">{viewDoc.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default StudentDocuments;
