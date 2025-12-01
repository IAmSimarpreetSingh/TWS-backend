require('dotenv').config();
const express = require('express');
const cors = require('cors');
const analyticsRoutes = require('./routes/analytics');
const ticketScraperJob = require('./jobs/ticketScraper');
const config = require('./config/config');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', analyticsRoutes);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  
  // Start scraper jobs
  if (process.env.ENABLE_SCRAPER !== 'false') {
    ticketScraperJob.start();
  }
});

module.exports = app;
