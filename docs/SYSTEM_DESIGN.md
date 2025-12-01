# System Design Document

## Overview
This document outlines the system architecture for the TWS Vivid Seats Analytics Backend - a scalable data collection and analytics platform for ticket pricing and availability insights.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Vivid Seats Public API                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Collection Layer                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Scraping Service (Node.js + Cron / Supabase Edge)       │  │
│  │  - Runs every 10-20 minutes                               │  │
│  │  - Fetches ticket data for tracked events                │  │
│  │  - Rate limiting & error handling                         │  │
│  │  - Job tracking and monitoring                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Data Processing Layer                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Data Processor Service                                   │  │
│  │  - Validate incoming data                                 │  │
│  │  - Calculate metrics:                                     │  │
│  │    * Lowest price per zone/section                        │  │
│  │    * Group ticket prices (2, 4 tickets)                   │  │
│  │    * Ticket counts per zone                               │  │
│  │    * Availability status                                  │  │
│  │  - Transform for database storage                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL Database                  │
│  ┌──────────────────┬──────────────────┬────────────────────┐  │
│  │  Events Table    │ Ticket Snapshots │  Aggregated Data   │  │
│  │  - event_id      │ - snapshot_id    │  - hourly rollups  │  │
│  │  - name          │ - event_id       │  - daily rollups   │  │
│  │  - venue         │ - timestamp      │  - trends          │  │
│  │  - date          │ - section/zone   │                    │  │
│  │                  │ - price          │                    │  │
│  │                  │ - quantity       │                    │  │
│  └──────────────────┴──────────────────┴────────────────────┘  │
│                                                                   │
│  Partitioning: By date (monthly partitions)                      │
│  Indexing: Composite indexes on (event_id, timestamp, zone)      │
│  RLS: Row-level security for multi-tenancy                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Aggregation Layer                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Scheduled Jobs (pg_cron / Edge Functions)               │  │
│  │  - Hourly aggregation: Roll up raw snapshots             │  │
│  │  - Daily aggregation: Compute daily statistics           │  │
│  │  - Materialized views refresh                            │  │
│  │  - Data archival (>4 months → cold storage)              │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer (PostgREST + Custom)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Supabase Auto-generated REST API                        │  │
│  │  + Custom RPC Functions                                  │  │
│  │  - GET /api/analytics/price-trends                       │  │
│  │  - GET /api/analytics/group-prices                       │  │
│  │  - GET /api/analytics/ticket-counts                      │  │
│  │  Query Parameters: event_id, zone, start_date, end_date  │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      React Frontend                              │
│  - 3 Analytics Visualizations (Recharts)                         │
│  - Filters: Event, Zone, Date Range                              │
│  - Real-time updates via Supabase subscriptions (optional)       │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Database
- **Supabase (PostgreSQL)**
  - Fully managed PostgreSQL
  - Built-in real-time subscriptions
  - Auto-generated REST API (PostgREST)
  - Row-level security
  - pg_cron for scheduled tasks

### Backend
- **Node.js + Express**
  - Lightweight, fast
  - Large ecosystem
  - Easy integration with Supabase

### Scraping Layer
**Option 1: Supabase Edge Functions (Recommended)**
- Serverless, scales automatically
- Built-in scheduling via cron
- No server management
- Pay per execution

**Option 2: Node.js Cron Jobs**
- More control
- Easier debugging
- Runs on dedicated server

### Data Storage Strategy
- **Hot Data** (last 1 month): Main PostgreSQL tables with full indexing
- **Warm Data** (1-4 months): Partitioned tables
- **Cold Data** (>4 months): Archive to Supabase Storage or S3

## Scalability Considerations

### Database Optimization

1. **Table Partitioning**
   - Partition `ticket_snapshots` by month
   - Enables faster queries on recent data
   - Simplifies data archival

