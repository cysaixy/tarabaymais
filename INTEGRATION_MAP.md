# TarabayMais — Frontend ↔ Backend INTEGRATION MAP (Phase 1)

Read-only analysis. **No code changed.** Source-of-truth priority: backend **code** > `FRONTEND_INTEGRATION_GUIDE.md` > frontend code. Where code and docs disagree, code wins and the discrepancy is flagged.

> Full evidence (every endpoint with file+line citations, Prisma enums, docs-vs-code diff) lives in `backend/.agents/tasks/integration-discovery-report.md`. This file is the decision-ready map.

---

## Phase 0 recap — Discovery summary

**Frontend stack:** React 19, react-router-dom 7, Vite 7, Tailwind v4, **axios** (shared instance `frontend/src/lib/api.ts`), **Firebase** phone-OTP auth, **sonner** toasts. An API layer and a full `services/` folder (7 modules) already exist.

**Backend stack:** Express + Prisma (Postgres) + Firebase Admin. Routes under `/api/v1` (`backend/src/server.ts`). Helmet, CORS (whitelists Vite `:5173`, `credentials:true`, methods GET/POST/PATCH/DELETE/OPTIONS — **no PUT**), rate limiting (sensitive on `/auth` + `/ai`, general elsewhere).

**Auth mechanism:** Firebase ID token (Bearer). `authMiddleware.authenticate` verifies via `auth.verifyIdToken`, uses the **Firebase UID as the DB `user.id`**, loads `prisma.user` (incl `farmerProfile`) into `req.user`. RBAC via `rbacMiddleware.authorize([roles])`.

**Error format:** `{ success:false, error:string, details?:any }`. Success: `{ success:true, data?, message? }` (`utils/apiResponse.ts`). Prisma P2002→409, P2025→404, P2003→409, else 500.

**Pagination convention:** **none** on the backend — every list returns all rows with only `orderBy`. Frontend filters client-side.

**Existing frontend API layer:** `lib/api.ts` (axios + request interceptor attaching the Firebase token). **No response interceptor / 401-retry / error normalization** (the guide recommends one).

**Key headline:** the service layer is **already correctly wired** to all 30 backend endpoints and shapes match. Integration work is **page-level cleanup + a few foundation fixes**, not a rewrite.

---

## A. Summary table

