import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  FormControlLabel, Grid, MenuItem, Paper, Step, StepLabel, Stepper,
  TextField, Typography,
} from '@mui/material';
import {
  AccountBalance, Badge, CheckCircle, CloudUpload, Description,
  NavigateBefore, NavigateNext, Person, Send, Work,
} from '@mui/icons-material';
import { loanApplicationAPI } from '../../services/api';

const steps = [
  { label: 'Loan Details', color: '#3b82f6', bg: '#eff6ff', icon: <AccountBalance /> },
  { label: 'Personal Details', color: '#8b5cf6', bg: '#f5f3ff', icon: <Person /> },
  { label: 'Employment Details', color: '#22a06b', bg: '#ecfdf5', icon: <Work /> },
  { label: 'Documents', color: '#f59e0b', bg: '#fff7ed', icon: <Description /> },
  { label: 'Review & Submit', color: '#334155', bg: '#f1f5f9', icon: <CheckCircle /> },
];

const coreRequiredDocuments = [
  ['panCard', 'PAN Card'],
  ['aadhaarCard', 'Aadhaar Card'],
  ['addressProof', 'Address Proof'],
  ['bankStatement', 'Bank Statement'],
];

const employmentRequiredDocuments = [
  ['salarySlip', 'Salary Slip'],
  ['itrForm16', 'ITR / Form 16'],
];

const schoolStudentDocuments = [
  ['aadhaarCard', 'Aadhaar Card'],
  ['studentIdCard', 'Student ID Card'],
  ['schoolAdmissionProof', 'School ID / Admission Proof'],
  ['guardianIncomeProof', 'Guardian Income Proof'],
];

const collegeStudentDocuments = [
  ['aadhaarCard', 'Aadhaar Card'],
  ['studentIdCard', 'Student ID Card'],
  ['admissionFeeProof', 'Admission Proof / Fee Receipt'],
  ['guardianIncomeProof', 'Guardian Income Proof'],
];

const defaultEmploymentTypeOptions = ['Salaried', 'Self Employed', 'Business Owner', 'Professional'];
const educationEmploymentTypeOptions = [...defaultEmploymentTypeOptions, 'Student'];

