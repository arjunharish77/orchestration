# AUDIT_03_DESIGN_SYSTEM — Design System Proposal

_Based on static analysis of the current component library, theme, and view code._

---

## Executive Summary

The app has a solid design foundation — a well-structured MUI theme with a complete green palette, CSS custom properties for status colors, semantic spacing, and thoughtful typography. The core visual identity is coherent. The problems are execution gaps: design tokens that are bypassed by hardcoded hex strings in the same file that defines them, near-duplicate components that have diverged in subtle ways, and three competing feedback and navigation patterns that create inconsistency without adding new capability.

This document proposes minimal changes. No new visual direction. No rebranding. The goal is to close the gap between the design token system that already exists and the view code that doesn't use it.

---

## Section 1 — Token System Audit

### 1.1 What Exists (and Is Working)

**File:** `frontend/src/theme/theme.ts`

The theme defines two parallel token layers:

**MUI theme palette**
```ts
palette.primary.main = '#2d6a2d'   // green[600]
palette.divider = '#e0ede0'
palette.text.secondary = '#526252'
palette.background.default = '#f8fcf8'
```

**CSS custom properties** (on `:root` via `MuiCssBaseline.styleOverrides`)
```css
--g50 … --g900       /* full green ramp */
--crm-border         /* #e0ede0 */
--crm-bg             /* #f8fcf8 */
--crm-sidebar        /* green[900] */
--crm-primary        /* green[600] */
--crm-paper          /* #ffffff */
--crm-paper-soft     /* #fafdfa */
--crm-soft           /* #eef7ee */
--crm-muted          /* #526252 */
--s-new-bg/fg/dot    /* status: New / Pending / Low */
--s-asg-bg/fg/dot    /* status: Assigned / Invited */
--s-prog-bg/fg/dot   /* status: In Progress / Processing */
--s-conv-bg/fg/dot   /* status: Converted / Done / Active */
--s-lost-bg/fg/dot   /* status: Lost / Failed / High / Overdue */
--radius-sm          /* 4px */
--radius-md          /* 8px */
--radius-pill        /* 9999px */
```

`StatusChip` uses these CSS vars correctly. `MetaChip` uses `--g50` and `--g700` correctly.

### 1.2 Token Leakage — Where the System Is Bypassed

Every file below defines or hardcodes color values that already exist in the token system:

| File | Hardcoded value | Should be |
|---|---|---|
| `WorkspacePrimitives.tsx:14` | `const green = '#2d6a2d'` | `theme.palette.primary.main` or `var(--crm-primary)` |
| `WorkspacePrimitives.tsx:10` | `const line = '#e0ede0'` | `theme.palette.divider` or `var(--crm-border)` |
| `WorkspacePrimitives.tsx:11` | `const panel = '#ffffff'` | `theme.palette.background.paper` or `var(--crm-paper)` |
| `WorkspacePrimitives.tsx:12` | `const mutedPanel = '#eef7ee'` | `var(--crm-soft)` |
| `WorkspacePrimitives.tsx:13` | `const textMain = '#162716'` | `theme.palette.text.primary` |
| `CompactDataTable.tsx:64` | `const line = '#e0ede0'` | `theme.palette.divider` |
| `CompactDataTable.tsx:66` | `const green = '#2d6a2d'` | `theme.palette.primary.main` |
| `CompactDataTable.tsx:68` | `const tableHeader = '#fafdfa'` | `var(--crm-paper-soft)` |
| `FilterDialog.tsx:8` | `const line = '#e0ede0'` | `theme.palette.divider` |
| `FormDialog.tsx:46` | `bgcolor: '#eef7ee'` (inline) | `var(--crm-soft)` |
| `FormDialog.tsx:51` | `borderColor: '#e0ede0'` (inline) | `theme.palette.divider` |
| `DashboardView.tsx:18` | `const green = '#2d6a2d'` | `theme.palette.primary.main` |
| `TasksView.tsx:35` | `const green = '#2d6a2d'` | `theme.palette.primary.main` |
| `ReportsView.tsx:23` | `const green = '#2d6a2d'` | `theme.palette.primary.main` |
| `UploadsView.tsx:373` | `bgcolor: '#2d6a2d'` (inline) | `theme.palette.primary.main` |
| `AppChip.tsx:19-24` | hardcoded palette per tone | `--s-conv-*`, `--s-lost-*`, etc. |

