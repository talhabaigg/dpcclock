# Close/Reopen Project Feature - Requirements Document

## 1. Overview

### 1.1 Problem Statement
As the number of projects grows, completed or inactive projects clutter every listing page in the application (locations, kiosks, requisitions, variations, timesheets, forecasts, mobile sync). There is currently no way to archive or close a project without permanently deleting its data.

### 1.2 Objective
Allow authorized users to **close** a project (Location), which hides the project and all its associated data from default listing views throughout the application, while preserving all historical data for direct access.

### 1.3 Scope
- Close and reopen projects
- Filter closed projects and their associated entities from all listing/selection views
- Provide a toggle to view closed projects when needed
- No data deletion; purely a visibility/status change

---

## 2. Functional Requirements

### 2.1 Close a Project

| ID | Requirement |
|----|-------------|
| FR-01 | A user with the `locations.close` permission can close an open project |
| FR-02 | Closing a project records the timestamp (`closed_at`) and the user who performed the action (`closed_by`) |
| FR-03 | Closing a project is performed via a POST action from the project action menu on the Locations index page |
| FR-04 | The user must confirm the action before the project is closed |
| FR-05 | A success flash message is displayed after closing |

### 2.2 Reopen a Project

| ID | Requirement |
|----|-------------|
| FR-06 | A user with the `locations.close` permission can reopen a closed project |
| FR-07 | Reopening clears the `closed_at` and `closed_by` fields |
| FR-08 | Reopening is performed via the action menu (visible when "Show Closed" is toggled on) |
| FR-09 | A success flash message is displayed after reopening |

### 2.3 Locations Index Filtering

| ID | Requirement |
|----|-------------|
| FR-10 | By default, the Locations index page only shows open projects |
| FR-11 | A "Show Closed" toggle is available in the toolbar |
| FR-12 | When toggled on, closed projects appear in the list alongside open projects |
| FR-13 | Closed projects are visually distinguished with a "Closed" badge and reduced opacity |
| FR-14 | The toggle state is reflected in the URL as a query parameter (`?show_closed=1`) |

### 2.4 Associated Entity Filtering

When a project is closed, its associated data must be hidden from the following listing/selection views:

| ID | Area | Requirement |
|----|------|-------------|
| FR-15 | **Kiosks** | Kiosks belonging to closed projects are hidden from the Kiosks index page |
| FR-16 | **Requisitions - List** | Requisitions for closed projects are hidden from the Requisitions index page |
| FR-17 | **Requisitions - Create** | Closed projects are excluded from the location dropdown when creating a new requisition |
| FR-18 | **Requisitions - Edit** | Closed projects are excluded from the location dropdown when editing a requisition |
| FR-19 | **Timesheets - Review** | Closed projects are excluded from the location filter on timesheet review |
| FR-20 | **Timesheets - Edit** | Closed projects are excluded from the location filter on timesheet editing |
| FR-21 | **Variations - List** | Variations for closed projects are hidden from the Variations index page |
| FR-22 | **Variations - Create** | Closed projects are excluded from the location dropdown when creating a variation |
| FR-23 | **Variations - Edit** | Closed projects are excluded from the location dropdown when editing a variation |
| FR-24 | **Labour Forecast** | Closed projects are excluded from the Labour Forecast location list |
| FR-25 | **Turnover Forecast** | Closed projects are excluded from the Turnover Forecast location list |
| FR-26 | **Mobile App Sync** | Closed projects and their drawings are excluded from the mobile app sync endpoint |
| FR-27 | **Location Dashboard** | Closed projects are excluded from the "available locations" dropdown on the Location Dashboard |

### 2.5 Direct Access Preservation

| ID | Requirement |
|----|-------------|
| FR-28 | A closed project remains accessible via its direct URL (e.g., `/locations/{id}`, `/locations/{id}/dashboard`) |
| FR-29 | Drawings, variations, cost codes, price lists, and all other detail pages for a closed project remain accessible via direct URL |
| FR-30 | No write operations are blocked on a closed project (users may still need to do cleanup work) |

---

## 3. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | The feature must not interfere with the existing EmployeeHub sync mechanism (which uses `deleted_at` / soft deletes) |
| NFR-02 | EH sync must not overwrite or reset the `closed_at` field |
| NFR-03 | Closing/reopening must be an instantaneous operation (no background jobs required) |
| NFR-04 | The feature must work within the existing Spatie permission system |

---

## 4. Data Model Changes

### 4.1 New Columns on `locations` Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `closed_at` | `timestamp` | Yes | `NULL` | When the project was closed. NULL = open. |
| `closed_by` | `unsignedBigInteger` | Yes | `NULL` | FK to `users.id`. Who closed the project. |

### 4.2 Model Scopes

