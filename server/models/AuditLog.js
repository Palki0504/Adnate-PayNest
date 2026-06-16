const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    userName: {
      type: String,
      default: 'System',
    },
    userRole: {
      type: String,
      enum: ['admin', 'customer', 'manager', 'system'],
      default: 'system',
    },
    action: {
      type: String,
      required: true,
      enum: [
        'login',
        'logout',
        'register',
        'login_failed',
        'user_created',
        'user_updated',
        'user_activated',
        'user_deactivated',
        'transfer_initiated',
        'transfer_completed',
        'transfer_failed',
        'overdraft_used',
        'classification_changed',
        'classification_created',
        'classification_updated',
        'classification_deleted',
        'notification_sent',
        'business_rule_created',
        'business_rule_updated',
        'business_rule_deleted',
        'settings_updated',
        'password_reset',
        'kyc_updated',
      ],
    },
    details: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
