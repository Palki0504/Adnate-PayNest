import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, MenuItem, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Calculate, CalendarMonth, Download, Refresh, Visibility } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { loanApplicationAPI } from '../../services/api';

const defaultLoanTypes = [
  { value: 'personal', label: 'Personal Loan' },
  { value: 'home', label: 'Home Loan' },
  { value: 'vehicle', label: 'Vehicle Loan' },
  { value: 'education', label: 'Education Loan' },
];

const paymentFrequencies = [
  { value: 'monthly', label: 'Monthly', paymentsPerYear: 12 },
  { value: 'fortnightly', label: 'Fortnightly', paymentsPerYear: 26 },
  { value: 'weekly', label: 'Weekly', paymentsPerYear: 52 },
  { value: 'quarterly', label: 'Quarterly', paymentsPerYear: 4 },
];

const initialForm = {
  loanType: 'personal',
  amount: '',
  interestRate: '',
  tenure: '',
  tenureUnit: 'years',
  paymentFrequency: 'monthly',
  firstEmiDate: '',
};

const formatCurrency = (value, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(Number(value) || 0);

const formatDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '-';

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addPaymentPeriod = (date, frequency, periods) => {
  const nextDate = new Date(date);
  if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + periods);
  if (frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + periods * 3);
  if (frequency === 'fortnightly') nextDate.setDate(nextDate.getDate() + periods * 14);
  if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + periods * 7);
  return nextDate;
};

const fieldSx = {
  width: '100%',
  mt: 1.75,
  '& .MuiOutlinedInput-root': {
    minHeight: 58,
    borderRadius: '14px',
    backgroundColor: '#fff',
    color: '#0F172A',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    transition: 'border-color .2s ease, box-shadow .2s ease, transform .2s ease',
    '& fieldset': { borderColor: '#D1D9E6', borderWidth: '2px' },
    '&:hover fieldset': { borderColor: '#3B82F6' },
    '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(59,130,246,0.15)' },
    '&.Mui-focused fieldset': { borderColor: '#3B82F6', borderWidth: '2px' },
  },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    color: '#0F172A',
    WebkitTextFillColor: '#0F172A',
    padding: '15px 16px',
    fontWeight: 600,
    boxSizing: 'border-box',
  },
  '& input[type="date"]': {
    minWidth: 0,
    paddingLeft: '14px',
    paddingRight: '16px',
    colorScheme: 'light',
  },
  '& .MuiInputLabel-root': {
    color: '#0F172A',
    backgroundColor: '#fff',
    borderRadius: '5px',
    padding: '2px 5px',
    fontSize: '0.74rem',
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: '0.01em',
    zIndex: 2,
    maxWidth: 'calc(100% - 20px)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'clip',
    transform: 'translate(8px, -17px) scale(1)',
    transformOrigin: 'top left',
    pointerEvents: 'none',
  },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    transform: 'translate(8px, -17px) scale(1)',
    backgroundColor: '#fff',
    color: '#0F172A',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#0F172A',
    backgroundColor: '#fff',
  },
  '& .MuiSelect-icon': {
    color: '#0B1F4D',
    right: 12,
    transition: 'transform .2s ease, color .2s ease',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiSelect-icon': {
    color: '#3B82F6',
    transform: 'rotate(180deg)',
  },
};

const inputLabelProps = { shrink: true };

const selectProps = {
  MenuProps: {
    PaperProps: {
      sx: {
        mt: 0.75,
        borderRadius: '12px',
        border: '1px solid #D1D9E6',
        boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
        '& .MuiMenuItem-root': { color: '#0F172A', minHeight: 42, fontWeight: 600 },
        '& .MuiMenuItem-root.Mui-selected': { bgcolor: '#eff6ff' },
      },
    },
  },
};