| Page/Component | File path | Static element | Needed operation | Matching endpoint | Status |
|---|---|---|---|---|---|
| FarmerLoginPage | `frontend/src/pages/auth/FarmerLoginPage.tsx` | default phone `"0917 000 0000"` | login + getMe | Firebase OTP → `GET /auth/me` | ✅ MATCH (clear demo value) |
| OfficerLoginPage | `frontend/src/pages/auth/OfficerLoginPage.tsx` | hardcoded test phone `+639170000002` | officer login + role gate | Firebase OTP → `GET /auth/me` | ⚠️ remove demo number |
| FarmerOnboardingPage | `frontend/src/pages/auth/FarmerOnboardingPage.tsx` | `CAGAYAN_MUNICIPALITIES`(25), `CORN_VARIETIES`(6), `ownership`, `scope`, demo defaults | register + create farm + crop cycle | `POST /auth/sync`, `POST /farm`, `POST /crop-cycles/farm/:farmId` | ⚠️ SHAPE MISMATCH (ownership/scope have no API sink) + ❓ |
| FarmerDashboardPage | `frontend/src/pages/farmer/FarmerDashboardPage.tsx` | welcome chat seed; duplicated feature logic | load active cycle + feature actions | `getActiveCropCycle` composite + feature endpoints | ✅ MATCH (dedupe later) |
| FarmerActivityPage | `frontend/src/pages/farmer/FarmerActivityPage.tsx` | `ACTIVITY_SUGGESTIONS` (mirrors enum) | create/list activity, offline queue | `POST /activities/:cropCycleId`, `GET /activities` | ✅ MATCH |
| FarmerObservationPage | `frontend/src/pages/farmer/FarmerObservationPage.tsx` | `SYMPTOM_OPTIONS` (UI); offline queues `blob:` imageUrl | create observation (multipart) | `POST /observations/:cropCycleId` | ⚠️ SHAPE MISMATCH (blob URL in sync) |
| FarmerScannerPage | `frontend/src/pages/farmer/FarmerScannerPage.tsx` | **fabricated AI diagnosis fallback**; hardcoded `defaultTasks`; local-only task toggles | scan + list observations | `POST /ai/scan`, `GET /observations` | ⚠️ SHAPE MISMATCH + ❌ (tasks have no endpoint) |
| FarmerChatPage | `frontend/src/pages/farmer/FarmerChatPage.tsx` | **fabricated chat answers + sources on error**; hardcoded greeting sources | RAG chat | `POST /ai/chat` | ⚠️ SHAPE MISMATCH (invented data) |
| FarmerDisasterReportPage | `frontend/src/pages/farmer/FarmerDisasterReportPage.tsx` | invented `₱36,000/ha` loss; `EVENT_TYPES`; photo captured but never sent | create disaster report | `POST /case/disaster-report/:farmId` | ⚠️/❓ + ❌ (no photo field) |
| FarmerExpertRequestPage | `frontend/src/pages/farmer/FarmerExpertRequestPage.tsx` | status `"IN_PROGRESS"` (not a real enum) | create HIGH observation + list cases | `POST /observations/:cropCycleId`, `GET /case/pipeline` | ⚠️ SHAPE MISMATCH (enum drift) |
| FarmerHistoryPage | `frontend/src/pages/farmer/FarmerHistoryPage.tsx` | filter pills (UI state) | list activities/observations/cases, sync | `GET /activities`, `GET /observations`, `GET /case/pipeline`, `POST /sync` | ✅ MATCH |
| MyFarmsPage | `frontend/src/pages/farmer/MyFarmsPage.tsx` | — | list farms | `GET /farm` | ❓ UNCLEAR (orphaned route, diff design) |
| AddFarmPage | `frontend/src/pages/farmer/AddFarmPage.tsx` | — | create farm | `POST /farm` | ❓ UNCLEAR (orphaned route `/farmer/farms/new`) |
| TechnicianDashboardPage | `frontend/src/pages/technician/TechnicianDashboardPage.tsx` | MAP placeholder (honest); analytics bypasses service layer | pipeline + case updates + analytics | `GET /case/pipeline`, `PATCH /case/pipeline/:caseId`, `PATCH /case/expert-requests/:caseId/resolve`, `GET /analytics/summary` | ✅ MATCH (minor) |
| Header / Footer | `frontend/src/components/{Header,Footer}.tsx` | nav links | navigation only | — | 🔧 UI ONLY |
| AuthProvider / ProtectedRoute | `frontend/src/context/AuthProvider.tsx`, `frontend/src/routes/ProtectedRoute.tsx` | provisional role from token claim | session + guard | `GET /auth/me` | ✅ MATCH (logout cache leak, see D) |
| FCM push (whole app) | — | — | register device token | `POST /register/fcm-token` | ❌ MISSING (frontend never calls it; no VAPID key) |

Legend: ✅ MATCH · ⚠️ SHAPE MISMATCH · ❌ MISSING ENDPOINT · 🔧 UI ONLY · ❓ UNCLEAR.

---

## B. Per-page detail (field-by-field)

### Backend endpoint reference (composed full paths, auth, shapes)
All endpoints require `authenticate` unless noted. Role via `authorize([...])`.

