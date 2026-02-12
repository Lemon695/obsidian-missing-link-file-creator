import React from "react";
import { Button } from "@/react/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  infoText?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, infoText }: PaginationProps) {
  return (
    <div className="tw-flex tw-items-center tw-justify-between tw-pt-3 tw-border-t tw-border-border">
      {infoText && (
        <span className="tw-text-sm tw-text-muted-foreground">{infoText}</span>
      )}
      <div className="tw-flex tw-items-center tw-gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="tw-h-4 tw-w-4" />
        </Button>
        <span className="tw-text-sm tw-text-muted-foreground">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="tw-h-4 tw-w-4" />
        </Button>
      </div>
    </div>
  );
}
