# UI Reference Comparison And Improvement Plan

This document compares the current Unnatify CRM frontend in `commcrm` with the reference CRM frontend available locally at `../crm/crm`.

Scope:

- UI structure across all visible pages
- Route and component organization
- Table, filter, form, modal, settings, and detail-page patterns
- What should be copied as a pattern
- What should not be copied because it conflicts with Unnatify requirements
- Practical improvements for the current app

Important rule: the reference repo should be used as a UI and structure benchmark only. The current app must keep Unnatify-specific requirements: CSV-only uploads, MCUBE telephony, 10-digit phone handling, assignment engine, automation nodes, configurable fields/dispositions, WhatsApp and voicebot provisions, permission templates, operations login, Resend email, and the current deployment direction.

## 1. Overall Verdict

The current app is now much closer to the reference repo than before because it has real routes and many feature views have been split out. However, the reference repo still has a more mature frontend system.

Reference repo strengths:

- Route-backed pages with dedicated page-specific components.
- Reusable layout, grid, dialog, skeleton, empty/error, filter, and preview components.
- Cleaner settings section with a dedicated settings layout and route-level settings pages.
- More consistent table toolbars, actions, row density, and visual rhythm.
- Better separation between page state, UI components, dialogs, and forms.

Current app strengths:

- Better aligned to Unnatify business requirements.
- Cleaner visible module set: Dashboard, Leads, Activities, CSV Uploads, Tasks, Automation, Reports, Settings.
- Has Unnatify-specific modules that the reference repo does not: MCUBE, CSV upload history/result CSV, lead assignment as automation node, WhatsApp/voicebot provisions, operations login, email OTP/2FA provisions.
- Route coverage exists for the main app pages and settings pages.

Main improvement direction:

- Keep Unnatify domain logic.
- Continue extracting large view files into smaller page sections/components.
- Standardize tables, filters, forms, dialogs, chips, and page headers so the app feels like one system.

## 2. Route Structure Comparison

### Reference Repo

Reference routes are nested under `src/app/dashboard`.

Examples:

- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/leads/page.tsx`
- `src/app/dashboard/leads/[id]/page.tsx`
- `src/app/dashboard/activities/page.tsx`
- `src/app/dashboard/automations-v2/page.tsx`
- `src/app/dashboard/automations-v2/[id]/page.tsx`
- `src/app/dashboard/reports/page.tsx`
- `src/app/dashboard/settings/layout.tsx`
- `src/app/dashboard/settings/users/page.tsx`
- `src/app/dashboard/settings/teams/page.tsx`
- `src/app/dashboard/settings/permission-templates/page.tsx`
- `src/app/dashboard/settings/integrations/page.tsx`

The reference repo has deeper route ownership. Pages own their loading, data fetch, dialog state, and route-specific UI.

### Current App

Current routes exist under `frontend/src/app`.

Examples:

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/leads/page.tsx`
- `frontend/src/app/leads/[id]/page.tsx`
- `frontend/src/app/activities/page.tsx`
- `frontend/src/app/uploads/page.tsx`
- `frontend/src/app/tasks/page.tsx`
- `frontend/src/app/automation/page.tsx`
- `frontend/src/app/reports/page.tsx`
- `frontend/src/app/settings/page.tsx`
- `frontend/src/app/settings/users/page.tsx`
- `frontend/src/app/settings/connectors/page.tsx`
- `frontend/src/app/settings/fields/page.tsx`
- `frontend/src/app/settings/lists/page.tsx`
- `frontend/src/app/settings/uploads/page.tsx`
- `frontend/src/app/settings/security/page.tsx`

Current app routes still mostly pass through `CrmRoute` and `CrmApp`. This is acceptable for shared auth/shell handling, but the reference repo is cleaner because pages are more independent.

### Improvement

- Keep `CrmApp` as a thin authenticated shell/data coordinator only.
- Gradually move page-specific data loading into route views.
- Eventually let each route load only its own data instead of relying on a shared workspace loader.
- Keep `CrmRoute` small and avoid adding page-specific logic there.

## 3. Component Structure Comparison

### Reference Repo

The reference repo has mature component folders:

- `components/common/standard-data-grid.tsx`
- `components/common/standard-dialog.tsx`
- `components/common/empty-state.tsx`
- `components/common/error-state.tsx`
- `components/common/skeletons.tsx`
- `components/common/record-preview.tsx`
- `components/filters/advanced-filter-modal.tsx`
- `components/bulk-actions/bulk-toolbar.tsx`
- `components/layout/NavigationDrawer.tsx`
- `components/layout/header.tsx`
- `components/ui-mui/m3-components.tsx`