| Method | Path | Role | Body / params | Success data |
|---|---|---|---|---|
| POST | `/auth/sync` | any | firstName, lastName, phone (req); rsbsaNumber, preferredLanguage (opt) | `{user}` (incl farmerProfile) |
| GET | `/auth/me` | any | — | `{user}` (401 if no DB profile) |
| POST | `/register/fcm-token` | any | fcmToken (req) | `{message}` only |
| POST | `/farm` | FARMER | name, municipality, barangay, areaHectares>0 (req); latitude, longitude (opt) | `{farm}` |
| GET | `/farm` | FARMER\|TECHNICIAN | — | `{farms:[Farm & {cropCycles}]}` |
| PATCH | `/farm/:farmId` | FARMER | name/municipality/barangay/areaHectares/lat/lng (opt) | `{farm}` |
| DELETE | `/farm/:farmId` | FARMER | — | `{deletedCropCycles}` |
| GET | `/crop-cycles/:id` | FARMER\|TECH\|OFFICER | — | `{cropCycle}` incl farm, activities, observations |
| POST | `/crop-cycles/farm/:farmId` | FARMER | cropType(def corn), variety, plantingDate(req), expectedHarvestDate, areaHectares>0(req) | `{cropCycle}` (area-cap 400 w/ details) |
| GET | `/crop-cycles/farm/:farmId` | FARMER\|TECH | — | `{cropCycles}` |
| PATCH | `/crop-cycles/:id/status` | FARMER | status(CropStatus,req) | `{cropCycle}` |
| DELETE | `/crop-cycles/:id` | FARMER | — | `{deletedCropCycle}` |
| GET | `/activities` / `/activities/:cropCycleId` | FARMER\|TECH\|OFFICER | — | `{activities:[CropActivity & {cropCycle:{farm}}]}` |
| POST | `/activities/:cropCycleId` | FARMER | activityType(ActivityType,req), description, costAmount≥0, performedAt | `{activity}` |
| GET | `/observations` / `/observations/:cropCycleId` | FARMER\|TECH\|OFFICER | — | `{observations:[... expertRequest, cropCycle.farm]}` |
| POST | `/observations/:cropCycleId` | FARMER (multipart) | image(file,opt), title(req), description, severity(SeverityLevel,req), aiDiagnosis(json) | `{observation, autoEscalatedCase}` |
| POST | `/ai/scan` | any (multipart) | image(file,req) | `{diagnosis:{isCornPlant,diseaseDetected,confidence,severity,description,recommendedAction}}` |
| POST | `/ai/chat` | any | prompt(req), cropCycleId(opt) | `{answer, sources:[{title,source}], farmContextUsed}` |
| GET | `/case/pipeline` | FARMER\|TECH\|OFFICER | — | `{pipeline:{expertCases, disasterCases}}` |
| PATCH | `/case/pipeline/:caseId` | TECH\|OFFICER | caseType, status(CaseStatus,req), recommendation, assignedTechnicianId | `{updatedCase}` |
| POST | `/case/disaster-report/:farmId` | FARMER | disasterType(req), damagePercentage 0-100(req), estimatedLoss≥0, notes | `{disasterReport}` |
| PATCH | `/case/expert-requests/:caseId/resolve` | TECH\|OFFICER | recommendation(req), status(def RESOLVED) | `{resolvedCase}` |
| GET | `/analytics/summary` | OFFICER\|TECH | — | `{summary:{totalFarmers,totalFarms,activeCropCycles,totalActiveHectares,pendingExpertCases,disasterMetrics}}` |
| GET | `/analytics/barangays` | OFFICER\|TECH | — | `{barangays:[{barangay,_count,_sum}]}` |
| GET | `/analytics/export` (+ dup `/analytics-report/export`) | OFFICER\|TECH | query type/format/dates/barangay | **binary** xlsx/csv |
| POST | `/sync` | any | actions:[{clientRefId, actionType, payload, clientTimestamp}] | `{total,processed,failed,results}` |
| GET | `/api/health` | public | — | `{status:"ok"}` |

### Field-by-field highlights (UI field → API field)

**Onboarding (`FarmerOnboardingPage`)**
- UI `firstName/lastName/phone/rsbsaNumber/preferredLanguage` → `POST /auth/sync` ✅
- UI `name/municipality/barangay/areaHectares/lat/lng` → `POST /farm` ✅
- UI `variety/plantingDate/expectedHarvestDate/areaHectares` → `POST /crop-cycles/farm/:farmId` ✅
- **UI `ownership` (owned/rented/arb) and `scope` (medium/above_medium) → NO API field.** Collected but never sent. Farm model has no such columns.

**Observation (`FarmerObservationPage`, `FarmerExpertRequestPage`)**
- UI `image(File)` → multipart `image`; `title/description/severity` ✅; `aiDiagnosis` (from scanner) → `aiDiagnosis` ✅
- Severity HIGH/CRITICAL auto-creates an expert request server-side (`autoEscalatedCase`). ✅

**Chat (`FarmerChatPage`)**
- UI `prompt` (+ optional `cropCycleId`) → `POST /ai/chat`; response `answer/sources/farmContextUsed` ✅
- UI fabricates `answer` + `sources` **on error** — not an API-sourced shape. ⚠️

**Scanner (`FarmerScannerPage`)**
- UI `image` → `POST /ai/scan`; response `diagnosis.*` ✅
- UI `defaultTasks` checklist → **no endpoint**; toggles are local only. ❌

**Disaster (`FarmerDisasterReportPage`)**
- UI `disasterType` (EVENT_TYPES) → free-string `disasterType` ✅ (not an enum)
- UI `damagePct` → `damagePercentage` ✅
- UI `estimatedLossPhp = haNum * 36000` → `estimatedLoss` ⚠️ invented constant
- UI `photo` → **no API field**, never uploaded. ❌

