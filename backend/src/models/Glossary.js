const mongoose = require('mongoose');

/**
 * IP / legal glossary terms used by the refinement pass to enforce
 * consistent, correct terminology per target language.
 */
const glossarySchema = new mongoose.Schema(
  {
    englishTerm: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    translations: {
      // e.g. { hi: 'पेटेंट', mr: 'पेटंट', bn: 'পেটেন্ট', ... }
      type: Map,
      of: String,
      default: {}
    },
    notes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Glossary', glossarySchema);
