// src/routes/admin.routes.js
const express = require('express');
const adminController = require('../controllers/admin.controller');
const { authMiddleware, authorize } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authMiddleware, authorize('admin'));

/**
 * @route GET /api/admin/clients
 * @desc Get all clients with pagination and filtering
 * @access Private (Admin only)
 */
router.get('/clients', adminController.listClients);

/**
 * @route GET /api/admin/clients/:clientId
 * @desc Get client details by ID
 * @access Private (Admin only)
 */
router.get('/clients/:clientId', adminController.getClient);

/**
 * @route POST /api/admin/clients/:clientId/approve
 * @desc Approve a client
 * @access Private (Admin only)
 */
router.post('/clients/:clientId/approve', adminController.approveClient);

/**
 * @route POST /api/admin/clients/:clientId/suspend
 * @desc Suspend a client
 * @access Private (Admin only)
 */
router.post('/clients/:clientId/suspend', adminController.suspendClient);

/**
 * @route POST /api/admin/clients/:clientId/revoke
 * @desc Revoke a client
 * @access Private (Admin only)
 */
router.post('/clients/:clientId/revoke', adminController.revokeClient);

/**
 * @route PUT /api/admin/clients/:clientId/quota
 * @desc Update client usage quota
 * @access Private (Admin only)
 */
router.put('/clients/:clientId/quota', adminController.updateClientQuota);

/**
 * @route POST /api/admin/clients/:clientId/reset-usage
 * @desc Reset client usage counter
 * @access Private (Admin only)
 */
router.post('/clients/:clientId/reset-usage', adminController.resetClientUsage);

/**
 * @route GET /api/admin/stats
 * @desc Get system statistics for admin dashboard
 * @access Private (Admin only)
 */
router.get('/stats', adminController.getSystemStats);

/**
 * @route POST /api/admin/clients/:clientId/reinstate
 * @desc Reinstate a suspended or revoked client
 * @access Private (Admin only)
 */
router.post('/clients/:clientId/reinstate', adminController.reinstateClient);

/**
 * @route DELETE /api/admin/clients/:clientId
 * @desc Delete a revoked client
 * @access Private (Admin only)
 */
router.delete('/clients/:clientId', adminController.deleteClient);

// ====== EMAIL MONITORING ROUTES ======

/**
 * @route GET /api/admin/email-stats
 * @desc Get email system statistics
 * @access Private (Admin only)
 */
router.get('/email-stats', adminController.getEmailStats);

/**
 * @route GET /api/admin/suppressed-emails
 * @desc Get list of suppressed email addresses
 * @access Private (Admin only)
 */
router.get('/suppressed-emails', adminController.getSuppressedEmails);

/**
 * @route POST /api/admin/reactivate-email
 * @desc Reactivate a suppressed email address
 * @access Private (Admin only)
 */
router.post('/reactivate-email', adminController.reactivateEmail);

/**
 * @route POST /api/admin/send-test-email
 * @desc Send a test email
 * @access Private (Admin only)
 */
router.post('/send-test-email', adminController.sendTestEmail);

/**
 * @route GET /api/admin/contact-form-stats
 * @desc Get contact form statistics
 * @access Private (Admin only)
 */
router.get('/contact-form-stats', adminController.getContactFormStats);

module.exports = router;