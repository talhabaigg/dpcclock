# Business Requirements Document: Variation Management System

| Field              | Value                                      |
| ------------------ | ------------------------------------------ |
| **Document ID**    | BRD-VAR-001                                |
| **Version**        | 2.0                                        |
| **Status**         | Draft                                      |
| **Date**           | 2026-02-23                                 |
| **Author**         | Reverse-engineered from codebase (As-Built)|
| **Classification** | Internal                                   |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Objectives](#2-business-objectives)
3. [Stakeholders](#3-stakeholders)
4. [Scope](#4-scope)
5. [Business Context](#5-business-context)
6. [Business Process Flows](#6-business-process-flows)
7. [Functional Requirements](#7-functional-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Business Rules](#9-business-rules)
10. [Data Dictionary](#10-data-dictionary)
11. [User Interface Summary](#11-user-interface-summary)
12. [Integration Points](#12-integration-points)
13. [Security & Access Control](#13-security--access-control)
14. [Assumptions & Constraints](#14-assumptions--constraints)
15. [Glossary](#15-glossary)
16. [Traceability Matrix](#16-traceability-matrix)

---

## 1. Executive Summary

The Variation Management System is a module within the Superior Portal. It enables project teams to create, price, and manage variations that arise during the lifecycle of a construction project. Variations represent scope changes — additional work, extra materials, or revised quantities — that fall outside the original contract.

The system supports the full variation lifecycle:

- **Creating** variations with scope descriptions linked to a project
- **Pricing** variations using project-specific conditions or manual cost entry
- **Building client-facing quotes** with sell rates, margins, and printable output
- **Generating Premier variations** from priced scope items using the Quick Gen logic
- **Sending** finalised variations to Premier ERP automatically via API
- **Syncing** variations from Premier back into the portal automatically via API for reconciliation

The system is accessed by administrators, project managers, and clients (who receive output only).

---

## 2. Business Objectives

| ID      | Objective                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| BO-01   | Enable timely capture and documentation of scope changes on construction projects                          |
| BO-02   | Provide accurate cost estimation for variations using established pricing conditions and oncost structures  |
| BO-03   | Produce professional client-facing quotes with configurable sell rates and margin visibility                |
| BO-04   | Automate the generation of Premier-compatible variation line items (Quick Gen)                              |
| BO-05   | Automate the transmission of approved variations to Premier ERP for financial processing via API            |
| BO-06   | Maintain bi-directional automated data sync between the portal and Premier for variation reconciliation    |
| BO-07   | Enforce role-based access control so that only authorised users can create, edit, send, or delete variations|

---

## 3. Stakeholders

| Role                    | Responsibilities                                                                         | System Permissions                          |
| ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Administrator**       | Full access to all variation functions; manages system configuration and variation ratios | All permissions                             |
| **Project Manager**     | Views and manages variations for their projects; creates, prices, and sends variations    | variations.view, create, edit, send         |
| **Client (External)**   | Receives printed/PDF quotes for review and approval; no system access                    | N/A (receives output only)                  |

---

## 4. Scope

### 4.1 In Scope

- Variation creation, editing, viewing, and deletion
- Variation pricing using conditions (unit rate method) or manual line items
- Variation ratio setup and configuration per project (oncost percentages)
- Client quote generation with sell rates, margins, and printable output
- Premier variation generation (Quick Gen logic)
- Automated sending of variations to Premier via API
- Automated syncing of variations from Premier via API
- Variation listing with search, filtering, and pagination
- CSV/Excel download of variations for reference

### 4.2 Out of Scope

- Variation duplication
- Purchase order management
- Daywork processing

---

## 5. Business Context

### 5.1 What Is a Variation?

A variation represents a change to the original scope of work on a construction project. Variations arise when:

- The client requests additional work beyond the original contract
- Site conditions require changes to the planned scope
- Design modifications necessitate different materials or methods

Each variation is associated with a **project** (referred to as a Location within the portal).

### 5.2 Variation Types

| Type                 | Description                                                                          |
| -------------------- | ------------------------------------------------------------------------------------ |
| **Paid on Account**  | Variations that have been invoiced or partially paid against the project account     |
| **Pending**          | Variations awaiting client approval or internal review                               |
| **Approved**         | Variations formally approved by the client or project authority                      |

### 5.3 Variation Statuses

Variations progress through the following statuses during their lifecycle:

| Status       | Meaning                                                              |
| ------------ | -------------------------------------------------------------------- |
| **Draft**    | Work in progress; not yet submitted                                  |
| **Pending**  | Submitted for internal review or awaiting client approval            |
| **Sent**     | Transmitted to Premier ERP; locked for editing                       |
| **Approved** | Approved by the client or internally (synced from Premier)           |
| **Rejected** | Declined by the client or internally                                 |

### 5.4 Variation Ratios

Each project has a set of cost codes configured with **variation ratios** — percentage-based oncost rates that are applied during the Quick Gen process. These ratios represent indirect costs such as superannuation, payroll tax, workcover, site allowances, and other project-specific oncosts.

Each cost code is categorised as either:

- **LAB (Labour)** — The variation ratio is applied as a percentage of the base labour cost
- **MAT (Material)** — The variation ratio is applied as a percentage of the base material cost

The variation ratio configuration is a prerequisite for generating Premier variations.

---

## 6. Business Process Flows

### 6.1 End-to-End Variation Lifecycle

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 1. CHANGE    │───▶│ 2. VARIATION │───▶│ 3. CLIENT    │───▶│ 4. GENERATE  │───▶│ 5. SEND TO   │
│ DETECTED /   │    │ CREATED &    │    │ QUOTE        │    │ PREMIER      │    │ PREMIER      │
│ REQUESTED    │    │ PRICED       │    │ BUILT        │    │ VARIATION    │    │ VIA API      │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

**Step 1 — Change Detected or Requested**: A scope change is identified on site, requested by the client, or arises from design modifications.

**Step 2 — Variation Created and Priced**: The user creates a variation in the portal, selects the project, and adds priced scope items using conditions or manual entry.

**Step 3 — Client Quote Built**: The user sets sell rates (using multipliers or direct entry), reviews margins, and prints a client-facing quote for approval.

**Step 4 — Premier Variation Generated**: The system generates Premier-compatible line items from the pricing items using the Quick Gen logic, applying oncost ratios.

**Step 5 — Sent to Premier via API**: The finalised variation is transmitted to Premier ERP automatically via API. The variation is locked upon successful transmission.

### 6.2 Process: Create a Variation

| Step | Actor         | Action                                                                     |
| ---- | ------------- | -------------------------------------------------------------------------- |
| 1    | User          | Navigates to Variations > Create                                           |
| 2    | System        | Displays Step 1 (Details) form with project selector                       |
| 3    | User          | Selects a project from the dropdown                                        |
| 4    | User          | Enters Variation Number, Description, Date, and Type                       |
| 5    | User          | Optionally enters Client Notes                                             |
| 6    | User          | Clicks Next to proceed to Step 2 (Pricing)                                 |
| 7    | System        | Saves the variation and moves to the Pricing tab                           |

### 6.3 Process: Price a Variation

| Step | Actor  | Action                                                                                   |
| ---- | ------ | ---------------------------------------------------------------------------------------- |
| 1    | User   | On the Pricing tab, chooses to add an item **From Condition** or **Manual**               |
| 2a   | User   | **From Condition**: Selects a condition from the project's condition list                 |
| 2b   | User   | Enters a quantity (in the condition's natural unit: LM, m2, or EA)                       |
| 2c   | System | Calculates labour cost, material cost, and total cost using the condition's unit rates    |
| 2d   | System | Stores the pricing item with computed costs                                               |
| 3a   | User   | **Manual**: Enters a description, quantity, unit, labour rate, and material rate          |
| 3b   | System | Calculates total cost as (qty x labour rate) + (qty x material rate)                     |
| 4    | User   | Repeats steps 1-3 for each scope item in the variation                                   |
| 5    | User   | Can reorder, edit, or delete pricing items inline                                        |
| 6    | System | Displays running totals: Total Labour, Total Material, Grand Total                       |

### 6.4 Process: Build a Client Quote

| Step | Actor  | Action                                                                                     |
| ---- | ------ | ------------------------------------------------------------------------------------------ |
| 1    | User   | Navigates to the Client tab (Step 3)                                                       |
| 2    | System | Displays each pricing item with Cost Rate, Sell Rate, Sell Total, Margin, and Margin %     |
| 3    | User   | Enters a **Multiplier %** (e.g., 220%) to set sell rate as a percentage of cost            |
| 4    | User   | Optionally uses **Apply Down** to apply the same multiplier to all subsequent rows         |
| 5    | User   | Can override individual sell rates directly                                                |
| 6    | User   | For linear conditions with height, can toggle unit display between LM and m2               |
| 7    | System | Calculates Sell Total = Qty x Sell Rate for each item                                      |
| 8    | System | Displays Summary Cards: Total Cost, Total Sell, Margin ($), Margin (%)                     |
| 9    | User   | Enters optional Client Notes (included on the printed quote)                               |
| 10   | User   | Clicks **Save Sell Rates** to persist pricing                                              |
| 11   | User   | Clicks **Print Quote** to open a printable client-facing quote in a new browser tab        |

### 6.5 Process: Generate Premier Variation (Quick Gen)

| Step | Actor  | Action                                                                                     |
| ---- | ------ | ------------------------------------------------------------------------------------------ |
| 1    | User   | Navigates to the Premier tab (Step 4)                                                      |
| 2    | System | Displays base totals from pricing items (Total Labour, Total Material)                     |
| 3    | User   | Clicks **Generate Premier Variation**                                                      |
| 4    | System | If existing lines exist, shows confirmation warning that manual edits will be lost          |
| 5    | User   | Confirms generation                                                                        |
| 6    | System | Executes Quick Gen logic (see Business Rules BR-04 through BR-07)                          |
| 7    | System | Replaces all existing line items with newly generated ones                                  |
| 8    | System | Displays line count, total cost, and total revenue                                         |

### 6.6 Process: Send to Premier via API

| Step | Actor  | Action                                                                                     |
| ---- | ------ | ------------------------------------------------------------------------------------------ |
| 1    | User   | On the Premier tab, clicks **Send to Premier**                                             |
| 2    | System | Displays confirmation dialog                                                                |
| 3    | User   | Confirms                                                                                    |
| 4    | System | Automatically transmits the variation to Premier ERP via the API                            |
| 5a   | System | **On success**: Sets variation status to "Sent"; displays success message                   |
| 5b   | System | **On failure**: Displays error message with API response details                           |

### 6.7 Process: Sync Variations from Premier

| Step | Actor  | Action                                                                                     |
| ---- | ------ | ------------------------------------------------------------------------------------------ |
| 1    | User   | On the project's variation listing, clicks **Sync from Premier**                           |
| 2    | System | Dispatches an automated background job to fetch variations from Premier via API             |
| 3    | System | For each variation returned: creates or updates the Variation record                        |
| 4    | System | For each variation's lines: creates, updates, or removes line items                        |
| 5    | System | Displays success message upon completion                                                   |

---

## 7. Functional Requirements

### FR-01: Variation Creation

| ID       | Requirement                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------- |
| FR-01.01 | The portal shall allow authorised users to create a new variation for a selected project.            |
| FR-01.02 | A variation shall capture the following mandatory fields: Project, Variation Number, Description, and Type. |
| FR-01.03 | A variation shall support the following optional fields: Date, Client Notes, and Amount.             |
| FR-01.04 | The Type field shall accept values: "Paid on Account", "Pending", or "Approved".                    |
| FR-01.05 | A newly created variation shall default to status "Pending".                                        |
| FR-01.06 | The portal shall record the creating user's name on the variation.                                  |
| FR-01.07 | The project selector shall be limited to configured parent project groups.                          |

### FR-02: Variation Editing

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-02.01 | The portal shall allow authorised users to edit an existing variation's details and line items.       |
| FR-02.02 | Editing shall be disabled for variations with status "Sent" or "Approved" (locked variations).       |
| FR-02.03 | When editing, the portal shall replace all existing line items with the newly submitted set.          |
| FR-02.04 | The portal shall record the updating user's name on the variation.                                   |

### FR-03: Variation Viewing

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-03.01 | The portal shall display a read-only detail view of any variation with its pricing items and Premier variation lines. |
| FR-03.02 | The detail view shall show aggregated totals: Total Cost, Total Revenue, Pricing Cost, Pricing Sell.  |
| FR-03.03 | The detail view shall display the variation status as a colour-coded badge.                           |
| FR-03.04 | The detail view shall provide action buttons: Edit, Print Quote, and Download Excel.                 |

### FR-04: Variation Listing & Filtering

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-04.01 | The portal shall display a paginated list of all variations accessible to the current user.          |
| FR-04.02 | Project managers shall only see variations for projects they manage.                                  |
| FR-04.03 | The list shall support filtering by: Search text, Status, Project, and Type.                         |
| FR-04.04 | The list shall be sortable and paginated at 50 items per page.                                       |
| FR-04.05 | The list shall support toggle between List view and Grid (card) view.                                |
| FR-04.06 | When viewing a project-scoped list, the portal shall display summary cards (Approved Revenue, Pending Revenue). |
| FR-04.07 | Each variation row shall display: Variation Number, Description, Status, Type, Total Cost, Total Revenue. |

### FR-05: Variation Pricing (Scope Items)

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-05.01 | The portal shall support adding pricing items to a variation from **conditions** (unit rate method).  |
| FR-05.02 | When adding from a condition, the user shall select a condition and enter a quantity.                 |
| FR-05.03 | The portal shall compute labour cost and material cost using the condition's unit rates.              |
| FR-05.04 | For linear conditions with height, the portal shall convert linear metres to m2 for cost calculation. |
| FR-05.05 | The portal shall support adding **manual** pricing items with user-specified labour and material rates.|
| FR-05.06 | Manual items shall capture: Description, Quantity, Unit of Measure, Labour Rate, and Material Rate.   |
| FR-05.07 | Supported units of measure shall be: EA, LM, m2, m3, m, HR, DAY, LOT.                               |
| FR-05.08 | Users shall be able to edit pricing item descriptions, quantities, and costs inline.                 |
| FR-05.09 | Users shall be able to reorder pricing items using sort controls.                                    |
| FR-05.10 | Users shall be able to delete pricing items with a confirmation prompt.                              |
| FR-05.11 | The portal shall display running totals: Total Labour, Total Material, and Grand Total.              |
| FR-05.12 | Total Cost shall be calculated as Labour Cost + Material Cost for each item.                         |

### FR-06: Client Quote Generation

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-06.01 | The portal shall allow users to set a **sell rate** per unit for each pricing item.                  |
| FR-06.02 | Users shall be able to set sell rates via a **multiplier percentage** (e.g., 220% of cost rate).     |
| FR-06.03 | The **Apply Down** function shall apply a multiplier to all pricing items below the current row.     |
| FR-06.04 | For linear conditions with height, users shall be able to toggle the display unit between LM and m2. |
| FR-06.05 | The portal shall calculate Sell Total = Quantity x Sell Rate for each pricing item.                  |
| FR-06.06 | The portal shall calculate Margin = Sell Total - Total Cost for each pricing item.                   |
| FR-06.07 | The portal shall calculate Margin % = (Margin / Sell Total) x 100.                                  |
| FR-06.08 | The portal shall display summary cards: Total Cost, Total Sell, Margin ($), and Margin (%).          |
| FR-06.09 | Margin indicators shall be colour-coded: green for positive margin, red for negative margin.         |
| FR-06.10 | Users shall be able to save sell rates in bulk.                                                       |
| FR-06.11 | Users shall be able to enter Client Notes that appear on the printed quote.                          |
| FR-06.12 | The portal shall generate a **printable client quote** in a new browser tab.                         |
| FR-06.13 | The client quote shall respect the user's unit display toggle (LM vs m2) for each line item.        |

### FR-07: Premier Variation Generation (Quick Gen)

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-07.01 | The portal shall generate Premier-compatible variation line items from pricing items using the Quick Gen logic. |
| FR-07.02 | Quick Gen shall aggregate total labour cost and total material cost from all pricing items.           |
| FR-07.03 | Quick Gen shall group material costs by cost code for condition-linked pricing items.                |
| FR-07.04 | Quick Gen shall generate **labour oncost lines** by applying each LAB-type cost code's variation ratio to total labour. |
| FR-07.05 | Quick Gen shall generate **direct material lines** — one per cost code from the material aggregation.|
| FR-07.06 | Quick Gen shall generate **material oncost lines** by applying each MAT-type cost code's variation ratio to total material. |
| FR-07.07 | Regenerating Premier variation lines shall **replace all existing line items** on the variation.     |
| FR-07.08 | If existing line items are present, the portal shall display a confirmation warning before regeneration. |
| FR-07.09 | After generation, the portal shall display the line count, total cost, and total revenue.            |

### FR-08: Send to Premier (Automated via API)

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-08.01 | The portal shall automatically transmit a variation's line items to Premier ERP via the API.          |
| FR-08.02 | The API payload shall include: Company ID, Job Number, Variation Number, Description, Date, and all line items. |
| FR-08.03 | Each line item in the payload shall include: Line Number, Cost Item (code), Cost Type, Description, Quantity, Unit Cost, and Amount. |
| FR-08.04 | On successful transmission, the portal shall set the variation status to "Sent".                     |
| FR-08.05 | Sent variations shall be locked for editing.                                                         |
| FR-08.06 | The portal shall display a confirmation dialog before sending.                                       |
| FR-08.07 | On API failure, the portal shall display an error message with details from the API response.        |
| FR-08.08 | The Send to Premier action shall require the `variations.send` permission.                           |

### FR-09: Sync from Premier (Automated via API)

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-09.01 | The portal shall automatically sync variations from Premier ERP via the API for a given project.     |
| FR-09.02 | The sync shall run as a background job to avoid blocking the user interface.                         |
| FR-09.03 | For each synced variation, the portal shall create or update the Variation record.                   |
| FR-09.04 | For each synced variation's lines, the portal shall create, update, or remove line items.            |
| FR-09.05 | The Premier variation ID shall be stored on the variation for reconciliation.                        |
| FR-09.06 | The sync job shall retry up to 3 times with exponential backoff (60s, 120s, 240s).                  |
| FR-09.07 | The Sync action shall require the `variations.sync` permission.                                     |

### FR-10: Variation Ratio Setup

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-10.01 | Administrators shall be able to configure variation ratios per cost code for each project.           |
| FR-10.02 | Each cost code shall have a prelim type classification: LAB (Labour) or MAT (Material).              |
| FR-10.03 | Each cost code shall have a variation ratio percentage that determines its oncost contribution.       |
| FR-10.04 | Variation ratios shall be used by the Quick Gen process to generate oncost line items.               |
| FR-10.05 | The variation ratio setup shall be a prerequisite for generating Premier variations.                  |

### FR-11: CSV/Excel Download

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-11.01 | The portal shall allow users to download a variation as a CSV file for reference purposes.           |
| FR-11.02 | The CSV shall include a header row with: Company Code, Job Number, Variation Number, Description, Date. |
| FR-11.03 | Each line item row shall include: Line Number, Cost Item, Cost Type, Description, UoM, Qty, Unit Cost, Cost, Revenue. |
| FR-11.04 | Cost Item values shall be formatted to prevent Excel from interpreting them as numbers (e.g., `="01-01"`). |
| FR-11.05 | Revenue shall only be populated on lines where it is greater than zero.                              |
| FR-11.06 | The Download action shall require the `variations.export` permission.                                |

### FR-12: Variation Deletion

| ID       | Requirement                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------- |
| FR-12.01 | The portal shall allow authorised users to soft-delete a variation.                                  |
| FR-12.02 | Soft-deleted variations shall not appear in the default variation listing.                           |
| FR-12.03 | The deleting user's name shall be recorded on the variation.                                        |
| FR-12.04 | The Delete action shall require the `variations.delete` permission.                                 |

---

## 8. Non-Functional Requirements

| ID       | Category       | Requirement                                                                                |
| -------- | -------------- | ------------------------------------------------------------------------------------------ |
| NFR-01   | Performance    | The variation listing page shall load within 3 seconds for up to 1,000 variations.         |
| NFR-02   | Performance    | Cost calculations shall return results within 2 seconds.                                   |
| NFR-03   | Reliability    | The Premier sync job shall implement retry logic with exponential backoff.                 |
| NFR-04   | Reliability    | The Premier sync job shall timeout after 300 seconds per execution attempt.                |
| NFR-05   | Security       | All variation operations shall enforce permission-based access control.                    |
| NFR-06   | Security       | Premier API authentication tokens shall be cached for 29 minutes (below the 30-min expiry).|
| NFR-07   | Usability      | The 4-step variation wizard shall allow navigation between steps without data loss.        |
| NFR-08   | Usability      | The client quote shall be formatted for print (printable browser layout).                  |
| NFR-09   | Auditability   | The portal shall record created_by, updated_by, and deleted_by on all variations.          |
| NFR-10   | Data Integrity | Soft deletion shall be used; variations are never permanently removed.                     |
| NFR-11   | Responsiveness | The variation interface shall be usable on both desktop and mobile devices.                |
| NFR-12   | Availability   | The Premier API integration shall handle authentication failures gracefully with retry.    |

---

## 9. Business Rules

### Cost Calculation Rules

| ID    | Rule                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------- |
| BR-01 | **Unit Rate Pricing**: Labour = effective_qty x labour_unit_rate. Material = effective_qty x sum of cost code rates. |
| BR-02 | **Linear-to-Area Conversion**: For linear conditions with height, effective_qty = measured_qty x height (converting LM to m2). For area or count conditions, effective_qty = measured_qty. |
| BR-03 | **Manual Pricing**: Total Cost = (Qty x Labour Rate) + (Qty x Material Rate). No condition linkage.       |

### Quick Gen Rules

| ID    | Rule                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------- |
| BR-04 | **Labour Oncost**: For each cost code where prelim_type = "LAB" and variation_ratio > 0: line_amount = total_labour x (variation_ratio / 100). |
| BR-05 | **Material Oncost**: For each cost code where prelim_type = "MAT" and variation_ratio > 0: line_amount = total_material x (variation_ratio / 100). |
| BR-06 | **Material Grouping**: Material costs from condition-based pricing items are grouped by cost code before generating direct material lines. |
| BR-07 | **Manual Item Materials**: Material costs from manual pricing items (no condition link) are excluded from the cost-code-grouped material breakdown. Labour costs from manual items are included in the total labour. |

### Client Quote Rules

| ID    | Rule                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------- |
| BR-08 | **Multiplier**: Sell Rate = Cost Rate per unit x (Multiplier / 100).                                     |
| BR-09 | **Apply Down**: When a user applies a multiplier "down", it is applied to all pricing items below the current row. A confirmation dialog is displayed. |
| BR-10 | **Unit Toggle**: For linear conditions with height, the display unit can toggle between LM and m2. The stored sell rate always uses the primary unit (LM). Display rate = stored_rate / height. |
| BR-11 | **Margin**: Margin ($) = Sell Total - Total Cost. Margin (%) = (Margin / Sell Total) x 100.              |

### Status & Locking Rules

| ID    | Rule                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------- |
| BR-12 | **Sent Lock**: Variations with status "Sent" or "Approved" cannot be edited, re-sent, or deleted via the UI. |
| BR-13 | **Status Transition**: Sending to Premier sets status from any state to "Sent".                           |

### Data Integrity Rules

| ID    | Rule                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------- |
| BR-14 | **Cascade Delete**: Deleting a variation soft-deletes the variation record. Line items and pricing items are cascade-deleted at the database level when the variation is hard-deleted. |
| BR-15 | **Line Renumbering**: When generating Premier variation lines, existing lines are deleted and remaining lines are renumbered sequentially. |
| BR-16 | **Premier Sync**: The sync process uses an upsert pattern keyed on Premier's variation ID to avoid duplicates. Lines that no longer exist in Premier are deleted locally. |

---

## 10. Data Dictionary

### 10.1 Variation

| Field              | Type         | Required | Description                                                     |
| ------------------ | ------------ | -------- | --------------------------------------------------------------- |
| variation_number   | String       | Yes      | Variation number (e.g., "VAR-01")                               |
| type               | String       | Yes      | Type: "Paid on Account", "Pending", or "Approved"               |
| description        | String       | Yes      | Scope description of the variation                              |
| status             | String       | Yes      | Current status (default: "pending")                             |
| date               | Date         | No       | Date of the variation                                           |
| location_id        | Foreign Key  | Yes      | Reference to the project                                        |
| premier_co_id      | String       | No       | Premier variation identifier (set after sync or send)           |
| markup_percentage  | Decimal(5,2) | No       | Markup percentage                                               |
| client_notes       | Text         | No       | Notes to include on client-facing quote                         |
| created_by         | String       | No       | Name of the user who created the variation                      |
| updated_by         | String       | No       | Name of the user who last updated the variation                 |
| deleted_by         | String       | No       | Name of the user who deleted the variation (soft delete)        |

### 10.2 Variation Pricing Item

| Field                | Type          | Required | Description                                                   |
| -------------------- | ------------- | -------- | ------------------------------------------------------------- |
| variation_id         | Foreign Key   | Yes      | Parent variation reference                                    |
| condition_id         | Foreign Key   | No       | Source condition (null for manual items)                       |
| description          | String        | Yes      | Line item description                                         |
| qty                  | Decimal(12,4) | Yes      | Quantity in the item's unit of measure                        |
| unit                 | String(20)    | Yes      | Unit of measure (default: "EA")                               |
| labour_cost          | Decimal(12,2) | Yes      | Total labour cost for this item (default: 0)                  |
| material_cost        | Decimal(12,2) | Yes      | Total material cost for this item (default: 0)                |
| total_cost           | Decimal(12,2) | Yes      | Labour + Material cost (default: 0)                           |
| sell_rate            | Decimal(12,2) | No       | Sell price per unit (set in Client tab)                       |
| sell_total           | Decimal(12,2) | No       | Qty x Sell Rate                                                |
| sort_order           | Integer       | Yes      | Display order (default: 0)                                    |

### 10.3 Variation Line Item (Premier Format)

| Field                  | Type          | Required | Description                                                 |
| ---------------------- | ------------- | -------- | ----------------------------------------------------------- |
| variation_id           | Foreign Key   | Yes      | Parent variation reference                                  |
| line_number            | Integer       | Yes      | Sequential line number                                      |
| description            | String        | Yes      | Line description                                            |
| qty                    | Decimal(10,2) | Yes      | Quantity (typically 1 for oncost lines)                     |
| unit_cost              | Decimal(10,2) | Yes      | Cost per unit                                               |
| total_cost             | Decimal(10,2) | Yes      | Qty x Unit Cost                                             |
| cost_item              | String        | Yes      | Cost code (e.g., "01-01", "42-01")                          |
| cost_type              | String        | Yes      | Cost type (LAB, MAT, etc.)                                  |
| revenue                | Decimal(10,2) | Yes      | Revenue amount (0 for cost lines)                           |
| cost_code_id           | Foreign Key   | No       | Reference to the cost code record                           |

---

## 11. User Interface Summary

### 11.1 Variation Index Page

- Paginated list/grid of variations with status badges
- Filter sidebar: Search, Status, Project, Type
- Action menu per variation: View, Edit, Download, Send to Premier, Delete
- Summary cards (project-scoped view): Approved Revenue, Pending Revenue

### 11.2 Variation Create/Edit (4-Step Wizard)

| Step | Tab Name | Purpose                                                                |
| ---- | -------- | ---------------------------------------------------------------------- |
| 1    | Details  | Variation metadata: project, variation number, description, type, date |
| 2    | Pricing  | Add scope items from conditions or manual; inline edit and reorder     |
| 3    | Client   | Set sell rates, multipliers, margins; add client notes; print quote    |
| 4    | Premier  | Generate Premier variation (Quick Gen); download CSV; send to Premier  |

### 11.3 Variation Show (Read-Only)

- Header with variation number, status badge, and action buttons
- Details section: Date, Project, Description, Created/Updated by
- Pricing Items table with totals
- Premier Variation lines table
- Client Notes section

### 11.4 Client Quote (Printable)

- Company-branded printable layout
- Table of pricing items with Qty, Unit, Description, and Sell Rate
- Optional unit toggle (LM/m2) per item
- Client Notes section
- Totals

---

## 12. Integration Points

### 12.1 Premier ERP (Outbound — Send Variation)

| Attribute       | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Direction       | Superior Portal → Premier                                          |
| Protocol        | HTTPS REST API (automated)                                         |
| Authentication  | Bearer token (OAuth2 password grant, 30-minute expiry)             |
| Endpoint        | POST /api/ChangeOrder/CreateChangeOrders                           |
| Trigger         | User action: "Send to Premier"                                    |
| Payload Format  | JSON with Company, Job, Variation Number, Description, Date, Line Items |
| On Success      | Variation status set to "Sent"                                     |
| On Failure      | Error displayed to user; variation status unchanged                |

### 12.2 Premier ERP (Inbound — Sync Variations)

| Attribute       | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Direction       | Premier → Superior Portal                                          |
| Protocol        | HTTPS REST API (automated)                                         |
| Authentication  | Bearer token (same as outbound)                                    |
| Endpoints       | GET /api/ChangeOrder/GetChangeOrders, GET /api/ChangeOrder/GetChangeOrderLines |
| Trigger         | User action: "Sync from Premier" (dispatches automated background job) |
| Sync Pattern    | Upsert keyed on Premier variation ID                               |
| Retry Policy    | 3 attempts with backoff: 60s, 120s, 240s                          |
| Timeout         | 300 seconds per attempt                                            |

### 12.3 Project Cost Codes (Internal Dependency)

| Attribute       | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Direction       | Internal reference                                                 |
| Purpose         | Defines oncost structure (variation_ratio, prelim_type) for Quick Gen |
| Usage           | Consumed during Premier variation generation to produce oncost line items |

---

## 13. Security & Access Control

The Variation Management System uses role-based permissions. The following permissions govern access:

| Permission         | Description                                             | Roles                         |
| ------------------ | ------------------------------------------------------- | ----------------------------- |
| variations.view    | View variation listings and detail pages                | Administrator, Project Manager|
| variations.create  | Create new variations                                   | Administrator, Project Manager|
| variations.edit    | Edit variations, manage pricing items, update sell rates | Administrator, Project Manager|
| variations.delete  | Soft-delete variations                                  | Administrator                 |
| variations.sync    | Trigger sync from Premier                               | Administrator                 |
| variations.send    | Send variations to Premier                              | Administrator, Project Manager|
| variations.export  | Download variation as CSV/Excel                         | Administrator, Project Manager|

**Additional Access Rules:**

- Project Managers see only variations belonging to their managed projects
- Administrators see all variations across all projects
- External clients receive printed quotes only; they have no system access

---

## 14. Assumptions & Constraints

### Assumptions

| ID   | Assumption                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------------- |
| A-01 | All projects have their cost code structure and variation ratios configured before variations are created.|
| A-02 | The prelim_type on each cost code is correctly populated as either "LAB" or "MAT".                       |
| A-03 | Conditions exist and have valid unit rate pricing before being used in variation pricing items.           |
| A-04 | The Premier ERP API is available and reachable from the portal's application server.                     |
| A-05 | The project's external ID corresponds to the valid Job Number in Premier ERP.                            |
| A-06 | Users understand the difference between pricing items (internal scope) and Premier variation lines (ERP format). |

### Constraints

| ID   | Constraint                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------------- |
| C-01 | The Premier Company ID is hardcoded as a single value; multi-company support is not available.            |
| C-02 | The JobSubledger is hardcoded as "SWCJOB" for all variation submissions.                                 |
| C-03 | The project selector on the variation create page is limited to three configured parent project groups.   |
| C-04 | Premier API authentication tokens expire after 30 minutes; the portal caches them for 29 minutes.        |
| C-05 | The CSV download format follows the QTMP specification required by Premier.                              |
| C-06 | The Premier sync job has a 300-second timeout; large volumes of variations may require multiple syncs.   |
| C-07 | Client quotes are rendered as a browser-printable page; PDF generation is not natively supported.        |

---

## 15. Glossary

| Term                  | Definition                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| **Variation**         | A formal document representing a modification to the original construction contract scope.         |
| **Variation Number**  | The unique identifier for a variation within a project (e.g., "VAR-01").                           |
| **Project / Location**| The construction project; the top-level organisational entity in the portal.                       |
| **Condition**         | A project-specific pricing template that defines unit rates for calculating costs for a type of work. |
| **Pricing Item**      | A scope line item on a variation with labour and material costs and an optional sell rate.          |
| **Premier Variation** | The Premier ERP-formatted set of cost lines generated from pricing items via Quick Gen.            |
| **Quick Gen**         | The automated process of generating Premier-compatible variation line items from pricing items.    |
| **Oncost**            | An indirect cost applied as a percentage of base labour or material (e.g., superannuation, payroll tax). |
| **Prelim Type**       | The category (LAB or MAT) that determines which base cost a variation ratio oncost is applied to.  |
| **Variation Ratio**   | The percentage oncost rate configured on each cost code for a project.                             |
| **Premier ERP**       | The Jonas Premier enterprise resource planning system used for financial management.               |
| **Multiplier**        | A percentage applied to cost rate to derive the sell rate (e.g., 220% = 2.2x markup).              |
| **Unit Rate Method**  | A pricing approach that applies fixed labour and material rates per unit of measurement (e.g., $/m2). |
| **Soft Delete**       | A deletion method that marks records as deleted without physically removing them from the database. |
| **Superior Portal**   | The web application used by the organisation for project management, including variation management.|

---

## 16. Traceability Matrix

This matrix maps business objectives to functional requirements to ensure complete coverage.

| Business Objective | Functional Requirements                                                |
| ------------------ | ---------------------------------------------------------------------- |
| BO-01 (Capture)    | FR-01 (Create), FR-02 (Edit)                                           |
| BO-02 (Costing)    | FR-05 (Pricing), FR-07 (Quick Gen), FR-10 (Variation Ratios)           |
| BO-03 (Quotes)     | FR-06 (Client Quote)                                                   |
| BO-04 (Quick Gen)  | FR-07 (Quick Gen), FR-10 (Variation Ratios)                            |
| BO-05 (Premier)    | FR-08 (Send via API), FR-11 (CSV Download)                             |
| BO-06 (Sync)       | FR-09 (Sync via API)                                                   |
| BO-07 (Access)     | FR-01.07, FR-02.02, FR-04.02, FR-08.08, FR-09.07, FR-11.06, FR-12.04 |

---

*End of Document*