**Recommended fix (Batch 4, low risk):** Replace all local `const green/line/panel` constants in component files with references to CSS custom properties or `theme.palette.*`. For JSX `sx` props, use `'primary.main'`, `'divider'`, `'background.paper'`, etc. No visual change; one less place to update when the palette changes.

---

## Section 2 — Typography Scale

### 2.1 Current Scale (Defined, Mostly Respected)

| Variant | Size | Weight | Use |
|---|---|---|---|
| `h1` | 40px | 800 | Not used in app (too large) |
| `h2` | 32px | 800 | Not used in app |
| `h3` | 24px | 800 | Page titles (via `PageHeader`) |
| `h4` | 20px | 800 | Section headers |
| `h5` | 16px | 700 | Card headers |
| `h6` | 11px | 700 | Uppercase label caps (category labels) |
| `body1` | 14px | 500 | Body text |
| `body2` | 12px | 500 | Secondary text |
| `caption` | 11px | 500 | Muted helper text |
| `button` | — | 600 | No transform, no spacing |

### 2.2 Issues

1. **Inline font sizing in `sx` props** — Many components override typography via direct `sx` props (`fontSize: 11`, `fontSize: 23`, `fontWeight: 800`) rather than using named variants. This is common and hard to avoid in MUI, but it means no single source of truth for, e.g., "metric card numbers" or "table column headers."

2. **`h6` is used for two different things** — Page section labels (which should be `h6`) and dialog subtitles (which use `Typography variant="h6"` but look like `body2`). The semantic meaning is muddied.

3. **Table column headers use custom `fontSize: 0.7rem` uppercase** — Defined inline in `CompactDataTable.tsx:199-202`. This is a bespoke style not part of the typography scale. It should be a named variant (e.g., `tableHeader`).

**Recommendation:** No typography changes needed for Phase 3 fixes. Document the actual usage for future reference. Only change if a consistent `tableHeader` variant is desired.

---

## Section 3 — Color System

### 3.1 Palette

The green palette is 10-stop (`green[50]` → `green[900]`) and well-defined. The semantic mapping is good:

```
green[50]  = Surface soft (muted panels, chip backgrounds)
green[600] = Primary interactive (buttons, links, active indicators)
green[700] = Text on light surfaces
green[900] = Sidebar, body text, heavy labels
```

### 3.2 Semantic Status Colors

The `--s-{status}-{bg|fg|dot}` CSS variable system is the right approach. All five lead statuses (New, Assigned, In Progress, Converted, Lost) plus shared task/upload/user statuses are covered.

**Gap:** `'Valid'` and `'Expired'` lead statuses (which appear in the data from the upload processor) are not in `StatusChip`'s `TONES` map. They fall through to the `fallback` (green/new). `'Valid'` should be styled like `Converted`; `'Expired'` needs a distinct color (e.g., slate-amber).

**Recommendation (Batch 4):** Add `'Valid'` and `'Expired'` to `StatusChip.tsx:8-32`. Two lines.

### 3.3 Error / Warning Colors

The theme does not define explicit error/warning palette entries (only `success`). MUI defaults are used (`error.main = #d32f2f`). For consistency, an explicit `error` and `warning` palette should be added to `theme.ts` matching the `--status-rose-*` and `--status-amber-*` CSS vars already defined.

---

## Section 4 — Component Inventory and Consolidation Plan

