# Database Schema Documentation

## Overview
This document defines the complete database schema for the TWS Vivid Seats Analytics system using Supabase (PostgreSQL).

## Entity Relationship Diagram

```
┌─────────────────────┐
│      events         │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ venue               │
│ date                │
│ category            │
│ created_at          │
│ updated_at          │
│ last_scraped        │
└──────────┬──────────┘
           │
           │ 1:N
           │
┌──────────▼──────────────┐
│  ticket_snapshots       │
├─────────────────────────┤
│ id (PK)                 │
│ event_id (FK)           │
│ timestamp               │
│ zone                    │
│ section                 │
│ section_id              │
│ lowest_price            │
│ average_price           │
│ highest_price           │
│ lowest_price_2tickets   │
│ lowest_price_4tickets   │
│ total_tickets           │
│ total_listings          │
│ available               │
│ raw_listings (JSONB)    │
└─────────────────────────┘
           │
           │ Aggregates to
           │
┌──────────▼──────────────┐
│ aggregated_analytics    │
├─────────────────────────┤
│ id (PK)                 │
│ event_id (FK)           │
│ zone                    │
│ hour                    │
│ min_price               │
│ avg_price               │
│ max_price               │
│ min_price_2tickets      │
│ min_price_4tickets      │
│ total_tickets           │
│ total_listings          │
│ created_at              │
└─────────────────────────┘
           │
           │ Aggregates to
           │
┌──────────▼──────────────┐
│  daily_analytics        │
├─────────────────────────┤
│ id (PK)                 │
│ event_id (FK)           │
│ zone                    │
│ date                    │
│ daily_min_price         │
│ daily_avg_price         │
│ daily_max_price         │
│ daily_min_2tickets      │
│ daily_min_4tickets      │
│ peak_tickets            │
│ avg_tickets             │
│ created_at              │
└─────────────────────────┘

┌─────────────────────┐
│  scraper_jobs       │
├─────────────────────┤
│ id (PK)             │
│ job_id (UUID)       │
│ started_at          │
│ completed_at        │
│ status              │
│ events_scraped      │
│ errors_count        │
│ error_details       │
└─────────────────────┘

┌─────────────────────┐
│  zones_mapping      │
├─────────────────────┤
│ id (PK)             │
│ event_id (FK)       │
│ zone_name           │
│ sections (ARRAY)    │
│ display_order       │
└─────────────────────┘
```

## Table Definitions

### 1. events

