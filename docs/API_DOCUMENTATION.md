# API Documentation

## Overview
This document describes the REST API endpoints for the TWS Vivid Seats Analytics Backend.

## Base URL
```
Production: https://your-project.supabase.co/rest/v1
Development: http://localhost:5000/api
```

## Authentication
All requests require an API key in the header:
```
Authorization: Bearer YOUR_SUPABASE_ANON_KEY
apikey: YOUR_SUPABASE_ANON_KEY
```

## Endpoints

### 1. Analytics Endpoints

#### GET /api/analytics/price-trends

Get price trends over time for a specific event and zone.

**Query Parameters:**
- `event_id` (required): UUID of the event
- `zone` (optional): Zone name (e.g., "Lower Bowl", "Upper Bowl")
- `start_date` (required): ISO 8601 datetime
- `end_date` (required): ISO 8601 datetime
- `granularity` (optional): "hourly" or "daily" (default: "hourly")

**Example Request:**
```bash
GET /api/analytics/price-trends?event_id=123e4567-e89b-12d3-a456-426614174000&zone=Lower%20Bowl&start_date=2025-11-01T00:00:00Z&end_date=2025-11-07T23:59:59Z&granularity=hourly
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-11-01T00:00:00Z",
      "min_price": 125.00,
      "avg_price": 185.50,
      "max_price": 350.00
    },
    {
      "timestamp": "2025-11-01T01:00:00Z",
      "min_price": 120.00,
      "avg_price": 180.00,
      "max_price": 340.00
    }
  ],
  "meta": {
    "event_id": "123e4567-e89b-12d3-a456-426614174000",
    "zone": "Lower Bowl",
    "granularity": "hourly",
    "data_points": 168,
    "trend": "decreasing",
    "percent_change": -4.2
  }
}
```

---

#### GET /api/analytics/group-prices

Get group ticket price trends (2 or 4 tickets).

**Query Parameters:**
- `event_id` (required): UUID of the event
- `zone` (optional): Zone name
- `start_date` (required): ISO 8601 datetime
- `end_date` (required): ISO 8601 datetime
- `group_size` (required): 2 or 4
- `granularity` (optional): "hourly" or "daily" (default: "hourly")

**Example Request:**
```bash
GET /api/analytics/group-prices?event_id=123e4567-e89b-12d3-a456-426614174000&zone=Lower%20Bowl&start_date=2025-11-01T00:00:00Z&end_date=2025-11-07T23:59:59Z&group_size=2
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-11-01T00:00:00Z",
      "price": 250.00
    },
    {
      "timestamp": "2025-11-01T01:00:00Z",
      "price": 240.00
    }
  ],
  "meta": {
    "event_id": "123e4567-e89b-12d3-a456-426614174000",
    "zone": "Lower Bowl",
    "group_size": 2,
    "granularity": "hourly",
    "data_points": 168
  }
}
```

---

#### GET /api/analytics/ticket-counts

Get ticket availability counts over time.

**Query Parameters:**
- `event_id` (required): UUID of the event
- `zone` (optional): Zone name
- `start_date` (required): ISO 8601 datetime
- `end_date` (required): ISO 8601 datetime
- `granularity` (optional): "hourly" or "daily" (default: "hourly")

**Example Request:**
```bash
GET /api/analytics/ticket-counts?event_id=123e4567-e89b-12d3-a456-426614174000&zone=Lower%20Bowl&start_date=2025-11-01T00:00:00Z&end_date=2025-11-07T23:59:59Z
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-11-01T00:00:00Z",
      "total_tickets": 1250,
      "total_listings": 145
    },
    {
      "timestamp": "2025-11-01T01:00:00Z",
      "total_tickets": 1240,
      "total_listings": 143
    }
  ],
  "meta": {
    "event_id": "123e4567-e89b-12d3-a456-426614174000",
    "zone": "Lower Bowl",
    "granularity": "hourly",
    "data_points": 168
  }
}
```

---

### 2. Event Endpoints

#### GET /api/events

Get list of all tracked events.

**Query Parameters:**
- `active` (optional): true/false (default: true)
- `category` (optional): Filter by category (NBA, MLB, etc.)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```bash
GET /api/events?active=true&category=NBA&limit=10
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Lakers vs Warriors",
      "venue": "Crypto.com Arena",
      "city": "Los Angeles",
      "state": "CA",
      "date": "2025-12-15T19:30:00Z",
      "category": "NBA",
      "active": true,
      "last_scraped": "2025-11-30T10:15:00Z"
    }
  ],
  "meta": {
    "total": 100,
    "limit": 10,
    "offset": 0
  }
}
```

---

#### GET /api/events/:id

Get details of a specific event.