Page folders also contain route-specific subcomponents:

- `dashboard/leads/columns.tsx`
- `dashboard/leads/create-lead-dialog.tsx`
- `dashboard/leads/edit-lead-dialog.tsx`
- `dashboard/leads/lead-form.tsx`
- `dashboard/leads/mobile-list.tsx`
- `dashboard/activities/columns.tsx`
- `dashboard/activities/activity-form.tsx`
- `dashboard/settings/custom-fields/create-custom-field-dialog.tsx`
- `dashboard/settings/teams/create-team-dialog.tsx`

### Current App

Current app has improved structure:

- `components/common/CompactDataTable.tsx`
- `components/common/FieldSelector.tsx`
- `components/common/FilterDialog.tsx`
- `components/common/RouteState.tsx`
- `components/common/ToastProvider.tsx`
- `components/common/WorkspacePrimitives.tsx`
- `components/layout/CrmShell.tsx`
- `features/crm/CrmApp.tsx`
- `features/crm/CrmRoute.tsx`
- `features/crm/views/*.tsx`
- `features/crm/components/LeadDetailParts.tsx`
- `features/crm/components/TelephonyPopupLayer.tsx`
- `features/crm/views/connectors/TelephonyConnectorPanel.tsx`

But some view files remain too large:

- `LeadDetailView.tsx`
- `LeadsView.tsx`
- `SettingsView.tsx`
- `UsersView.tsx`
- `ReportsView.tsx`
- `TelephonyConnectorPanel.tsx`

### Improvement

- Split `LeadsView` into `LeadCreatePanel`, `LeadFilters`, `LeadAdvancedFilters`, `LeadTable`, and `lead-table-columns`.
- Split `LeadDetailView` into tab components: `LeadOverviewTab`, `LeadActivitiesTab`, `LeadDispositionsTab`, `LeadTasksTab`, `LeadCallsTab`, `LeadAutomationHistoryTab`, `LeadAuditTab`, `LeadCustomFieldsTab`, `LeadNotesTab`.
- Split `SettingsView` into route-section components: `SettingsFieldsPage`, `SettingsListsPage`, `SettingsUploadHistoryPage`, `SettingsSecurityPage`.
- Split `UsersView` into `UsersTab`, `TeamsTab`, `SalesGroupsTab`, and `PermissionsTab`.
- Split `TelephonyConnectorPanel` into `TelephonyEndpointCards`, `ClickToCallConfigPanel`, and `AgentPopupConfigPanel`.

## 4. Layout And Navigation Comparison

### Reference Repo

The reference layout has:

- A persistent dashboard shell.
- Separate navigation drawer and header components.
- Route-aware active states.
- Better top-header hierarchy.
- Better spacing between sidebar, page header, and content.
- Motion wrappers for page transitions.
- Settings has its own layout with a settings sidebar.

### Current App

Current app has:

- `CrmShell` with sidebar, topbar, search, notification icon, profile area, logout.
- Compact module navigation.
- Better sidebar icons after recent changes.
- Settings has a dedicated frame and sidebar-like route list.

Current app is cleaner than before, but it still feels less refined because:

- Some pages use their own local chip/table styles.
- Page headers and action placement are not fully standardized.
- Settings and connector sections still have many dense inline controls.
- Some pages still look like functional admin screens rather than polished CRM screens.

### Improvement

- Create one `PageHeader` component used by every route.
- Create one `PageActionBar` pattern for search, filters, export, create buttons.
- Create one shared `AppChip`/status chip component and remove local duplicate chip implementations.
- Keep main sidebar minimal, but make settings sidebar more like the reference: icon + label, route-aware, compact, clear grouping.

## 5. Table And List UI Comparison

### Reference Repo

The reference uses `StandardDataGrid`, based on MUI DataGrid, with:

- Columns button.
- Filter button.
- Density selector.
- Export.
- Selection model.
- Select-all-filtered behavior.
- Consistent row height.
- Consistent footer.
- Better loading/empty state integration.
- Bulk action toolbar.

### Current App

The current app has:

- `CompactDataTable`.
- `CrmDataTable`.
- Field selector on several pages.
- Search/filter controls on leads and activities.
- Pagination support.

But there are still gaps:

- Several views still define local `DataTable` functions instead of using `CompactDataTable`/`CrmDataTable`.
- Table toolbar behavior is not identical everywhere.
- Export, filters, density, search, and field selector are not uniformly present.
- Bulk actions are not consistently implemented.
- Some table columns are built inline inside the view file instead of a separate columns module.

