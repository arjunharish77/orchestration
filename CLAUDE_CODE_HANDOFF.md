# Unnatify CRM — Frontend Refactor Handoff

> Audience: **Claude Code** running against the `frontend/` Next.js + MUI v6 codebase.
> Goal: ship the visual + UX refactor described in *Unnatify CRM — Design Critique.html* without changing any backend contracts, route paths, or component public APIs.
> Constraint: **Use only existing color tokens** (`green[50]`–`green[900]`, `#f8fcf8`, `#e0ede0`, `#162716`, `#526252`). No new fonts. No new dependencies.

---

## 0. Working agreement

- Branch per phase (`refactor/01-type-ramp`, `refactor/02-status-chips`, …). Each phase below is a self-contained PR.
- After each phase, run `pnpm test` and `node test/architecture-smoke.mjs`. Do not regress.
- Public exports of every component must keep the same prop shape. If a prop becomes obsolete, accept it and ignore it (mark `@deprecated` in JSDoc). No breaking renames.
- Search-and-replace is fine for token values; never search-and-replace JSX structure without reading the file.
- All numeric literals for color must be removed from leaf components and replaced with theme tokens or the CSS variables already declared in `MuiCssBaseline.styleOverrides[':root']`.

---

## 1. Token additions to `frontend/src/theme/theme.ts`

Extend (do NOT replace) the existing palette and CssBaseline `:root` block.

```ts
// Add alongside green[]
const slate = { 50: '#eef3fa', 200: '#d6e3f0', 600: '#1c4980', 800: '#0f2f55' };
const amber = { 50: '#fbf3df', 200: '#ecd9a4', 600: '#b07a16', 800: '#6f4a08' };
const rose  = { 50: '#fbeaea', 200: '#f0c4c4', 600: '#a23a3a', 800: '#6a1f1f' };
```

These are **status-only** tokens. Do not use them for chrome, surfaces, or accents anywhere outside `StatusChip`, `MetaChip`, and form-validation states. Add them under `palette.info`, `palette.warning`, `palette.error` mains so MUI's default error/warning components inherit correctly.

In `MuiCssBaseline.styleOverrides[':root']` add:

```css
--s-new-bg: var(--g50);     --s-new-fg: var(--g700);     --s-new-dot: var(--g500);
--s-asg-bg: #eef3fa;        --s-asg-fg: #1c4980;         --s-asg-dot: #1c4980;
--s-prog-bg: #fbf3df;       --s-prog-fg: #b07a16;        --s-prog-dot: #b07a16;
--s-conv-bg: var(--g50);    --s-conv-fg: var(--g800);    --s-conv-dot: var(--g700);
--s-lost-bg: #fbeaea;       --s-lost-fg: #a23a3a;        --s-lost-dot: #a23a3a;
--radius-sm: 4px;           --radius-md: 8px;            --radius-pill: 9999px;
--ink: var(--g900);         --muted: #526252;            --line-2: #cfe1cf;
```

---

## 2. Phase plan

### Phase 01 — Typography ramp (½ day)

**File:** `frontend/src/theme/theme.ts`

Replace the `typography` block:

```ts
typography: {
  fontFamily: 'Inter, Arial, sans-serif',
  h1: { fontSize: 40, fontWeight: 800, letterSpacing: '-0.022em', lineHeight: 1.05 },
  h2: { fontSize: 32, fontWeight: 800, letterSpacing: '-0.018em', lineHeight: 1.1 },
  h3: { fontSize: 24, fontWeight: 800, letterSpacing: '-0.012em', lineHeight: 1.15 },
  h4: { fontSize: 20, fontWeight: 800, letterSpacing: '-0.008em', lineHeight: 1.2 },
  h5: { fontSize: 16, fontWeight: 700, letterSpacing: 0,            lineHeight: 1.25 },
  h6: { fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase' },
  body1: { fontSize: 14, fontWeight: 500, lineHeight: 1.5 },
  body2: { fontSize: 12, fontWeight: 500, lineHeight: 1.5 },
  caption: { fontSize: 11, fontWeight: 500, color: '#526252' },
  button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
}
```

**Repo-wide search-and-fix:**

- `fontWeight={900}` → `fontWeight={800}` for headings, `fontWeight={700}` for emphasis labels, delete entirely on body text.
- `fontSize: 11.5` → `fontSize: 12`. `fontSize: 12.5` → `fontSize: 13`. `fontSize: 13.5` → `fontSize: 14`.
- Drop bespoke `letterSpacing: 0` overrides — they're now defaults.