const fieldSx = {
  width: '100%',
  '& .MuiOutlinedInput-root': {
    width: '100%',
    minHeight: 58,
    bgcolor: '#fff',
    color: '#0F172A',
    borderRadius: '14px',
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
    fontWeight: 600,
    padding: '15px 16px',
  },
  '& .MuiInputLabel-root': {
    color: '#0F172A',
    bgcolor: '#fff',
    px: 0.75,
    fontWeight: 600,
    lineHeight: 1.2,
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#0F172A' },
  '& .MuiSelect-icon': {
    color: '#0B1F4D',
    right: 12,
    transition: 'transform .2s ease, color .2s ease',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiSelect-icon': {
    color: '#3B82F6',
    transform: 'rotate(180deg)',
  },
  '& input[type="date"]': {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    colorScheme: 'light',
  },
};

const StepOneField = ({ label, children, wide = false }) => (
  <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', md: wide ? 'span 2' : 'span 1' } }}>
    <Typography
      component="label"
      sx={{
        display: 'inline-block',
        color: '#0F172A',
        bgcolor: '#fff',
        borderRadius: '6px',
        px: 0.9,
        py: 0.35,
        fontSize: '.8rem',
        fontWeight: 600,
        mb: 0.9,
        boxShadow: '0 3px 8px rgba(2,12,36,.12)',
      }}
    >
      {label}
    </Typography>
    {children}
  </Box>
);

const PremiumSectionCard = ({ step, children }) => (
  <Card sx={{
    color: '#0f172a',
    bgcolor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    boxShadow: '0 12px 32px rgba(15,23,42,.1)',
    overflow: 'visible',
  }}>
    <Box sx={{ height: 5, bgcolor: step.color, borderRadius: '20px 20px 0 0' }} />
    <CardContent sx={{ p: { xs: 2.25, sm: 3, md: 4 } }}>{children}</CardContent>
  </Card>
);

const currency = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const calculateTotals = (amount, annualRate, tenure, tenureUnit) => {
  const principal = Number(amount || 0);
  const tenureValue = Number(tenure || 0);
  const months = tenureUnit === 'years' ? tenureValue * 12 : tenureUnit === 'months' ? tenureValue : 0;
  const rate = Number(annualRate || 0) / 12 / 100;
  if (!principal || !months) return { estimatedEMI: 0, totalInterest: 0, totalRepayment: 0 };
  const estimatedEMI = rate === 0
    ? principal / months
    : (principal * rate * (1 + rate) ** months) / ((1 + rate) ** months - 1);
  const totalRepayment = estimatedEMI * months;
  return { estimatedEMI, totalInterest: totalRepayment - principal, totalRepayment };
};

const ApplyLoanWizard = ({ onSubmitted }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bootstrap, setBootstrap] = useState({ accounts: [], configs: [], customer: {} });
  const [declaration, setDeclaration] = useState(false);
  const [documents, setDocuments] = useState({});
  const [loanDetails, setLoanDetails] = useState({
    loanType: '', purpose: '', loanAmount: '', tenure: '', tenureUnit: '',
    interestRate: '', linkedAccountId: '',
  });
  const [personalDetails, setPersonalDetails] = useState({
    name: '', dateOfBirth: '', gender: '', maritalStatus: '', mobileNumber: '',
    email: '', address: '', panNumber: '', aadhaarNumber: '',
  });
  const [employmentDetails, setEmploymentDetails] = useState({
    employmentType: '', organizationName: '', designation: '', monthlyIncome: '',
    workExperience: '', officeAddress: '', existingEMI: '', monthlyExpenses: '',
    overdraftUtilization: '',
  });
  const [studentDetails, setStudentDetails] = useState({
    studentType: '', institutionName: '', classOrSemester: '', institutionAddress: '',
    city: '', state: '',
  });

  useEffect(() => {
    loanApplicationAPI.getBootstrap()
      .then(({ data }) => {
        setBootstrap(data);
        const customer = data.customer || {};
        const personal = {
          name: customer.name || '',
          dateOfBirth: customer.dateOfBirth?.split('T')[0] || '',
          gender: customer.gender || '',
          maritalStatus: '',
          mobileNumber: customer.mobileNumber || '',
          email: customer.email || '',
          address: '',
          panNumber: customer.panNumber || '',
          aadhaarNumber: customer.aadhaarNumber || '',
        };
        setPersonalDetails(personal);
        setEmploymentDetails((current) => ({ ...current, designation: customer.designation || '' }));
      })
      .catch((err) => setError(err.response?.data?.message || 'Unable to load loan application data.'))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(
    () => calculateTotals(loanDetails.loanAmount, loanDetails.interestRate, loanDetails.tenure, loanDetails.tenureUnit),
    [loanDetails.loanAmount, loanDetails.interestRate, loanDetails.tenure, loanDetails.tenureUnit],
  );

  const selectedLoanConfig = useMemo(
    () => bootstrap.configs.find((config) => config.loanType === loanDetails.loanType),
    [bootstrap.configs, loanDetails.loanType],
  );
  const loanProductOptions = useMemo(
    () => bootstrap.configs.map((config) => ({ value: config.loanType, label: config.displayName || config.loanType })),
    [bootstrap.configs],
  );
  const employmentTypeOptions = useMemo(
    () => (loanDetails.loanType === 'education' ? educationEmploymentTypeOptions : defaultEmploymentTypeOptions),
    [loanDetails.loanType],
  );
  const isStudentApplicant = employmentDetails.employmentType === 'Student';
  const displayedDocuments = useMemo(
    () => {
      if (!isStudentApplicant) return [...coreRequiredDocuments, ...employmentRequiredDocuments];
      if (studentDetails.studentType === 'School') return schoolStudentDocuments;
      if (studentDetails.studentType === 'College') return collegeStudentDocuments;
      return [];
    },
    [isStudentApplicant, studentDetails.studentType],
  );
  const requiredDocumentKeys = useMemo(
    () => new Set(displayedDocuments.map(([key]) => key)),
    [displayedDocuments],
  );
  const duplicateLoanWarning = useMemo(() => {
    if (!loanDetails.loanType) return '';
    const lock = (bootstrap.activeLoanTypeLocks || []).find((item) => item.loanType === loanDetails.loanType);
    if (!lock) return '';
    const displayName = lock.displayName || loanProductOptions.find((item) => item.value === loanDetails.loanType)?.label || loanDetails.loanType;
    return lock.message || `You cannot apply for this loan type because you already have an active or pending ${displayName}. Please repay or close your existing ${displayName} before applying again.`;
  }, [bootstrap.activeLoanTypeLocks, loanDetails.loanType, loanProductOptions]);

  const tenureOptions = useMemo(() => {
    if (!selectedLoanConfig || !loanDetails.tenureUnit) return [];
    if (loanDetails.tenureUnit === 'years') {
      const minimum = Math.max(1, Math.ceil(selectedLoanConfig.minTenure / 12));
      const maximum = Math.floor(selectedLoanConfig.maxTenure / 12);
      return Array.from({ length: Math.max(0, maximum - minimum + 1) }, (_, index) => minimum + index);
    }
    const minimum = selectedLoanConfig.minTenure;
    const maximum = selectedLoanConfig.maxTenure;
    const step = maximum - minimum > 60 ? 12 : maximum - minimum > 24 ? 6 : 3;
    const values = [];
    for (let value = minimum; value <= maximum; value += step) values.push(value);
    if (values.at(-1) !== maximum) values.push(maximum);
    return values;
  }, [selectedLoanConfig, loanDetails.tenureUnit]);

  useEffect(() => {
    if (loanDetails.loanType !== 'education' && employmentDetails.employmentType === 'Student') {
      setEmploymentDetails((current) => ({ ...current, employmentType: '' }));
    }
  }, [employmentDetails.employmentType, loanDetails.loanType]);

  useEffect(() => {
    if (!isStudentApplicant) {
      setStudentDetails({
        studentType: '', institutionName: '', classOrSemester: '', institutionAddress: '',
        city: '', state: '',
      });
      return;
    }
    setEmploymentDetails((current) => ({
      ...current,
      organizationName: '',
      designation: '',
      monthlyIncome: '',
      workExperience: '',
      officeAddress: '',
      existingEMI: '',
      monthlyExpenses: '',
      overdraftUtilization: '',
    }));
  }, [isStudentApplicant]);

  const handleStudentChange = useCallback((event) => {
    const { name, value } = event.target;
    setStudentDetails((current) => ({
      ...current,
      [name]: value,
      ...(name === 'studentType' ? { institutionName: '', classOrSemester: '', institutionAddress: '', city: '', state: '' } : {}),
    }));
  }, []);

  const handleLoanChange = useCallback((event) => {
    const { name, value } = event.target;
    if (name === 'loanType') {
      const config = bootstrap.configs.find((item) => item.loanType === value);
      setLoanDetails((current) => ({
        ...current,
        loanType: value,
        tenure: '',
        tenureUnit: '',
        interestRate: value ? (config?.effectiveInterestRate ?? config?.interestRate ?? '') : '',
      }));
      return;
    }
    if (name === 'tenureUnit') {
      setLoanDetails((current) => ({ ...current, tenureUnit: value, tenure: '' }));
      return;
    }
    setLoanDetails((current) => ({ ...current, [name]: value }));
  }, [bootstrap.configs]);

  const validateStep = () => {
    if (activeStep === 0 && duplicateLoanWarning) {
      return duplicateLoanWarning;
    }
    if (activeStep === 0 && (!loanDetails.loanType || !loanDetails.purpose || !loanDetails.loanAmount || !loanDetails.tenure || !loanDetails.tenureUnit || loanDetails.interestRate === '' || !loanDetails.linkedAccountId)) {
      return 'Complete all loan details before continuing.';
    }
    if (activeStep === 1 && Object.values(personalDetails).some((value) => value === '' || value === null || value === undefined)) {
      return 'All personal details are mandatory.';
    }
    if (activeStep === 2 && !employmentDetails.employmentType) {
      return 'Select employment type before continuing.';
    }
    if (activeStep === 2 && isStudentApplicant) {
      if (!studentDetails.studentType) return 'Select student type before continuing.';
      if (Object.values(studentDetails).some((value) => value === '' || value === null || value === undefined)) {
        return `All ${studentDetails.studentType.toLowerCase()} student details are mandatory.`;
      }
    }
    if (activeStep === 2 && !isStudentApplicant && Object.values(employmentDetails).some((value) => value === '' || value === null || value === undefined)) {
      return 'All employment details are mandatory.';
    }
    if (activeStep === 3 && [...requiredDocumentKeys].some((key) => !documents[key])) {
      return 'Upload all required documents before continuing.';
    }
    return '';
  };

  const next = async () => {
    const message = validateStep();
    if (message) return setError(message);
    setError('');
    if (activeStep === 0) {
      setSavingDraft(true);
      try {
        await loanApplicationAPI.saveDraft({ loanDetails });
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to save loan details.');
        setSavingDraft(false);
        return;
      }
      setSavingDraft(false);
    }
    setActiveStep((step) => Math.min(4, step + 1));
  };

  const readFile = (type, file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError('Each document must be 2 MB or smaller.');
    const reader = new FileReader();
    reader.onload = () => {
      setDocuments((current) => ({
        ...current,
        [type]: { type, name: file.name, size: file.size, mimeType: file.type, data: reader.result },
      }));
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (submitting) {
      setError('Request already sent and pending for approval.');
      return;
    }
    if (duplicateLoanWarning) return setError(duplicateLoanWarning);
    if (!declaration) return setError('Please accept the declaration before submitting.');
    setSubmitting(true);
    setError('');
    try {
      const response = await loanApplicationAPI.submit({
        loanDetails,
        personalDetails,
        employmentDetails: isStudentApplicant ? { ...employmentDetails, employmentType: 'Student' } : employmentDetails,
        studentDetails,
        documents: displayedDocuments.map(([key]) => documents[key]).filter(Boolean),
      });
      setSuccess(response.data.message);
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      setError(apiMessage === 'This request is already pending for manager approval.'
        ? 'Request already sent and pending for approval.'
        : apiMessage || 'Loan application submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 }, bgcolor: 'transparent', color: '#172033' }}>
      <Typography sx={{ fontSize: { xs: '1.35rem', md: '1.65rem' }, fontWeight: 800, color: '#0b1f4d' }}>Apply for a Loan</Typography>
      <Typography sx={{ color: '#64748b', mb: 3, mt: 0.5 }}>{submitted ? 'Your submitted loan application is read-only.' : 'Complete the five steps below. You can review everything before submission.'}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 3, bgcolor: '#fff', color: '#0f172a', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 10px 28px rgba(15,23,42,.09)', overflowX: 'auto' }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{
          minWidth: { xs: 620, md: 'auto' },
          '& .MuiStepConnector-line': { borderTopWidth: 3, borderColor: '#dbe3ef', borderRadius: 2 },
          '& .MuiStepConnector-root.Mui-active .MuiStepConnector-line, & .MuiStepConnector-root.Mui-completed .MuiStepConnector-line': {
            borderColor: '#3b82f6',
          },
          '& .MuiStepIcon-root': {
            fontSize: '2.15rem',
            transition: 'all .25s ease',
            filter: 'drop-shadow(0 3px 6px rgba(15,23,42,.12))',
          },
          '& .MuiStepIcon-root.Mui-active': { transform: 'scale(1.12)' },
          '& .MuiStepLabel-labelContainer': { mt: 0.6 },
        }}>
          {steps.map((step) => (
            <Step key={step.label}>
              <StepLabel StepIconProps={{ sx: { color: `${step.color}55`, '&.Mui-active, &.Mui-completed': { color: step.color } } }}>
                <Typography sx={{ color: activeStep >= steps.indexOf(step) ? '#0B1F4D' : '#94a3b8', fontWeight: 800, fontSize: { xs: '.72rem', md: '.84rem' }, whiteSpace: 'nowrap' }}>{step.label}</Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      <PremiumSectionCard step={steps[activeStep]}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 3.5, color: '#0f172a' }}>
          <Box sx={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: '12px', bgcolor: steps[activeStep].color, boxShadow: `0 8px 18px ${steps[activeStep].color}55` }}>
            {steps[activeStep].icon}
          </Box>
          <Box>
            <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.3rem' }, fontWeight: 800 }}>{steps[activeStep].label}</Typography>
            <Typography sx={{ color: '#64748b', fontSize: '.78rem' }}>Step {activeStep + 1} of {steps.length}</Typography>
          </Box>
        </Box>

        {activeStep === 0 && (
          <>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 2.5,
            }}>
              <StepOneField label="Loan Type">
                <TextField select fullWidth name="loanType" value={loanDetails.loanType} onChange={handleLoanChange} sx={fieldSx}>
                  {loanProductOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
                </TextField>
              </StepOneField>
              <StepOneField label="Purpose of Loan" wide>
                <TextField fullWidth name="purpose" value={loanDetails.purpose} onChange={handleLoanChange} sx={fieldSx} />
              </StepOneField>
              <StepOneField label="Loan Amount (₹)">
                <TextField fullWidth type="number" name="loanAmount" value={loanDetails.loanAmount} onChange={handleLoanChange} sx={fieldSx} />
              </StepOneField>
              <StepOneField label="Loan Tenure">
                <TextField select fullWidth name="tenure" value={loanDetails.tenure} onChange={handleLoanChange} disabled={!loanDetails.tenureUnit || tenureOptions.length === 0} sx={fieldSx}>
                  {tenureOptions.map((value) => (
                    <MenuItem key={value} value={value}>{value}</MenuItem>
                  ))}
                </TextField>
              </StepOneField>
              <StepOneField label="Tenure Unit">
                <TextField select fullWidth name="tenureUnit" value={loanDetails.tenureUnit} onChange={handleLoanChange} sx={fieldSx}>
                  <MenuItem value="months">Months</MenuItem>
                  <MenuItem value="years">Years</MenuItem>
                </TextField>
              </StepOneField>
              <StepOneField label="Repayment Account" wide>
                <TextField
                  select
                  fullWidth
                  name="linkedAccountId"
                  value={loanDetails.linkedAccountId}
                  onChange={handleLoanChange}
                  sx={{
                    ...fieldSx,
                    '& .MuiSelect-select': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      pr: '42px !important',
                    },
                  }}
                >
                  {bootstrap.accounts.map((account) => (
                    <MenuItem key={account._id} value={account._id}>
                      {`${account.accountType.charAt(0).toUpperCase()}${account.accountType.slice(1)} - ${account.accountNumber} - ${currency(account.balance)}`}
                    </MenuItem>
                  ))}
                </TextField>
              </StepOneField>
              <Box sx={{ gridColumn: '1 / -1', display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Chip
                  label={loanDetails.interestRate === '' ? 'Select a loan type to view the applicable interest rate' : `Applicable Interest Rate: ${loanDetails.interestRate}% p.a.`}
                  sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, border: '1px solid #bfdbfe' }}
                />
                {selectedLoanConfig && (
                  <Chip
                    label={`Available tenure: ${selectedLoanConfig.minTenure}–${selectedLoanConfig.maxTenure} months`}
                    sx={{ bgcolor: 'rgba(96,165,250,.15)', color: '#bfdbfe', fontWeight: 700 }}
                  />
                )}
                {selectedLoanConfig && (
                  <Chip
                    label={`Amount range: ${currency(selectedLoanConfig.minAmount)} - ${currency(selectedLoanConfig.maxAmount)}`}
                    sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 700, border: '1px solid #bbf7d0' }}
                  />
                )}
                {selectedLoanConfig && (
                  <Chip
                    label={`Penalty ${selectedLoanConfig.lateEmiPenalty || 0}% | Processing ${selectedLoanConfig.processingFee || 0}% | Prepayment ${selectedLoanConfig.prepaymentCharge || 0}%`}
                    sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 700, border: '1px solid #fed7aa' }}
                  />
                )}
              </Box>
            </Box>
            {duplicateLoanWarning && <Alert severity="warning" sx={{ mt: 2, borderRadius: '12px', fontWeight: 700 }}>{duplicateLoanWarning}</Alert>}
            <Grid container spacing={2} sx={{ mt: 1.25 }}>
              {[
                ['Estimated EMI', totals.estimatedEMI, '#2563eb'],
                ['Total Interest', totals.totalInterest, '#16a34a'],
                ['Total Repayment', totals.totalRepayment, '#ea580c'],
              ].map(([label, value, color]) => (
                <Grid item xs={12} md={4} key={label}>
                  <Paper sx={{
                    p: 2.25,
                    bgcolor: '#fff',
                    border: '1px solid #dbe3ef',
                    borderRadius: '14px',
                    boxShadow: '0 10px 24px rgba(2,12,36,.12)',
                    transition: 'transform .2s ease, box-shadow .2s ease',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 14px 30px rgba(2,12,36,.16)' },
                  }}>
                    <Typography sx={{ color: '#64748b', fontSize: '.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</Typography>
                    <Typography sx={{ color, fontWeight: 900, fontSize: { xs: '1.2rem', md: '1.35rem' }, mt: 0.5 }}>{currency(value)}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </>
        )}

        {activeStep === 1 && (
          <Grid container spacing={2.5}>
            {[
              ['name', 'Full Name'], ['dateOfBirth', 'Date of Birth', 'date'], ['gender', 'Gender', 'select', ['Male', 'Female', 'Other', 'Prefer not to say']],
              ['maritalStatus', 'Marital Status', 'select', ['Single', 'Married', 'Divorced', 'Widowed']], ['mobileNumber', 'Mobile Number'],
              ['email', 'Email Address', 'email'], ['address', 'Residential Address'], ['panNumber', 'PAN Number'], ['aadhaarNumber', 'Aadhaar Number'],
            ].map(([name, label, type = 'text', options]) => (
              <Grid item xs={12} md={name === 'address' ? 8 : 4} key={name}>
                <Typography component="label" sx={{ display: 'inline-block', color: '#0F172A', bgcolor: '#fff', borderRadius: '6px', px: .9, py: .35, fontSize: '.8rem', fontWeight: 600, mb: .9 }}>
                  {label} *
                </Typography>
                <TextField required select={type === 'select'} fullWidth type={type === 'select' ? undefined : type} value={personalDetails[name]} onChange={(e) => setPersonalDetails((current) => ({ ...current, [name]: e.target.value }))} sx={fieldSx}>
                  {options?.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                </TextField>
              </Grid>
            ))}
          </Grid>
        )}

        {activeStep === 2 && (
          <>
            {isStudentApplicant && (
              <Alert severity="info" sx={{ mb: 2, borderRadius: '12px', fontWeight: 700 }}>
                Employment details are optional for students. You may provide guardian or student documents in the next step.
              </Alert>
            )}
            <Grid container spacing={2.5}>
            {[
              ['employmentType', 'Employment Type', 'select', employmentTypeOptions],
              ...(isStudentApplicant ? [] : [
              ['organizationName', 'Organization Name'], ['designation', 'Designation'], ['monthlyIncome', 'Monthly Income (₹)', 'number'],
              ['workExperience', 'Work Experience (Years)', 'number'], ['officeAddress', 'Office Address'],
              ['existingEMI', 'Existing EMI / Loan Amount (₹)', 'number'], ['monthlyExpenses', 'Monthly Expenses (₹)', 'number'],
              ['overdraftUtilization', 'Overdraft Utilization (%)', 'number'],
              ]),
            ].map(([name, label, type = 'text', options]) => {
              const isRequired = name === 'employmentType' || !isStudentApplicant;
              return (
                <Grid item xs={12} md={name.toLowerCase().includes('address') ? 8 : 4} key={name}>
                  <Typography component="label" sx={{ display: 'inline-block', color: '#0F172A', bgcolor: '#fff', borderRadius: '6px', px: .9, py: .35, fontSize: '.8rem', fontWeight: 600, mb: .9 }}>
                    {label}{isRequired ? ' *' : ''}
                  </Typography>
                  <TextField required={isRequired} select={type === 'select'} fullWidth type={type === 'select' ? undefined : type} value={employmentDetails[name]} onChange={(e) => setEmploymentDetails((current) => ({ ...current, [name]: e.target.value }))} sx={fieldSx}>
                    {options?.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </TextField>
                </Grid>
              );
            })}
            {isStudentApplicant && (
              <>
                <Grid item xs={12} md={4}>
                  <Typography component="label" sx={{ display: 'inline-block', color: '#0F172A', bgcolor: '#fff', borderRadius: '6px', px: .9, py: .35, fontSize: '.8rem', fontWeight: 600, mb: .9 }}>
                    Student Type *
                  </Typography>
                  <TextField required select fullWidth name="studentType" value={studentDetails.studentType} onChange={handleStudentChange} sx={fieldSx}>
                    <MenuItem value="School">School</MenuItem>
                    <MenuItem value="College">College</MenuItem>
                  </TextField>
                </Grid>
                {studentDetails.studentType && [
                  ['institutionName', studentDetails.studentType === 'School' ? 'School Name' : 'College Name'],
                  ['classOrSemester', studentDetails.studentType === 'School' ? 'Class' : 'Semester'],
                  ['institutionAddress', studentDetails.studentType === 'School' ? 'School Address' : 'College Address'],
                  ['city', 'City'],
                  ['state', 'State'],
                ].map(([name, label]) => (
                  <Grid item xs={12} md={name === 'institutionAddress' ? 8 : 4} key={name}>
                    <Typography component="label" sx={{ display: 'inline-block', color: '#0F172A', bgcolor: '#fff', borderRadius: '6px', px: .9, py: .35, fontSize: '.8rem', fontWeight: 600, mb: .9 }}>
                      {label} *
                    </Typography>
                    <TextField required fullWidth name={name} value={studentDetails[name]} onChange={handleStudentChange} sx={fieldSx} />
                  </Grid>
                ))}
              </>
            )}
            </Grid>
          </>
        )}

        {activeStep === 3 && (
          <Grid container spacing={2}>
            {displayedDocuments.map(([key, label]) => {
              const file = documents[key];
              const isRequired = requiredDocumentKeys.has(key);
              return (
                <Grid item xs={12} md={6} key={key}>
                  <Paper sx={{ p: 2.25, borderRadius: '14px', border: `2px dashed ${file ? '#22a06b' : '#cbd5e1'}`, bgcolor: '#fff', boxShadow: '0 8px 20px rgba(2,12,36,.1)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 800, color: '#1e293b' }}>{label}{isRequired ? ' *' : ' (Optional)'}</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: '.78rem' }}>{file ? `${file.name} • ${(file.size / 1024).toFixed(1)} KB` : 'PDF, JPG or PNG • Max 2 MB'}</Typography>
                      </Box>
                      {file ? <CheckCircle sx={{ color: '#22a06b' }} /> : (
                        <Button component="label" variant="outlined" startIcon={<CloudUpload />} sx={{ color: '#0b1f4d', borderColor: '#0b1f4d', borderWidth: 2, borderRadius: '10px', fontWeight: 700 }}>
                          Upload
                          <input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => readFile(key, e.target.files?.[0])} />
                        </Button>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}

        {activeStep === 4 && (
          <Box>
            {[
              ['Loan Details', [['Type', loanDetails.loanType], ['Purpose', loanDetails.purpose], ['Amount', currency(loanDetails.loanAmount)], ['Tenure', `${loanDetails.tenure} ${loanDetails.tenureUnit}`], ['Interest', `${loanDetails.interestRate}%`], ['Estimated EMI', currency(totals.estimatedEMI)]]],
              ['Personal Details', [['Name', personalDetails.name], ['Mobile', personalDetails.mobileNumber], ['Email', personalDetails.email], ['Address', personalDetails.address]]],
              isStudentApplicant
                ? ['Student Details', [['Employment', employmentDetails.employmentType], ['Student Type', studentDetails.studentType], ['Institution', studentDetails.institutionName], [studentDetails.studentType === 'School' ? 'Class' : 'Semester', studentDetails.classOrSemester], ['Address', studentDetails.institutionAddress], ['City', studentDetails.city], ['State', studentDetails.state]]]
                : ['Employment Details', [['Employment', employmentDetails.employmentType], ['Organization', employmentDetails.organizationName], ['Monthly Income', currency(employmentDetails.monthlyIncome)], ['Existing EMI', currency(employmentDetails.existingEMI)], ['Overdraft Use', `${employmentDetails.overdraftUtilization || 0}%`]]],
              ['Documents', displayedDocuments.map(([key, label]) => [label, documents[key]?.name || 'Not uploaded'])],
            ].map(([title, rows], index) => (
              <Paper key={title} sx={{ p: 2.25, mb: 2, borderRadius: '14px', border: '1px solid #dbe2ea', bgcolor: '#fff', boxShadow: '0 8px 20px rgba(2,12,36,.1)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 800, color: '#0b1f4d' }}>{title}</Typography>
                  {!submitted && <Button size="small" onClick={() => setActiveStep(index)} sx={{ color: '#1d4ed8', fontWeight: 700 }}>Edit</Button>}
                </Box>
                <Grid container spacing={1.5}>{rows.map(([label, value]) => <Grid item xs={12} md={6} key={label}><Typography sx={{ color: '#64748b', fontSize: '.75rem' }}>{label}</Typography><Typography sx={{ fontWeight: 600 }}>{value || '-'}</Typography></Grid>)}</Grid>
              </Paper>
            ))}
            <FormControlLabel
              sx={{ color: '#334155', alignItems: 'flex-start', mt: 1, '& .MuiFormControlLabel-label': { fontSize: '.9rem', lineHeight: 1.5 } }}
              control={<Checkbox checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} sx={{ color: '#94a3b8', '&.Mui-checked': { color: '#0B1F4D' }, pt: 0.25 }} />}
              label="I declare that the information and documents provided are true and complete."
            />
          </Box>
        )}
      </PremiumSectionCard>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 3, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
        <Button
          disabled={activeStep === 0 || submitting || submitted}
          startIcon={<NavigateBefore />}
          onClick={() => setActiveStep((step) => step - 1)}
          sx={{ color: '#334155', borderRadius: '11px', px: 3, minHeight: 46, fontWeight: 700, alignSelf: { xs: 'stretch', sm: 'auto' } }}
        >
          Back
        </Button>
        {activeStep < 4 ? (
          <Button
            variant="outlined"
            endIcon={<NavigateNext />}
            onClick={next}
            disabled={savingDraft || submitted || (activeStep === 0 && Boolean(duplicateLoanWarning))}
            sx={{
              bgcolor: '#fff',
              color: '#0b1f4d',
              border: '2px solid #0b1f4d',
              borderRadius: '11px',
              px: 4,
              minHeight: 48,
              fontWeight: 800,
              boxShadow: '0 7px 18px rgba(11,31,77,.12)',
              transition: 'all .22s ease',
              alignSelf: { xs: 'stretch', sm: 'auto' },
              '&:hover': {
                bgcolor: '#0b1f4d',
                color: '#fff',
                border: '2px solid #0b1f4d',
                transform: 'translateY(-2px)',
                boxShadow: '0 11px 24px rgba(11,31,77,.22)',
              },
            }}
          >
            {savingDraft ? 'Saving...' : 'Save & Continue'}
          </Button>
        ) : (
          <Button
            variant="contained"
            endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Send />}
            disabled={submitting || submitted || !declaration || Boolean(duplicateLoanWarning)}
            onClick={submit}
            sx={{
              bgcolor: '#0b1f4d',
              color: '#fff',
              borderRadius: '11px',
              px: 4,
              minHeight: 48,
              fontWeight: 800,
              boxShadow: '0 8px 20px rgba(11,31,77,.28)',
              alignSelf: { xs: 'stretch', sm: 'auto' },
              '& .MuiButton-endIcon, & .MuiSvgIcon-root': { color: '#fff' },
              '&:hover': {
                bgcolor: '#12316f',
                color: '#fff',
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 26px rgba(11,31,77,.34)',
              },
              '&.Mui-disabled': {
                bgcolor: '#64748b',
                color: '#fff',
                opacity: 0.75,
                boxShadow: 'none',
              },
              '&.Mui-disabled .MuiButton-endIcon, &.Mui-disabled .MuiSvgIcon-root': { color: '#fff' },
            }}
          >
            {submitted ? 'Submitted' : 'Submit Application'}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default ApplyLoanWizard;

