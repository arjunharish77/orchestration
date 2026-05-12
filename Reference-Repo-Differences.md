# Reference Repo Differences

This document compares the current Unnatify CRM app in `commcrm` with the reference repo shared earlier at `../crm/crm`.

Scope of this review:

- Frontend structure and routing
- UI patterns and page composition
- CRM module coverage
- Settings/admin organization
- List, detail, filter, and action patterns
- Areas where the reference repo should be used only as inspiration, not copied directly

No code changes are included in this document.

## 1. High-Level Summary

The reference repo is a more mature, componentized CRM frontend. It has route-backed pages, reusable layout components, standard data grids, reusable dialogs, settings sub-pages, filter builders, saved views, preview drawers, and polished loading/empty/error states.

The current Unnatify CRM app is more directly aligned to the custom requirements already discussed: MCUBE telephony, CSV uploads, lead assignment engine, configurable lead fields, custom dispositions, WhatsApp/voicebot connector provisions, Resend email, account/user-level 2FA settings, admin operations access, and VPS deployment documentation.

The main difference is this:

- The reference repo is stronger in frontend structure, reusable UI patterns, and CRM screen polish.
- The current app is stronger in requirement-specific backend concepts and custom connector foundations.

The reference repo should be used as a design and structure reference, not copied module-for-module.

## 2. Architecture Differences

### Reference Repo

The reference repo is split into clear route pages and reusable components.

Examples:

- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/leads/page.tsx`
- `src/app/dashboard/leads/[id]/page.tsx`
- `src/app/dashboard/activities/page.tsx`
- `src/app/dashboard/settings/layout.tsx`
- `src/components/layout/NavigationDrawer.tsx`
- `src/components/layout/header.tsx`
- `src/components/common/standard-data-grid.tsx`
- `src/components/common/record-preview.tsx`
- `src/components/common/skeletons.tsx`
- `src/components/filters/advanced-filter-modal.tsx`
- `src/components/views/view-switcher.tsx`

This makes the frontend easier to maintain because each major screen has its own route and most repeated UI is reusable.

### Current App

The current app is still heavily concentrated in `frontend/src/app/crm-app.tsx`.

It has many features inside one large application component. This made it faster to build the foundation, but it also makes the UI harder to polish, debug, and scale.

### Difference

The reference repo has better frontend separation. The current app has more requirement-specific CRM logic.

Recommended direction later:

- Gradually split the current frontend into route-level pages.
- Extract reusable list, form, modal, settings, skeleton, and action components.
- Keep the current backend/domain requirements instead of replacing them with reference repo assumptions.

## 3. Routing Differences

### Reference Repo

The reference repo has proper route-backed pages for each major module.

Examples:

- `/dashboard/leads`
- `/dashboard/leads/[id]`
- `/dashboard/activities`
- `/dashboard/forms`
- `/dashboard/forms/[formId]`
- `/dashboard/lists`
- `/dashboard/lists/[id]`
- `/dashboard/opportunities`
- `/dashboard/opportunities/[id]`
- `/dashboard/reports`
- `/dashboard/automations-v2`
- `/dashboard/automations-v2/[id]`
- `/dashboard/settings/...`

### Current App

The current app now has browser routes such as:

- `/dashboard`
- `/leads`
- `/activities`
- `/uploads`
- `/tasks`
- `/automation`
- `/reports`
- `/settings`
- `/ops-login`

But much of the UI is still handled through a central app component and internal view state.

### Difference

The reference repo uses routes as the primary app structure. The current app uses routes for navigation but still keeps much of the UI inside one central component.

This matters because route-backed pages are easier to load, test, deep-link, and maintain.

## 4. Navigation And Layout Differences

### Reference Repo

The reference repo has a polished persistent dashboard layout:

- Collapsible side navigation
- Icon rail when collapsed
- Sticky top header
- Global search
- Quick create menu
- Notification bell
- Profile menu
- Feature-gated navigation
- Active state based on route path

The navigation includes:

- Dashboard
- Leads
- Lists
- Opportunities
- Activities
- Forms
- Automations
- Reports
- Settings/admin section

### Current App

The current app has a lighter custom layout with sidebar/topbar patterns. It has already been adjusted to keep only required main modules visible:

- Dashboard
- Leads
- CSV Uploads
- Tasks
- Activities
- Automation
- Reports
- Settings

Other admin/configuration areas are intended to live inside Settings.

### Difference

The reference layout is more polished and componentized. The current navigation is closer to the user-approved module structure.

Important note:

The reference repo includes modules like Opportunities, Forms, and Lists. These should not be added blindly because the current requirement says the visible app should focus on the required CRM foundation and avoid unnecessary modules.

## 5. Visual Design Differences

### Reference Repo

The reference repo uses a clean, compact CRM design language:

- Soft green theme
- Compact table rows
- Rounded active navigation state
- Clear toolbar actions
- Sticky page structure
- Cards only where useful
- Good visual grouping
- Route-level detail pages
- More mature empty/loading/error states

### Current App

The current app has gone through several iterations and still has inconsistent UI areas:

- Some pages are denser than others.
- Some actions are inline where modals would be cleaner.
- Some screens show too much configuration at once.
- Some list views are simpler than the reference repo.
- Some settings areas are functional but not yet as refined as reference repo settings pages.

### Difference

The reference repo is cleaner and more consistent visually. The current app needs selective UI refinement using the reference as inspiration.

Recommended direction later:

- Use one consistent compact visual system.
- Keep action buttons, filters, tabs, and tables consistent across all pages.
- Avoid adding extra modules just because they exist in the reference repo.

## 6. List View Differences

### Reference Repo

The reference repo uses a reusable `StandardDataGrid` component.

It supports:

- Column toolbar
- Filters
- Density control
- Export
- Row selection
- Bulk selection
- Compact header styling
- Pagination
- Loading skeletons
- Empty state
- Row click/detail navigation

### Current App

The current app has simpler custom list views. It now includes field selector controls in important list views like:

- Leads
- Activities
- Users
- Tasks
- CSV Uploads

But it does not yet have the same mature reusable grid system.

### Difference

The current app has the right requirement direction, especially configurable visible fields, but the reference repo has a better reusable list infrastructure.

Recommended direction later:

- Build or extract a common compact table/list component.
- Standardize field selector behavior across all list pages.
- Add consistent skeleton, empty, error, pagination, and bulk action behavior.

## 7. Lead List Differences

### Reference Repo

The reference lead list includes:

- Data grid
- Lead name as clickable detail link
- Bulk actions
- Add to list action
- Delete action
- Create lead dialog
- Edit lead dialog
- Advanced filter modal
- Quick preview drawer
- Empty state

### Current App

The current lead list is focused on the Unnatify lead model:

- Customer/lead fields
- Lead category
- Lead status
- Lead disposition
- Custom fields
- Assignment-related fields
- CSV upload-created leads
- Telephony/automation integration foundations

### Difference

The reference lead list has stronger UX infrastructure. The current lead list is better aligned to Unnatify-specific data and workflows.

Recommended direction later:

- Keep the current lead model.
- Improve the UI using reference patterns like advanced filters, field selector, row actions, and preview/detail consistency.

## 8. Lead Detail Differences

### Reference Repo

The reference lead detail page is route-backed and polished.

It includes:

- Dedicated `/dashboard/leads/[id]` route
- Sticky left contact card
- Lead summary
- KPI/status tiles
- Tabs for activity/details/opportunities/notes/audit
- Activity timeline
- Notes panel
- Contextual forms panel
- Record history/audit panel
- Create activity dialog
- Edit lead dialog

### Current App

The current app has a lead detail foundation and related activity/task/custom field concepts, but the detail view is not as mature or as separately structured as the reference repo.

### Difference

The reference lead detail UI is much better as a reference for layout and interaction.

But the current app should not copy opportunity-heavy sections unless explicitly needed. The latest requirement does not require opportunity pages as a core visible module.

Recommended direction later:

- Use the reference layout idea for a clean lead detail page.
- Keep only required tabs such as overview, activities, tasks, dispositions, notes, calls, automation history, audit, and custom fields.
- Do not add opportunity sections unless the requirement changes.

## 9. Activities Differences

### Reference Repo

The reference activities page includes:

- Activity list
- Activity type selector
- Filter builder
- View switcher
- Create activity dialog
- Contextual forms panel
- Desktop grid and mobile list handling

### Current App

The current requirement is more specific:

- There should be an Activities section and activity list.
- No activity detail view is needed.
- The Activities page should default to one activity type based on URL.
- Changing activity type in filter should change the URL.
- Each activity list row should show lead name.
- Clicking lead name should open the lead.
- All list views should allow selecting visible fields, including custom fields.

### Difference

The reference repo has a strong activities UI, but the current app needs a stricter URL-driven single-activity-type list behavior.

Recommended direction later:

- Use the reference activities page for visual structure only.
- Keep the current requirement of no activity detail route.
- Ensure the activity type is URL-driven.

## 10. Settings Differences

### Reference Repo

The reference repo has a proper Settings route layout with a settings sidebar.

Settings areas include:

- General
- Teams
- Users
- Roles & Permissions
- Pipelines
- Opportunity Types
- Activity Types
- Custom Fields
- Sales Groups
- Assignment Rules
- Lead Scoring
- Security
- Permission Templates
- Integrations

### Current App

The current app groups admin/configuration areas inside Settings and has requirement-specific settings:

- Users
- Teams
- Sales groups
- Custom fields
- Field permissions
- Disposition configuration
- Upload history
- Telephony connector
- WhatsApp connector provision
- Voicebot connector provision
- Assignment engine
- Automation settings
- 2FA/account security settings

### Difference

The reference settings UI is better organized as separate settings pages. The current app has more custom-required settings but needs cleaner organization.

Recommended direction later:

- Move Settings to a route-backed settings layout.
- Keep Settings as the home for configuration/admin modules.
- Avoid exposing unnecessary modules in the main sidebar.

## 11. Automation Differences

### Reference Repo

The reference repo includes `automations-v2`.

It has:

- Automation list
- Search
- New automation action
- Status chips
- Row action menu
- Separate automation detail/editor route

### Current App

The current app has a requirement-specific automation foundation:

- Node-based automation concept
- Assignment Engine as an automation node
- API-call node with Postman-like configuration
- Mail merge fields from lead/activity/user
- Exit condition configuration
- Lead automation report
- Connector usage from automation

### Difference

The reference repo has a cleaner automation list UX. The current app has stronger requirement-specific automation concepts.

Recommended direction later:

- Use reference patterns for automation list, status, row menus, and editor route structure.
- Keep the custom automation node requirements already documented for Unnatify.

## 12. Forms Differences

### Reference Repo

The reference repo includes a larger forms module:

- Form list
- Form detail
- Form editor
- Contextual forms panel
- Submissions table
- Form-related lead/activity integration

### Current App

The current app requirement is narrower:

- Disposition forms at lead level
- Configurable disposition fields
- Custom fields on users, leads, and activities
- Field visibility/editability/masking through permission templates

### Difference

The reference repo has a more general forms system. The current app needs form-like behavior mainly for lead dispositions and configurable fields.

Recommended direction later:

- Do not add a full Forms module unless required.
- Use reference patterns for configurable forms and contextual panels.
- Keep the visible module set clean.

## 13. Opportunity And Pipeline Differences

### Reference Repo

The reference repo includes Opportunities, Opportunity Types, and Pipelines as first-class modules.

### Current App

The latest direction says unnecessary modules should not be shown. The current visible app should focus on:

- Dashboard
- Leads
- CSV Uploads
- Tasks
- Activities
- Automation
- Reports
- Settings

### Difference

Opportunity-related UI exists in the reference repo but should not be copied unless explicitly approved.

Recommended direction later:

- Keep opportunity concepts out of the visible app unless the requirement changes.
- Remove or hide opportunity buttons/labels from the current app where still present.

## 14. Filter And Saved View Differences

### Reference Repo

The reference repo includes:

- Advanced filter modal
- AND/OR filter groups
- Field/operator/value rows
- Saved view switcher
- My/shared views
- Save current view dialog

### Current App

The current app has simpler filtering and field selector behavior.

### Difference

The current app supports choosing visible fields in list views, but does not yet have a full saved views/filter builder system like the reference repo.

Recommended direction later:

- Add advanced filters where useful.
- Add saved views only if it helps users manage complex lead/activity/task lists.
- Keep filters compact and avoid cluttering every page.

## 15. Loading, Empty, And Error State Differences

### Reference Repo

The reference repo has reusable skeletons, empty states, and error states.

Examples:

- `src/components/common/skeletons.tsx`
- `src/components/common/empty-state.tsx`
- `src/components/common/error-state.tsx`

### Current App

The current app has some loading and skeleton behavior, but it is not yet as standardized.

### Difference

The reference repo is stronger in reusable state handling.

Recommended direction later:

- Create one shared loading/skeleton pattern.
- Create one shared empty state pattern.
- Create one shared error state pattern.
- Avoid showing temporary static content before real data loads.

## 16. Permissions And Admin Differences

### Reference Repo

The reference repo includes:

- Role guards
- Feature gates
- Permission-related settings
- Admin settings separation
- Tenant/platform-style admin concepts
- Impersonation banner

### Current App

The current app has requirements for:

- Administrator
- Sales Manager
- Sales User
- Teams
- Permission templates
- Field-level visible/editable/hidden/masked behavior
- Admin Operations Center visible only through a backend-created custom login
- 2FA account-level and user-level controls

### Difference

The reference repo has mature admin UI patterns. The current app has more specific permission requirements.

Recommended direction later:

- Use reference structure for settings/admin UI.
- Keep Unnatify-specific roles, permission templates, field masking, and operations-login rules.

## 17. Connector Differences

### Reference Repo

The reference repo has a general Integrations settings area, but it does not appear to be specifically designed around the MCUBE, WhatsApp, and voicebot requirements discussed here.

### Current App

The current app has requirement-specific connector foundations:

- MCUBE/telephony connector
- Clean webhook URL concepts
- Call route API
- Agent popup API
- Call log API
- Click-to-call configuration
- 10-digit phone normalization requirement
- WhatsApp connector provision
- Voicebot connector provision
- Postman-like API call configuration
- Mail merge variables from lead/user/activity fields
- Webhook sample body mapping for voicebot activity fields

### Difference

The current app is more aligned with the required connector behavior. The reference repo should be used for settings UI polish only, not connector logic.

## 18. Backend And Deployment Differences

### Reference Repo

The reference repo appears more frontend/product-CRM oriented and includes different app/backend assumptions.

### Current App

The current app includes:

- NestJS backend
- Prisma/Postgres foundation
- Worker service
- Redis/BullMQ concepts
- Docker/Compose deployment planning
- VPS go-live runbook
- Health checks
- Backup/restore planning
- Nginx/SSL guidance

### Difference

The current app has stronger production deployment documentation for the specific VPS setup.

Recommended direction later:

- Keep the current deployment/runbook direction.
- Do not replace production wiring based on the reference frontend repo.

## 19. What The Current App Should Borrow From The Reference Repo

The most useful ideas to borrow are:

- Route-backed pages for each main module.
- Reusable dashboard layout.
- Reusable compact table/grid component.
- Reusable action toolbar.
- Consistent page headers.
- Modal-based create/edit actions.
- Advanced filter modal pattern.
- Saved view pattern, if needed.
- Reusable skeleton/empty/error states.
- Settings layout with a left settings navigation.
- Clean lead detail page structure.
- Activity list layout with type filtering.
- Consistent role/feature-based navigation visibility.

## 20. What The Current App Should Not Copy Blindly

These reference areas may not match the current requirement:

- Opportunities as a visible main module.
- Lists as a visible main module.
- Full Forms module as a visible main module.
- Pipelines and opportunity types unless explicitly needed.
- Activity detail pages.
- Any UI that adds clutter or shows too many configuration blocks at once.
- Any generic connector model that does not support MCUBE, WhatsApp, voicebot, mail merge, and webhook body mapping requirements.

## 21. Important Current-App Gaps Compared To Reference

These are the main gaps visible from the comparison:

1. The frontend is not yet split enough into route-level pages and reusable components.
2. List views do not yet have a single production-grade reusable data grid.
3. Loading, empty, and error states are not fully standardized.
4. Settings is not yet as cleanly structured as the reference settings sidebar/pages.
5. Lead detail UI is not yet as polished as the reference lead detail.
6. Filter builder and saved views are not yet implemented at reference quality.
7. Create/edit flows should use consistent modals or drawers.
8. Some current UI still needs cleanup to remove unnecessary opportunity/form/list wording where not required.
9. Field label rendering and dropdown rendering must be consistent everywhere.
10. Activity list behavior must stay aligned to the custom URL-driven activity type requirement.

## 22. Suggested Next Decisions

Before changing code based on this comparison, these decisions should be confirmed:

1. Whether to restructure Settings into separate route-backed pages like the reference repo.
2. Whether to build a reusable compact data grid for Leads, Activities, Tasks, Uploads, Users, and Reports.
3. Whether to add saved views and advanced filters now or later.
4. Whether lead detail should follow the reference layout with tabs and a left summary panel.
5. Whether all opportunity/list/form references should be fully removed from the current UI unless hidden inside Settings or explicitly required.
6. Whether quick preview drawers should be added, or whether users should always open full lead detail pages.
7. Whether the reference repo's green-heavy visual language should be adapted to the current app as green-only, or mixed with the previously requested lighter blue shades.

## 23. Bottom Line

The reference repo is best used as a frontend quality benchmark. It shows how the CRM should feel: compact, route-backed, modular, consistent, and action-driven.

The current app should keep its own requirement-specific foundation: Unnatify lead workflow, CSV uploads, MCUBE telephony, custom fields, assignment engine, automation nodes, WhatsApp/voicebot provisions, permissions, and deployment setup.

The next best step is not to copy the reference repo. The better path is to selectively apply its structure and UI discipline to the current app while preserving the documented Unnatify requirements.