**Expert cases (`FarmerExpertRequestPage`)**
- UI reads `/case/pipeline` expertCases ✅, but maps `status === "IN_PROGRESS"` — **not a CaseStatus member** (real: SUBMITTED, UNDER_REVIEW, INSPECTED, RESOLVED, REJECTED). ⚠️

### Prisma enums (drive dropdowns/statuses/roles)
- `Role`: FARMER, TECHNICIAN, OFFICER
- `CropStatus`: ACTIVE, HARVESTED, FAILED, CANCELLED
- `ActivityType`: PREPARATION, PLANTING, FERTILIZER, PEST_CONTROL, IRRIGATION, HARVEST, OTHER
- `SeverityLevel`: LOW, MEDIUM, HIGH, CRITICAL
- `CaseStatus`: SUBMITTED, UNDER_REVIEW, INSPECTED, RESOLVED, REJECTED

---

## C. Mismatch resolution proposals

| ID | Item | Proposal | Label |
|---|---|---|---|
| C1 | `lib/api.ts` global `Content-Type: application/json` + the 2 services forcing `multipart/form-data` (drops the boundary) — likely breaks `/ai/scan` and photo observations | Don't set Content-Type for FormData; delete the per-call multipart header so the browser sets `multipart/form-data; boundary=...`. Make the base client not force JSON when the body is FormData. | **Frontend Transform** (Phase 2, highest priority) |
| C2 | `FarmerScannerPage` fabricates a fake diagnosis on scan failure | Remove the fabricated object; show honest error + retry, offer offline queue only if a real result exists. | **UI Adjustment** |
| C3 | `FarmerChatPage` fabricates answers + sources on error; greeting carries invented `sources` | Remove fabricated fallback (show error/retry); drop the hardcoded greeting citation or mark it plainly as a static welcome with no sources. | **UI Adjustment** |
| C4 | `FarmerExpertRequestPage` uses nonexistent `IN_PROGRESS` status | Map real `CaseStatus` values (UNDER_REVIEW / INSPECTED) to the Tagalog labels. | **UI Adjustment** |
| C5 | Offline observation queues a `blob:` object URL as `imageUrl` | Either (a) upload the photo to storage first to get a real URL before queueing, or (b) queue the File and upload at sync time. (a) matches guide; (b) needs a sync-time upload step. | **Frontend Transform** (needs your call on approach) |
| C6 | Disaster `estimatedLoss = ha * ₱36,000` invented client-side | Confirm the real business rule. Options: keep but label as an estimate, make it an editable field, or compute server-side. | **Remove/Defer** pending decision (❓) |
| C7 | Disaster photo captured but no backend sink | No `DisasterReport.imageUrl` field and no upload route. Defer the photo feature or raise a backend change. | **Backend Change Request** / Remove/Defer |
| C8 | Scanner "next tasks" checklist (`defaultTasks`) has no persistence | No tasks endpoint exists. Keep as local-only UI (label it clearly) or raise a backend change for a tasks resource. | **Remove/Defer** (or Backend Change Request) |
| C9 | Onboarding `ownership`/`scope` collected but unused | Drop the fields from the payload path (UI-only), or raise a schema change to persist them. | **UI Adjustment** (drop) or **Backend Change Request** (persist) — ❓ |
| C10 | Duplicate analytics: `/analytics/export` and `/analytics-report/export`; two controllers | Frontend should call `/analytics/export` only. Backend should de-duplicate. | **Backend Change Request** (frontend uses canonical path) |
| C11 | RAG retrieval always empty (pgvector not installed; embedding column commented out) | Chat works but returns no sources. Install pgvector + ingest embeddings. | **Backend Change Request** |
| C12 | No server pagination/search on officer lists | Fine at demo scale; will not scale for Region II. | **Backend Change Request** (defer) |
| C13 | Municipalities/varieties are client constants (no lookup endpoint) | Keep as constants for now, or add a lookup endpoint later. | **Remove/Defer** (keep constants) |
| C14 | No municipalities API, FCM web push unimplemented (no `/register/fcm-token` call, no VAPID key) | Defer FCM to its own phase; add `VITE_FIREBASE_VAPID_KEY` + service worker when scheduled. | **Remove/Defer** |
| C15 | Hardcoded demo auth values (farmer/officer phone numbers, onboarding defaults) | Clear them; the officer test number must go before production. | **UI Adjustment** |

