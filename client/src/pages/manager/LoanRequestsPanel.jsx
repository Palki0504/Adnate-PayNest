import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, MenuItem, Paper, Snackbar, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material';
import {
  Check, Close, Description, Download, Help, OpenInNew, RateReview,
  Visibility, AccessTime, CancelOutlined, Send, VerifiedUser,
} from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { loanApplicationAPI } from '../../services/api';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(value || 0);
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '-';
const fieldSx = {
  '& .MuiOutlinedInput-root': { bgcolor: '#fff', color: '#172033', borderRadius: '9px' },
  '& .MuiInputLabel-root': { color: '#64748b' },
};

const statusBadgeSx = (status) => {
  const displayStatus = status === 'Approved' ? 'Disbursed' : status;
  const palette = {
    Submitted: { bgcolor: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
    'Under Review': { bgcolor: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' },
    Approved: { bgcolor: '#dcfce7', color: '#15803d', border: '#86efac' },
    Rejected: { bgcolor: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
    'More Info Required': { bgcolor: '#ffedd5', color: '#c2410c', border: '#fdba74' },
    Disbursed: { bgcolor: '#e2e8f0', color: '#334155', border: '#94a3b8' },
    Closed: { bgcolor: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  };
  const colors = palette[displayStatus] || palette.Submitted;
  return {
    bgcolor: colors.bgcolor,
    color: colors.color,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    fontWeight: 800,
    '& .MuiChip-label': { px: 1.15 },
  };
};

const displayLoanStatus = (status) => status === 'Approved' ? 'Disbursed' : status;

const classificationSx = (classification) => {
  const palette = {
    DIAMOND: { bgcolor: '#dbeafe', color: '#1d4ed8' },
    PLATINUM: { bgcolor: '#ede9fe', color: '#6d28d9' },
    GOLD: { bgcolor: '#fef3c7', color: '#d97706' },
    SILVER: { bgcolor: '#e2e8f0', color: '#475569' },
  };
  return { ...(palette[String(classification || '').toUpperCase()] || palette.SILVER), fontWeight: 800, borderRadius: '8px', height: 24 };
};

const uniqueApplications = (rows = []) => {
  const seen = new Map();
  rows.forEach((item) => {
    const pendingKey = ['Submitted', 'Under Review', 'More Info Required'].includes(item.status)
      ? `${item.customerId}-${item.linkedAccountId || item.accountNumber}-${item.loanType}-${item.loanAmount}-${item.tenure}`
      : item._id;
    if (!seen.has(pendingKey)) seen.set(pendingKey, item);
  });
  return Array.from(seen.values());
};

const LoanRequestsPanel = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [documentLoading, setDocumentLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [action, setAction] = useState('');
  const [comment, setComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchApplications = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await loanApplicationAPI.getManagerApplications();
      setApplications(uniqueApplications(data.applications || []));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load loan requests.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const filteredApplications = useMemo(
    () => status ? applications.filter((application) => application.status === status) : applications,
    [applications, status]
  );

  const requestMetrics = useMemo(() => ([
    { label: 'Total Requests', value: applications.length, color: '#2563eb', bg: '#dbeafe', icon: <Description /> },
    { label: 'Under Review', value: applications.filter((item) => item.status === 'Under Review').length, color: '#7c3aed', bg: '#ede9fe', icon: <AccessTime /> },
    { label: 'Rejected', value: applications.filter((item) => item.status === 'Rejected').length, color: '#dc2626', bg: '#fee2e2', icon: <CancelOutlined /> },
    { label: 'Disbursed', value: applications.filter((item) => ['Approved', 'Disbursed'].includes(item.status)).length, color: '#16a34a', bg: '#dcfce7', icon: <Send /> },
  ]), [applications]);

  const downloadReport = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const formatReportAmount = (value) => `Rs. ${new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(Number(value) || 0)}`;
    const cleanText = (value) => String(value ?? '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    doc.setFillColor(11, 31, 77);
    doc.rect(0, 0, pageWidth, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.text('ADNATE PAYNEST', 14, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Manager Banking Portal', 14, 23);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('CUSTOMER LOAN REQUESTS REPORT', pageWidth - 14, 16, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      `Generated: ${new Date().toLocaleString('en-IN')} | Status: ${status || 'All Statuses'}`,
      pageWidth - 14,
      24,
      { align: 'right' }
    );

    const summary = [
      ['Total Requests', applications.length, [37, 99, 235]],
      ['Under Review', applications.filter((item) => item.status === 'Under Review').length, [245, 158, 11]],
      ['Rejected', applications.filter((item) => item.status === 'Rejected').length, [220, 38, 38]],
      ['Disbursed', applications.filter((item) => ['Approved', 'Disbursed'].includes(item.status)).length, [22, 163, 74]],
    ];
    const cardGap = 4;
    const cardWidth = (pageWidth - 28 - (cardGap * 4)) / 5;
    summary.forEach(([label, value, color], index) => {
      const x = 14 + index * (cardWidth + cardGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, 42, cardWidth, 18, 2.5, 2.5, 'FD');
      doc.setFillColor(...color);
      doc.circle(x + 7, 51, 3.2, 'F');
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(label, x + 13, 48.5);
      doc.setTextColor(...color);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(String(value), x + 13, 55.5);
    });

    const rows = filteredApplications.map((item) => [
      cleanText(item.customerName),
      cleanText(item.email),
      cleanText(item.customerId),
      cleanText(item.classification),
      cleanText(item.loanType).replace(/\b\w/g, (letter) => letter.toUpperCase()),
      formatReportAmount(item.loanAmount),
      formatReportAmount(item.employmentDetails?.monthlyIncome),
      formatReportAmount(item.employmentDetails?.existingEMI),
      `${Number(item.employmentDetails?.overdraftUtilization || 0)}%`,
      cleanText(date(item.appliedAt)),
      cleanText(item.status),
    ]);

    doc.autoTable({
      startY: 66,
      head: [['Customer', 'Email', 'Customer ID', 'Class', 'Loan Type', 'Loan Amount', 'Income', 'Existing EMI', 'OD Use', 'Applied On', 'Status']],
      body: rows,
      theme: 'grid',
      margin: { left: 14, right: 14, bottom: 14 },
      styles: {
        font: 'helvetica',
        fontSize: 7.2,
        cellPadding: 2.1,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        valign: 'middle',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [11, 31, 77],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 2.6,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 38 },
        2: { cellWidth: 24 },
        3: { cellWidth: 19, halign: 'center' },
        4: { cellWidth: 22 },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 23, halign: 'right' },
        7: { cellWidth: 23, halign: 'right' },
        8: { cellWidth: 16, halign: 'center' },
        9: { cellWidth: 22, halign: 'center' },
        10: { cellWidth: 23, halign: 'center' },
      },
      didDrawPage: () => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Confidential - For authorized Adnate PayNest personnel only', 14, pageHeight - 7);
        doc.text(
          `Page ${doc.internal.getNumberOfPages()}`,
          pageWidth - 14,
          pageHeight - 7,
          { align: 'right' }
        );
      },
    });

    if (rows.length === 0) {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(10);
      doc.text('No loan requests match the selected status filter.', pageWidth / 2, 82, { align: 'center' });
    }

    doc.save(`Adnate_PayNest_Loan_Requests_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const openDetails = async (id) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await loanApplicationAPI.getDetails(id);
      setSelected(data.application);
      setAction('');
      setComment('');
      setRejectionReason('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load application details.');
    } finally {
      setLoading(false);
    }
  };

  const submitAction = async () => {
    if (!selected || !action || submitting) return;
    if (action === 'reject' && !rejectionReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    if (action === 'more-info' && !comment.trim()) {
      setError('Manager comment is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const submittedAction = action;
      const { data } = await loanApplicationAPI.updateStatus(selected._id, {
        action,
        comment,
        rejectionReason,
      });
      const updatedApplication = data.application;

      setApplications((current) => current.map((item) => (
        item._id === updatedApplication._id ? { ...item, ...updatedApplication } : item
      )).filter((item) => item._id !== updatedApplication._id || !['Submitted', 'Under Review', 'More Info Required'].includes(updatedApplication.status) || status === updatedApplication.status));
      setSelected(null);
      setAction('');
      setSuccess(
        submittedAction === 'approve'
          ? 'Loan request approved successfully.'
          : data.message
      );
      await fetchApplications(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update application.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDocumentBlob = async (doc, download = false) => {
    if (!selected || documentLoading) return null;
    setDocumentLoading(doc._id);
    setError('');
    try {
      const { data } = await loanApplicationAPI.getDocument(selected._id, doc._id, download);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to open document.');
      return null;
    } finally {
      setDocumentLoading('');
    }
  };

  const viewDocument = async (doc) => {
    const blob = await getDocumentBlob(doc);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreview({ ...doc, url });
  };

  const openDocumentInNewTab = async (doc) => {
    const newTab = window.open('', '_blank');
    if (newTab) {
      newTab.opener = null;
      newTab.document.title = 'Loading document...';
    }
    const blob = await getDocumentBlob(doc);
    if (!blob) {
      newTab?.close();
      return;
    }
    const url = URL.createObjectURL(blob);
    if (newTab) {
      newTab.location.href = url;
    } else {
      setPreview({ ...doc, url });
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const downloadDocument = async (doc) => {
    const blob = await getDocumentBlob(doc, true);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.originalName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const closePreview = () => {
    setPreview(null);
  };

  const detailSections = selected ? [
    ['Loan Details', {
      'Loan Type': selected.loanType,
      Purpose: selected.purpose,
      'Loan Amount': money(selected.loanAmount),
      Tenure: `${selected.tenure} months`,
      'Interest Rate': `${selected.interestRate}%`,
      'EMI Start Date': date(selected.emiStartDate),
      'Estimated EMI': money(selected.estimatedEMI),
      'Total Interest': money(selected.totalInterest),
      'Total Repayment': money(selected.totalRepayment),
    }],
    ['Personal Details', selected.personalDetails],
    ['Employment Details', {
      ...selected.employmentDetails,
      monthlyIncome: money(selected.employmentDetails?.monthlyIncome),
      existingEMI: money(selected.employmentDetails?.existingEMI),
      monthlyExpenses: money(selected.employmentDetails?.monthlyExpenses),
      overdraftUtilization: `${selected.employmentDetails?.overdraftUtilization || 0}%`,
    }],
    ['Eligibility Summary', {
      Score: `${selected.eligibilitySummary?.score || 0}/100`,
      Eligible: selected.eligibilitySummary?.isEligible ? 'Yes' : 'No',
      'Debt-to-Income': `${Number(selected.eligibilitySummary?.debtToIncomeRatio || 0).toFixed(1)}%`,
      'Disposable Income': money(selected.eligibilitySummary?.disposableIncome),
    }],
  ] : [];

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Snackbar
        open={Boolean(success)}
        autoHideDuration={4000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>

      <Paper sx={{ p: 0, bgcolor: 'transparent', borderRadius: 0, border: 0, boxShadow: 'none', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
        <Paper sx={{ p: { xs: 2, md: 2.5 }, mb: 2.5, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 26px rgba(2,12,36,.13)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', lg: 'center' }, flexDirection: { xs: 'column', lg: 'row' }, gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.6, minWidth: 0 }}>
              <Box sx={{ width: 48, height: 48, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '14px', bgcolor: '#dbeafe', color: '#2563eb' }}><Description /></Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: '#0B1F4D', fontWeight: 900, fontSize: { xs: '1.05rem', md: '1.25rem' } }}>Customer Loan Requests</Typography>
                <Typography sx={{ color: '#64748b', fontSize: '.86rem', mt: .3 }}>Review and process customer loan applications.</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.2, flexShrink: 0 }}>
              <Typography sx={{ color: '#334155', fontWeight: 800, fontSize: '.82rem' }}>Status</Typography>
              <TextField select size="small" value={status} onChange={(event) => setStatus(event.target.value)} sx={{ ...fieldSx, width: { xs: '100%', sm: 205 } }}>
                <MenuItem value="">All Statuses</MenuItem>
                {['Submitted', 'Under Review', 'Rejected', 'More Info Required', 'Disbursed', 'Closed'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <Button variant="contained" startIcon={<Download />} onClick={downloadReport} sx={{ bgcolor: '#0B1F4D', color: '#fff', borderRadius: '10px', px: 2.3, minHeight: 40, fontWeight: 800, boxShadow: '0 7px 16px rgba(11,31,77,.2)', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#163873', transform: 'translateY(-1px)' } }}>Download Report</Button>
            </Box>
          </Box>
        </Paper>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5, mb: 2.5 }}>
          {requestMetrics.map((metric) => (
            <Box key={metric.label} sx={{ minWidth: 0 }}>
              <Card sx={{ height: '100%', bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: '15px', boxShadow: '0 9px 22px rgba(2,12,36,.12)', transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 14px 28px rgba(2,12,36,.17)' } }}>
                <CardContent sx={{ p: 2.2, display: 'flex', alignItems: 'center', gap: 1.6 }}>
                  <Box sx={{ width: 48, height: 48, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: metric.bg, color: metric.color, '& svg': { fontSize: 27 } }}>{metric.icon}</Box>
                  <Box>
                    <Typography sx={{ color: metric.color, fontSize: '1.55rem', lineHeight: 1.1, fontWeight: 900 }}>{metric.value}</Typography>
                    <Typography sx={{ color: '#475569', fontSize: '.82rem', mt: .45 }}>{metric.label}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>

        {loading && !selected ? (
          <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress sx={{ color: '#fff' }} /></Box>
        ) : (
        <Paper sx={{ p: { xs: 1.25, md: 1.6 }, bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 26px rgba(2,12,36,.13)', overflow: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <TableContainer sx={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
          <Table size="small" sx={{ minWidth: 1180, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#eff6ff' }}>
                {['Customer', 'ID / Classification', 'Loan Type', 'Loan Amount', 'Income', 'Existing EMI', 'OD Use', 'Applied On', 'Status', 'Action'].map((item) => (
                  <TableCell
                    key={item}
                    sx={{
                      color: '#0B1F4D',
                      borderColor: '#dbeafe',
                      fontWeight: 900,
                      px: 1.35,
                      py: 1.4,
                      whiteSpace: 'nowrap',
                      width: item === 'Action' ? 82 : item === 'Customer' ? 205 : item === 'ID / Classification' ? 160 : undefined,
                    }}
                  >
                    {item}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredApplications.map((item, index) => (
                <TableRow key={item._id} sx={{ bgcolor: index % 2 ? '#f8fafc' : '#fff', '& td': { color: '#334155', borderColor: '#e2e8f0', px: 1.35, py: 1.35, overflow: 'hidden' }, '&:hover': { bgcolor: '#eff6ff' } }}>
                  <TableCell sx={{ width: 205 }}>
                    <Typography noWrap sx={{ color: '#0f172a', fontWeight: 800 }}>{item.customerName}</Typography>
                    <Typography noWrap sx={{ fontSize: '.74rem', color: '#64748b', mt: .25 }}>{item.email}</Typography>
                  </TableCell>
                  <TableCell sx={{ width: 160 }}><Typography noWrap sx={{ color: '#0f172a', fontSize: '.78rem', fontWeight: 700 }}>{item.customerId}</Typography><Chip size="small" label={item.classification} sx={{ mt: .55, ...classificationSx(item.classification) }} /></TableCell>
                  <TableCell sx={{ textTransform: 'capitalize', fontWeight: 700 }}>{item.loanType}</TableCell>
                  <TableCell sx={{ color: '#0f172a !important', fontWeight: 800 }}>{money(item.loanAmount)}</TableCell>
                  <TableCell>{money(item.employmentDetails?.monthlyIncome)}</TableCell>
                  <TableCell>{money(item.employmentDetails?.existingEMI)}</TableCell>
                  <TableCell>{item.employmentDetails?.overdraftUtilization || 0}%</TableCell>
                  <TableCell>{date(item.appliedAt)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={displayLoanStatus(item.status)}
                      sx={statusBadgeSx(item.status)}
                    />
                  </TableCell>
                  <TableCell sx={{ width: 82, minWidth: 82, maxWidth: 82, textAlign: 'center' }}>
                    <Tooltip title="View Details"><Button size="small" onClick={() => openDetails(item._id)} sx={{ minWidth: 42, width: 42, height: 38, color: '#1d4ed8', border: '1px solid #cbd5e1', borderRadius: '9px', boxShadow: '0 4px 10px rgba(15,23,42,.07)', '&:hover': { bgcolor: '#0B1F4D', color: '#fff', borderColor: '#0B1F4D' } }}><Visibility fontSize="small" /></Button></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {filteredApplications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ color: '#64748b', py: 5, borderColor: '#e2e8f0' }}>
                    No loan requests found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        </Paper>
        )}
        <Box sx={{ mt: 2.2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: .8, color: 'rgba(255,255,255,.8)' }}>
          <VerifiedUser sx={{ color: '#bfdbfe', fontSize: 19 }} />
          <Typography sx={{ fontSize: '.8rem', fontWeight: 600 }}>All loan request data is updated in real time.</Typography>
        </Box>
      </Paper>

      <Dialog
        open={Boolean(selected)}
        onClose={submitting ? undefined : () => setSelected(null)}
        fullWidth
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: '#0f1633', color: '#fff', border: '1px solid rgba(255,255,255,.1)' } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Loan Application Details</DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,.1)' }}>
          {detailSections.map(([title, values]) => (
            <Paper
              key={title}
              sx={{ p: 2, mb: 2, bgcolor: '#171f43', color: '#fff', border: '1px solid rgba(255,255,255,.08)', borderRadius: '12px' }}
            >
              <Typography sx={{ fontWeight: 800, mb: 1.5 }}>{title}</Typography>
              <Grid container spacing={1.5}>
                {Object.entries(values || {}).map(([label, value]) => (
                  <Grid item xs={12} sm={6} md={4} key={label}>
                    <Typography sx={{ color: 'rgba(255,255,255,.45)', fontSize: '.72rem', textTransform: 'capitalize' }}>{label}</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{String(value || '-')}</Typography>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          ))}

          <Paper sx={{ p: 2, mb: 2, bgcolor: '#171f43', color: '#fff', borderRadius: '12px' }}>
            <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Uploaded Documents</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {selected?.documents?.map((doc) => (
                <Box key={doc._id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    icon={documentLoading === doc._id ? <CircularProgress size={16} color="inherit" /> : <Check />}
                    label={`${doc.originalName} (${(doc.size / 1024).toFixed(1)} KB)`}
                    color="success"
                    variant="outlined"
                    clickable
                    disabled={Boolean(documentLoading)}
                    onClick={() => viewDocument(doc)}
                    sx={{ maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                  />
                  <Tooltip title="Preview document">
                    <Button size="small" startIcon={<Visibility />} onClick={() => viewDocument(doc)} disabled={Boolean(documentLoading)}>
                      View Document
                    </Button>
                  </Tooltip>
                  <Tooltip title="Open in a new tab">
                    <Button size="small" startIcon={<OpenInNew />} onClick={() => openDocumentInNewTab(doc)} disabled={Boolean(documentLoading)}>
                      New Tab
                    </Button>
                  </Tooltip>
                  <Tooltip title="Download document">
                    <Button size="small" startIcon={<Download />} onClick={() => downloadDocument(doc)} disabled={Boolean(documentLoading)}>
                      Download
                    </Button>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </Paper>

          {['Submitted', 'Under Review', 'More Info Required'].includes(selected?.status) && (
            <Box>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Manager Action</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Button variant={action === 'review' ? 'contained' : 'outlined'} startIcon={<RateReview />} onClick={() => setAction('review')}>Under Review</Button>
                <Button color="success" variant={action === 'approve' ? 'contained' : 'outlined'} startIcon={<Check />} onClick={() => setAction('approve')}>Approve</Button>
                <Button color="error" variant={action === 'reject' ? 'contained' : 'outlined'} startIcon={<Close />} onClick={() => setAction('reject')}>Reject</Button>
                <Button color="warning" variant={action === 'more-info' ? 'contained' : 'outlined'} startIcon={<Help />} onClick={() => setAction('more-info')}>Request More Information</Button>
              </Box>
              {action === 'reject' && (
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Rejection Reason *"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  sx={fieldSx}
                />
              )}
              {action && action !== 'reject' && (
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label={action === 'more-info' ? 'Information Required *' : 'Manager Comment'}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  sx={fieldSx}
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelected(null)} sx={{ color: '#fff' }} disabled={submitting}>Close</Button>
          {action && (
            <Button
              variant="contained"
              onClick={submitAction}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(preview)}
        onClose={closePreview}
        fullWidth
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: '#0f1633', color: '#fff', height: '88vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {preview?.originalName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {preview && <Button startIcon={<OpenInNew />} onClick={() => openDocumentInNewTab(preview)}>New Tab</Button>}
            {preview && <Button startIcon={<Download />} onClick={() => downloadDocument(preview)}>Download</Button>}
            <Button onClick={closePreview} sx={{ color: '#fff' }}>Close</Button>
          </Box>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{ p: 1, borderColor: 'rgba(255,255,255,.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          {preview?.mimeType === 'application/pdf' ? (
            <Box
              component="iframe"
              src={preview.url}
              title={preview.originalName}
              sx={{ width: '100%', height: '100%', border: 0, bgcolor: '#fff' }}
            />
          ) : (
            <Box
              component="img"
              src={preview?.url}
              alt={preview?.originalName}
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default LoanRequestsPanel;