### 4.1 Chip Family (3 components, should be 2)

| Component | Purpose | Status |
|---|---|---|
| `StatusChip` | Lead/task/user/upload status with dot indicator | ✅ Keep as-is |
| `MetaChip` | Neutral tag label (activity type, filter value) | ✅ Keep as-is |
| `AppChip` | `@deprecated` — general-purpose chip with inferred color | ⚠️ Migrate and delete |

`AppChip` is marked `@deprecated` in its JSDoc comment but still used in `ReportsView.tsx` (drilldown dialog) and `ConnectorsView.tsx`. Its color inference from label text is fragile — e.g., `'hot'` is `success`, `'high'` is `danger`. Any label not in one of four hardcoded Sets gets `'neutral'`.

**Plan:**
- Replace `AppChip` usages in `ReportsView.tsx` → `StatusChip` (for status values) or `MetaChip` (for neutral labels)
- Replace `AppChip` usages in `ConnectorsView.tsx` → same
- Delete `AppChip.tsx`

This is a minor refactor across 2 files.

---

### 4.2 Button Family (2 wrappers + MUI Button, should be 0 wrappers)

| Component | Props vs MUI Button | What it adds |
|---|---|---|
| `AppButton` | Passes `...rest` to `Button` | Hardcodes `fontWeight: 800`, `px: 1.35`, `minHeight: 32` |
| `CapsuleButton` | Narrow API (only `children`, `startIcon`, `variant`, `onClick`, `disabled`) | Adds `whiteSpace: nowrap`, `fontSize: 12`, `fontWeight: 800` |

The global `MuiButton` theme override already sets `minHeight: 32`, `borderRadius: 8`, `textTransform: 'none'`, `boxShadow: 'none'`. The theme override uses `fontWeight: 600`. Both `AppButton` and `CapsuleButton` bump this to `fontWeight: 800`.

The only real functional difference: `CapsuleButton` uses a restricted prop interface (can't pass arbitrary `ButtonProps`). This makes it harder to compose (e.g., can't add `type="submit"` or `aria-label`).

**Plan:**
- Delete `AppButton.tsx` and `CapsuleButton.tsx`
- Replace all `<AppButton>` and `<CapsuleButton>` with MUI `<Button size="small" variant="...">` with `sx={{ fontWeight: 800 }}` if the heavier weight is specifically needed
- Update `MuiButton` theme override `fontWeight` from `600` to `700` if the heavier weight should be default

This is a search-and-replace across ~5 files.

---

### 4.3 Dialog Family (2 components, should be 1)

| Component | Purpose | Differences |
|---|---|---|
| `FormDialog` | General-purpose modal form | Title + optional subtitle + close icon, `DialogActions` footer |
| `FilterDialog` | Filter modal | Same structure, but no `subtitle`, filter icon in header, buttons inside `DialogContent` |

`FilterDialog`'s buttons being inside `DialogContent` (rather than `DialogActions`) is an unintentional inconsistency, not a design choice. The header structure is the same except for the filter icon.

**Plan:** Extend `FormDialog` with an optional `headerIcon` prop and move `FilterDialog`'s apply/reset buttons to a standard `actions` prop. Replace all `FilterDialog` usages with `FormDialog`. Delete `FilterDialog.tsx`.

`FilterDialog` is used in: `LeadsView.tsx` (for advanced filters). `ActivitiesView.tsx` already uses `FormDialog` for its advanced filters.

---

### 4.4 Tab Navigation (3 patterns, should be 2)

**Pattern A — MUI `Tabs` / `Tab`:** Used in `LeadDetailView` with a custom `sx` that overrides the tab indicator to a filled green background. Deviates from the theme's tab indicator style (`height: 3, borderRadius: 999`).

**Pattern B — `SegmentedTabs`:** Used in `ConnectorsView`, `ReportsView`, `AutomationView`. Pill-shaped button group. Correct for contained switching (e.g., sub-tabs within a page section).

