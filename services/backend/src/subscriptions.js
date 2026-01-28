/**
 * Reliability / webhook subscriptions management stubs
 */
module.exports = {
  listSubscriptions: async (req, res, { pool } = {}) => {
    // Optionally read from DB
    res.json({ success: true, subscriptions: [] })
  },

  createSubscription: async (req, res, { pool } = {}) => {
    // Validate and insert
    res.status(201).json({ success: true, id: 'stub-sub-1' })
  }
}