Validate visually against the dashboard, leads list, and lead detail. Body text in tables should be 14px not 12.5px.

### Phase 02 — Radius vocabulary (¼ day)

**Allowed values:** `4` (chips, inputs), `8` (cards, buttons, panels), `9999` (avatars, full pills).
**Disallow:** `1, 1.5, 1.6, 2, 6, 10, 12, 16` for `borderRadius`.

Search for `borderRadius:` and `borderRadius=` and reduce to the three. The most common offenders:

- `CrmShell.tsx` mobile alert (`borderRadius: 1.5`) → `8`.
- `WorkspacePrimitives.tsx` `SectionPanel` `borderRadius: 1.5` → `8`; `SegmentedTabs` `borderRadius: 2` → `8`, inner buttons `1.6` → `4`.
- `DashboardView.tsx` cards `borderRadius: 1` → `8`.
- `CompactDataTable.tsx` outer `borderRadius: 1.5` → `8`; inner `Skeleton` `1.5` → `4`.
- Search bar in `CrmShell` `borderRadius: 4` is fine but standardize all input-like surfaces to `8`. The bar should become `9999` (a true pill) to match the search affordance.

### Phase 03 — Status chips (1 day)

**New file:** `frontend/src/components/common/StatusChip.tsx`

```tsx
'use client';
import { Box, Stack, Typography } from '@mui/material';

export type LeadStatus = 'New' | 'Assigned' | 'In Progress' | 'Converted' | 'Lost';

const TONES: Record<LeadStatus, { bg: string; fg: string; dot: string }> = {
  'New':         { bg: 'var(--s-new-bg)',  fg: 'var(--s-new-fg)',  dot: 'var(--s-new-dot)' },
  'Assigned':    { bg: 'var(--s-asg-bg)',  fg: 'var(--s-asg-fg)',  dot: 'var(--s-asg-dot)' },
  'In Progress': { bg: 'var(--s-prog-bg)', fg: 'var(--s-prog-fg)', dot: 'var(--s-prog-dot)' },
  'Converted':   { bg: 'var(--s-conv-bg)', fg: 'var(--s-conv-fg)', dot: 'var(--s-conv-dot)' },
  'Lost':        { bg: 'var(--s-lost-bg)', fg: 'var(--s-lost-fg)', dot: 'var(--s-lost-dot)' },
};

export function StatusChip({ status }: { status: string }) {
  const tone = TONES[status as LeadStatus] ?? TONES['New'];
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}
      sx={{ height: 22, px: 1, borderRadius: '4px',
            bgcolor: tone.bg, color: tone.fg, border: `1px solid ${tone.bg}`,
            display: 'inline-flex', flexShrink: 0 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tone.dot }} />
      <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{status}</Typography>
    </Stack>
  );
}
```

**New file:** `frontend/src/components/common/MetaChip.tsx` — neutral g50/g700 pill, no dot. Use for tags like `CSV`, `Mumbai`, `Updated 12:04`.

**New file:** `frontend/src/components/common/TrendChip.tsx` — accepts `value: number`, shows `+12%` in green or `-3%` in rose. Only used in dashboard metrics.

**Migration:**

- In `LeadsView.tsx`, `DashboardView.tsx`, `LeadDetailView.tsx`, `TasksView.tsx`, `ActivitiesView.tsx`: replace `<AppChip label={status} />` (where the value is a lead status) with `<StatusChip status={status} />`.
- For badges in KPI cards (`+12%`, `Live`, `CSV`) replace with `<TrendChip>` or `<MetaChip>`.
- Keep `AppChip` exported for now but mark `@deprecated — use StatusChip / MetaChip / TrendChip`.

### Phase 04 — KPI tiles (½ day)

**File:** `frontend/src/features/crm/views/DashboardView.tsx`, function `DashboardMetricCard`.

Strip:

- `bgcolor: '#f4fbf4'` → `'background.paper'`
- The `&:before` blob — delete entirely.
- The icon tile (`Box sx={{ ... bgcolor: '#e6f4e6' ... }}>{visual.icon}`) — delete.
- The decorative `<AppChip label={visual.badge} />` — delete.

Add:

- Prop `trend?: number[]` for sparkline data (12 weekly points).
- Inline `<svg>` sparkline using `var(--g600)` stroke and `rgba(45,106,45,0.10)` fill. 100×32, `preserveAspectRatio="none"`.
- For overdue/error metrics (e.g. "Open Tasks" with `7 missed`), color the value in `var(--bad)` and replace sparkline with a 7-bar mini-histogram.

Backend already returns the metric tuple; just add an optional `trend: number[]` field server-side later. Until then, accept `undefined` and skip the spark.

### Phase 05 — Sidebar contrast & grouping (½ day)

**File:** `frontend/src/components/layout/CrmShell.tsx`

- Inactive item color: `#d8ead8` → `#91c091` (i.e. `green[300]`).
- Inactive font weight: `500` → `500` (unchanged), but selected weight `800` (currently `800` ✓).
- Add a `groups: { label: string; items: ShellViewKey[] }[]` const above `navItems`:
  ```ts
  const navGroups = [
    { label: 'Pipeline', keys: ['dashboard','leads','activities','tasks'] },
    { label: 'Operations', keys: ['uploads','automation','reports','settings'] },
  ];
  ```
- Render group label as a small caps eyebrow in `#65a265` between sections.
- Add a 3px `green[400]` left rail to the active item:
  ```tsx
  position: 'relative',
  '&::before': selected ? {
    content: '""', position: 'absolute', left: -8, top: 6, bottom: 6,
    width: 3, borderRadius: 2, background: 'var(--g400)',
  } : undefined,
  ```
- Add optional numeric badge: extend `navItems` with `count?: number`, render right-aligned mono badge next to label. Wire `count` from a new `/me/queue-counts` endpoint or an existing dashboard payload field if present; otherwise leave `undefined`.

### Phase 06 — Compact data table density (½ day)

**File:** `frontend/src/components/common/CompactDataTable.tsx`

- `rowHeight={40}` → `rowHeight={44}`.
- Cell `fontSize: '0.78rem'` → `'0.875rem'` (14px).
- Column header `fontSize: '0.64rem'` → `'0.7rem'` (kept as caps eyebrow).
- Primary cell color: `'primary.main'` → `'text.primary'` (i.e. ink). Keep `fontWeight: 700`.
- Hover color: `alpha(primary.main, 0.045)` → `alpha(primary.main, 0.05)` is fine; selected row stays `0.08`.
- Header bgcolor `#eef7ee` → `#fafdfa` (less green so the green DOES mean something on the rows).

### Phase 07 — Leads table score column + actions (1 day)

**File:** `frontend/src/features/crm/views/leads/lead-table-columns.ts` and `LeadsView.tsx`

- Add a `score` field to `LeadRow` (already returned by API as `lead.score`?). Confirm; if missing, ask BE for `score: number 0–100`.
- Add a column renderer:
  ```tsx
  case 'score': return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'var(--line)', overflow: 'hidden' }}>
        <Box sx={{ width: `${score}%`, height: '100%',
          bgcolor: score >= 70 ? 'var(--g600)' : score >= 40 ? 'var(--g500)' : 'var(--g300)' }} />
      </Box>
      <Typography sx={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 11, fontWeight: 700, color: score >= 40 ? 'var(--g700)' : 'var(--muted)' }}>{score}</Typography>
    </Stack>
  );
  ```
- Add `'score'` to `defaultVisibleLeadFields` after `'status'`.
- `LeadRowActionsMenu` — keep, just collapse trailing icons; the new score replaces the visual weight that the icon column was carrying.


### Phase 09 — Module-by-module visual sweep (1 day per pair)

Apply the new tokens, type, chips, and density across:

| Module       | Hot spot                                             |
|--------------|------------------------------------------------------|
| Activities   | Activity-type chips → `MetaChip`; row icons inherit. |
| Tasks        | Priority chip → `StatusChip` with mapping (High → progress tone, Overdue → lost tone). |
| Uploads      | Stage chip → `StatusChip` (`Queued/Processing/Done/Failed`). Progress bar: `var(--g600)` only when running, `var(--bad)` when failed. |
| Automation   | Run rows in `RunHistory.tsx` keep their progress bar; replace status pill with `StatusChip`. The flow canvas is fine — do not touch node visual until a follow-up phase. |
| Reports      | KPI grid in `ReportMetricGrid.tsx` → adopt new KPI tile from Phase 04. |
| Connectors   | Health badges → `StatusChip`. Tabs → `SegmentedTabs` with new radii. |
| Users        | Role chip → `MetaChip`; status (`Active/Suspended/Invited`) → `StatusChip`. |
| Settings     | Already minimal; just adopt new type ramp. |

