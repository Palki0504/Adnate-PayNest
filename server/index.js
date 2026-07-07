require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { verifyEmailTransporter } = require('./utils/emailService');

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
const databaseReady = connectDB();

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
const parseOriginList = (value = '') => value
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = [...new Set([
  ...parseOriginList(process.env.CORS_ORIGINS),
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'https://adnate-paynest.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean).map((origin) => origin.replace(/\/+$/, '')))];

const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: (origin, callback) => {
    const normalizedOrigin = origin?.replace(/\/+$/, '');
    const isLocalDevOrigin = normalizedOrigin && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(normalizedOrigin);

    if (!origin || allowedOrigins.includes(normalizedOrigin) || (!isProduction && isLocalDevOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked origin: ${origin}`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Adnate PayNest API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin/users', require('./routes/adminUsers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/classification-requests', require('./routes/classificationRequests'));
app.use('/api/classifications', require('./routes/classifications'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/account-type-requests', require('./routes/accountTypeRequests'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/beneficiaries', require('./routes/beneficiaries'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/customer', require('./routes/customerDashboard'));
app.use('/api/overdrafts', require('./routes/overdrafts'));
app.use('/api/admin/overdrafts', require('./routes/adminOverdrafts'));
app.use('/api/manager', require('./routes/managerOverdrafts'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/transfer-limits', require('./routes/transferLimits'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/loan-applications', require('./routes/loanApplications'));
app.use('/api/investments', require('./routes/investments'));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
databaseReady.then(async () => {
  await verifyEmailTransporter();
  app.listen(PORT, () => {
  console.log('');
  console.log('  🏦 Adnate PayNest API Server');
  console.log('  ─────────────────────────────────────');
  console.log(`  🚀 Running on port: ${PORT}`);
  console.log(`  🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('  📡 Health: /api/health');
  console.log(`  🔗 Allowed origins: ${allowedOrigins.join(', ') || 'none configured'}`);
  console.log('  ─────────────────────────────────────');
  console.log('');
  });
});

// ─── Scheduler: run daily to deactivate unpaid overdrafts on month boundary ───
const Account = require('./models/Account');
const Notification = require('./models/Notification');
const User = require('./models/User');
const {
  sendMonthEndOverdraftReminderEmail,
  sendOverdraftPenaltyAppliedEmail,
} = require('./utils/emailService');

let lastMonthlyCheck = null;

const checkAndDeactivateOverdrafts = async () => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Run only once per day
    if (lastMonthlyCheck && lastMonthlyCheck.getTime() === today.getTime()) return;

    // If it's not the first day of month, skip
    if (now.getDate() !== 1) {
      lastMonthlyCheck = today;
      return;
    }

    // Find all accounts with unpaid overdraft at the month boundary.
    const accounts = await Account.find({ overdraftUsed: { $gt: 0 } });
    for (const acc of accounts) {
      acc.overdraftStatus = 'DEACTIVATED';
      acc.lastOverdraftDeactivatedAt = new Date();
      await acc.save();
      const customer = await User.findOne({ _id: acc.userId, role: 'customer', isActive: true });
      if (customer?.email) {
        const dueDate = new Date(acc.overdraftDueDate || new Date(now.getFullYear(), now.getMonth(), 0));
        await sendMonthEndOverdraftReminderEmail({
          toEmail: customer.email,
          customerId: customer.customerId || customer._id,
          customerName: customer.name,
          outstandingAmount: acc.overdraftUsed || 0,
          classification: acc.classification || 'Custom',
          currentPenalty: acc.overdraftPenalty || 0,
          penaltyPerDay: acc.getOverdraftDailyPenalty(),
          dueDate: dueDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Kolkata',
          }),
        }).catch((error) => {
          console.error(`Month-end overdraft reminder failed for ${customer.email}:`, error.message);
        });
      }
      // Notify user
      await Notification.create({ userId: acc.userId, title: 'Overdraft Deactivated', message: 'Your overdraft facility has been deactivated due to outstanding repayment at month end.', type: 'alert' });
    }

    lastMonthlyCheck = today;
  } catch (err) {
    console.error('Overdraft monthly check failed:', err.message);
  }
};

// Trigger check every hour (safe, because we guard by date)
setInterval(checkAndDeactivateOverdrafts, 1000 * 60 * 60);
// Also run on startup
databaseReady.then(checkAndDeactivateOverdrafts);

const checkAndNotifyOverdraftPenalties = async () => {
  try {
    const now = new Date();
    const accounts = await Account.find({
      overdraftUsed: { $gt: 0 },
      overdraftDueDate: { $lt: now },
    });

    for (const account of accounts) {
      const previousPenalty = Number(account.overdraftPenalty || 0);
      await account.refreshOverdraftPolicy();
      const currentPenalty = Number(account.overdraftPenalty || 0);
      if (currentPenalty <= previousPenalty) continue;

      await account.save();
      const customer = await User.findOne({ _id: account.userId, role: 'customer', isActive: true });
      if (!customer?.email) continue;

      await sendOverdraftPenaltyAppliedEmail({
        toEmail: customer.email,
        customerId: customer.customerId || customer._id,
        customerName: customer.name,
        outstandingAmount: account.overdraftUsed || 0,
        classification: account.classification || 'Custom',
        penaltyAmount: currentPenalty - previousPenalty,
        penaltyPerDay: account.getOverdraftDailyPenalty(),
        totalAmountPayable: (account.overdraftUsed || 0) + currentPenalty,
        appliedOn: now.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        }),
      }).catch((error) => {
        console.error(`Overdraft penalty email failed for ${customer.email}:`, error.message);
      });
    }
  } catch (error) {
    console.error('Overdraft penalty email check failed:', error.message);
  }
};

setInterval(checkAndNotifyOverdraftPenalties, 1000 * 60 * 60);
databaseReady.then(checkAndNotifyOverdraftPenalties);

// Send each active customer their previous month's transaction sheet.
const { sendMonthlyStatements } = require('./utils/monthlyStatementService');

const runMonthlyStatementEmails = async () => {
  try {
    const result = await sendMonthlyStatements();
    if (result.sent > 0 || result.failed > 0) {
      console.log(`Monthly statements ${result.month}: ${result.sent} sent, ${result.failed} failed.`);
    }
  } catch (error) {
    console.error('Monthly statement email job failed:', error.message);
  }
};

setInterval(runMonthlyStatementEmails, 1000 * 60 * 60);
databaseReady.then(runMonthlyStatementEmails);

// ─── Scheduler: run hourly to deduct EMIs or apply penalties ──────────────────
const { processAutomatedEMIDeductions } = require('./controllers/loanController');
setInterval(processAutomatedEMIDeductions, 1000 * 60 * 60);
databaseReady.then(processAutomatedEMIDeductions);

// Scheduler: run hourly to process due RD installments.
const { processRDInstallments } = require('./controllers/investmentController');
setInterval(processRDInstallments, 1000 * 60 * 60);
databaseReady.then(processRDInstallments);
