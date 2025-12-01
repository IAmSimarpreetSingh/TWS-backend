module.exports = {
  scraperInterval: parseInt(process.env.SCRAPER_INTERVAL_MINUTES || '15') * 60 * 1000,
  vividSeatsBaseUrl: 'https://www.vividseats.com',
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Rate limiting
  maxRequestsPerMinute: 30,
  requestDelay: 2000, // 2 seconds between requests
  
  // Data retention
  dataRetentionMonths: 4,
  
  // Aggregation
  aggregationEnabled: process.env.AGGREGATION_ENABLED !== 'false',
};
