# presencelabs.net Integration Contract

## 1) Create Lead (Public Ingest)

- **Endpoint:** `POST /api/public/leads`
- **Headers:**
  - `content-type: application/json`
  - `x-presencelabs-key: <PUBLIC_INGEST_API_KEY>`
  - `x-presencelabs-ts: <unix-ms timestamp>`
  - `x-presencelabs-signature: <hex hmac>`
- **Signature algorithm:**
  - Message: `${x-presencelabs-ts}.${rawBody}`
  - HMAC SHA-256 secret: `PUBLIC_INGEST_API_SECRET`

### Payload

```json
{
  "businessName": "Example Plumbing",
  "ownerName": "Sam",
  "category": "plumber",
  "location": "San Jose, CA",
  "websiteUrl": "https://example.com",
  "phone": "+1 408 555 0123",
  "email": "owner@example.com",
  "notes": "From presencelabs.net lead form",
  "source": "presencelabs.net"
}
```

### Response

```json
{
  "ok": true,
  "importJobId": "cuid",
  "statusUrl": "/api/public/audits/<jobId>/status"
}
```

## 2) Poll Audit Status

- **Endpoint:** `GET /api/public/audits/:jobId/status`

### Response

```json
{
  "ok": true,
  "status": "Queued|Running|Completed|Failed|Cancelled",
  "progress": {
    "totalRows": 1,
    "processedRows": 1,
    "importedRows": 1,
    "skippedRows": 0,
    "failedRows": 0
  },
  "completedAt": "2026-05-13T20:00:00.000Z",
  "errorSummary": ""
}
```

## 3) Frontend UX Flow

1. Submit lead payload from `presencelabs.net`.
2. Persist `importJobId`.
3. Poll status endpoint every 3-5 seconds.
4. Show states: queued -> generating -> completed.
5. On completion, notify internal sales workflow (or future webhook callback).
