const cron = require('node-cron');
const scraperService = require('../services/scraper');
const analyticsService = require('../services/analyticsService');
const config = require('../config/config');
const logger = require('../utils/logger');

class TicketScraperJob {
  start() {
    // Run scraper every 15 minutes (configurable)
    const intervalMinutes = config.scraperInterval / 60000;
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    logger.info(`Scheduling scraper to run every ${intervalMinutes} minutes`);
    
    cron.schedule(cronExpression, async () => {
      try {
        logger.info('Starting scheduled scrape');
        await scraperService.scrapeAllEvents();
      } catch (error) {
        logger.error('Error in scheduled scrape:', error);
      }
    });

    // Run hourly aggregation
    cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Starting hourly aggregation');
        await analyticsService.runHourlyAggregation();
      } catch (error) {
        logger.error('Error in hourly aggregation:', error);
      }
    });

    // Run daily aggregation at 1 AM
    cron.schedule('0 1 * * *', async () => {
      try {
        logger.info('Starting daily aggregation');
        await analyticsService.runDailyAggregation();
      } catch (error) {
        logger.error('Error in daily aggregation:', error);
      }
    });

    logger.info('Scraper jobs scheduled successfully');
  }
}

module.exports = new TicketScraperJob();