Stores information about events being tracked.

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE NOT NULL, -- Vivid Seats event ID
    name VARCHAR(500) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50),
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    category VARCHAR(100), -- NBA, MLB, NFL, etc.
    performer_id VARCHAR(255),
    performer_name VARCHAR(255),
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_scraped TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_active ON events(active) WHERE active = true;
CREATE INDEX idx_events_external_id ON events(external_id);
CREATE INDEX idx_events_last_scraped ON events(last_scraped);
```

### 2. ticket_snapshots

Time-series data of ticket prices and availability. This is the main raw data table.

```sql
CREATE TABLE ticket_snapshots (
    id BIGSERIAL,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    zone VARCHAR(100) NOT NULL,
    section VARCHAR(100) NOT NULL,
    section_id VARCHAR(100),
    
    -- Price metrics
    lowest_price DECIMAL(10,2) NOT NULL,
    average_price DECIMAL(10,2),
    highest_price DECIMAL(10,2),
    
    -- Group pricing
    lowest_price_2tickets DECIMAL(10,2),
    lowest_price_4tickets DECIMAL(10,2),
    
    -- Availability
    total_tickets INTEGER NOT NULL DEFAULT 0,
    total_listings INTEGER NOT NULL DEFAULT 0,
    available BOOLEAN DEFAULT true,
    
    -- Raw data for detailed analysis
    raw_listings JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE ticket_snapshots_2025_11 PARTITION OF ticket_snapshots
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE ticket_snapshots_2025_12 PARTITION OF ticket_snapshots
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Indexes
CREATE INDEX idx_snapshots_event_time ON ticket_snapshots(event_id, timestamp);
CREATE INDEX idx_snapshots_zone ON ticket_snapshots(zone, timestamp);
CREATE INDEX idx_snapshots_section ON ticket_snapshots(section, timestamp);
CREATE INDEX idx_snapshots_timestamp ON ticket_snapshots(timestamp);
CREATE INDEX idx_snapshots_price ON ticket_snapshots(lowest_price);

-- JSONB index for raw listings
CREATE INDEX idx_snapshots_raw_listings ON ticket_snapshots USING GIN (raw_listings);
```

### 3. aggregated_analytics

Hourly aggregated data for faster querying.

```sql
CREATE TABLE aggregated_analytics (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    zone VARCHAR(100) NOT NULL,
    hour TIMESTAMP WITH TIME ZONE NOT NULL, -- Truncated to hour
    
    -- Aggregated price metrics
    min_price DECIMAL(10,2) NOT NULL,
    avg_price DECIMAL(10,2),
    max_price DECIMAL(10,2),
    
    -- Group pricing
    min_price_2tickets DECIMAL(10,2),
    min_price_4tickets DECIMAL(10,2),
    
    -- Aggregated availability
    total_tickets INTEGER,
    total_listings INTEGER,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(event_id, zone, hour)
);

-- Indexes
CREATE INDEX idx_analytics_event_hour ON aggregated_analytics(event_id, hour);
CREATE INDEX idx_analytics_zone_hour ON aggregated_analytics(zone, hour);
CREATE INDEX idx_analytics_hour ON aggregated_analytics(hour);
```

### 4. daily_analytics

Daily aggregated data for long-term trend analysis.

```sql
CREATE TABLE daily_analytics (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    zone VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    
    -- Daily price metrics
    daily_min_price DECIMAL(10,2) NOT NULL,
    daily_avg_price DECIMAL(10,2),
    daily_max_price DECIMAL(10,2),
    
    -- Group pricing
    daily_min_2tickets DECIMAL(10,2),
    daily_min_4tickets DECIMAL(10,2),
    
    -- Daily availability metrics
    peak_tickets INTEGER,
    avg_tickets INTEGER,
    min_tickets INTEGER,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(event_id, zone, date)
);

-- Indexes
CREATE INDEX idx_daily_event_date ON daily_analytics(event_id, date);
CREATE INDEX idx_daily_zone_date ON daily_analytics(zone, date);
CREATE INDEX idx_daily_date ON daily_analytics(date);
```

### 5. scraper_jobs

Tracks scraper job execution for monitoring and debugging.

```sql
CREATE TABLE scraper_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL, -- 'running', 'success', 'failed'
    events_scraped INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_details JSONB,
    duration_ms INTEGER, -- Computed on completion
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_jobs_status ON scraper_jobs(status);
CREATE INDEX idx_jobs_started_at ON scraper_jobs(started_at);
```

### 6. zones_mapping

Maps zones to sections for each event (for UI purposes).

```sql
CREATE TABLE zones_mapping (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL,
    sections TEXT[], -- Array of section IDs
    display_order INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(event_id, zone_name)
);

-- Indexes
CREATE INDEX idx_zones_event ON zones_mapping(event_id);
```

### 7. scraper_logs

Detailed logging for errors and important events.

```sql
CREATE TABLE scraper_logs (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    job_id UUID REFERENCES scraper_jobs(job_id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    level VARCHAR(20) NOT NULL, -- 'INFO', 'WARNING', 'ERROR'
    message TEXT NOT NULL,
    stack_trace TEXT,
    metadata JSONB
);

-- Indexes
CREATE INDEX idx_logs_timestamp ON scraper_logs(timestamp);
CREATE INDEX idx_logs_level ON scraper_logs(level);
CREATE INDEX idx_logs_event ON scraper_logs(event_id);
```

## Materialized Views

### mv_latest_prices

Quick access to the most recent prices for each event/zone.

```sql
CREATE MATERIALIZED VIEW mv_latest_prices AS
SELECT DISTINCT ON (event_id, zone)
    event_id,
    zone,
    section,
    lowest_price,
    average_price,
    total_tickets,
    total_listings,
    timestamp
FROM ticket_snapshots
ORDER BY event_id, zone, timestamp DESC;

-- Index
CREATE UNIQUE INDEX idx_mv_latest_prices ON mv_latest_prices(event_id, zone);

-- Refresh schedule (via pg_cron)
-- Every 15 minutes: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_prices;
```

### mv_price_trends

Pre-computed price trends for common queries.

```sql
CREATE MATERIALIZED VIEW mv_price_trends AS
SELECT 
    event_id,
    zone,
    DATE_TRUNC('hour', timestamp) as hour,
    MIN(lowest_price) as min_price,
    AVG(average_price) as avg_price,
    MAX(highest_price) as max_price,
    COUNT(*) as snapshot_count
FROM ticket_snapshots
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY event_id, zone, DATE_TRUNC('hour', timestamp);

-- Index
CREATE INDEX idx_mv_trends_event_hour ON mv_price_trends(event_id, hour);
```

## Sample Queries

### Get Price Trend for an Event/Zone

```sql
SELECT 
    hour as timestamp,
    min_price,
    avg_price
FROM aggregated_analytics
WHERE event_id = 'uuid-here'
  AND zone = 'Lower Bowl'
  AND hour >= NOW() - INTERVAL '7 days'
ORDER BY hour ASC;
```

### Get Lowest Group Prices Over Time

```sql
SELECT 
    hour as timestamp,
    min_price_2tickets as price_2,
    min_price_4tickets as price_4
FROM aggregated_analytics
WHERE event_id = 'uuid-here'
  AND zone = 'Lower Bowl'
  AND hour >= NOW() - INTERVAL '7 days'
ORDER BY hour ASC;
```

### Get Ticket Availability Trend

```sql
SELECT 
    hour as timestamp,
    total_tickets,
    total_listings
FROM aggregated_analytics
WHERE event_id = 'uuid-here'
  AND zone = 'Lower Bowl'
  AND hour >= NOW() - INTERVAL '7 days'
ORDER BY hour ASC;
```

### Get All Zones for an Event

```sql
SELECT DISTINCT zone
FROM ticket_snapshots
WHERE event_id = 'uuid-here'
  AND timestamp > NOW() - INTERVAL '1 day'
ORDER BY zone;
```

## Data Retention Policy

- **ticket_snapshots**: Keep 4 months, then archive to cold storage
- **aggregated_analytics**: Keep 6 months
- **daily_analytics**: Keep permanently (compressed)
- **scraper_jobs**: Keep 3 months
- **scraper_logs**: Keep 1 month

## Database Maintenance

### Partition Management

```sql
-- Create next month's partition
CREATE TABLE ticket_snapshots_2026_01 PARTITION OF ticket_snapshots
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### Vacuum Schedule

```sql
-- Weekly vacuum on large tables
VACUUM ANALYZE ticket_snapshots;
VACUUM ANALYZE aggregated_analytics;
```

### Archive Old Data

```sql
-- Archive snapshots older than 4 months
INSERT INTO ticket_snapshots_archive
SELECT * FROM ticket_snapshots
WHERE timestamp < NOW() - INTERVAL '4 months';

DELETE FROM ticket_snapshots
WHERE timestamp < NOW() - INTERVAL '4 months';
```

## Performance Considerations

1. **Partitioning**: Improves query performance on time-based queries
2. **Indexing**: Composite indexes on frequently queried columns
3. **Materialized Views**: Pre-computed aggregations for common queries
4. **Archival**: Moves old data to separate tables/storage
5. **Compression**: Use PostgreSQL table compression for historical data

## Estimated Storage Requirements

- **ticket_snapshots**: ~1KB per row × 100 events × 6 snapshots/hour × 24 hours × 120 days = ~17GB
- **aggregated_analytics**: ~500 bytes per row × 100 events × 10 zones × 24 hours × 180 days = ~2GB
- **daily_analytics**: ~500 bytes per row × 100 events × 10 zones × 365 days = ~180MB

**Total estimated**: ~20GB for 4 months of data (100 events tracked)
