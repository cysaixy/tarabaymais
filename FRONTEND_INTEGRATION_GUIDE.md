# Tarabay-Mais — Frontend Integration Guide

> **Audience:** Frontend / mobile developers integrating with the Tarabay-Mais backend.
> **Stack:** Express 5 + TypeScript · PostgreSQL (Prisma + pgvector) · Firebase Auth · Firebase Cloud Messaging (FCM) · Gemini AI (RAG) · ExcelJS.

---

## ⚠️ Read First — Endpoint Reference & Naming Notes

The routes below reflect the **actual mount points wired in `src/server.ts`**. Some paths differ from
common shorthand (e.g. `/farms` vs `/farm`). Always integrate against the "Actual Path" column.

| Feature | Actual Path (use this) | Common shorthand (NOT wired) |
| --- | --- | --- |
| Farms collection | `/api/v1/farm` | `/farms` |
| Crop cycles (list/create) | `/api/v1/crop-cycles/farm/:farmId` | `/crop-cycles/:id` |
| Crop cycle status | `/api/v1/crop-cycles/:id/status` | — |
| Observations | `/api/v1/observations/:cropCycleId` | `/cases/observations/:cropCycleId` |
| Crop activities | `/api/v1/activities/:cropCycleId` | — |
| Disaster report (create) | `/api/v1/case/disaster-report/:farmId` | `/disaster-reports` |
| Case pipeline (list) | `/api/v1/case/pipeline` | `/disaster-reports` (GET) |
| Expert case resolve | `/api/v1/case/expert-requests/:caseId/resolve` | — |
| FCM token registration | `/api/v1/register/fcm-token` | `/users/fcm-token` |
| RAG chat | `/api/v1/ai/chat` | — |
| Batch sync | `/api/v1/sync` | — |
| Analytics export | `/api/v1/analytics/export` | — |

---

## 1. System Overview & Authentication

### 1.1 Base URL Configuration

The server listens on `process.env.PORT` (defaults to **3000**). All feature routes are namespaced under `/api/v1`.

```ts
// src/config/api.ts
export const API_BASE_URL =
  import.meta.env.MODE === "production"
    ? "https://api.tarabay-mais.example.com/api/v1" // Staging / Production
    : "http://localhost:3000/api/v1"; // Development (server default port is 3000)

// Health probe (no auth, not namespaced): GET http://localhost:3000/api/health
export const HEALTH_URL = "http://localhost:3000/api/health";
```

> If your deployment maps the container to port `5000`, set the base URL accordingly. The code default is `3000`.

### 1.2 Authentication Flow

Every route except `GET /api/health` requires a valid Firebase ID token:

```
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

The backend verifies the token with the Firebase Admin SDK, then loads the matching `User` record
(including `farmerProfile`) from PostgreSQL and attaches it to the request. A **first-time** user has a
valid token but no DB record yet — call `POST /api/v1/auth/sync` (or `/api/v1/register/...`) to create it.

#### Retrieving the ID token

```ts
import { getAuth, getIdToken } from "firebase/auth";

export async function getFreshIdToken(forceRefresh = false): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("No authenticated Firebase user");
  // forceRefresh=true when a request returns 401 due to token expiry.
  return getIdToken(user, forceRefresh);
}
```

#### Axios interceptor (recommended)

```ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "./config/api";
import { getFreshIdToken } from "./auth";

export const api = axios.create({ baseURL: API_BASE_URL });

// Attach a fresh token to every outgoing request.
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getFreshIdToken();
  config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