| Scope | Query | Usage |
|-------|-------|-------|
| `scopeOpen()` | `whereNull('closed_at')` | Default filter on all listing queries |
| `scopeClosed()` | `whereNotNull('closed_at')` | Used when "Show Closed" is active |

### 4.3 Accessor

| Accessor | Returns | Description |
|----------|---------|-------------|
| `is_closed` | `bool` | `true` if `closed_at` is not null |

---

## 5. Permission Model

| Permission | Description | Roles |
|------------|-------------|-------|
| `locations.close` | Close and reopen projects | `admin` (implicit via *), `backoffice` |

A single permission covers both close and reopen. Managers do not have this permission by default.

---

## 6. API / Routes

| Method | Route | Name | Permission | Description |
|--------|-------|------|------------|-------------|
| `POST` | `/locations/{location}/close` | `locations.close` | `locations.close` | Close a project |
| `POST` | `/locations/{location}/reopen` | `locations.reopen` | `locations.close` | Reopen a closed project |

---

## 7. UI / UX Specification

### 7.1 Locations Index Page

**Toggle Control:**
- Position: In the toolbar row, next to the search bar
- Component: Switch with "Show Closed" label
- Behavior: Triggers an Inertia visit with `?show_closed=1` query parameter
- Default state: Off (closed projects hidden)

**Action Menu:**
- For open projects: "Close Project" option in the Admin group (visible to users with `locations.close` permission)
- For closed projects (when toggle is on): "Reopen Project" option in the Admin group
- Close action shows a confirmation dialog before proceeding

**Visual Indicators for Closed Projects:**
- Table row: `opacity-60` class applied
- Badge: Red "Closed" badge displayed next to the project name
- Card layout (mobile): Same opacity reduction and badge

### 7.2 Confirmation Dialog (Close)
- Title: "Close Project"
- Message: "Are you sure you want to close {project name}? This will hide the project and all its associated data from listing views. You can reopen it later."
- Actions: "Cancel" (secondary) | "Close Project" (destructive/primary)

---

## 8. Affected Controllers & Methods

### 8.1 Modified (add `->open()` scope to listing queries)

| Controller | Method(s) | What changes |
|------------|-----------|-------------|
| `LocationController` | `index()` | Filter by `open()` scope, accept `?show_closed`, pass permissions to frontend |
| `LocationController` | `dashboard()` | Filter `availableLocations` dropdown by `open()` |
| `LocationController` | `close()`, `reopen()` | **New methods** |
| `KioskController` | `index()` | Filter kiosks whose location is open |
| `PurchasingController` | `index()` | Filter requisitions by open locations |
| `PurchasingController` | `create()`, `edit()` | Filter location dropdown by `open()` |
| `ClockController` | `reviewTimesheets()` | Filter location list by `open()` |
| `ClockController` | `editTimesheet()` | Filter location list by `open()` |
| `VariationController` | `index()` | Filter variations by open locations |
| `VariationController` | `create()`, `edit()` | Filter location dropdown by `open()` |
| `LabourForecastController` | `index()` | Filter location list by `open()` |
| `TurnoverForecastController` | `index()` | Filter location list by `open()` |
| `Api\SyncController` | `pull()` | Filter `$projectIds` by `open()` |

### 8.2 Not Modified (direct access preserved)

| Controller | Reason |
|------------|--------|
| `DrawingController` (all methods) | Operates on single location via route model binding |
| `LabourForecastController::show()` | Single location detail view |
| `JobForecastController::show()` | Single location detail view |
| `LocationController::show/costCodes/priceList/favourites` | Single location detail views |
| `CalendarController` | Not location-specific |
| `LocationController::sync()` | EH sync must process all locations regardless |

---

## 9. Verification Checklist

| # | Test Case | Expected Result |
|---|-----------|----------------|
| 1 | Close a project from Locations index | Project disappears from list; success message shown |
| 2 | Toggle "Show Closed" on | Closed project appears with badge and dimmed styling |
| 3 | Reopen a closed project | Project returns to normal in list |
| 4 | Visit closed project via direct URL | Page loads normally (dashboard, drawings, etc.) |
| 5 | Check Kiosks index after closing project | Kiosks for closed project are hidden |
| 6 | Check Requisitions index after closing | Requisitions for closed project are hidden |
| 7 | Create new requisition | Closed project not in location dropdown |
| 8 | Check Variations index after closing | Variations for closed project are hidden |
| 9 | Create new variation | Closed project not in location dropdown |
| 10 | Check Timesheet Review | Closed project not in location filter |
| 11 | Check Labour Forecast index | Closed project not in list |
| 12 | Check Turnover Forecast index | Closed project not in list |
| 13 | Run EH sync | Sync completes without affecting `closed_at` field |
| 14 | Mobile app sync | Closed project's drawings not returned |
| 15 | Non-admin/non-backoffice user | Close/Reopen options not visible in action menu |