**Pattern C — `FilterPill` rows acting as tabs:** Used in `LeadsView` for Board/List/All and `TasksView` for Board/List/Calendar. These are not actually tabs — they're filter pills — but they behave as tab selectors for the view mode.

**Recommended pattern assignments:**
- **Top-level page tabs** (e.g., `LeadDetailView` tabs for Activities / Tasks / Calls): Use MUI `Tabs` with the existing theme indicator style. Remove the custom `bgcolor: green` filled override in `LeadDetailView`.
- **Sub-section mode switchers** (e.g., Board vs List in `TasksView`, tab groups in `ReportsView`): Use `SegmentedTabs` consistently.
- **`FilterPill`**: Reserve for actual filter controls. Do not use as view-mode selectors.

The `LeadDetailView` tab fix is a 1-line `sx` removal.

---

### 4.5 Feedback / Notification (4 patterns, should be 2)

**Pattern A — `ToastProvider` / `useToast()`:** Auto-dismissing Snackbar at bottom-right. Used in `LeadsView.tsx`. Correct for transient success/error confirmations.

**Pattern B — `MessageAlert`:** Inline `Alert` with severity inferred from message text. Used in `UploadsView.tsx`, `ConnectorsView.tsx`, `ReportsView.tsx`. Does not auto-dismiss. Correct for persistent warnings (e.g., "worker not ready").

**Pattern C — Inline `<Typography color="error">`:** Used in `ActivitiesView.tsx:568`. Should be replaced with `MessageAlert` or `ToastProvider`.

**Pattern D — Direct `<Alert severity="...">` (not `MessageAlert`):** Used in `UploadsView.tsx:316-322` for the "worker not ready" banner and in `DashboardView.tsx`. The `UploadsView` usage is correct for a persistent contextual warning.

**Rule to standardize:**
- **Transient confirmation** (created, updated, deleted): `useToast()` from `ToastProvider`
- **Persistent contextual warning** (worker down, config missing): inline `<Alert>` or `MessageAlert`
- **Never**: raw `<Typography color="error">` for feedback

`ActivitiesView.tsx`, `SettingsView.tsx`, and `LeadDetailView.tsx` need to migrate their inline `<Typography color="error">` to `MessageAlert`.

---

### 4.6 `SectionPanel.defaultExpanded` — Unused Prop

**File:** `WorkspacePrimitives.tsx:134`

```ts
export function SectionPanel({ title, children, actions, defaultExpanded }: ...) {
  void defaultExpanded;  // ← received, immediately discarded
```

`defaultExpanded` is accepted in the prop signature but immediately voided. The component does not render an expand/collapse toggle. Either:
- Remove `defaultExpanded` from the interface (simpler)
- Implement collapsible section panels using MUI `Collapse`

Collapsible sections would be genuinely useful for `LeadDetailView` (where Activities, Tasks, Calls, Audit tabs are currently tab-switched rather than stacked) but it's a medium-effort addition. For now, remove the prop to clean up the interface.

---

### 4.7 `FilterDialog` vs `FormDialog` for Advanced Filters — Already Half-Migrated

`ActivitiesView.tsx` uses `FormDialog` for its advanced filter modal. `LeadsView.tsx` uses `FilterDialog`. They render nearly identically. This inconsistency should be resolved when `FilterDialog` is consolidated into `FormDialog`.

---

### 4.8 `CompactDataTable` vs `CrmDataTable` — Keep Both, Use `CrmDataTable` Going Forward

`CrmDataTable<T>` is the typed wrapper that provides column definitions, `render` functions, typed row data, and row actions. `CompactDataTable` is the lower-level component that accepts `string[]` columns and `ReactNode[][]` rows. 

Most views use `CompactDataTable` directly (passing pre-rendered cell arrays). This is less type-safe but works. `CrmDataTable` is defined but unused by any current view.