// On 401, retry once with a force-refreshed token.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const token = await getFreshIdToken(true);
      original.headers.set("Authorization", `Bearer ${token}`);
      return api(original);
    }
    return Promise.reject(error);
  },
);
```

#### Fetch wrapper (alternative)

```ts
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getFreshIdToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await res.json();
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error ?? `Request failed with ${res.status}`);
  }
  return body.data as T;
}
```

### 1.3 User Role Enforcement

The backend defines three roles (Prisma `Role` enum). Role checks run **after** authentication.

| Role | Value sent by API | Typical capabilities |
| --- | --- | --- |
| Farmer | `FARMER` | Manage own farms, crop cycles, activities, observations, disaster reports |
| Technician | `TECHNICIAN` | View assigned cases, resolve expert requests, read analytics/exports |
| Officer | `OFFICER` | Municipal analytics, case oversight, exports |

```ts
export type UserRole = "FARMER" | "TECHNICIAN" | "OFFICER";
```

A role mismatch returns **403**; a missing/unsynchronized profile returns **401**.

---

## 2. Standard Request/Response Contracts & Error Handling

All JSON responses follow one envelope.

### 2.1 Success envelope

```json
{ "success": true, "data": { "...": "..." } }
```

Some write/delete operations return a message instead of (or alongside) `data`:

```json
{ "success": true, "message": "Crop cycle deleted successfully" }
```

### 2.2 Error envelope

```json
{ "success": false, "error": "Main error message", "details": "optional context" }
```

`details` may be a string, an object (e.g. field-level validation issues), or omitted.

### 2.3 TypeScript response types

```ts
export interface ApiSuccess<T> {
  success: true;
  data?: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

### 2.4 HTTP status code map

| Status | Meaning | When you'll see it |
| --- | --- | --- |
| `200` | OK | Successful read or update |
| `201` | Created | New resource created (farm, crop cycle, observation, report) |
| `400` | Bad Request | Invalid/missing body or query params, bad enum value |
| `401` | Unauthorized | Missing/expired/invalid Firebase token, or profile not yet synced |
| `403` | Forbidden | Authenticated but role not permitted for this route |
| `404` | Not Found | Resource missing or not owned by the caller |
| `500` | Server Error | Unhandled backend failure — surface a generic retry message |

### 2.5 Suggested client-side handler

```ts
export function isApiError(x: unknown): x is ApiError {
  return typeof x === "object" && x !== null && (x as ApiError).success === false;
}

export function toUserMessage(status: number, body: unknown): string {
  if (isApiError(body)) return body.error;
  switch (status) {
    case 401: return "Your session expired. Please sign in again.";
    case 403: return "You don't have permission to do that.";
    case 404: return "We couldn't find what you were looking for.";
    default:  return "Something went wrong. Please try again.";
  }
}
```

---

## 3. Feature Modules & Endpoint Specifications

Shared headers for every authenticated request:

```
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json          # omit for multipart/form-data uploads
```

### 3.1 User Profile & Device FCM Token Registration

Registers the device token so the backend can push notifications to this user.

| Field | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/register/fcm-token` |
| Required Role | Any authenticated user |

**Request body**

```json
{ "fcmToken": "eXampleToken:APA91bH..." }
```

**Response — 200**

```json
{ "success": true, "message": "FCM token updated successfully" }
```

**Errors:** `400` if `fcmToken` is missing, `401` if unauthenticated.

**Profile sync (first login)** — creates the PostgreSQL user record:

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/api/v1/auth/sync` | `{ "firstName", "lastName", "phone", "rsbsaNumber?", "preferredLanguage?" }` |

```json
{
  "success": true,
  "message": "User profile created and synchronized",
  "data": {
    "id": "firebase-uid-123",
    "firstName": "Maria",
    "lastName": "Santos",
    "phone": "+639171234567",
    "role": "FARMER",
    "farmerProfile": { "rsbsaNumber": "02-04-01-001", "preferredLanguage": "filipino" }
  }
}
```

### 3.2 Farm & Crop Cycle Management

#### List my farms

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/api/v1/farm` | `FARMER`, `TECHNICIAN` |

**Response — 200**

```json
{
  "success": true,
  "data": {
    "farms": [
      {
        "id": "farm-uuid-1",
        "farmerId": "firebase-uid-123",
        "name": "Sitio Malaya Cornfield",
        "municipality": "Tuguegarao",
        "barangay": "Caggay",
        "areaHectares": "2.50",
        "latitude": "17.613700",
        "longitude": "121.727100",
        "cropCycles": []
      }
    ]
  }
}
```

#### Create a farm

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/v1/farm` | `FARMER` |

**Request body**

```json
{
  "name": "Sitio Malaya Cornfield",
  "municipality": "Tuguegarao",
  "barangay": "Caggay",
  "areaHectares": 2.5,
  "latitude": 17.6137,
  "longitude": 121.7271
}
```

**Response — 201**

```json
{
  "success": true,
  "data": {
    "farm": {
      "id": "farm-uuid-1",
      "farmerId": "firebase-uid-123",
      "name": "Sitio Malaya Cornfield",
      "municipality": "Tuguegarao",
      "barangay": "Caggay",
      "areaHectares": "2.50",
      "latitude": "17.613700",
      "longitude": "121.727100"
    }
  }
}
```

> **Update / delete:** `PATCH /api/v1/farm/:farmId` and `DELETE /api/v1/farm/:farmId` (role `FARMER`).

#### Create a crop cycle (nested under a farm)

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/v1/crop-cycles/farm/:farmId` | `FARMER` |

**Request body**

```json
{
  "cropType": "corn",
  "variety": "IPB Var 6",
  "plantingDate": "2026-06-01",
  "expectedHarvestDate": "2026-09-15",
  "areaHectares": 1.25
}
```

**Response — 201**

```json
{
  "success": true,
  "data": {
    "cropCycle": {
      "id": "cycle-uuid-1",
      "farmId": "farm-uuid-1",
      "cropType": "corn",
      "variety": "IPB Var 6",
      "plantingDate": "2026-06-01T00:00:00.000Z",
      "expectedHarvestDate": "2026-09-15T00:00:00.000Z",
      "areaHectares": "1.25",
      "status": "ACTIVE"
    }
  }
}
```

**Validation notes:** `areaHectares` must be a positive number, and the sum of all `ACTIVE`
crop-cycle areas cannot exceed the farm's total hectares (returns `400` with remaining hectares in `details`).

#### List crop cycles for a farm

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/api/v1/crop-cycles/farm/:farmId` | `FARMER`, `TECHNICIAN` |

```json
{ "success": true, "data": { "cropCycles": [] } }
```

> **Status update / delete:** `PATCH /api/v1/crop-cycles/:id/status` (body `{ "status": "HARVESTED" }`) and
> `DELETE /api/v1/crop-cycles/:id`. Valid statuses: `ACTIVE`, `HARVESTED`, `FAILED`, `CANCELLED`.

### 3.3 Observations & Auto-Escalation

Creating an observation with `HIGH` or `CRITICAL` severity **auto-creates an expert request** and pushes an
`EXPERT_DISPATCH` notification to technicians.

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/v1/observations/:cropCycleId` | `FARMER` |

This endpoint accepts **`multipart/form-data`** so a photo can be attached. The image field name is `image`.

| Form field | Type | Notes |
| --- | --- | --- |
| `image` | file | Optional. Images only, ≤ 5 MB. Stored in Supabase; returns `imageUrl`. |
| `title` | text | Required |
| `description` | text | Required |
| `severity` | text | One of `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `aiDiagnosis` | text (JSON string) | Optional — the JSON returned by `POST /api/v1/ai/scan` |

**Multipart upload example**

```ts
export async function createObservation(cropCycleId: string, form: {
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  image?: File;
  aiDiagnosis?: object;
}) {
  const fd = new FormData();
  fd.append("title", form.title);
  fd.append("description", form.description);
  fd.append("severity", form.severity);
  if (form.aiDiagnosis) fd.append("aiDiagnosis", JSON.stringify(form.aiDiagnosis));
  if (form.image) fd.append("image", form.image);

  // Do NOT set Content-Type manually; the browser sets the multipart boundary.
  const res = await api.post(`/observations/${cropCycleId}`, fd);
  return res.data;
}
```

**Response — 201**

```json
{
  "success": true,
  "data": {
    "observation": {
      "id": "obs-uuid-1",
      "cropCycleId": "cycle-uuid-1",
      "farmerId": "firebase-uid-123",
      "title": "Yellowing lower leaves",
      "description": "Spreading discoloration on 20% of plants.",
      "imageUrl": "https://<supabase>/observation-photos/observations/uuid_leaf.jpg",
      "severity": "HIGH",
      "aiDiagnosis": { "diseaseDetected": "Nitrogen deficiency", "confidence": 0.82 }
    },
    "autoEscalatedCase": {
      "id": "expert-req-1",
      "observationId": "obs-uuid-1",
      "status": "SUBMITTED"
    }
  }
}
```

For `LOW`/`MEDIUM` severity, `autoEscalatedCase` is `null`.

> **Crop activities** share the same pattern: `POST /api/v1/activities/:cropCycleId` (role `FARMER`,
> body `{ "activityType", "description", "costAmount?", "performedAt?" }`). `activityType` is one of
> `PREPARATION`, `PLANTING`, `FERTILIZER`, `PEST_CONTROL`, `IRRIGATION`, `HARVEST`, `OTHER`.

### 3.4 Expert Case Resolution (Technicians)

| Method | Path | Role |
| --- | --- | --- |
| `PATCH` | `/api/v1/case/expert-requests/:caseId/resolve` | `TECHNICIAN`, `OFFICER` |

**Request body**

```json
{ "recommendation": "Apply nitrogen top-dressing; re-inspect in 7 days.", "status": "RESOLVED" }
```

`status` is optional and defaults to `RESOLVED`. On resolution the farmer receives a `CASE_RESOLVED` push.

**Response — 200**

```json
{
  "success": true,
  "data": {
    "resolvedCase": {
      "id": "expert-req-1",
      "status": "RESOLVED",
      "recommendation": "Apply nitrogen top-dressing; re-inspect in 7 days.",
      "assignedTechnicianId": "firebase-uid-tech-9",
      "resolvedAt": "2026-09-16T08:45:00.000Z",
      "observation": { "id": "obs-uuid-1", "title": "Yellowing lower leaves" }
    }
  }
}
```

> **Generic status update** (technician/officer): `PATCH /api/v1/case/pipeline/:caseId` with
> `{ "caseType": "EXPERT_REQUEST" | "DISASTER_REPORT", "status", "recommendation?", "assignedTechnicianId?" }`.

### 3.5 Disaster Reports

#### Submit a disaster report (nested under a farm)

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/v1/case/disaster-report/:farmId` | `FARMER` |

**Request body**

```json
{
  "disasterType": "TYPHOON",
  "damagePercentage": 65.5,
  "estimatedLoss": 84000,
  "notes": "Lodging across the eastern block after Typhoon signal #3."
}
```

**Response — 201**

```json
{
  "success": true,
  "data": {
    "disasterReport": {
      "id": "disaster-uuid-1",
      "farmId": "farm-uuid-1",
      "disasterType": "TYPHOON",
      "damagePercentage": "65.50",
      "estimatedLoss": "84000.00",
      "notes": "Lodging across the eastern block after Typhoon signal #3.",
      "status": "SUBMITTED"
    }
  }
}
```

#### Retrieve disaster reports (via unified case pipeline)

There is no standalone `GET /disaster-reports`. Read them through the case pipeline, which returns both
expert and disaster cases scoped to the caller's role (farmers see only their own):

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/api/v1/case/pipeline` | `FARMER`, `TECHNICIAN`, `OFFICER` |

```json
{
  "success": true,
  "data": {
    "pipeline": {
      "expertCases": [],
      "disasterCases": [
        {
          "id": "disaster-uuid-1",
          "farmId": "farm-uuid-1",
          "disasterType": "TYPHOON",
          "damagePercentage": "65.50",
          "estimatedLoss": "84000.00",
          "status": "SUBMITTED",
          "farm": { "name": "Sitio Malaya Cornfield", "barangay": "Caggay" }
        }
      ]
    }
  }
}
```

---

## 4. RAG Chatbot Integration (`POST /ai/chat`)

Grounded agricultural assistant. Retrieves relevant knowledge chunks via pgvector similarity search and,
optionally, live farm context for a given crop cycle, then answers with Gemini.

| Field | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/ai/chat` |
| Required Role | Any authenticated user |

### 4.1 Request body

```json
{
  "prompt": "Bakit naninilaw ang mga dahon ng mais ko?",
  "cropCycleId": "cycle-uuid-1"
}
```

`cropCycleId` is optional. When provided (and owned by the caller), the answer is enriched with location,
variety, days-after-planting, and recent observations.

```ts
export interface RagChatRequest {
  prompt: string;
  cropCycleId?: string;
}
```

### 4.2 Response format

```json
{
  "success": true,
  "data": {
    "answer": "Ang paninilaw ng dahon ay kadalasang sanhi ng kakulangan sa nitrogen...",
    "sources": [
      { "title": "Corn Nutrient Management", "source": "DA Region II Corn Techno Guide" },
      { "title": "Nitrogen Deficiency Symptoms", "source": "PhilRice Advisory" }
    ],
    "farmContextUsed": true
  }
}
```

```ts
export interface RagChatResponse {
  answer: string;
  sources: Array<{ title: string; source: string }>;
  farmContextUsed: boolean;
}
```

> Note: the current backend returns the answer as a single string (non-streaming). Render it once received.

### 4.3 UI guidelines

- **Chat history:** keep an in-memory array of `{ id, role: "user" | "assistant", text, sources?, pending? }`.
  Persist per crop cycle if you want the conversation to survive navigation.
- **Optimistic UI:** on submit, immediately append the user's message and a placeholder assistant bubble with
  `pending: true`; replace it when the response arrives.
- **Loading indicator:** show a typing/spinner state on the pending bubble; disable the send button while `pending`.
- **Citations:** render `sources` as chips or a "Sources" footer under the answer so farmers can see the
  official basis. If `farmContextUsed` is `true`, badge the reply as "Personalized to your farm".
- **Errors:** on `400` (missing prompt) block submit client-side; on `500` keep the user's text and offer retry.

```tsx
async function sendChat(prompt: string, cropCycleId?: string) {
  const tempId = crypto.randomUUID();
  appendMessage({ id: crypto.randomUUID(), role: "user", text: prompt });
  appendMessage({ id: tempId, role: "assistant", text: "", pending: true });
  try {
    const { data } = await api.post<{ data: RagChatResponse }>("/ai/chat", {
      prompt,
      cropCycleId,
    });
    updateMessage(tempId, {
      text: data.data.answer,
      sources: data.data.sources,
      pending: false,
    });
  } catch (err) {
    updateMessage(tempId, { text: "Failed to get a response. Tap to retry.", pending: false, failed: true });
  }
}
```

---

## 5. Offline Queueing & Batch Sync Engine (`POST /sync`)

Lets the mobile app capture actions while offline and replay them when connectivity returns.
Supported `actionType` values: `CREATE_OBSERVATION`, `CREATE_CROP_ACTIVITY`, `CREATE_DISASTER_REPORT`.

### 5.1 Workflow

1. **Capture locally.** When offline, write the action to a local queue (IndexedDB on web, SQLite on mobile).
2. **Generate a `clientRefId`.** Assign a local UUID per pending action; use it as the temporary key for any
   optimistic UI rows so you can reconcile later.
3. **Upload photos first.** On reconnect, upload any queued photos to storage to obtain a real `imageUrl`
   **before** building the sync payload — the sync endpoint expects a finished URL, not a file.
4. **POST the batch** to `/api/v1/sync`.
5. **Reconcile IDs.** Map each returned `clientRefId → serverId` and update local storage; mark `ORPHANED`/`FAILED`
   items for user review.

### 5.2 Local queue types

```ts
export type SyncActionType =
  | "CREATE_OBSERVATION"
  | "CREATE_CROP_ACTIVITY"
  | "CREATE_DISASTER_REPORT";

export interface SyncAction<TPayload = Record<string, unknown>> {
  clientRefId: string;      // local UUID, e.g. "temp-obs-101"
  actionType: SyncActionType;
  payload: TPayload;
  clientTimestamp?: string; // ISO-8601
}

export interface CreateObservationPayload {
  cropCycleId: string;
  title: string;
  description: string;
  imageUrl?: string;        // resolved BEFORE sync
  aiDiagnosis?: object;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface CreateCropActivityPayload {
  cropCycleId: string;
  activityType:
    | "PREPARATION" | "PLANTING" | "FERTILIZER" | "PEST_CONTROL"
    | "IRRIGATION" | "HARVEST" | "OTHER";
  description: string;
  costAmount?: number;
  performedAt?: string;     // ISO-8601
}

export interface CreateDisasterReportPayload {
  farmId: string;
  disasterType: string;
  damagePercentage: number;
  estimatedLoss?: number;
  notes?: string;
}
```

### 5.3 Batch request

```json
{
  "actions": [
    {
      "clientRefId": "temp-obs-101",
      "actionType": "CREATE_OBSERVATION",
      "payload": {
        "cropCycleId": "cycle-uuid-1",
        "title": "Leaf blight spots",
        "description": "Grey lesions on upper leaves.",
        "imageUrl": "https://<supabase>/observation-photos/observations/uuid_blight.jpg",
        "severity": "HIGH"
      },
      "clientTimestamp": "2026-09-16T08:30:00Z"
    }
  ]
}
```

### 5.4 Batch response & reconciliation

```json
{
  "success": true,
  "data": {
    "total": 1,
    "processed": 1,
    "failed": 0,
    "results": [
      { "clientRefId": "temp-obs-101", "serverId": "obs-uuid-9", "status": "SUCCESS" }
    ]
  }
}
```

Each result carries `status`: `SUCCESS` (with `serverId`), `ORPHANED` (target record missing — e.g. crop cycle
was deleted), or `FAILED` (with an `error` string).

```ts
export interface SyncResult {
  clientRefId: string;
  serverId?: string;
  status: "SUCCESS" | "FAILED" | "ORPHANED";
  error?: string;
}

async function reconcile(results: SyncResult[]) {
  for (const r of results) {
    if (r.status === "SUCCESS" && r.serverId) {
      await localDb.remapId(r.clientRefId, r.serverId); // clientRefId -> serverId
    } else {
      await localDb.markForReview(r.clientRefId, r.status, r.error);
    }
  }
}
```

---

## 6. Firebase Push Notifications (FCM) Setup

### 6.1 Initialize FCM & request a token (web)

```ts
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseApp = initializeApp({ /* your firebase web config */ });
const messaging = getMessaging(firebaseApp);

export async function registerForPush(): Promise<string | null> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: swReg,
  });
  return token ?? null;
}
```

### 6.2 Service worker (`public/firebase-messaging-sw.js`)

```js
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({ /* your firebase web config */ });
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Tarabay-Mais", {
    body: body ?? "",
    data: payload.data, // { type, caseId, observationId? }
  });
});
```

### 6.3 Submit the token to the backend

```ts
const token = await registerForPush();
if (token) {
  await api.post("/register/fcm-token", { fcmToken: token }); // POST /api/v1/register/fcm-token
}
```

### 6.4 Handling notification payloads

The backend attaches a `data` object with a `type` discriminator:

| `data.type` | Trigger | Suggested navigation |
| --- | --- | --- |
| `EXPERT_DISPATCH` | New `HIGH`/`CRITICAL` observation escalated | Open the case detail (`data.caseId`, `data.observationId`) |
| `CASE_RESOLVED` | Technician resolved an expert request | Open the farmer's resolved case (`data.caseId`) |

```ts
onMessage(messaging, (payload) => {
  // Foreground messages: render an in-app toast rather than a system notification.
  const type = payload.data?.type;
  if (type === "EXPERT_DISPATCH") showToast("🚨 New field alert requires inspection");
  if (type === "CASE_RESOLVED") showToast("✅ A technician responded to your observation");
});
```

> Notification titles/bodies are localized on the backend and delivered as-is. `data` values are always strings.

---

## 7. Municipal CSV/Excel Exporters

Generates a downloadable workbook of disaster claims or a barangay-level summary. Returns a **binary file**, not JSON.

| Field | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/analytics/export` |
| Required Role | `TECHNICIAN`, `OFFICER` |

