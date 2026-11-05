# HR Outreach Redesign — Implementation Progress

## Architecture Summary
- **Framework & App Shell**: Next.js 14 (App Router) in `apps/web`. Authenticated routes reside inside `apps/web/app/(app)/` wrapped by `apps/web/app/(app)/layout.tsx` (`AppShell`).
- **HR Outreach Page**: Located at route `/outreach` (`apps/web/app/(app)/outreach/page.tsx`).
- **Styling Architecture**: Global tokens defined in `apps/web/app/globals.css`. Outreach uses dedicated scoped stylesheet `apps/web/app/(app)/outreach/outreach.css` scoped under `.ob` with additive overrides appended to `globals.css`.
- **Backend API**: REST API in `apps/api` accessed via client helper `apps/web/lib/api.ts` (`api()`). No backend modifications made.

---

## Current Status & Next Step
- **Current Phase**: Phase 4 of 6 (Mobile UI) — **COMPLETED**
- **Branch**: `ui/hr-outreach-redesign`
- **Completed Tasks**:
  - [x] **Phase 1**: Find files & inventory audit (no code changes).
  - [x] **Phase 2**: Labels, 5 distinct steps, example hints, missing requirement warning badge, and focus-trapped confirmation modal.
  - [x] **Phase 3**: Desktop UI layout refinement, dedicated `outreach.css` stylesheet, flat single-colour icon-only AI button (`7bd1937`).
  - [x] **Phase 4**:
    - **Shared Mobile Navigation Drawer** in `layout.tsx`:
      - Hamburger toggle button in topbar with `aria-label`, `aria-expanded`, and `aria-controls`.
      - `<nav className="side">` converts to fixed left off-canvas drawer (`min(300px, 86vw)`) on `< 701px` with smooth sliding animation and backdrop overlay (z-index 69/70).
      - Drawer closes on route change, Esc key, backdrop tap, and navigation link click.
      - Body scroll is locked when drawer is open.
      - Focus returns to hamburger button on close.
      - Desktop collapsed rail state (`.col`) does not hide labels on mobile drawer.
      - Command palette (`Palette`) z-index updated to 80, cleanly overlaying drawer and closing drawer when opened.
      - Mobile topbar adapts: title truncates with ellipsis, "Profiles" button moved to drawer, "Ctrl K" hint hidden on narrow screens.
    - **Outreach Page Mobile Layout**:
      - 16px inputs, selects, and textareas on `< 700px` to prevent iOS Safari auto-zoom.
      - Interactive touch targets min 44×44px hit area.
      - Responsive action bar: sticky bottom in-flow on desktop; fixed bottom with safe-area inset on mobile (`< 768px`).
      - Two-row mobile action bar: top row has expandable "X of 5 ready" badge + missing requirements; bottom row has 3 accessible buttons (Preview, Save draft, Start sending).
      - Non-interactive checklist with check and alert SVG icons (`role="list"`).
      - Virtual keyboard detection via `window.visualViewport`: action bar un-fixes to static when keyboard is active so it never blocks focused fields.
      - Full-screen sheet for email Preview modal on mobile devices (`< 700px`).
      - Responsive campaign history grid (1 col `< 640px`, 2 cols `640–1023px`, 3 cols `≥ 1024px`).
      - Friendly compact empty state for Live sending card.
- **Pending Tasks**:
  - [ ] **Phase 5**: Full feature verification (paste/drop contacts, OCR screenshot upload, AI draft & enhance, templates, variable interpolation, preview modal, confirmation dialog, live tracker controls).
  - [ ] **Phase 6**: Cross-viewport verification (320px–1920px), no-horizontal-scroll validation, and final TypeScript / production build check.
- **Issues Found & Fixed**:
  - *Fixed*: Mobile viewport (`< 700px`) previously wrapped sidebar links into a static row atop page content. Replaced with off-canvas slide-in drawer.
  - *Fixed*: 13px inputs causing iOS auto-zoom; now scoped to 16px on mobile screens.
  - *Fixed*: Action bar overlapping textarea on short screens; now has dedicated bottom padding variable `--ob-bar-height` and static fallback when virtual keyboard is active.
- **Exact Next Step**: Await user to review mobile UI in browser at phone widths (320px–430px) and provide `05_PHASE5_check_features.md`.