**Recommendation:** No change needed now. If new views are built, use `CrmDataTable`. Existing views don't need to be migrated (it would be a large, risky refactor for no user-visible benefit).

---

## Section 5 — Layout Primitives

### 5.1 `ModuleShell` — Top-level page wrapper

Used by every view. Provides `px`/`py` padding, transition animation, and renders `PageHeader`. Consistent across all views. **No changes needed.**

### 5.2 `SectionPanel` — Card-like content block

Renders a titled card with optional header actions. Used in most views. **No changes needed** except removing the unused `defaultExpanded` prop.

### 5.3 `PageFilterBar` — Filter toolbar

Horizontal strip for filter pills. Wraps to vertical on mobile. Used in `LeadsView`, `ActivitiesView`. **No changes needed.**

### 5.4 `BulkActionBar` — Selection action strip

Appears above the table when rows are selected. Used in `LeadsView`. **No changes needed.**

### 5.5 `FormDrawer` — Right-side slide-in panel

Defined in `WorkspacePrimitives.tsx:164` but not used by any current view. May be planned for lead detail or task creation. Keep; do not delete.

### 5.6 `EmptyState` and `ErrorState` — Table empty/error containers

`EmptyState` is used by `CompactDataTable` via the `emptyLabel` prop (the DataGrid `noRowsLabel`). `ErrorState` is defined but appears unused. Views render their own error states inline.

**Recommendation:** Replace inline error `<Typography>` usages with `<ErrorState message={...} />`.

---

## Section 6 — Full Consolidation Roadmap

### Phase A — Token cleanup (no visual change, low risk)

| Task | Files Changed | Effort |
|---|---|---|
| Replace `const green/line/panel/mutedPanel/textMain` in `WorkspacePrimitives.tsx` with CSS vars / `theme.palette.*` | 1 | ~30 min |
| Replace `const green/line/panel` in `CompactDataTable.tsx` | 1 | ~20 min |
| Replace `const line` in `FilterDialog.tsx`, inline hex strings in `FormDialog.tsx` | 2 | ~15 min |
| Replace `const green` in `DashboardView.tsx`, `TasksView.tsx`, `ReportsView.tsx`, inline `bgcolor` in `UploadsView.tsx` | 4 | ~30 min |
| Add `'Valid'` and `'Expired'` to `StatusChip` TONES map | 1 | ~5 min |

---

### Phase B — Component consolidation (minor API changes, low risk)

| Task | Files Changed | Effort |
|---|---|---|
| Migrate `FilterDialog` usages → `FormDialog` with `actions` prop; delete `FilterDialog.tsx` | 2 | ~1 hr |
| Migrate `AppChip` usages → `StatusChip` or `MetaChip`; delete `AppChip.tsx` | 3 | ~1 hr |
| Delete `AppButton.tsx` and `CapsuleButton.tsx`; replace usages with MUI `Button` + `sx={{ fontWeight: 800 }}` | ~5 | ~1 hr |
| Remove `defaultExpanded` from `SectionPanel` interface | 1 | ~5 min |

---

### Phase C — Feedback pattern standardization (behavioral change, medium risk)

| Task | Files Changed | Effort |
|---|---|---|
| Migrate `ActivitiesView` inline `<Typography color="error">` → `MessageAlert` | 1 | ~15 min |
| Migrate `SettingsView` inline error typography → `MessageAlert` | 1 | ~15 min |
| Migrate `LeadDetailView` inline error typography → `MessageAlert` | 1 | ~15 min |
| Migrate transient success messages in `ActivitiesView` → `useToast()` | 1 | ~30 min |

---

### Phase D — Navigation pattern fix (visual change, medium risk)

| Task | Files Changed | Effort |
|---|---|---|
| Remove custom `bgcolor: green` tab indicator override in `LeadDetailView` | 1 | ~5 min |
| Replace `FilterPill` view-mode rows in `TasksView` with `SegmentedTabs` | 1 | ~20 min |
| Replace Calendar tab with real implementation OR hide it (label "Coming soon" or remove) | 1 | ~30 min (hide) / several days (implement) |