### 7.1 Query parameters

| Param | Values | Default | Notes |
| --- | --- | --- | --- |
| `type` | `disaster-claims`, `barangay-summary` | `disaster-claims` | Report kind |
| `format` | `xlsx`, `csv` | `xlsx` | Output format |
| `startDate` | `YYYY-MM-DD` | — | Inclusive lower bound (Asia/Manila) |
| `endDate` | `YYYY-MM-DD` | — | Inclusive upper bound |
| `barangay` | string | — | Case-insensitive filter |

Example: `GET /api/v1/analytics/export?type=disaster-claims&format=xlsx&startDate=2026-06-01&endDate=2026-09-16`

### 7.2 Frontend download (Blob → browser download)

```ts
export async function downloadExport(params: {
  type?: "disaster-claims" | "barangay-summary";
  format?: "xlsx" | "csv";
  startDate?: string;
  endDate?: string;
  barangay?: string;
}) {
  const res = await api.get("/analytics/export", {
    params,
    responseType: "blob", // critical: receive binary, not JSON
  });

  const blob = new Blob([res.data], {
    type:
      params.format === "csv"
        ? "text/csv"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ext = params.format === "csv" ? "csv" : "xlsx";
  a.href = url;
  a.download = `TarabayMais_${params.type ?? "disaster-claims"}_${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url); // free memory after the download starts
}
```

> With the raw Fetch API, use `await res.blob()` instead of `responseType`. Because the body is binary, an error
> envelope (`{ success: false }`) may arrive as JSON — inspect `res.headers["content-type"]` and, if it is
> `application/json`, parse the blob as text to surface the `error` message.

---

## Appendix — Endpoint Quick Reference

| Module | Method | Path | Role |
| --- | --- | --- | --- |
| Profile sync | `POST` | `/api/v1/auth/sync` | Any |
| FCM token | `POST` | `/api/v1/register/fcm-token` | Any |
| Farms list | `GET` | `/api/v1/farm` | `FARMER`, `TECHNICIAN` |
| Farm create | `POST` | `/api/v1/farm` | `FARMER` |
| Farm update | `PATCH` | `/api/v1/farm/:farmId` | `FARMER` |
| Farm delete | `DELETE` | `/api/v1/farm/:farmId` | `FARMER` |
| Crop cycle create | `POST` | `/api/v1/crop-cycles/farm/:farmId` | `FARMER` |
| Crop cycle list | `GET` | `/api/v1/crop-cycles/farm/:farmId` | `FARMER`, `TECHNICIAN` |
| Crop cycle status | `PATCH` | `/api/v1/crop-cycles/:id/status` | `FARMER` |
| Crop cycle delete | `DELETE` | `/api/v1/crop-cycles/:id` | `FARMER` |
| Crop activity | `POST` | `/api/v1/activities/:cropCycleId` | `FARMER` |
| Observation | `POST` | `/api/v1/observations/:cropCycleId` | `FARMER` |
| AI scan | `POST` | `/api/v1/ai/scan` | Any |
| RAG chat | `POST` | `/api/v1/ai/chat` | Any |
| Case pipeline | `GET` | `/api/v1/case/pipeline` | `FARMER`, `TECHNICIAN`, `OFFICER` |
| Case status update | `PATCH` | `/api/v1/case/pipeline/:caseId` | `TECHNICIAN`, `OFFICER` |
| Disaster report create | `POST` | `/api/v1/case/disaster-report/:farmId` | `FARMER` |
| Expert case resolve | `PATCH` | `/api/v1/case/expert-requests/:caseId/resolve` | `TECHNICIAN`, `OFFICER` |
| Analytics summary | `GET` | `/api/v1/analytics/summary` | `OFFICER`, `TECHNICIAN` |
| Barangay distribution | `GET` | `/api/v1/analytics/barangays` | `OFFICER`, `TECHNICIAN` |
| Analytics export | `GET` | `/api/v1/analytics/export` | `TECHNICIAN`, `OFFICER` |
| Batch sync | `POST` | `/api/v1/sync` | Any |
| Health check | `GET` | `/api/health` | Public |
```
