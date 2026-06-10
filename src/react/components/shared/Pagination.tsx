import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  infoText?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, infoText }: PaginationProps) {
  return (
    <div className="ccmd-pagination">
      {infoText && <span className="ccmd-pagination__info">{infoText}</span>}
      <div className="ccmd-pagination__nav">
        <button
          className="ccmd-iconbtn ccmd-iconbtn--sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="ccmd-pagination__page">{currentPage} / {totalPages}</span>
        <button
          className="ccmd-iconbtn ccmd-iconbtn--sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