### Improvement

- Replace all local `DataTable` functions with `CrmDataTable`.
- Move common table controls into `TableToolbar`.
- Standardize table top area in this order: search, quick filters, advanced filter, columns, density, export.
- Keep pagination centered at the bottom everywhere.
- Add selected-row bulk-action behavior where useful: leads, tasks, upload rows, reports.

## 6. Filters Comparison

### Reference Repo

Reference repo has `AdvancedFilterModal` with grouped conditions:

- Groups.
- AND/OR logic.
- Multiple conditions.
- Field selector.
- Operator selector.
- Dialog-based filtering.

### Current App

Current app has:

- Filter dialogs.
- Some quick filters.
- Advanced lead conditions.
- Dynamic custom field inclusion in some lists.

But the filtering experience is not yet fully unified:

- Operators differ across pages.
- Dropdown fields are not consistently rendered as dropdowns.
- Date fields need date-specific operators everywhere.
- Custom fields should be available consistently in Leads, Activities, Tasks, Reports, assignment, and automation-related filters.

### Improvement

- Create shared field metadata helpers for all filterable modules.
- Use field type to decide operators:
  - Text: contains, equals, starts with, ends with, empty, not empty.
  - Number: equals, greater than, less than, between, empty.
  - Date/datetime: on, before, after, between, today, yesterday, this week, this month.
  - Dropdown: is, is not, in, not in.
  - Boolean: is true, is false.
- Use dropdown inputs when fields have options.
- Use date inputs/date pickers for date fields.
- Use a single `AdvancedFilterBuilder` across all list pages.

## 7. Page-by-Page UI Comparison

### Dashboard

Reference:

- More polished dashboard card layout.
- Better widget structure.
- More visual hierarchy.
- Better use of chart/stat components.

Current:

- Shows core metrics and recent lead/automation/connectors.
- Useful, but less polished and still table-heavy.

Improve:

- Convert metrics to a reusable compact stat-card component.
- Add clearer sections: Lead Health, Upload Health, Automation Health, Connector Health.
- Use compact charts only where they help, not decoration.

### Leads

Reference:

- Strong lead list with DataGrid, avatar, clickable lead name, action icons, create/edit dialogs, advanced filter modal, and bulk actions.
- Has quick preview drawer, but user explicitly said quick preview is not required.

Current:

- Keeps Unnatify lead model and custom fields.
- Has route-backed lead detail.
- Has filters, field selection, and create behavior.

Improve:

- Keep no quick preview.
- Improve create lead as modal or dedicated compact panel.
- Move columns to a separate file.
- Make every custom field selectable in columns and filters.
- Add row actions menu with View, Edit, Assign, Add Task, Add Disposition where applicable.

### Lead Detail

Reference:

- Clean detail route.
- Good split between profile/sidebar and tabbed detail content.
- Better visual rhythm.

Current:

- Has required tabs: overview, activities, dispositions, tasks, calls, automation history, audit, custom fields, notes.
- Domain coverage is stronger than reference.
- Some controls are still too dense and inline.

Improve:

- Extract each tab into a separate component.
- Use consistent section cards with compact rows.
- Move create task/activity/disposition into modal or side panel.
- Show labels/names instead of IDs everywhere.
- Keep all dropdown fields as dropdown controls.

### Activities

Reference:

- Dedicated activity list with columns, mobile list, create activity dialog, and stats.

Current:

- Correctly has list-only activity queues by type.
- Activity type is URL-driven with 3-digit codes.
- Lead name opens lead.
- No activity detail route, as required.

Improve:

- Standardize table toolbar.
- Add quick filters and advanced filter modal.
- Ensure activity custom fields are available in field selector and filters.
- Make activity-type dropdown route-driven and persistent.

### CSV Uploads

Reference:

- Has import/integration concepts but not the exact Unnatify CSV upload requirement.

Current:

- Better aligned: CSV-only uploads, upload history, row-level status, result CSV, original CSV.

Improve:

- Use a cleaner upload modal/panel.
- Add upload progress/skeleton.
- Make upload summary more scannable with status cards.
- Ensure failed row details open in a modal, not inline if the list becomes crowded.

### Tasks

Reference:

- Task/activity handling is more polished visually through activity views.

Current:

- Has task list and lead-linked tasks.
- Actions are functional but basic.

Improve:

- Add quick filters: due today, overdue, assigned to me, priority.
- Add advanced filters.
- Use lead name consistently instead of IDs.
- Add status update menu and bulk close/reschedule where useful.

### Automation

Reference:

- Has automation list/editor routes and workflow execution UI.
- More componentized around automation-specific screens.