---

## D. Cross-cutting concerns

**Auth flow** — Firebase phone OTP. `lib/api.ts` request interceptor attaches `getIdToken()`. `AuthProvider` subscribes to `onAuthStateChanged`, calls `GET /auth/me`, resolves role (provisional from token claim, then DB profile). `ProtectedRoute`: loading→spinner, no user→`/login`, user w/o role→`/onboarding`, wrong role→role home. **Gaps:** no 401 refresh+retry response interceptor (guide recommends one); `logout` does not call `clearFarmContext()` → stale `tarabay_active_farm` can leak across sessions on shared devices.

**Global error handling** — backend uniform envelope + Prisma mapping. Frontend has **no centralized normalization**; `AddFarmPage` reads `response.data.{error,details}` field-level (good model to generalize). 401/403/404/422/500 are mostly surfaced as generic toasts. Recommend a shared error normalizer + response interceptor in Phase 2.

**Loading / empty / error states** — hand-rolled per page today; no shared components. Recommend shared `Loading`/`Empty`/`ErrorState` components styled to the emerald farmer theme and the officer theme.

**Pagination / search / filter** — none on backend; client-side filtering only. Keep client-side for now; flag server pagination as a future backend change.

**File / image uploads** — multer memoryStorage, 5MB, images only, on `/ai/scan` and `/observations/:cropCycleId` → Supabase. **The multipart Content-Type bug (C1) is the top foundation fix.** Disaster photo and offline `blob:` URL need resolution (C5, C7).

**Environment variables** — `frontend/.env` has all `VITE_FIREBASE_*` + `VITE_API_BASE_URL` (`http://localhost:3000/api/v1`). **Missing:** `VITE_FIREBASE_VAPID_KEY` (FCM). Note: committed Firebase web keys in `.env` — review gitignore/rotation (values not printed here).

---

## E. Recommended integration order

**Phase 2 — Foundation (in order of risk):**
1. Fix multipart Content-Type in `lib/api.ts` + the 2 services (C1). *High risk, blocks scan + photo observations.*
2. Add response interceptor: 401 force-refresh-and-retry once + normalize `{error,details}` (model after `AddFarmPage`). *Medium.*
3. Shared Loading / Empty / Error components (emerald + officer themes). *Low.*
4. Call `clearFarmContext()` (and clear offline queue as appropriate) on logout. *Low.*

**Phase 3 — Page by page (auth → lookups → core → dashboards):**
1. **Auth/onboarding** — clear demo defaults, remove officer test number, decide ownership/scope (C9, C15). *Low risk.*
2. **Farm management** — decide fate of orphaned `MyFarmsPage`/`AddFarmPage` (wire `/farmer/farms` + `/farmer/farms/new`, or remove) (❓). *Low-med.*
3. **Activity + Observation** — fix offline `blob:` imageUrl (C5); keep enum-accurate chips. *Med.*
4. **Scanner** — remove fabricated diagnosis (C2); decide `defaultTasks` fate (C8). *Med.*
5. **Chat** — remove fabricated answers/sources (C3); greeting cosmetic. *Med.*
6. **Disaster report** — resolve invented ₱36k/ha loss (C6); photo has no sink (C7). *Med, needs decisions.*
7. **Expert request** — fix `IN_PROGRESS` → real `CaseStatus` (C4). *Low.*
8. **Technician dashboard** — optionally route analytics through a service; MAP stays honest placeholder. *Low.*

**Backend Change Requests (do NOT implement — listed for you):** de-dup analytics routes/controllers (C10); install pgvector + ingest embeddings for RAG (C11); server pagination/search (C12); decide DisasterReport image field + Farm ownership field + lookup endpoints (C7, C9, C13).

**Decisions I need from you (❓):**
1. Orphaned farm pages — wire them in or remove?
2. Onboarding `ownership`/`scope` — drop (UI-only) or persist (schema change)?
3. Disaster `estimatedLoss` ₱36,000/ha — keep as labeled estimate, make editable, or compute server-side?
4. Disaster photo — defer, or raise a backend change to store it?
5. Scanner "next tasks" — keep as local-only UI, or make it a real feature?
6. FCM push — in scope for this integration pass, or a later phase?

---

**STOP — awaiting your review of Phase 1 before any Phase 2 changes.**
