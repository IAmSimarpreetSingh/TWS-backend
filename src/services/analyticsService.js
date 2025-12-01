const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

class AnalyticsService {
  // Get lowest price over time
  async getLowestPriceOverTime(eventId, zone = null, startDate, endDate) {
    try {
      let query = supabase
        .from('aggregated_analytics')
        .select('hour_timestamp, lowest_price, zone')
        .eq('event_id', eventId)
        .gte('hour_timestamp', startDate)
        .lte('hour_timestamp', endDate)
        .order('hour_timestamp', { ascending: true });

      if (zone) {
        query = query.eq('zone', zone);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Error fetching lowest price over time:', error);
      throw error;
    }
  }

  // Get lowest group price trend
  async getGroupPriceTrend(eventId, groupSize, zone = null, startDate, endDate) {
    try {
      const priceField = `lowest_group_price_${groupSize}`;
      
      let query = supabase
        .from('aggregated_analytics')
        .select(`hour_timestamp, ${priceField}, zone`)
        .eq('event_id', eventId)
        .gte('hour_timestamp', startDate)
        .lte('hour_timestamp', endDate)
        .order('hour_timestamp', { ascending: true });

      if (zone) {
        query = query.eq('zone', zone);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Error fetching group price trend:', error);
      throw error;
    }
  }

  // Get number of tickets listed over time
  async getTicketsListedOverTime(eventId, zone = null, startDate, endDate) {
    try {
      let query = supabase
        .from('aggregated_analytics')
        .select('hour_timestamp, total_tickets, total_listings, zone')
        .eq('event_id', eventId)
        .gte('hour_timestamp', startDate)
        .lte('hour_timestamp', endDate)
        .order('hour_timestamp', { ascending: true });

      if (zone) {
        query = query.eq('zone', zone);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Error fetching tickets listed over time:', error);
      throw error;
    }
  }

  // Get available zones for an event
  async getEventZones(eventId) {
    try {
      const { data, error } = await supabase
        .from('zones_mapping')
        .select('zone, sections')
        .eq('event_id', eventId);

      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Error fetching event zones:', error);
      throw error;
    }
  }

  // Get current ticket summary
  async getCurrentTicketSummary(eventId) {
    try {
      const { data, error } = await supabase
        .from('event_statistics')
        .select('*')
        .eq('event_id', eventId)
        .single();

      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Error fetching ticket summary:', error);
      throw error;
    }
  }

  // Get latest prices by section
  async getLatestPricesBySection(eventId) {
    try {
      const { data, error } = await supabase
        .from('latest_ticket_prices')
        .select('*')
        .eq('event_id', eventId)
        .order('section', { ascending: true });

      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Error fetching latest prices:', error);
      throw error;
    }
  }

  // Get all tracked events
  async getAllEvents() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, event_id, event_name, venue, date, category')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });

      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Error fetching all events:', error);
      throw error;
    }
  }

  // Get zones with latest pricing for an event
  async getZonesWithPricing(eventId) {
    try {
      // Get latest snapshot time
      const { data: latestSnapshot, error: snapshotError } = await supabase
        .from('ticket_snapshots')
        .select('scraped_at')
        .eq('event_id', eventId)
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();

      if (snapshotError) throw snapshotError;

      // Get zone pricing from that time
      const { data, error } = await supabase
        .from('ticket_snapshots')
        .select('zone, price, quantity, quantity_filter')
        .eq('event_id', eventId)
        .eq('scraped_at', latestSnapshot.scraped_at);

      if (error) throw error;

      // Group by zone and calculate min prices
      const zoneMap = {};
      data.forEach(ticket => {
        if (!zoneMap[ticket.zone]) {
          zoneMap[ticket.zone] = {
            zone: ticket.zone,
            minPrice: ticket.price,
            minGroupPrice2: null,
            minGroupPrice4: null,
            totalTickets: 0
          };
        }
        
        zoneMap[ticket.zone].totalTickets += ticket.quantity;
        
        if (ticket.quantity_filter === 1) {
          zoneMap[ticket.zone].minPrice = Math.min(zoneMap[ticket.zone].minPrice, ticket.price);
        } else if (ticket.quantity_filter === 2) {
          zoneMap[ticket.zone].minGroupPrice2 = zoneMap[ticket.zone].minGroupPrice2 
            ? Math.min(zoneMap[ticket.zone].minGroupPrice2, ticket.price)
            : ticket.price;
        } else if (ticket.quantity_filter === 4) {
          zoneMap[ticket.zone].minGroupPrice4 = zoneMap[ticket.zone].minGroupPrice4
            ? Math.min(zoneMap[ticket.zone].minGroupPrice4, ticket.price)
            : ticket.price;
        }
      });

      return Object.values(zoneMap);
    } catch (error) {
      logger.error('Error fetching zones with pricing:', error);
      throw error;
    }
  }

  // Run hourly aggregation
  async runHourlyAggregation() {
    try {
      logger.info('Running hourly aggregation');
      
      const { error } = await supabase.rpc('aggregate_hourly_analytics');
      
      if (error) throw error;
      
      logger.info('Hourly aggregation completed');
    } catch (error) {
      logger.error('Error running hourly aggregation:', error);
      throw error;
    }
  }

  // Run daily aggregation
  async runDailyAggregation() {
    try {
      logger.info('Running daily aggregation');
      
      const { error } = await supabase.rpc('aggregate_daily_analytics');
      
      if (error) throw error;
      
      logger.info('Daily aggregation completed');
    } catch (error) {
      logger.error('Error running daily aggregation:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