---

## Section 7 — What NOT to Change

These things work and should not be touched:

1. **The green palette itself** — The color choices are clean and distinctive. No brand change needed.
2. **`StatusChip` CSS variable usage** — Correctly uses the token system. Keep as-is.
3. **`MetaChip`** — Simple, focused, uses tokens. Keep as-is.
4. **`CompactDataTable` / DataGrid** — The DataGrid implementation handles sorting, pagination, selection, and keyboard navigation correctly. Don't replace it.
5. **`WorkspacePrimitives` component names and API** — The names are good (`ModuleShell`, `SectionPanel`, `PageFilterBar`, `MetricCard`). Only the internal hardcoded hex constants need fixing.
6. **`ToastProvider`** — Correct implementation. Just needs to be used consistently.
7. **`FormDialog`** — The structure is correct. Just needs to absorb `FilterDialog`.
8. **`AdvancedFilterBuilder`** — Works. Don't change.
9. **`CrmShell` sidebar** — Layout and collapse behavior are solid. Dark `green[900]` sidebar is a strong identity choice.
10. **`SegmentedTabs`** — Correct design for sub-section mode switching. Keep usage in `ReportsView` and `ConnectorsView`.

---

## Section 8 — Component Register (Current State)

For reference, the complete design token and component inventory:

### Tokens
- **Color ramp:** `green[50-900]` via MUI palette + CSS `--g50`…`--g900`
- **Semantic surface:** `--crm-bg`, `--crm-paper`, `--crm-paper-soft`, `--crm-soft`, `--crm-border`, `--crm-muted`, `--crm-sidebar`, `--crm-primary`
- **Status:** `--s-new-*`, `--s-asg-*`, `--s-prog-*`, `--s-conv-*`, `--s-lost-*`
- **Radii:** `--radius-sm` (4px), `--radius-md` (8px), `--radius-pill` (9999px)
- **Typography:** 9-variant scale on `Inter`

### Layout
- `ModuleShell` — page wrapper with header
- `SectionPanel` — titled card block
- `PageFilterBar` — filter toolbar
- `BulkActionBar` — row selection action strip
- `FormDrawer` — right-side slide-in
- `EmptyState`, `ErrorState` — fallback states
- `ActionToolbar` — right-aligned action button row
- `CrmShell` — app shell (sidebar + topbar)

### Data display
- `CompactDataTable` — MUI DataGrid wrapper (column array API)
- `CrmDataTable<T>` — typed DataGrid wrapper (column definition API)
- `CompactTableSkeleton` — skeleton row loader
- `MetricCard` — KPI card with icon, value, trend, and detail

### Form / Interaction
- `FilterPill` — toggle/display chip for filter bar
- `SegmentedTabs` — pill-style tab group
- `FormDialog` — modal form
- `FilterDialog` — ⚠️ consolidate into `FormDialog`
- `FieldSelector` — column visibility picker
- `AdvancedFilterBuilder` — multi-condition filter form
- `ConfirmDialog` — destructive action confirmation
- `RowActionMenu` — kebab menu for table row actions

### Chips / Labels
- `StatusChip` — dot + label with CSS var status tones ✅
- `MetaChip` — neutral text label tag ✅
- `AppChip` — `@deprecated` — inferred color chip ⚠️ migrate + delete
- `TrendChip` — `+N%` delta display

### Feedback
- `MessageAlert` — inline severity Alert
- `ToastProvider` / `useToast()` — Snackbar system
- `PageHeader` — page title + subtitle + actions

### Button wrappers (to delete)
- `AppButton` — thin MUI Button wrapper ⚠️ delete
- `CapsuleButton` — narrow-API Button wrapper ⚠️ delete
