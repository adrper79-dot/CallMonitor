/**
 * Auth server operations that are server-only (user provisioning, unlocks, password resets)
 * These are simple proxied endpoints until full migration is implemented.
 */
module.exports = {
  handleSignup: async (req, res, { pool } = {}) => {
    console.log('Signup proxied request', { body: req.body })
    // Validate payload minimally then respond
    if (!req.body || !req.body.email) return res.status(400).json({ success: false, error: 'email required' })
    // Enqueue or call existing service to create a user — stubbed here
    res.json({ success: true, message: 'Signup received' })
  },

  handleForgotPassword: async (req, res, { pool } = {}) => {
    console.log('Forgot-password request', { body: req.body })
    if (!req.body || !req.body.email) return res.status(400).json({ success: false, error: 'email required' })
    res.json({ success: true, message: 'Reset requested' })
  }
}
