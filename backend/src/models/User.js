const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BCRYPT_COST_FACTOR = 12;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    name: {
      type: String,
      trim: true,
      default: ''
    },
    // Hashed refresh tokens currently valid for this user (supports
    // multiple devices/sessions). Never store raw refresh tokens.
    refreshTokenHashes: {
      type: [String],
      default: [],
      select: false
    }
  },
  { timestamps: true }
);

userSchema.statics.hashPassword = async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_COST_FACTOR);
};

userSchema.methods.comparePassword = async function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Ensure secrets are never serialized in API responses.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHashes;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
