import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import React from 'react';

// Type for Laravel pagination data excluding the data array
export type PaginationData = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    next_page_url: string | null;
    prev_page_url: string | null;
};

type PaginationProps = {
    pagination: PaginationData;
};

const PaginationComponent: React.FC<PaginationProps> = ({ pagination }) => {
    const { current_page, last_page, prev_page_url, next_page_url } = pagination;

    return (
        <Pagination className="flex items-center justify-end p-4">
            <PaginationContent>
                {/* Previous Page Link */}
                {prev_page_url ? (
                    <PaginationItem>
                        <PaginationPrevious href={prev_page_url} />
                    </PaginationItem>
                ) : (
                    <PaginationItem>
                        <PaginationPrevious />
                    </PaginationItem>
                )}

                {/* Generate Page Links Dynamically */}
                {Array.from({ length: last_page }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, and a few pages around the current page
                    if (page === 1 || page === last_page || (page >= current_page - 1 && page <= current_page + 1)) {
                        return (
                            <PaginationItem key={page}>
                                <PaginationLink href={`?page=${page}`} isActive={page === current_page}>
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        );
                    }

                    // Optionally show ellipsis where pages are skipped
                    if ((page === 2 && current_page > 4) || (page === last_page - 1 && current_page < last_page - 3)) {
                        return (
                            <PaginationItem key={`ellipsis-${page}`}>
                                <PaginationEllipsis />
                            </PaginationItem>
                        );
                    }

                    return null;
                })}
                {next_page_url ? (
                    <PaginationItem>
                        <PaginationNext href={next_page_url} />
                    </PaginationItem>
                ) : (
                    <PaginationItem>
                        <PaginationNext />
                    </PaginationItem>
                )}
            </PaginationContent>
        </Pagination>
    );
};

export default PaginationComponent;
