/**
 * Security Employee (Security Department) Module
 * Contains apps for the Security Department category
 */

const express = require('express');
const router = express.Router();

// Import routes
const legalCasesRoutes = require('./legal-cases/routes');

// Mount routes
router.use('/legal-cases', legalCasesRoutes);

module.exports = router;
