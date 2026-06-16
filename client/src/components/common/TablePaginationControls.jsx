import React, { useEffect, useState } from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import { KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';

export const TABLE_ROWS_PER_PAGE = 10;

export const getTotalPages = (totalRecords, rowsPerPage = TABLE_ROWS_PER_PAGE) =>
  Math.max(1, Math.ceil((Number(totalRecords) || 0) / rowsPerPage));

export const clampPage = (page, totalPages) => {
  const numericPage = Number.parseInt(page, 10);
  if (Number.isNaN(numericPage)) return 1;
  return Math.min(Math.max(numericPage, 1), Math.max(1, totalPages));
};

const TablePaginationControls = ({
  page,
  totalRecords,
  totalPages: totalPagesProp,
  onPageChange,
  rowsPerPage = TABLE_ROWS_PER_PAGE,
  sx,
}) => {
  const totalPages = totalPagesProp || getTotalPages(totalRecords, rowsPerPage);
  const normalizedPage = clampPage(page, totalPages);
  const [pageInput, setPageInput] = useState(String(normalizedPage));
  const shouldShow = (Number(totalRecords) || 0) > rowsPerPage || totalPages > 1;

  useEffect(() => {
    setPageInput(String(normalizedPage));
  }, [normalizedPage]);

  useEffect(() => {
    if (normalizedPage !== page) {
      onPageChange(normalizedPage);
    }
  }, [normalizedPage, onPageChange, page]);

  const commitPage = () => {
    const nextPage = clampPage(pageInput, totalPages);
    setPageInput(String(nextPage));
    if (nextPage !== normalizedPage) {
      onPageChange(nextPage);
    }
  };

  if (!shouldShow) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 0.5,
        py: 0.75,
        ...sx,
      }}
    >
      <IconButton
        aria-label="Previous page"
        size="small"
        disabled={normalizedPage <= 1}
        onClick={() => onPageChange(normalizedPage - 1)}
        sx={{
          width: 28,
          height: 28,
          color: '#f59e0b',
          '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' },
        }}
      >
        <KeyboardArrowLeft sx={{ fontSize: 18 }} />
      </IconButton>

      <TextField
        size="small"
        value={pageInput}
        onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commitPage}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitPage();
            event.currentTarget.blur();
          }
        }}
        inputProps={{
          'aria-label': `Page number, 1 to ${totalPages}`,
          inputMode: 'numeric',
          min: 1,
          max: totalPages,
          style: {
            boxSizing: 'border-box',
            height: 26,
            lineHeight: '26px',
            padding: 0,
            textAlign: 'center',
            fontWeight: 800,
            fontSize: '0.78rem',
          },
        }}
        sx={{
          width: 34,
          '& .MuiOutlinedInput-root': {
            width: 34,
            height: 26,
            minHeight: 26,
            color: '#0f172a',
            borderRadius: '8px',
            background: '#f59e0b',
            boxShadow: '0 4px 10px rgba(245,158,11,0.2)',
            p: 0,
            '& fieldset': { border: 'none' },
          },
          '& .MuiOutlinedInput-input': {
            width: 34,
            height: 26,
            lineHeight: '26px',
            p: 0,
            textAlign: 'center',
          },
        }}
      />

      <IconButton
        aria-label="Next page"
        size="small"
        disabled={normalizedPage >= totalPages}
        onClick={() => onPageChange(normalizedPage + 1)}
        sx={{
          width: 28,
          height: 28,
          color: '#f59e0b',
          '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' },
        }}
      >
        <KeyboardArrowRight sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
};

export default TablePaginationControls;
