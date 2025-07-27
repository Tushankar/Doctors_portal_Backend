// Stub ML matcher for prescriptions
// TODO: connect to real ML model or drug database

/**
 * Matches extracted medications against a valid drugs database
 * @param {Array} medications - array of medication objects { name, dosage, frequency, duration, instructions, confidence }
 * @returns {Promise<Array>} - array of medications with `isValid` flag
 */
export const matchDrugs = async (medications) => {
  // In a real implementation, compare against a drug DB or use an ML model
  return medications.map((med) => ({
    ...med,
    isValid: true, // default to valid; override with real logic
  }));
};
