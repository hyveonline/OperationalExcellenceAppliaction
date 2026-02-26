/**
 * Security Employee (Security Department) Module
 * Contains apps for the Security Department category
 */

const express = require('express');
const router = express.Router();

// Import routes
const legalCasesRoutes = require('./legal-cases/routes');
const blacklistRoutes = require('./blacklist/routes');

// Mount routes
router.use('/legal-cases', legalCasesRoutes);
router.use('/blacklist', blacklistRoutes);

module.exports = router;
