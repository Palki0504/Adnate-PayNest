require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
const databaseReady = connectDB();

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/overdrafts', require('./routes/overdrafts'));
app.use('/api/admin/overdrafts', require('./routes/adminOverdrafts'));
app.use('/api/manager', require('./routes/managerOverdrafts'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/transfer-limits', require('./routes/transferLimits'));

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
databaseReady.then(() => app.listen(PORT, () => {
  console.log('');
  console.log('  🏦 Adnate PayNest API Server');
  console.log('  ─────────────────────────────────────');
  console.log(`  🚀 Running on: http://localhost:${PORT}`);
  console.log(`  🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  📡 Health: http://localhost:${PORT}/api/health`);
  console.log('  ─────────────────────────────────────');
  console.log('');
}));

// ─── Scheduler: run daily to deactivate unpaid overdrafts on month boundary ───
const Account = require('./models/Account');
const Notification = require('./models/Notification');

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

    // Find accounts with outstanding overdraft (overdraftUsed > 0) and active overdraft status
    const accounts = await Account.find({ overdraftUsed: { $gt: 0 }, overdraftStatus: 'ACTIVE' });
    for (const acc of accounts) {
      acc.overdraftStatus = 'DEACTIVATED';
      acc.lastOverdraftDeactivatedAt = new Date();
      await acc.save();
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
