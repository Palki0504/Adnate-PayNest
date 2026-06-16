const mongoose = require("mongoose");

const beneficiarySchema = new mongoose.Schema(
  {
    // userId is the owner of this beneficiary record (the logged-in user)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    nickname: {
      type: String,
      required: true,
    },

    // customerId of the RECIPIENT (the beneficiary's Customer ID)
    customerId: {
      type: String,
      required: true,
    },

    accountNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    accountType: {
      type: String,
      enum: ['savings', 'current', 'salary'],
    },

    beneficiaryName: {
      type: String,
      required: true,
    },

    beneficiaryPhone: {
      type: String,
      default: "",
    },

    beneficiaryEmail: {
      type: String,
      default: "",
    },

    relationship: {
      type: String,
      enum: ["self", "family", "friend", "business", "other"],
      default: "other",
    },

    notes: {
      type: String,
      default: "",
    },

    isVerified: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    bankName: {
      type: String,
      default: "Adnate PayNest",
    },

    branchName: {
      type: String,
      default: "Digital Banking Branch",
    },

    ifscCode: {
      type: String,
      default: "ADNP0001234",
    },

    maxTransferLimit: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

beneficiarySchema.index(
  { userId: 1, nickname: 1 },
  {
    name: "beneficiary_active_user_nickname_unique",
    unique: true,
    partialFilterExpression: { isActive: true },
    collation: { locale: "en", strength: 2 },
  }
);

beneficiarySchema.index({ userId: 1 }, { name: "userId_1" });
beneficiarySchema.index(
  { userId: 1, accountNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, accountNumber: { $type: 'string' } },
    name: 'beneficiary_active_account_unique',
  }
);

module.exports = mongoose.model("Beneficiary", beneficiarySchema);
