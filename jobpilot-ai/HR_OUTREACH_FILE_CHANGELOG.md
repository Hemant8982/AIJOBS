# HR Outreach Redesign — File Changelog

## Summary of Changes by Phase

### Phase 1: Find the Files (Discovery)
*Rule: No code changes in Phase 1.*

| File Path | What Changed | Why | Components / Styles Affected | Behavior Affected? | Phase |
|---|---|---|---|---|---|
| *None* | No files modified | Discovery and inventory phase | None | No | Phase 1 |

---

### Phase 2: Labels, Steps, Help Text, Confirm Dialog

| File Path | What Changed | Why | Components / Styles Affected | Behavior Affected? | Phase |
|---|---|---|---|---|---|
| `apps/web/components/ui.tsx` | Added SVG paths for `menu`, `close`, `info`, `alert`, `retry` icons | Support redesigned UI indicators, confirmation modal, and drawer | `Icon` component | No (additive only) | Phase 2 |
| `apps/web/app/(app)/outreach/outreach.css` | Created dedicated stylesheet scoped to `.ob` | Style 5-step tracker, helper notes, variable chips, and confirmation modal | `.ob-tracker`, `.ob-card-h`, `.ob-confirm-backdrop` | No | Phase 2 |
| `apps/web/app/(app)/outreach/page.tsx` | Integrated 5-step tracker, step anchors, variable chips, and confirmation modal before campaign creation | Provide guided 5-step outreach workflow and prevent accidental campaign sends | Outreach route `/outreach` | No (all existing handlers and APIs intact) | Phase 2 |

---

### Phase 3: Desktop UI & AI Button Refinement

| File Path | What Changed | Why | Components / Styles Affected | Behavior Affected? | Phase |
|---|---|---|---|---|---|
| `apps/web/app/(app)/outreach/outreach.css` | Added flat single-colour styling for AI button (`.ou-ai-go.icon-only`) | Remove purple glow/gradient and make it a clean solid primary square button | `.ob .ou-ai-go.icon-only` | No | Phase 3 |
| `apps/web/app/(app)/outreach/page.tsx` | Rendered AI button as icon-only (`size={18}`) with accessible label/title | Cleaner visual appearance matching modern prompt designs | `.ou-ai-go` button | No | Phase 3 |

---

### Phase 4: Shared Mobile Shell & Responsive Outreach Layout

| File Path | What Changed | Why | Components / Styles Affected | Behavior Affected? | Phase |
|---|---|---|---|---|---|
| `apps/web/app/(app)/layout.tsx` | Added hamburger toggle button, mobile drawer state (`nav`), backdrop, focus trapping/return, scroll lock, and route-change auto-close | Replace static row-wrapping sidebar on `< 701px` with modern off-canvas drawer | AppShell, `.topbar`, `.side` navigation across all pages | No (all nav links and routes intact) | Phase 4 |
| `apps/web/app/globals.css` | Appended `@media (max-width: 700px)` mobile shell overrides, `100dvh` fallbacks, and mobile topbar layout | Provide off-canvas drawer positioning, >=44px nav item touch targets, and truncated topbar title | `.side`, `.topbar`, `.mobile-nav-backdrop`, `.shell` | No (additive overrides only) | Phase 4 |
| `apps/web/app/(app)/outreach/page.tsx` | Added virtual keyboard detection via `visualViewport`, mobile checklist summary/toggle, non-interactive icon checklist, and compact live sending empty state | Improve mobile ergonomics and prevent action bar from obstructing input fields | Action bar (`.ob-action-bar`), checklist (`.ob-checks-list`), live sending card | No (all state and action handlers preserved) | Phase 4 |
| `apps/web/app/(app)/outreach/outreach.css` | Added 16px mobile input rules, >=44px mobile touch targets, fixed bottom mobile action bar, fullscreen preview modal on `< 700px`, and responsive campaign grid (1/2/3 cols) | Complete mobile responsive styling for `/outreach` | `.ob input`, `.ob-action-bar`, `.ou-modal`, `.ou-clist` | No | Phase 4 |

---

### Phase 5: Functional Verification & Accessibility Fixes

| File Path | What Changed | Why | Components / Styles Affected | Behavior Affected? | Phase |
|---|---|---|---|---|---|
| `apps/web/app/(app)/outreach/page.tsx` | Added `Escape` key handler for Preview modal; updated Gmail setup link to Next.js `<Link>`; added desktop missing requirement badge | Ensure consistent keyboard accessibility and navigation | Preview modal, action bar, topbar pills | No (strictly additive fixes) | Phase 5 |
| `apps/web/app/(app)/outreach/outreach.css` | Added `.ob-desktop-missing` style with media query hiding on `<= 768px` | Display missing requirement warning clearly on desktop screens without cluttering mobile bar | Action bar (`.ob-desktop-missing`) | No | Phase 5 |
