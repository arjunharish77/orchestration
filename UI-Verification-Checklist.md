# UI Verification Checklist

Run these before each UI milestone.

## Desktop Checks

- Open `http://127.0.0.1:3000/dashboard`.
- Verify sidebar, top bar, dashboard cards, and tables do not overlap.
- Open Leads, Lead Detail, Uploads, Automation, Connectors, Users, Reports, and Settings.
- Verify dense tables show row counts and empty states.
- Verify long labels stay inside buttons, chips, tabs, and section headers.
- Verify telephony popup and WhatsApp floating chat do not cover primary actions.

## Mobile Checks

Use browser responsive mode at `390x844`.

- Verify sidebar collapse is usable.
- Verify filters and forms stack vertically.
- Verify tables scroll horizontally instead of shrinking text into unreadable columns.
- Verify drawers, popups, and floating chat fit within the viewport.

## Screenshot Milestones

Capture screenshots for:

- Dashboard
- Leads list
- Lead detail
- Automation builder
- Connectors
- Reports
- Settings

Store milestone screenshots outside source control unless they are intentionally used as fixtures.

## Performance Checks

Use browser DevTools Performance or Lighthouse.

- Initial app load should not show a blank page after authentication.
- Leads table with 50 rows should remain responsive while filtering.
- Reports page should render without long main-thread pauses.
- Automation builder should allow node selection, clone, and delete without layout jumps.