2. **Indexing Strategy**
   ```sql
   CREATE INDEX idx_snapshots_event_time ON ticket_snapshots(event_id, timestamp);
   CREATE INDEX idx_snapshots_zone ON ticket_snapshots(zone, timestamp);
   CREATE INDEX idx_analytics_hourly ON aggregated_analytics(event_id, hour);
   ```

3. **Materialized Views**
   ```sql
   CREATE MATERIALIZED VIEW mv_daily_price_trends AS
   SELECT event_id, zone, DATE(timestamp) as date,
          MIN(price) as min_price, AVG(price) as avg_price
   FROM ticket_snapshots
   GROUP BY event_id, zone, DATE(timestamp);
   ```

4. **Pre-aggregation**
   - Hourly rollups reduce query load
   - Daily summaries for long-term trends
   - Reduces data volume by 95%

### Query Optimization

1. **Response Time Target: <1 second**
   - Pre-computed aggregations
   - Efficient indexing
   - Connection pooling

2. **Caching Strategy**
   - Cache aggregated data (TTL: 5 minutes)
   - Use Supabase built-in caching
   - Optional: Redis for frequently accessed data

### Scraper Scalability

1. **Rate Limiting**
   - Respect Vivid Seats API limits
   - Exponential backoff on errors
   - Distributed rate limiting if scaling horizontally

2. **Job Distribution**
   - Queue-based system (Bull/Redis)
   - Parallel workers for multiple events
   - Priority queue for high-demand events

3. **Error Handling**
   - Retry logic with exponential backoff
   - Dead letter queue for failed jobs
   - Monitoring and alerting

## Data Retention Policy

- **Real-time Data**: Last 7 days (no compression)
- **Recent Data**: 1-4 months (compressed aggregations)
- **Historical Data**: Archive to cold storage after 4 months
- **Analytics Data**: Permanent storage of daily/hourly rollups

## Monitoring & Observability

1. **Metrics to Track**
   - Scraper success/failure rate
   - API response times
   - Database query performance
   - Storage usage growth

2. **Alerting**
   - Scraper failures
   - API errors
   - Database performance degradation
   - Storage capacity warnings

## Security

1. **API Security**
   - Row-level security (RLS) in Supabase
   - API key authentication
   - Rate limiting per client

2. **Data Privacy**
   - No personally identifiable information stored
   - Public ticket data only

## Cost Optimization

1. **Database**
   - Use table partitioning to manage data growth
   - Archive old data to cheaper storage
   - Optimize queries to reduce compute

2. **Scraping**
   - Batch requests where possible
   - Only scrape events with active listings
   - Adaptive scraping frequency based on activity

## Future Enhancements

1. **Real-time Updates**
   - WebSocket connections for live price updates
   - Supabase real-time subscriptions

2. **Machine Learning**
   - Price prediction models
   - Demand forecasting
   - Optimal purchase timing recommendations

3. **Multi-venue Support**
   - Scale to support multiple ticket platforms
   - Unified data model

4. **Advanced Analytics**
   - Price elasticity analysis
   - Competitor comparison
   - Market trends

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│         Cloud Provider (AWS/GCP)        │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Load Balancer                    │ │
│  └─────────────┬─────────────────────┘ │
│                │                        │
│       ┌────────┴────────┐               │
│       ▼                 ▼               │
│  ┌─────────┐      ┌─────────┐          │
│  │ API     │      │ API     │          │
│  │ Server 1│      │ Server 2│          │
│  └────┬────┘      └────┬────┘          │
│       │                │               │
│       └────────┬────────┘               │
│                ▼                        │
│       ┌─────────────────┐               │
│       │  Supabase       │               │
│       │  PostgreSQL     │               │
│       └─────────────────┘               │
└─────────────────────────────────────────┘
```

## Conclusion

This system design provides a scalable, cost-effective solution for real-time ticket analytics. The use of Supabase simplifies infrastructure management while providing powerful features like real-time subscriptions and auto-generated APIs. The pre-aggregation strategy ensures fast query performance even as data volume grows.
