import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 5,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20],
  itemLabel = 'records'
}) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (safePage > 3) pages.push('...');
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 border-t border-[#c9c7b6]/60 bg-[#faf8f0]/60 text-xs">
      <div className="flex flex-wrap items-center gap-3 text-[#797869]">
        <span>
          Showing <strong className="text-[#1c1c14]">{startItem}</strong>–
          <strong className="text-[#1c1c14]">{endItem}</strong> of{' '}
          <strong className="text-[#1c1c14]">{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 px-2 rounded-md border border-[#c9c7b6] bg-white text-xs font-semibold text-[#1c1c14] focus:outline-none focus:border-[#616218] cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Previous page"
          className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] font-semibold hover:bg-[#faf8f0] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="ml-1 hidden sm:inline">Prev</span>
        </button>

        {getPageNumbers().map((pg, idx) =>
          pg === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-1.5 text-[#797869]">
              ...
            </span>
          ) : (
            <button
              key={pg}
              type="button"
              onClick={() => onPageChange(pg)}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                safePage === pg
                  ? 'bg-[#616218] text-white border border-[#616218]'
                  : 'bg-white text-[#1c1c14] border border-[#c9c7b6] hover:bg-[#faf8f0]'
              }`}
            >
              {pg}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Next page"
          className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] font-semibold hover:bg-[#faf8f0] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <span className="mr-1 hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
