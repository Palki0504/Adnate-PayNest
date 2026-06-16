const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');

// ─── @desc    Get admin settings (auto-creates default if not exists)
// ─── @route   GET /api/admin/settings
// ─── @access  Protected (admin)
const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = await Settings.create({ key: 'global' });
    }
    res.status(200).json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Update admin settings
// ─── @route   PUT /api/admin/settings
// ─── @access  Protected (admin)
const updateSettings = async (req, res, next) => {
  try {
    const {
      bankName,
      supportEmail,
      maintenanceMode,
      overdraftEnabled,
      maxODPerMonth,
      requireKycForTransfer,
      maxTransferApprovalThreshold,
      sessionTimeoutMinutes,
      allowSelfRegistration,
    } = req.body;

    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = new Settings({ key: 'global' });
    }

    if (bankName !== undefined) settings.bankName = bankName;
    if (supportEmail !== undefined) settings.supportEmail = supportEmail;
    if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
    if (overdraftEnabled !== undefined) settings.overdraftEnabled = overdraftEnabled;
    if (maxODPerMonth !== undefined) settings.maxODPerMonth = maxODPerMonth;
    if (requireKycForTransfer !== undefined) settings.requireKycForTransfer = requireKycForTransfer;
    if (maxTransferApprovalThreshold !== undefined) settings.maxTransferApprovalThreshold = maxTransferApprovalThreshold;
    if (sessionTimeoutMinutes !== undefined) settings.sessionTimeoutMinutes = sessionTimeoutMinutes;
    if (allowSelfRegistration !== undefined) settings.allowSelfRegistration = allowSelfRegistration;

    settings.updatedBy = req.user._id;
    await settings.save();

    await AuditLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'settings_updated',
      details: 'Admin settings updated',
      metadata: { updatedFields: Object.keys(req.body) },
    });

    res.status(200).json({ success: true, message: 'Settings updated successfully.', settings });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSettings, updateSettings };
