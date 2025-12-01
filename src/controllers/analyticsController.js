const analyticsService = require('../services/analyticsService');
const logger = require('../utils/logger');

class AnalyticsController {
  // Get lowest price over time
  async getLowestPrice(req, res) {
    try {
      const { eventId } = req.params;
      const { zone, startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'startDate and endDate are required',
        });
      }

      const data = await analyticsService.getLowestPriceOverTime(
        eventId,
        zone,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error in getLowestPrice:', error);
      res.status(500).json({
        error: 'Failed to fetch lowest price data',
      });
    }
  }

  // Get group price trend
  async getGroupPriceTrend(req, res) {
    try {
      const { eventId } = req.params;
      const { groupSize = 2, zone, startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'startDate and endDate are required',
        });
      }

      if (![2, 4].includes(parseInt(groupSize))) {
        return res.status(400).json({
          error: 'groupSize must be 2 or 4',
        });
      }

      const data = await analyticsService.getGroupPriceTrend(
        eventId,
        parseInt(groupSize),
        zone,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error in getGroupPriceTrend:', error);
      res.status(500).json({
        error: 'Failed to fetch group price trend',
      });
    }
  }

  // Get tickets listed over time
  async getTicketsListed(req, res) {
    try {
      const { eventId } = req.params;
      const { zone, startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'startDate and endDate are required',
        });
      }

      const data = await analyticsService.getTicketsListedOverTime(
        eventId,
        zone,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error in getTicketsListed:', error);
      res.status(500).json({
        error: 'Failed to fetch tickets listed data',
      });
    }
  }

  // Get event zones
  async getEventZones(req, res) {
    try {
      const { eventId } = req.params;

      const data = await analyticsService.getEventZones(eventId);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error in getEventZones:', error);
      res.status(500).json({
        error: 'Failed to fetch event zones',
      });
    }
  }

  // Get current summary
  async getCurrentSummary(req, res) {
    try {
      const { eventId } = req.params;

      const data = await analyticsService.getCurrentTicketSummary(eventId);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error in getCurrentSummary:', error);
      res.status(500).json({
        error: 'Failed to fetch current summary',
      });
    }
  }

  // Get latest prices by section
  async getLatestPrices(req, res) {
    try {
      const { eventId } = req.params;

      const data = await analyticsService.getLatestPricesBySection(eventId);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error in getLatestPrices:', error);
      res.status(500).json({
        error: 'Failed to fetch latest prices',
      });
    }
  }

  // Get all tracked events
  async getAllEvents(req, res) {
    try {
      const data = await analyticsService.getAllEvents();

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error in getAllEvents:', error);
      res.status(500).json({
        error: 'Failed to fetch events',
      });
    }
  }

  // Get zones with current pricing
  async getZonesWithPricing(req, res) {
    try {
      const { eventId } = req.params;

      const data = await analyticsService.getZonesWithPricing(eventId);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error in getZonesWithPricing:', error);
      res.status(500).json({
        error: 'Failed to fetch zones with pricing',
      });
    }
  }
}

module.exports = new AnalyticsController();
