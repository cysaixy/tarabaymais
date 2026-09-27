# TarabayMais — Project Guidelines & UX Directives

## 1. Target User Persona
- **Primary Users:** Smallholder Filipino corn farmers (many are older, with limited smartphone experience and low digital literacy) located in rural areas (e.g., Cagayan Valley / Region II).
- **Secondary Users:** Municipal Agricultural Technicians and Officers (DA / LGU).

## 2. Core Farmer UX Non-Negotiables
All farmer-facing interfaces must adhere strictly to the following principles:

1. **Simplicity & Low Cognitive Load:**
   - Keep screens uncluttered with minimal text inputs.
   - Use progressive disclosure rather than complex nested forms.
   - Clear visual affordances and confirmation dialogs.

2. **Photo-First Input (One-Tap Camera / Gallery):**
   - Direct, prominent buttons to snap or upload leaf / field photos.
   - Immediate visual preview and instant feedback during AI scanning.

3. **Large, High-Contrast Tap Targets:**
   - Buttons must be prominent and oversized (minimum 48px to 56px height) with bold, readable typography.
   - High-contrast colors accessible in bright outdoor sunlight.
   - Generous spacing between clickable elements to avoid accidental taps.

4. **Filipino Language (Tagalog / Localized):**
   - Primary interface copy, navigation, status indicators, and AI guidance must be in natural, conversational Filipino/Tagalog.
   - Avoid intimidating technical jargon; use familiar agricultural terms (e.g., "Kuhanan ng Litrato", "Suriin ang Pananim", "Ulat ng Pinsala").

5. **Offline-First Resilience:**
   - Assume rural barangays have weak or zero cellular signal.
   - Field observations, activity logs, and disaster reports must be cached locally (e.g., IndexedDB / LocalStorage) when offline.
   - Automatic background or one-tap synchronization with the backend `/api/v1/sync` endpoint once network connectivity is detected.
   - Unambiguous visual indicators showing offline status vs. synced status.

## 3. Absolute Architectural & Implementation Rules
These rules are absolute and must be followed across the entire application:

1. **Mobile-First Responsive Layout:**
   - All screens must be engineered mobile-first (small viewport, bottom thumb-reach zones, readable outdoor typography) while scaling gracefully and cleanly to tablet and desktop screens.

2. **Framework & Styling System:**
   - Adhere strictly to the existing codebase tech stack: **React + Tailwind CSS** (Vite + Tailwind v4).

3. **Toast / Notification System:**
   - Integrate a prominent toast/notification library (e.g., `sonner` or `react-hot-toast`) to provide immediate, unambiguous visual feedback for login events (success, invalid PIN/credentials), network errors, and offline/sync status changes.

4. **Strict Grounding in Core Specifications:**
   - Ground all logic, routes, and data flows on:
     - `FRONTEND_INTEGRATION_GUIDE.md` (exact backend endpoint paths, headers, payload structures, Prisma enum values).
     - `ai_farming_system_flowchart.mmd` (complete lifecycle: onboarding -> crop growth timeline -> plant health scanner -> RAG chat advisor -> activities/observations -> disaster claims -> offline sync -> municipal officer portal).
     - `AGENTS.md` (farmer accessibility guidelines, large tap targets, Filipino localization, offline resilience).
   - Match the given UI/UX flowchart as faithfully as possible. Any unstated details must be adapted so they fit seamlessly with existing backend routes, models, and specifications.

5. **Execution Directive:**
   - Do NOT build anything until explicitly directed by the user. Planning and alignment must strictly precede implementation.

