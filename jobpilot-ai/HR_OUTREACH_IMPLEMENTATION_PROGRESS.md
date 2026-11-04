# HR Outreach Redesign — Implementation Progress

## Architecture Summary
- **Framework & App Shell**: Next.js 14 (App Router) in `apps/web`. Authenticated routes reside inside `apps/web/app/(app)/` wrapped by `apps/web/app/(app)/layout.tsx` (`AppShell`).
- **HR Outreach Page**: Located at route `/outreach` (`apps/web/app/(app)/outreach/page.tsx`).
- **Styling Architecture**: Global tokens defined in `apps/web/app/globals.css`. Outreach currently uses `.ou-*` utility classes inside `globals.css` (lines 738–840, 901). Phase 3 will introduce dedicated `outreach.css` scoped to `.ob-*` / `.ou-*` without breaking global styles.
- **Backend API**: REST API in `apps/api` accessed via client helper `apps/web/lib/api.ts` (`api()`). No backend modifications are permitted.

### Current Outreach Page Mechanisms (Verified in Phase 0)
1. **Email / Contact Parsing**: Debounced (350ms) call to `POST /outreach/parse` with `{ text }`. Also accepts uploaded CSV/TXT files via `FileReader.readAsText`.
2. **Screenshot Contact Extraction**: Drag & drop or file upload to `.ou-drop`. Images resized client-side via HTML5 Canvas (`prepImage` to max 1600px) and sent to `POST /outreach/from-image`. Found contacts can be selected and added to recipients.
3. **AI Drafting & Enhancement**:
   - `POST /outreach/draft` with `{ role }` generates `{ subject, body }`.
   - `POST /outreach/enhance` with `{ body, action }` where action is one of `improve`, `shorter`, `friendlier`, `formal`, `confident`, `grammar`.
   - Full single-step undo history maintained via `undo` state.
4. **Template Variables**: Supports `{{name}}`, `{{first_name}}`, `{{company}}` inserted at textarea cursor position.
5. **Resume & Extra Attachments**:
   - Resumes loaded via `GET /resumes`, filtered for `fileSize > 0`.
   - Dropdown selects `resumeId`.
   - `extra` boolean flag controls `includeExtraFiles`.
6. **Sending Limits & Readiness**:
   - Polled from `GET /outreach/limits` (`sentLast24h`, `dailyLimit`, `gmailConnected`, `mailMode`).
   - Readiness evaluated across 5 conditions: emails present, resume selected, campaign name set, message >= 20 characters, Gmail connected.
7. **Campaign Lifecycle & Live Tracker**:
   - `POST /outreach/campaigns` creates campaigns with `start: true` (send) or `start: false` (save draft).
   - Live progress polled every 3s via `GET /outreach/campaigns` and `GET /outreach/campaigns/:id`.
   - Campaign action controls: `POST /outreach/campaigns/:id/:action` (`start`, `pause`, `cancel`, `retry`).

---

## Outreach Route & File Inventory (Phase 0)

| Group | File | Purpose | Modify / Inspect only | Shared? |
|---|---|---|---|---|
| **App shell** | `apps/web/app/(app)/layout.tsx` | Sidebar navigation, topbar, command palette, and upcoming mobile drawer | Modify (additive) | Yes, all app pages |
| **Global CSS** | `apps/web/app/globals.css` | Global tokens, primitives (`.card`, `.btn`, `.pill`), shell layout | Modify only by appending mobile-shell rules | Yes, all app pages |
| **Shared UI** | `apps/web/components/ui.tsx` | Icon SVG path map (`P`), Logo, Pill | Modify only to add missing icon paths | Yes, all app pages |
| **Page** | `apps/web/app/(app)/outreach/page.tsx` | Full HR Outreach route (`/outreach`) | Modify (markup, layout, step structure) | No |
| **Page-local components** | Inline inside `page.tsx` | Upload zone, editor, settings, progress, campaigns | Modify | No |
| **Page CSS** | `apps/web/app/(app)/outreach/outreach.css` | Dedicated styles for redesigned outreach components | Create (Phase 3) | No |
| **Brand Assets** | `apps/web/components/brand.tsx` | `BrandLogo`, `BrandMark` | Inspect only | Yes |
| **Read only** | `apps/web/lib/api.ts` | API client (`api()`, `apiBlob()`, `errText()`) | Inspect only | Yes |
| **Read only** | `apps/web/app/(app)/settings/email/page.tsx` | Gmail status presentation reference | Inspect only | No |

---

## Current Status & Next Step
- **Current Phase**: Phase 1 of 6 (Find the files — Discovery) — **COMPLETED**
- **Branch**: `ui/hr-outreach-redesign`
- **Completed Tasks**:
  - [x] Created clean branch `ui/hr-outreach-redesign`.
  - [x] Ran Phase 0 file and dependency resolution across `apps/web`.
  - [x] Audited all 11 API endpoints called by the outreach page.
  - [x] Audited shared layout and styling hazards (iOS 16px zoom, mobile sidebar stacking, z-index hierarchy).
  - [x] Initialized the 3 context tracking files.
- **Pending Tasks**:
  - [ ] Phase 2: Labels, 5 distinct steps (1: Who to email, 2: Write the email, 3: Send settings, 4: Preview & send, 5: Track live), and confirmation dialog.
  - [ ] Phase 3: Desktop layout refinement, dedicated `outreach.css`.
  - [ ] Phase 4: Mobile layout and responsive off-canvas drawer in `layout.tsx`.
  - [ ] Phase 5: Verification of all existing features (parsing, OCR, AI drafting, attachments, live tracker).
  - [ ] Phase 6: Cross-viewport responsive testing and clean production build check.
- **Issues Found**:
  - Existing page only numbers steps 1, 2, and 3; lacks visual steps for Preview/Send and Tracking.
  - Sticky bottom action bar overlaps the message textarea when the screen height is limited.
  - Mobile layout (`< 700px`) stacks all navigation links above the page instead of an off-canvas drawer.
  - Inputs at 13px cause automatic zooming on iOS Safari touch devices.
- **Issues Fixed**: None (Phase 1 was discovery and inventory only; no code changes made).
- **Exact Next Step**: Wait for user to review Phase 1 inventory and paste `02_PHASE2_labels_and_steps.md`.