const EMICalculator = () => {
  const [form, setForm] = useState(initialForm);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [loanConfigs, setLoanConfigs] = useState([]);

  const loanTypes = useMemo(() => (
    loanConfigs.length
      ? loanConfigs.map((config) => ({ value: config.loanType, label: config.displayName || config.loanType }))
      : defaultLoanTypes
  ), [loanConfigs]);

  const selectedLoanConfig = useMemo(
    () => loanConfigs.find((config) => config.loanType === form.loanType),
    [loanConfigs, form.loanType],
  );

  useEffect(() => {
    loanApplicationAPI.getBootstrap()
      .then((response) => {
        const configs = response.data.configs || [];
        setLoanConfigs(configs);
        const first = configs[0];
        if (first) {
          setForm((current) => ({
            ...current,
            loanType: current.loanType || first.loanType,
            interestRate: current.interestRate || first.effectiveInterestRate || first.interestRate || '',
          }));
        }
      })
      .catch(() => {});
  }, []);

  const frequency = useMemo(
    () => paymentFrequencies.find((item) => item.value === form.paymentFrequency),
    [form.paymentFrequency],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'loanType') {
      const config = loanConfigs.find((item) => item.loanType === value);
      setForm((current) => ({
        ...current,
        loanType: value,
        interestRate: config?.effectiveInterestRate ?? config?.interestRate ?? '',
        tenure: '',
        tenureUnit: config?.tenureUnit === 'months' ? 'months' : current.tenureUnit,
      }));
    } else {
      setForm((current) => ({ ...current, [name]: value }));
    }
    setResults(null);
    setShowFullSchedule(false);
    setError('');
  };

  const calculateEmi = () => {
    const principal = Number(form.amount);
    const annualRate = Number(form.interestRate);
    const tenureValue = Number(form.tenure);

    if (!principal || principal <= 0 || annualRate < 0 || !tenureValue || tenureValue <= 0 || !form.firstEmiDate) {
      setError('Please enter valid values in all calculator fields.');
      return;
    }
    if (selectedLoanConfig?.minAmount && principal < Number(selectedLoanConfig.minAmount)) {
      setError(`Minimum amount for ${selectedLoanConfig.displayName} is ${formatCurrency(selectedLoanConfig.minAmount)}.`);
      return;
    }
    if (selectedLoanConfig?.maxAmount && principal > Number(selectedLoanConfig.maxAmount)) {
      setError(`Maximum amount for ${selectedLoanConfig.displayName} is ${formatCurrency(selectedLoanConfig.maxAmount)}.`);
      return;
    }

    const tenureYears = form.tenureUnit === 'years' ? tenureValue : tenureValue / 12;
    const numberOfEmis = Math.max(1, Math.round(tenureYears * frequency.paymentsPerYear));
    const tenureMonths = form.tenureUnit === 'years' ? tenureValue * 12 : tenureValue;
    const minTenure = Number(selectedLoanConfig?.minTenure || selectedLoanConfig?.tenureMin || 0);
    const maxTenure = Number(selectedLoanConfig?.maxTenure || selectedLoanConfig?.tenureMax || 0);
    if ((minTenure && tenureMonths < minTenure) || (maxTenure && tenureMonths > maxTenure)) {
      setError(`Tenure for ${selectedLoanConfig.displayName} must be between ${minTenure} and ${maxTenure} months.`);
      return;
    }
    const periodicRate = annualRate / 100 / frequency.paymentsPerYear;
    const emi = periodicRate === 0
      ? principal / numberOfEmis
      : (principal * periodicRate * (1 + periodicRate) ** numberOfEmis)
        / ((1 + periodicRate) ** numberOfEmis - 1);

    let balance = principal;
    const firstDate = new Date(`${form.firstEmiDate}T00:00:00`);
    const schedule = Array.from({ length: numberOfEmis }, (_, index) => {
      const interest = periodicRate === 0 ? 0 : balance * periodicRate;
      let principalComponent = emi - interest;
      let installmentAmount = emi;

      if (index === numberOfEmis - 1 || principalComponent > balance) {
        principalComponent = balance;
        installmentAmount = principalComponent + interest;
      }

      balance = Math.max(0, balance - principalComponent);
      return {
        emiNumber: index + 1,
        dueDate: toIsoDate(addPaymentPeriod(firstDate, form.paymentFrequency, index)),
        emiAmount: installmentAmount,
        principalAmount: principalComponent,
        interestAmount: interest,
        outstandingBalance: balance,
      };
    });

    setResults({
      emi,
      totalInterest: schedule.reduce((sum, row) => sum + row.interestAmount, 0),
      totalRepayment: schedule.reduce((sum, row) => sum + row.emiAmount, 0),
      numberOfEmis,
      schedule,
      lastEmiDate: schedule.at(-1)?.dueDate,
    });
  };

  const resetCalculator = () => {
    setForm(initialForm);
    setResults(null);
    setError('');
    setShowFullSchedule(false);
  };

  const downloadSchedule = () => {
    if (!results) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFillColor(28, 37, 84);
    doc.rect(0, 0, 297, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ADNATE PAYNEST', 14, 15);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Estimated EMI & Amortization Schedule', 14, 24);
    doc.setTextColor(28, 37, 84);
    doc.text(
      `${loanTypes.find((item) => item.value === form.loanType)?.label} | Amount: ${formatCurrency(form.amount)} | Rate: ${form.interestRate}% p.a.`,
      14, 45,
    );
    doc.text(
      `Tenure: ${form.tenure} ${form.tenureUnit} | Frequency: ${frequency.label} | First EMI: ${formatDate(form.firstEmiDate)}`,
      14, 52,
    );
    doc.autoTable({
      startY: 60,
      head: [['EMI No.', 'Due Date', 'EMI Amount', 'Principal', 'Interest', 'Outstanding Balance']],
      body: results.schedule.map((row) => [
        row.emiNumber, formatDate(row.dueDate), formatCurrency(row.emiAmount, 2),
        formatCurrency(row.principalAmount, 2), formatCurrency(row.interestAmount, 2),
        formatCurrency(row.outstandingBalance, 2),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [76, 61, 168] },
      alternateRowStyles: { fillColor: [246, 247, 252] },
      styles: { fontSize: 8 },
    });
    doc.setFontSize(8);
    doc.setTextColor(90, 98, 112);
    doc.text('This schedule is an estimate only and does not constitute loan approval.', 14, 202);
    doc.save(`PayNest_EMI_Schedule_${form.loanType}.pdf`);
  };

  const visibleSchedule = results?.schedule.slice(0, showFullSchedule ? results.schedule.length : 12) || [];

  return (
    <Box sx={{ bgcolor: 'transparent', p: { xs: 2, md: 3 }, color: '#0f172a' }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: '#0b1f4d', fontSize: '1.5rem', fontWeight: 800 }}>EMI Calculator</Typography>
        <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>
          Estimate repayments and review the complete payment breakdown before applying.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 28px rgba(15,23,42,.1)' }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography sx={{ fontWeight: 900, color: '#0B1F4D', mb: 2.5 }}>Loan Details</Typography>
          <Grid container columnSpacing={2.5} rowSpacing={3}>
            <Grid item xs={12} md={4}>
              <TextField select fullWidth name="loanType" label="Loan Type" value={form.loanType} onChange={handleChange} InputLabelProps={inputLabelProps} SelectProps={selectProps} sx={fieldSx}>
                {loanTypes.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth required type="number" name="amount" label="Loan Amount (₹)" value={form.amount} onChange={handleChange} inputProps={{ min: 1 }} InputLabelProps={inputLabelProps} sx={fieldSx} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth required type="number" name="interestRate" label="Interest Rate (% p.a.)" value={form.interestRate} onChange={handleChange} inputProps={{ min: 0, step: 0.01 }} InputLabelProps={inputLabelProps} sx={fieldSx} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth required type="number" name="tenure" label="Loan Tenure" value={form.tenure} onChange={handleChange} inputProps={{ min: 1 }} InputLabelProps={inputLabelProps} sx={fieldSx} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField select fullWidth name="tenureUnit" label="Tenure Unit" value={form.tenureUnit} onChange={handleChange} InputLabelProps={inputLabelProps} SelectProps={selectProps} sx={fieldSx}>
                <MenuItem value="years">Years</MenuItem>
                <MenuItem value="months">Months</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField select fullWidth name="paymentFrequency" label="Payment Frequency" value={form.paymentFrequency} onChange={handleChange} InputLabelProps={inputLabelProps} SelectProps={selectProps} sx={fieldSx}>
                {paymentFrequencies.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth required type="date" name="firstEmiDate" label="First EMI Date" value={form.firstEmiDate} onChange={handleChange} InputLabelProps={inputLabelProps} sx={fieldSx} />
            </Grid>
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', minHeight: 56, alignItems: 'center' }}>
                <Button variant="contained" startIcon={<Calculate />} onClick={calculateEmi} sx={{ minHeight: 46, bgcolor: '#0B1F4D', color: '#fff', px: 3, borderRadius: '11px', fontWeight: 700, boxShadow: '0 7px 18px rgba(11,31,77,.2)', '&:hover': { bgcolor: '#163873', boxShadow: '0 9px 22px rgba(11,31,77,.28)' } }}>
                  Calculate EMI
                </Button>
                <Button variant="outlined" startIcon={<Refresh />} onClick={resetCalculator} sx={{ minHeight: 46, color: '#0B1F4D', borderColor: '#cbd5e1', px: 3, borderRadius: '11px', fontWeight: 700, '&:hover': { borderColor: '#0B1F4D', bgcolor: '#eff6ff' } }}>
                  Reset
                </Button>
                {selectedLoanConfig && (
                  <Chip
                    label={`Rule: ${formatCurrency(selectedLoanConfig.minAmount)} - ${formatCurrency(selectedLoanConfig.maxAmount)} | ${selectedLoanConfig.interestRate}% p.a. | Processing ${selectedLoanConfig.processingFee || 0}%`}
                    sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 700 }}
                  />
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {results && (
        <>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {[
              ['Monthly EMI', formatCurrency(results.emi, 2)],
              ['Total Interest Payable', formatCurrency(results.totalInterest, 2)],
              ['Total Repayment Amount', formatCurrency(results.totalRepayment, 2)],
              ['Total Number of EMIs', results.numberOfEmis],
            ].map(([label, value], index) => (
              <Grid item xs={12} sm={6} lg={3} key={label}>
                <Card sx={{ height: '100%', bgcolor: '#fff', border: '1px solid #e2e8f0', borderTop: `4px solid ${index === 0 ? '#2563eb' : '#6657c7'}`, borderRadius: '14px', boxShadow: '0 8px 22px rgba(15,23,42,.09)' }}>
                  <CardContent>
                    <Typography sx={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>{label}</Typography>
                    <Typography sx={{ color: '#0B1F4D', fontSize: '1.45rem', fontWeight: 800, mt: 0.75 }}>{value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card sx={{ mt: 3, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 28px rgba(15,23,42,.1)' }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <CalendarMonth sx={{ color: '#9c8cf2' }} />
                <Typography sx={{ fontWeight: 900, color: '#0B1F4D' }}>Loan Overview</Typography>
              </Box>
              <Grid container spacing={2}>
                {[
                  ['Loan Amount', formatCurrency(form.amount)],
                  ['Interest Rate', `${form.interestRate}% p.a.`],
                  ['Tenure', `${form.tenure} ${form.tenureUnit}`],
                  ['Payment Frequency', frequency.label],
                  ['First EMI Date', formatDate(form.firstEmiDate)],
                  ['Last EMI Date', formatDate(results.lastEmiDate)],
                ].map(([label, value]) => (
                  <Grid item xs={12} sm={6} md={4} key={label}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: '10px', borderColor: '#e2e8f0', bgcolor: '#f8fafc' }}>
                      <Typography sx={{ color: '#64748b', fontSize: '0.75rem' }}>{label}</Typography>
                      <Typography sx={{ color: '#0f172a', fontWeight: 700, mt: 0.4 }}>{value}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3, bgcolor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 28px rgba(15,23,42,.1)' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Box>
                  <Typography sx={{ fontWeight: 900, color: '#0B1F4D' }}>Amortization Schedule</Typography>
                  <Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>Principal and interest split for every payment.</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {results.schedule.length > 12 && (
                    <Button variant="outlined" startIcon={<Visibility />} onClick={() => setShowFullSchedule((current) => !current)} sx={{ color: '#0B1F4D', borderColor: '#cbd5e1', borderRadius: '9px', fontWeight: 700 }}>
                      {showFullSchedule ? 'Show First 12' : 'View Full Schedule'}
                    </Button>
                  )}
                  <Button variant="contained" startIcon={<Download />} onClick={downloadSchedule} sx={{ bgcolor: '#0B1F4D', borderRadius: '9px', fontWeight: 700, '&:hover': { bgcolor: '#163873' } }}>
                    Download Schedule PDF
                  </Button>
                </Box>
              </Box>
              <TableContainer sx={{ maxHeight: showFullSchedule ? 560 : 'none' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {['EMI No.', 'Due Date', 'EMI Amount', 'Principal Amount', 'Interest Amount', 'Outstanding Balance'].map((heading) => (
                        <TableCell key={heading} sx={{ bgcolor: '#171e43', color: '#fff', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.12)', whiteSpace: 'nowrap' }}>{heading}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleSchedule.map((row) => (
                      <TableRow key={row.emiNumber} hover sx={{ bgcolor: row.emiNumber % 2 ? '#fff' : '#f8fafc', '&:hover': { bgcolor: '#eff6ff !important' }, '& td': { borderBottom: '1px solid #e2e8f0' } }}>
                        <TableCell sx={{ color: '#334155' }}>{row.emiNumber}</TableCell>
                        <TableCell sx={{ color: '#334155', whiteSpace: 'nowrap' }}>{formatDate(row.dueDate)}</TableCell>
                        <TableCell sx={{ color: '#0f172a', fontWeight: 700 }}>{formatCurrency(row.emiAmount, 2)}</TableCell>
                        <TableCell sx={{ color: '#334155' }}>{formatCurrency(row.principalAmount, 2)}</TableCell>
                        <TableCell sx={{ color: '#334155' }}>{formatCurrency(row.interestAmount, 2)}</TableCell>
                        <TableCell sx={{ color: '#334155' }}>{formatCurrency(row.outstandingBalance, 2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      <Alert severity="info" sx={{ mt: 3, border: '1px solid #bfdbfe', bgcolor: '#eff6ff', color: '#334155', '& .MuiAlert-icon': { color: '#2563eb' } }}>
        This calculator provides estimates only. Results may vary based on bank policies, fees, taxes, and rounding, and do not constitute automatic loan approval.
      </Alert>
    </Box>
  );
};

export default EMICalculator;
