# Supabase Setup Guide

## Overview
This guide walks you through setting up Supabase for the TWS Vivid Seats Analytics Backend.

## Prerequisites
- Supabase account (sign up at https://supabase.com)
- Basic knowledge of PostgreSQL
- Node.js 16+ installed locally

## Step 1: Create a New Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in the details:
   - **Name**: tws-vivid-seats-analytics
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait 2-3 minutes for provisioning

## Step 2: Get Your API Credentials

1. Go to Project Settings → API
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: For frontend use
   - **service_role key**: For backend use (keep secret!)

3. Create `.env` file in your backend directory:
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
SCRAPER_INTERVAL_MINUTES=10
PORT=5000
NODE_ENV=development
```

## Step 3: Run Database Migrations

### Option A: Using Supabase SQL Editor (Recommended for beginners)

1. Go to SQL Editor in your Supabase dashboard
2. Click "New query"
3. Copy and paste each migration file content
4. Run them in order:

**Migration 1: Create events table**
```sql
-- See backend/supabase/migrations/001_create_events_table.sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50),
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    category VARCHAR(100),
    performer_id VARCHAR(255),
    performer_name VARCHAR(255),
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_scraped TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_active ON events(active) WHERE active = true;
CREATE INDEX idx_events_external_id ON events(external_id);
```

**Migration 2: Create ticket_snapshots table**
```sql
-- See backend/supabase/migrations/002_create_ticket_snapshots_table.sql
CREATE TABLE ticket_snapshots (
    id BIGSERIAL,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    zone VARCHAR(100) NOT NULL,
    section VARCHAR(100) NOT NULL,
    section_id VARCHAR(100),
    lowest_price DECIMAL(10,2) NOT NULL,
    average_price DECIMAL(10,2),
    highest_price DECIMAL(10,2),
    lowest_price_2tickets DECIMAL(10,2),
    lowest_price_4tickets DECIMAL(10,2),
    total_tickets INTEGER NOT NULL DEFAULT 0,
    total_listings INTEGER NOT NULL DEFAULT 0,
    available BOOLEAN DEFAULT true,
    raw_listings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create first partition
CREATE TABLE ticket_snapshots_2025_11 PARTITION OF ticket_snapshots
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE ticket_snapshots_2025_12 PARTITION OF ticket_snapshots
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE INDEX idx_snapshots_event_time ON ticket_snapshots(event_id, timestamp);
CREATE INDEX idx_snapshots_zone ON ticket_snapshots(zone, timestamp);
```

**Migration 3: Create aggregated analytics table**
```sql
-- See backend/supabase/migrations/003_create_aggregated_analytics_table.sql
CREATE TABLE aggregated_analytics (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    zone VARCHAR(100) NOT NULL,
    hour TIMESTAMP WITH TIME ZONE NOT NULL,
    min_price DECIMAL(10,2) NOT NULL,
    avg_price DECIMAL(10,2),
    max_price DECIMAL(10,2),
    min_price_2tickets DECIMAL(10,2),
    min_price_4tickets DECIMAL(10,2),
    total_tickets INTEGER,
    total_listings INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, zone, hour)
);

CREATE INDEX idx_analytics_event_hour ON aggregated_analytics(event_id, hour);
CREATE INDEX idx_analytics_zone_hour ON aggregated_analytics(zone, hour);
```

**Migration 4: Additional tables and indexes**
```sql
-- Daily analytics
CREATE TABLE daily_analytics (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    zone VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    daily_min_price DECIMAL(10,2) NOT NULL,
    daily_avg_price DECIMAL(10,2),
    daily_max_price DECIMAL(10,2),
    daily_min_2tickets DECIMAL(10,2),
    daily_min_4tickets DECIMAL(10,2),
    peak_tickets INTEGER,
    avg_tickets INTEGER,
    min_tickets INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, zone, date)
);

-- Scraper jobs tracking
CREATE TABLE scraper_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL,
    events_scraped INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_details JSONB,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Zones mapping
CREATE TABLE zones_mapping (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL,
    sections TEXT[],
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, zone_name)
);
```

### Option B: Using Supabase CLI (Advanced)

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref your-project-ref
```

4. Run migrations:
```bash
supabase db push
```

## Step 4: Set Up Row Level Security (RLS)

Enable RLS for public access with proper security:

```sql
-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_analytics ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for analytics)
CREATE POLICY "Allow public read access" ON events
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON ticket_snapshots
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON aggregated_analytics
    FOR SELECT USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role only" ON events
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON ticket_snapshots
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON aggregated_analytics
    FOR ALL USING (auth.role() = 'service_role');
```

## Step 5: Create Database Functions (RPC)

Create custom functions for complex queries:

```sql
-- Function to get price trends
CREATE OR REPLACE FUNCTION get_price_trends(
    p_event_id UUID,
    p_zone VARCHAR,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_granularity VARCHAR DEFAULT 'hourly'
)
RETURNS TABLE (
    timestamp TIMESTAMP WITH TIME ZONE,
    min_price DECIMAL,
    avg_price DECIMAL,
    max_price DECIMAL
) AS $$
BEGIN
    IF p_granularity = 'daily' THEN
        RETURN QUERY
        SELECT 
            date::TIMESTAMP WITH TIME ZONE,
            daily_min_price,
            daily_avg_price,
            daily_max_price
        FROM daily_analytics
        WHERE event_id = p_event_id
          AND (p_zone IS NULL OR zone = p_zone)
          AND date >= p_start_date::DATE
          AND date <= p_end_date::DATE
        ORDER BY date ASC;
    ELSE
        RETURN QUERY
        SELECT 
            hour,
            min_price,
            avg_price,
            max_price
        FROM aggregated_analytics
        WHERE event_id = p_event_id
          AND (p_zone IS NULL OR zone = p_zone)
          AND hour >= p_start_date
          AND hour <= p_end_date
        ORDER BY hour ASC;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

## Step 6: Set Up Scheduled Jobs (pg_cron)

Enable pg_cron extension:

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule hourly aggregation (runs every hour)
SELECT cron.schedule(
    'hourly-aggregation',
    '0 * * * *',  -- Every hour at minute 0
    $$
    INSERT INTO aggregated_analytics (event_id, zone, hour, min_price, avg_price, max_price, total_tickets, total_listings)
    SELECT 
        event_id, 
        zone,
        DATE_TRUNC('hour', timestamp) as hour,
        MIN(lowest_price),
        AVG(average_price),
        MAX(highest_price),
        SUM(total_tickets),
        SUM(total_listings)
    FROM ticket_snapshots
    WHERE timestamp >= NOW() - INTERVAL '1 hour'
      AND timestamp < NOW()
    GROUP BY event_id, zone, DATE_TRUNC('hour', timestamp)
    ON CONFLICT (event_id, zone, hour) DO UPDATE
    SET min_price = EXCLUDED.min_price,
        avg_price = EXCLUDED.avg_price;
    $$
);

-- Schedule daily aggregation (runs at 1 AM)
SELECT cron.schedule(
    'daily-aggregation',
    '0 1 * * *',  -- Every day at 1 AM
    $$
    INSERT INTO daily_analytics (event_id, zone, date, daily_min_price, daily_avg_price, peak_tickets, avg_tickets)
    SELECT 
        event_id,
        zone,
        DATE(hour) as date,
        MIN(min_price),
        AVG(avg_price),
        MAX(total_tickets),
        AVG(total_tickets)
    FROM aggregated_analytics
    WHERE DATE(hour) = CURRENT_DATE - INTERVAL '1 day'
    GROUP BY event_id, zone, DATE(hour)
    ON CONFLICT (event_id, zone, date) DO UPDATE
    SET daily_min_price = EXCLUDED.daily_min_price,
        daily_avg_price = EXCLUDED.daily_avg_price;
    $$
);
```

## Step 7: Configure Realtime (Optional)

Enable realtime for live updates:

1. Go to Database → Replication
2. Enable replication for tables:
   - `ticket_snapshots`
   - `aggregated_analytics`

## Step 8: Test Your Setup

Insert test data:

```sql
-- Insert test event
INSERT INTO events (external_id, name, venue, city, state, date, category)
VALUES ('test-123', 'Lakers vs Warriors', 'Crypto.com Arena', 'Los Angeles', 'CA', '2025-12-15 19:30:00', 'NBA');

-- Insert test snapshot
INSERT INTO ticket_snapshots (event_id, zone, section, lowest_price, average_price, total_tickets, total_listings)
SELECT id, 'Lower Bowl', '101', 125.00, 180.00, 450, 45
FROM events WHERE external_id = 'test-123';
```

Query test data:

```sql
SELECT * FROM events;
SELECT * FROM ticket_snapshots;
```

## Step 9: Connect Your Application

Update your backend `.env`:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

Test connection:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Test query
const { data, error } = await supabase
    .from('events')
    .select('*')
    .limit(10);

console.log('Events:', data);
```

## Troubleshooting

### Connection Issues
- Verify your API keys are correct
- Check if your IP is allowed (Supabase → Settings → Database → Connection string)
- Ensure you're using the service_role key for backend operations

### Migration Errors
- Run migrations one at a time
- Check SQL Editor for detailed error messages
- Verify foreign key relationships

### Performance Issues
- Ensure all indexes are created
- Check query performance in Supabase Dashboard → Database → Logs
- Consider creating materialized views for slow queries

## Next Steps

1. Set up your scraper service (see `backend/src/services/scraper.js`)
2. Configure cron jobs for regular scraping
3. Test API endpoints
4. Monitor performance and logs

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)