Current:

- Better aligned to Unnatify automation needs: assignment engine node, API call node, WhatsApp, voicebot, exit conditions.
- UI still feels like a dense configuration screen.

Improve:

- Split automation into `AutomationList`, `AutomationEditor`, `NodePalette`, `NodeInspector`, and `RunHistory`.
- Make editor route-backed later, for example `/automation/[id]`.
- Use a proper flow canvas library or a structured node canvas for if/else and multi-branch logic.
- Make API call node variable mapping dynamic from connector body variables.

### Reports

Reference:

- Has more route-style report pages and cleaner grids.

Current:

- Has reports for uploads, automation, calls/messages, journey, audit.
- Functional but visually uneven.

Improve:

- Create report cards and report tables as reusable components.
- Move large report sections into route tabs or subcomponents.
- Add date range, team, status, and connector filters consistently.
- Add export history status and download actions as row actions.

### Settings

Reference:

- Strongest area of the reference repo.
- Dedicated settings layout.
- Settings sidebar with route-backed pages.
- Page-specific create dialogs.
- Cleaner forms grouped by purpose.
- Permission template modal is much richer.

Current:

- Settings is route-backed and grouped by Users & Access, Connectors, Fields & Disposition, List Values, Upload History, Security.
- Correctly avoids exposing unnecessary modules.
- Stronger Unnatify-specific connector/settings behavior.

Improve:

- Convert each settings tab into its own file and page-like component.
- Use create/edit modals for users, teams, sales groups, permission templates, custom fields, disposition fields.
- Improve permission template UI to match reference style: left module list, right permissions matrix, field-level visible/editable/hidden/masked controls.
- Replace inline forms with compact “Add” buttons opening dialogs.
- Keep only required settings modules visible.

### Connectors

Reference:

- Has integrations and telephony examples, but not as specific to MCUBE requirements.

Current:

- Stronger MCUBE detail: lead route API, agent popup API, call log complete API, 10-digit phone rule, click-to-call data template, popup config.
- WhatsApp and voicebot provisions exist.

Improve:

- Further split connector tabs:
  - `ApiCallConnectorPanel`
  - `WhatsAppConnectorPanel`
  - `VoicebotConnectorPanel`
  - `ConnectorLogsPanel`
- Make connector forms save real configuration where currently some fields are placeholders.
- Use dynamic variable mapping UI for API body variables.

## 8. UI System Differences

### Reference Repo

Uses consistent:

- Border radius.
- Table row height.
- Typography weights.
- Card spacing.
- Buttons with icons.
- Dialog sizes.
- Page-level motion.
- Empty/loading/error states.

### Current App

Current app has:

- Consistent green palette in many places.
- Compact tables.
- Improved sidebar icons.
- Skeletons and error states exist.

Still inconsistent:

- Some local tables are hand-rolled.
- Some chips are duplicated and styled differently.
- Some forms are inline, others are modal-like.
- Some pages have many visible controls at once.
- Some pages need better spacing and alignment.

### Improvement

- Create `AppChip`, `AppButton`, `PageHeader`, `TableToolbar`, `SectionCard`, `FormDialog`, and `ConfirmDialog`.
- Use these everywhere.
- Remove duplicate local `AppChip` and `DataTable` implementations.
- Keep compact density as default.
- Use subtle animations only for route/content entry, modal open/close, row hover, and skeleton transitions.

## 9. Current App Files That Should Be Split Next

Highest priority:

- `frontend/src/features/crm/views/LeadDetailView.tsx`
- `frontend/src/features/crm/views/LeadsView.tsx`
- `frontend/src/features/crm/views/SettingsView.tsx`
- `frontend/src/features/crm/views/UsersView.tsx`
- `frontend/src/features/crm/views/ReportsView.tsx`
- `frontend/src/features/crm/views/connectors/TelephonyConnectorPanel.tsx`

Recommended next extraction order:

1. Extract shared `AppChip` and replace local chip copies.
2. Extract shared lightweight table wrapper or move all local tables to `CrmDataTable`.
3. Split `LeadDetailView` tabs into separate components.
4. Split `SettingsView` route sections into separate components.
5. Split `UsersView` tabs into separate components.
6. Split connector panels further.
7. Move page-specific columns into `columns.tsx` files where useful.

## 10. Things Not To Copy From Reference Repo

Do not copy these into the visible Unnatify app unless requirements change:

- Opportunities.
- Forms as a full separate module.
- Lists as a main sidebar module.
- Generic CRM pipeline pages.
- Quick preview drawer.
- Reference repo’s lead/opportunity assumptions.
- Reference repo’s telephony assumptions if they conflict with MCUBE requirements.
- Any extra admin modules not required by Unnatify.

