import { useEffect, useMemo, useState } from 'react';
import { TABLE_ROWS_PER_PAGE, clampPage, getTotalPages } from '../components/common/TablePaginationControls';

const useTablePagination = (records = [], resetKeys = [], rowsPerPage = TABLE_ROWS_PER_PAGE) => {
  const [page, setPage] = useState(1);
  const totalRecords = records.length;
  const totalPages = getTotalPages(totalRecords, rowsPerPage);

  useEffect(() => {
    setPage(1);
  }, resetKeys);

  useEffect(() => {
    setPage((currentPage) => clampPage(currentPage, totalPages));
  }, [totalPages]);

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return records.slice(start, start + rowsPerPage);
  }, [page, records, rowsPerPage]);

  return {
    page,
    setPage,
    rowsPerPage,
    totalPages,
    totalRecords,
    paginatedRecords,
  };
};

export default useTablePagination;