**Example Request:**
```bash
GET /api/events/123e4567-e89b-12d3-a456-426614174000
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Lakers vs Warriors",
    "venue": "Crypto.com Arena",
    "city": "Los Angeles",
    "state": "CA",
    "date": "2025-12-15T19:30:00Z",
    "category": "NBA",
    "performer_id": "lakers",
    "performer_name": "Los Angeles Lakers",
    "image_url": "https://example.com/image.jpg",
    "active": true,
    "created_at": "2025-10-01T00:00:00Z",
    "last_scraped": "2025-11-30T10:15:00Z",
    "zones": [
      {
        "zone_name": "Lower Bowl",
        "sections": ["101", "102", "103"],
        "current_min_price": 125.00
      },
      {
        "zone_name": "Upper Bowl",
        "sections": ["201", "202", "203"],
        "current_min_price": 65.00
      }
    ]
  }
}
```

---

#### GET /api/events/:id/zones

Get all zones for a specific event.

**Example Request:**
```bash
GET /api/events/123e4567-e89b-12d3-a456-426614174000/zones
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "zone_name": "Lower Bowl",
      "sections": ["101", "102", "103", "104"],
      "display_order": 1,
      "current_min_price": 125.00,
      "current_total_tickets": 450
    },
    {
      "zone_name": "Upper Bowl",
      "sections": ["201", "202", "203", "204"],
      "display_order": 2,
      "current_min_price": 65.00,
      "current_total_tickets": 800
    }
  ]
}
```

---

### 3. Real-time Endpoints (Supabase)

#### GET /api/realtime/latest-prices

Get the most recent prices for an event (Supabase Realtime subscription compatible).

**Query Parameters:**
- `event_id` (required): UUID of the event

**Example Request:**
```bash
GET /api/realtime/latest-prices?event_id=123e4567-e89b-12d3-a456-426614174000
```

**WebSocket Subscription:**
```javascript
const channel = supabase
  .channel('price-updates')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'ticket_snapshots',
      filter: `event_id=eq.${eventId}`
    },
    (payload) => {
      console.log('New price update:', payload.new);
    }
  )
  .subscribe();
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required parameter: event_id",
    "details": {}
  }
}
```

### Error Codes
- `VALIDATION_ERROR`: Invalid or missing parameters
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Invalid or missing API key
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

---

## Rate Limits

- **Authenticated requests**: 1000 requests per hour
- **Public endpoints**: 100 requests per hour per IP

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1638360000
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters:**
- `limit`: Number of results per page (max: 100, default: 50)
- `offset`: Number of results to skip

**Response Meta:**
```json
{
  "meta": {
    "total": 500,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

---

## Filtering

Many endpoints support filtering using query parameters:

```bash
GET /api/events?category=NBA&active=true&date_gte=2025-12-01
```

Supported operators:
- `_eq`: Equals
- `_neq`: Not equals
- `_gt`: Greater than
- `_gte`: Greater than or equal
- `_lt`: Less than
- `_lte`: Less than or equal
- `_like`: Pattern match
- `_in`: In array

---

## Sorting

Use `order` parameter:

```bash
GET /api/events?order=date.asc
GET /api/analytics/price-trends?order=timestamp.desc
```

---

## Code Examples

### JavaScript (Fetch API)

```javascript
async function getPriceTrends(eventId, zone, startDate, endDate) {
  const params = new URLSearchParams({
    event_id: eventId,
    zone: zone,
    start_date: startDate,
    end_date: endDate,
    granularity: 'hourly'
  });

  const response = await fetch(
    `https://your-project.supabase.co/rest/v1/api/analytics/price-trends?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    }
  );

  const data = await response.json();
  return data;
}
```

### Python (Requests)

```python
import requests

def get_price_trends(event_id, zone, start_date, end_date):
    url = "https://your-project.supabase.co/rest/v1/api/analytics/price-trends"
    
    params = {
        "event_id": event_id,
        "zone": zone,
        "start_date": start_date,
        "end_date": end_date,
        "granularity": "hourly"
    }
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "apikey": SUPABASE_ANON_KEY
    }
    
    response = requests.get(url, params=params, headers=headers)
    return response.json()
```

### cURL

```bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/api/analytics/price-trends?event_id=123e4567-e89b-12d3-a456-426614174000&zone=Lower%20Bowl&start_date=2025-11-01T00:00:00Z&end_date=2025-11-07T23:59:59Z' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'apikey: YOUR_SUPABASE_ANON_KEY'
```

---

## Webhooks (Future)

Subscribe to events via webhooks:

```json
POST /api/webhooks/subscribe
{
  "url": "https://your-app.com/webhook",
  "events": ["price_drop", "low_inventory"],
  "filters": {
    "event_id": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

---

## Support

For API support, contact: api-support@twsvividseats.com
