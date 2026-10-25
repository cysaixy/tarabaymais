# Officer Portal API Reference

Base path: `GET /api/v1/officer/*`
Auth: Firebase ID Bearer token + `OFFICER` or `TECHNICIAN` role.
Cache: Redis cache-aside, 120s TTL, key includes query params. Invalidated on writes to farms, crop cycles, observations, scans, disaster reports, expert requests, and offline sync.
Timezone: All bucketing and period boundaries use `Asia/Manila`.

---

## 1. GET /analytics/overview

KPIs for the current period (default last 30 days) with deltas vs the previous equal-length period and sparklines.

**Query params**

| Param      | Type     | Default   | Description                                     |
| ---------- | -------- | --------- | ----------------------------------------------- |
| `barangay` | string   | —         | Case-insensitive partial match on farm barangay |
| `from`     | ISO date | now − 30d | Period start (inclusive)                        |
| `to`       | ISO date | now       | Period end (inclusive)                          |

**Response**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalFarms": {
        "value": 26,
        "delta": { "absolute": 26, "percent": 100 },
        "sparkline": [ { "date": "2026-09-25", "value": 5 }, ... ]
      },
      "activeCornHectares": {
        "value": 83.87,
        "delta": { "absolute": 83.87, "percent": 100 },
        "sparkline": [ { "date": "2026-09-25", "value": 12.5 }, ... ]
      },
      "openCases": {
        "value": 10,
        "delta": { "absolute": 10, "percent": 100 },
        "sparkline": [ { "date": "2026-09-25", "value": 3 }, ... ]
      },
      "disasterReportsThisPeriod": {
        "value": 10,
        "delta": { "absolute": 10, "percent": 100 },
        "sparkline": [ { "date": "2026-09-25", "value": 2 }, ... ]
      },
      "avgResponseTimeHours": {
        "value": 4.5,
        "delta": { "absolute": -1, "percent": -18 },
        "sparkline": []
      },
      "casesResolvedThisPeriod": {
        "value": 2,
        "delta": { "absolute": 2, "percent": 100 },
        "sparkline": [ { "date": "2026-09-25", "value": 1 }, ... ]
      }
    }
  }
}
```

- `totalFarms` / `activeCornHectares` sparklines are **cumulative daily** (value as of end of each day).
- `openCases` / `disasterReportsThisPeriod` / `casesResolvedThisPeriod` sparklines are **daily counts**.
- `avgResponseTimeHours` is `null` when no resolved/first-response data exists; delta is also `null` in that case.
- `avgResponseTimeHours` = `(firstResponseAt − createdAt) / 3600`, averaged over resolved cases in the period.

---

## 2. GET /analytics/crop-stages

Farm and hectare counts by corn growth stage for ACTIVE crop cycles.

**Query params:** `barangay`, `from`, `to` (optional)

**Response**

```json
{
  "success": true,
  "data": {
    "cropStages": {
      "stages": {
        "SEEDLING": { "farmCount": 8, "totalAreaHectares": 23.93 },
        "VEGETATIVE": { "farmCount": 4, "totalAreaHectares": 13.51 },
        "TASSELING": { "farmCount": 5, "totalAreaHectares": 13.23 },
        "SILKING": { "farmCount": 0, "totalAreaHectares": 0 },
        "GRAIN_FILL": { "farmCount": 6, "totalAreaHectares": 22.79 },
        "HARVEST_READY": { "farmCount": 3, "totalAreaHectares": 10.41 }
      }
    }
  }
}
```

Growth stage is computed at query time from `plantingDate` (days after planting), thresholds in `src/lib/growthStage.ts`.

---

## 3. GET /analytics/scan-trends

Weekly healthy vs flagged scan counts from `PlantScan`. All bucketing uses Asia/Manila time.

**Verdict rule** (shared in `src/lib/scanVerdict.ts`): A scan is **HEALTHY** when diagnosis is empty/null or one of `none|no disease|healthy|no issue|n/a|na` (case-insensitive, trimmed) AND severity is not high/critical. Otherwise **FLAGGED**.

**Query params:** `barangay`, `from`, `to`

**Response**

```json
{
  "success": true,
  "data": {
    "scanTrends": {
      "weekly": [
        { "weekStart": "2026-08-31", "healthy": 5, "flagged": 1 },
        { "weekStart": "2026-09-07", "healthy": 6, "flagged": 0 },
        { "weekStart": "2026-09-14", "healthy": 2, "flagged": 3 }
      ]
    }
  }
}
```

The series is **zero-filled** for every Monday in the range, even weeks with no scans.

---

## 4. GET /analytics/top-issues

Top 8 pests/diseases aggregated from `PlantScan.diagnosis` and Observation `ai_diagnosis.diseaseDetected` (where `scanId IS NULL` to avoid double-counting).

**Query params:** `barangay`, `from`, `to`

**Response**

```json
{
  "success": true,
  "data": {
    "topIssues": {
      "topIssues": [
        { "diagnosis": "Stalk Rot", "count": 13, "avgSeverity": 2.4 },
        { "diagnosis": "Corn Leaf Aphid", "count": 9, "avgSeverity": 2.7 },
        { "diagnosis": "Aspergillus Ear Rot", "count": 4, "avgSeverity": 3.5 }
      ]
    }
  }
}
```

`avgSeverity` is weighted: critical=4, high=3, medium=2, low=1, rounded to 1 decimal.

---

## 5. GET /analytics/disasters

Disaster report counts and total estimated loss, grouped by barangay/month/type.

**Query params**

| Param      | Values                          | Default    |
| ---------- | ------------------------------- | ---------- |
| `barangay` | string                          | —          |
| `from`     | ISO date                        | now − 30d  |
| `to`       | ISO date                        | now        |
| `groupBy`  | `barangay` \| `month` \| `type` | `barangay` |

**Response**

```json
{
  "success": true,
  "data": {
    "disasters": {
      "groupBy": "barangay",
      "groups": [
        {
          "groupKey": "Dabbac Grande",
          "count": 3,
          "totalEstimatedLoss": 84000.0
        },
        { "groupKey": "San Antonio", "count": 2, "totalEstimatedLoss": 45000.0 }
      ]
    }
  }
}
```

---

## 6. GET /farms/geo

GeoJSON FeatureCollection of farms with coordinates + disaster report points. Each farm feature includes growth stage, health status, and open case count.

**Query params:** `barangay`

**Response**

```json
{
  "success": true,
  "data": {
    "farmsGeo": {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {
            "id": "farm-uuid",
            "name": "Sakahan ko sa Dabbac Grande",
            "barangay": "Dabbac Grande",
            "municipality": "Baggao",
            "hectares": 5.0,
            "growthStage": "GRAIN_FILL",
            "healthStatus": "critical",
            "openCaseCount": 1
          },
          "geometry": { "type": "Point", "coordinates": [121.8756, 18.1447] }
        },
        {
          "type": "Feature",
          "properties": {
            "id": "disaster-uuid",
            "kind": "disaster",
            "disasterType": "TYPHOON",
            "estimatedLoss": 84000.0,
            "farmName": "Sakahan ko sa Dabbac Grande",
            "barangay": "Dabbac Grande"
          },
          "geometry": { "type": "Point", "coordinates": [121.8756, 18.1447] }
        }
      ],
      "farmsWithoutLocation": 0
    }
  }
}
```

Farm health rule: CRITICAL open-case severity or recent critical finding (14 days) → `critical`; HIGH/MEDIUM → `watch`; otherwise `healthy`.

---

## 7. GET /queue

Unified action queue: open expert-request cases, HIGH/CRITICAL observations without a case, and unreviewed disaster reports. Sorted by severity then oldest first.

**Query params**

| Param      | Values                                | Default |
| ---------- | ------------------------------------- | ------- |
| `barangay` | string                                | —       |
| `limit`    | 1–100                                 | 20      |
| `offset`   | ≥ 0                                   | 0       |
| `type`     | `case` \| `observation` \| `disaster` | — (all) |

**Response**

```json
{
  "success": true,
  "data": {
    "queue": {
      "items": [
        {
          "id": "case-uuid",
          "type": "case",
          "severity": "critical",
          "farmerName": "Juan Dela Cruz",
          "farmName": "[DEMO] Sakahan ni Farmer 1",
          "barangay": "Dabbac Grande",
          "summary": "Aspergillus Ear Rot",
          "createdAt": "2026-09-01T12:50:36.512Z",
          "waitingHours": 1304,
          "status": "submitted"
        }
      ],
      "total": 17,
      "nextCursor": 20,
      "limit": 20,
      "offset": 0
    }
  }
}
```

- `total` is the full count matching filters (unlimited query, then paginated in memory).
- `nextCursor` is `offset + limit` when more items exist, else `null`.
- An observation that already has an ExpertRequest appears once as a `case`; standalone HIGH/CRITICAL observations are `observation` items.
- Disaster severity is derived from `damagePercentage`: ≥50 critical, ≥25 high, ≥10 medium, else low.

---

## 8. GET /analytics/barangays (extended)

Per-barangay farm distribution with extended fields.

**Response** (per barangay row)

```json
{
  "barangay": "Dabbac Grande",
  "farms": 6,
  "hectares": 18.65,
  "openCases": 5,
  "avgHealthScore": 57,
  "riskScore": 43,
  "disasterCount": 2
}
```

- `riskScore` (0–100, higher = worse risk) = `min(100, (openCases/farms × 40) + (disasterCount/farms × 30))`.
- `avgHealthScore` = `100 − riskScore` (kept for backward compatibility).

---

## Cache invalidation mutators

`officer:analytics:*` prefix is invalidated (SCAN-based) on:

- Farm create/update/delete
- Crop cycle create/update/status change
- Observation create (all severities)
- PlantScan create (AI scan)
- ExpertRequest create/status/assignment change
- DisasterReport create/status change
- Offline sync batch (CREATE_OBSERVATION, CREATE_DISASTER_REPORT)