### Phase 10 — Lint the system (½ day)

Add `stylelint` (or extend ESLint with a custom rule) that:

- Disallows hex colors except in `theme.ts` and the `:root` block of `MuiCssBaseline`.
- Disallows `borderRadius` literals not in `[4, 8, 9999]`.
- Disallows `fontWeight` literals not in `[500, 600, 700, 800]`.

Plug into `pnpm lint` and CI.

---

## 3. Concrete file diff list

Files that **will** change (touch list, no diffs included — Claude Code can read each):

- `frontend/src/theme/theme.ts` *(phases 01, 02, 03)*
- `frontend/src/components/common/AppChip.tsx` *(deprecate)*
- `frontend/src/components/common/StatusChip.tsx` *(new)*
- `frontend/src/components/common/MetaChip.tsx` *(new)*
- `frontend/src/components/common/TrendChip.tsx` *(new)*
- `frontend/src/components/common/CompactDataTable.tsx` *(phase 06)*
- `frontend/src/components/common/WorkspacePrimitives.tsx` *(phases 01, 02)*
- `frontend/src/components/common/PageHeader.tsx` *(phase 01)*
- `frontend/src/components/layout/CrmShell.tsx` *(phase 05)*
- `frontend/src/features/crm/views/DashboardView.tsx` *(phase 04, 03)*
- `frontend/src/features/crm/views/LeadsView.tsx` *(phase 07, 03)*
- `frontend/src/features/crm/views/leads/lead-table-columns.ts` *(phase 07)*
- `frontend/src/features/crm/views/LeadDetailView.tsx` *(phase 08)*
- `frontend/src/features/crm/views/lead-detail/*` *(phase 08, new files)*
- `frontend/src/features/crm/views/{Tasks,Activities,Uploads,Reports,Users,Connectors,Automation}View.tsx` *(phase 09, chip migration)*
- `frontend/src/features/crm/views/automation/RunHistory.tsx` *(phase 09)*
- `frontend/src/features/crm/views/reports/ReportMetricGrid.tsx` *(phase 09)*

Files that **must not** change in this refactor:

- Any file under `frontend/src/lib/` (API + auth + format).
- `frontend/src/features/crm/types/lead.ts`.
- All `*/error.tsx`, `*/loading.tsx` route files (next.js plumbing).
- `frontend/test/architecture-smoke.mjs` — your sweep should leave the smoke test green.

---

## 4. Acceptance criteria

A reviewer should be able to verify on a running dev build:

1. **Type:** in DevTools, `<Typography variant="h2">` computes to 32px / 800; `body1` is 14px / 500; no element shows `font-weight: 900`.
2. **Radius:** `getComputedStyle` of any card, button, or input returns one of `4px`, `8px`, or a fully rounded value.
3. **Chips:** "Lost" lead row shows a rose chip; "Converted" shows green; "Assigned" shows slate-blue; "+12%" tile delta uses `TrendChip`.
4. **Sidebar:** on `/leads`, the "Leads" item has a 3px green left rail; "Pipeline" / "Operations" eyebrows are visible; inactive items render at `#91c091`.
5. **Dashboard:** each KPI tile shows its value at 30px and a sparkline OR a mini-histogram OR a numeric breakdown — never a circle, blob, or icon tile.
6. **Lead detail:** at ≥1280px width, the layout is three columns (`280 / 1fr / 320`); identity panel sticks; right rail sticks; middle scrolls.
7. **Smoke test:** `node frontend/test/architecture-smoke.mjs` passes.
8. **Lint:** `pnpm lint` passes including the new color/radius/weight rules.

---

## 5. Out of scope (for future tickets)

- Automation flow canvas redesign (the node graph itself).
- Dark mode. The theme is `mode: 'light'` and stays so.
- New iconography. We are reusing MUI outlined icons.
- Replacing DataGrid with a custom virtualized table. Not now.
- Mobile redesign past current responsive breakpoints.

---

## 6. Visual reference

Open `Unnatify CRM — Design Critique.html` (in this project) at 1920×1080. Slides 03–08 contain the side-by-side before/after for type, KPI tiles, status chips, sidebar, leads table, and lead detail. Use those as the visual source of truth — if a value disagrees with this doc, the deck wins.