Use these from the reference as patterns only:

- Settings layout structure.
- DataGrid/table polish.
- Dialog-based create/edit flows.
- Advanced filter builder.
- Empty/loading/error state components.
- Permission template UI structure.
- Cleaner page header/action layout.

## 11. Practical Improvement Checklist

- [x] Replace duplicate local `AppChip` implementations with one shared component.
- [x] Replace duplicate local `DataTable` implementations with `CrmDataTable`.
- [x] Add a shared `PageHeader` and use it across every page.
- [x] Add a shared `TableToolbar` with search, quick filters, advanced filters, columns, density, export.
- [x] Make lead filters field type-aware with backend-supported operators.
- [x] Make dropdown fields render as dropdowns in lead filters and core configurable forms.
- [x] Make date/datetime fields render with date-specific filter operators in the shared advanced filter builder.
- [x] Ensure custom fields are available in lead, activity, user, and lead-detail field selectors/filters.
- [x] Split lead detail tabs into separate files.
- [x] Split settings sections into separate files.
- [x] Split users/access tabs into separate files.
- [x] Split connector tabs into separate files.
- [x] Improve Settings permission template UI using the reference modal pattern.
- [x] Move create/edit actions into modals where inline forms clutter pages.
- [x] Add consistent empty/error/skeleton states across list pages through shared table skeletons, route loading/error files, and shared empty/error primitives.
- [x] Keep visible sidebar modules limited to required Unnatify modules.

## 12. Suggested Target Structure

Suggested frontend structure for the current app:

```text
frontend/src/features/crm/
  CrmApp.tsx
  CrmRoute.tsx
  components/
    LeadDetailParts.tsx
    TelephonyPopupLayer.tsx
  shared/
    AppChip.tsx
    PageHeader.tsx
    TableToolbar.tsx
    FormDialog.tsx
    field-metadata.ts
  views/
    DashboardView.tsx
    leads/
      LeadsView.tsx
      LeadTable.tsx
      LeadCreateDialog.tsx
      LeadFilters.tsx
      lead-columns.tsx
    lead-detail/
      LeadDetailView.tsx
      LeadOverviewTab.tsx
      LeadActivitiesTab.tsx
      LeadDispositionsTab.tsx
      LeadTasksTab.tsx
      LeadCallsTab.tsx
      LeadAutomationTab.tsx
      LeadAuditTab.tsx
      LeadCustomFieldsTab.tsx
      LeadNotesTab.tsx
    activities/
      ActivitiesView.tsx
      ActivityFilters.tsx
      activity-columns.tsx
    settings/
      SettingsView.tsx
      SettingsFieldsPage.tsx
      SettingsListsPage.tsx
      SettingsUploadsPage.tsx
      SettingsSecurityPage.tsx
      access/
        UsersAccessView.tsx
        UsersTab.tsx
        TeamsTab.tsx
        SalesGroupsTab.tsx
        PermissionsTab.tsx
    connectors/
      ConnectorsView.tsx
      TelephonyConnectorPanel.tsx
      ApiCallConnectorPanel.tsx
      WhatsAppConnectorPanel.tsx
      VoicebotConnectorPanel.tsx
      ConnectorLogsPanel.tsx
```

## 13. Bottom Line

The current app is correct in domain direction but still behind the reference repo in UI system maturity.

Latest remediation update:

- Worker and backend automation now understand workflow edges for execution order.
- Worker API-call execution now has the same public HTTPS/private-network safety guardrails expected by the backend path.
- Advanced lead filters now have backend support for custom-field operators that the UI exposes.
- CSV upload validation now respects mapped Lead mandatory rules in addition to the confirmed default upload columns.
- Settings mandatory-rule field selection and activity disposition editing are now more dynamic.
- Telephony agent presence and popup fan-out are Redis-backed, with DB polling fallback retained for resilience.
- Telephony popup SSE now uses short-lived stream tokens instead of long-lived access tokens.
- Automation now owns its lead-context loading instead of requiring the shared CRM shell to load leads for the route.
- Auth now supports httpOnly access/refresh cookies with bearer-token fallback, and refresh tokens are no longer kept in browser storage.

The best path is not to copy the reference app. The best path is to keep the current Unnatify requirements and gradually adopt the reference repo’s frontend discipline:

- Route-owned pages.
- Smaller components.
- Standard tables.
- Standard modals.
- Standard filters.
- Cleaner settings pages.
- Consistent compact visual system.
