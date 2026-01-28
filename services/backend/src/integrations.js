/**
 * Integrations callback handlers (hubspot, salesforce, generic OAuth callbacks)
 * Keep these minimal and safe. Replace with full implementation when migrating logic.
 */
module.exports = {
  handleHubspotCallback: async (req, res, { pool } = {}) => {
    console.log('HubSpot callback received', req.query || req.body)
    // Acknowledge — actual processing should validate and queue work
    res.status(200).json({ received: true })
  },

  handleSalesforceCallback: async (req, res, { pool } = {}) => {
    console.log('Salesforce callback received', req.query || req.body)
    res.status(200).json({ received: true })
  }
}
