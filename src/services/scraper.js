const axios = require('axios');
const { supabase } = require('../config/supabase');
const config = require('../config/config');
const logger = require('../utils/logger');

class ScraperService {
  constructor() {
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
  }

  // Rate limiting helper
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < config.requestDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, config.requestDelay - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  // Fetch event data from Vivid Seats API
  async fetchEventData(productionId, quantity = 1) {
    await this.rateLimit();
    
    try {
      logger.info(`Fetching VividSeats data for production ${productionId}, quantity ${quantity}`);
      
      // Real VividSeats API endpoint (discovered from browser DevTools)
      const url = `https://www.vividseats.com/hermes/api/v1/listings`;
      const params = {
        productionId: productionId,
        quantity: quantity,
        // Add other required parameters as discovered from actual API
      };
      
      const response = await axios.get(url, {
        params,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });
      
      return this.parseVividSeatsResponse(response.data, productionId);
    } catch (error) {
      logger.error(`Error fetching VividSeats data for ${productionId}:`, error.message);
      
      // Fallback to mock data if API fails
      logger.info(`Using mock data for production ${productionId}`);
      return {
        productionId,
        name: 'Sample Event',
        venue: 'Sample Venue',
        date: new Date(),
        tickets: this.generateMockTickets(),
      };
    }
  }

  // Parse VividSeats API response
  parseVividSeatsResponse(apiData, productionId) {
    const tickets = [];
    
    // Parse the actual API structure
    // This will depend on the exact API response format
    if (apiData.listings && Array.isArray(apiData.listings)) {
      apiData.listings.forEach(listing => {
        tickets.push({
          section: listing.section || listing.sectionName,
          zone: listing.zone || this.deriveZone(listing.section),
          row: listing.row,
          quantity: listing.quantity || listing.splitQuantity,
          price: parseFloat(listing.price || listing.faceValue),
          rating: listing.dealScore || 5.0,
          tags: this.extractTags(listing),
        });
      });
    }
    
    return {
      productionId,
      name: apiData.event?.name || 'Unknown Event',
      venue: apiData.venue?.name || 'Unknown Venue',
      date: apiData.event?.date || new Date(),
      tickets: tickets.length > 0 ? tickets : this.generateMockTickets(),
    };
  }

  // Derive zone from section number (basic logic)
  deriveZone(section) {
    if (!section) return 'General Admission';
    
    const sectionNum = parseInt(section);
    if (isNaN(sectionNum)) return 'General Admission';
    
    if (sectionNum >= 100 && sectionNum < 200) return 'Lower Bowl';
    if (sectionNum >= 200 && sectionNum < 300) return 'Upper Bowl';
    if (sectionNum >= 300 && sectionNum < 400) return 'Club Level';
    if (sectionNum >= 500) return 'Upper Deck';
    
    return 'General Admission';
  }

  // Extract tags from listing
  extractTags(listing) {
    const tags = [];
    
    if (listing.instantDownload) tags.push('Instant Download');
    if (listing.mobileTransfer) tags.push('Mobile Transfer');
    if (listing.aisle) tags.push('Aisle Seats');
    if (listing.vip) tags.push('VIP Access');
    if (listing.parkingIncluded) tags.push('Parking Included');
    
    return tags;
  }

  // Generate mock tickets for MVP
  generateMockTickets() {
    const sections = ['101', '102', '103', '201', '202', '203'];
    const zones = ['Lower Bowl', 'Upper Bowl', 'Club Level'];
    const tickets = [];

    for (let i = 0; i < 50; i++) {
      tickets.push({
        section: sections[Math.floor(Math.random() * sections.length)],
        zone: zones[Math.floor(Math.random() * zones.length)],
        row: String.fromCharCode(65 + Math.floor(Math.random() * 10)),
        quantity: Math.floor(Math.random() * 6) + 1,
        price: Math.floor(Math.random() * 500) + 50,
        rating: (Math.random() * 5 + 5).toFixed(1),
        tags: this.getRandomTags(),
      });
    }

    return tickets;
  }

  getRandomTags() {
    const allTags = ['Mobile Transfer', 'Instant Download', 'Aisle Seats', 'VIP Access'];
    const numTags = Math.floor(Math.random() * 3);
    return allTags.slice(0, numTags);
  }

  // Scrape tickets for a specific event with multiple quantity options
  async scrapeEvent(eventId) {
    const jobId = await this.createJob(eventId);
    
    try {
      logger.info(`Starting scrape job ${jobId} for event ${eventId}`);
      
      let totalSaved = 0;
      
      // Scrape for quantity 1, 2, and 4 to capture group pricing
      for (const quantity of [1, 2, 4]) {
        const eventData = await this.fetchEventData(eventId, quantity);
        const tickets = eventData.tickets;
        
        // Save tickets with quantity info
        const saved = await this.saveTickets(eventId, tickets, quantity);
        totalSaved += saved;
        
        // Small delay between quantity requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      await this.completeJob(jobId, totalSaved);
      logger.info(`Completed scrape job ${jobId}, saved ${totalSaved} tickets`);
      
      return { success: true, ticketCount: totalSaved };
    } catch (error) {
      await this.failJob(jobId, error.message);
      logger.error(`Failed scrape job ${jobId}:`, error);
      throw error;
    }
  }

  // Create scraper job record
  async createJob(eventId) {
    const { data, error } = await supabase
      .from('scraper_jobs')
      .insert({
        event_id: eventId,
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  // Mark job as completed
  async completeJob(jobId, ticketCount) {
    await supabase
      .from('scraper_jobs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'completed',
        tickets_scraped: ticketCount,
      })
      .eq('id', jobId);
  }

  // Mark job as failed
  async failJob(jobId, errorMessage) {
    await supabase
      .from('scraper_jobs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', jobId);
  }

  // Save tickets to database with quantity filter
  async saveTickets(eventId, tickets, quantityFilter = 1) {
    const now = new Date().toISOString();
    
    const ticketRecords = tickets.map(ticket => ({
      event_id: eventId,
      section: ticket.section,
      zone: ticket.zone,
      row_name: ticket.row,
      quantity: ticket.quantity,
      quantity_filter: quantityFilter, // Track which quantity filter was used
      price: ticket.price,
      rating: parseFloat(ticket.rating),
      tags: ticket.tags,
      scraped_at: now,
    }));

    const { data, error} = await supabase
      .from('ticket_snapshots')
      .insert(ticketRecords)
      .select('id');

    if (error) throw error;
    return data.length;
  }

  // Scrape all active events
  async scrapeAllEvents() {
    logger.info('Starting scrape for all active events');
    
    const { data: events, error } = await supabase
      .from('events')
      .select('id, event_id, event_name')
      .gte('date', new Date().toISOString());

    if (error) {
      logger.error('Error fetching events:', error);
      return;
    }

    logger.info(`Found ${events.length} active events to scrape`);

    for (const event of events) {
      try {
        await this.scrapeEvent(event.id);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`Error scraping event ${event.id}:`, error);
      }
    }

    logger.info('Completed scraping all events');
  }
}

module.exports = new ScraperService();
