const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// General endpoints
router.get('/events', analyticsController.getAllEvents);

// Event-specific analytics endpoints
router.get('/events/:eventId/analytics/lowest-price', analyticsController.getLowestPrice);
router.get('/events/:eventId/analytics/group-price', analyticsController.getGroupPriceTrend);
router.get('/events/:eventId/analytics/tickets-listed', analyticsController.getTicketsListed);
router.get('/events/:eventId/zones', analyticsController.getEventZones);
router.get('/events/:eventId/zones-pricing', analyticsController.getZonesWithPricing);
router.get('/events/:eventId/summary', analyticsController.getCurrentSummary);
router.get('/events/:eventId/latest-prices', analyticsController.getLatestPrices);

module.exports = router;
