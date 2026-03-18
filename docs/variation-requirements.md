# Variation Management — Requirements

**Status:** Built | **Last Updated:** 2026-03-18

---

## Purpose

Answer one question: **"What does this scope change cost us, and what do we charge the client?"**

The Variation module lets project teams create, price, and manage change orders on construction projects. It takes a scope change through a structured 4-step process — from initial description, through internal costing, client quoting, and finally export to Premier for financial processing.

---

## How a Variation Moves Through the System

| Stage | What Happens |
|---|---|
| **1. Captured** | Someone identifies a scope change. A team member opens the system and records the details — which project, what the work is, and what type of change it is |
| **2. Priced** | The team works out what the change will cost. They can pull rates from the project's pre-set conditions or enter costs manually |
| **3. Quoted** | The team sets the sell price for the client. They choose a markup, review the profit margin, and print a professional quote |
| **4. Exported** | The system generates the cost breakdown in the format Premier needs, including all the on-cost lines (super, payroll tax, etc.) |
| **5. Sent** | The variation is sent to Premier with one click. Once sent, it's locked so nobody can accidentally change it |

---

## Step 1: Variation Details

The user fills in the basics:

- **Project** — which construction project this variation belongs to (searchable list of active projects)
- **Variation Number** — a reference number like "VAR-001"
- **Description** — what the scope change is about
- **Type** — what category it falls under (e.g. dayworks, variations)
- **Date** — when the variation was raised (defaults to today)

The system won't let the user continue until the project, number, and description are filled in. Managers only see their own projects.

---

## Step 2: Pricing

This is where the team works out what the variation will cost. There are two ways to add items:

### Using a Condition (Recommended)

Conditions are pre-set pricing templates that exist on each project. They contain the agreed labour rate and material rates for different types of work (e.g. "plasterboard install", "timber framing").

The user picks a condition and enters a quantity (e.g. 50 linear metres). The system automatically calculates:
- How much the labour will cost
- How much the materials will cost
- The total

For wall-type work measured in linear metres, the system automatically converts to square metres using the wall height for costing purposes.

### Manual Entry

If there's no matching condition, the user can enter costs directly:
- A description of the work
- How much (quantity and unit — e.g. 10 hours, 25 square metres, 1 lot)
- Labour rate per unit
- Material rate per unit

The system calculates the totals.

### Managing the List

Users can:
- Add as many items as needed
- Edit any item after adding it
- Reorder items
- Delete items (with a confirmation prompt)

The screen shows running totals for labour, materials, and the grand total.

Users can also create new conditions on the spot using the "Manage" button if a condition doesn't exist yet for the type of work.

---

## Step 3: Client Quote

This is where the team sets what the client will be charged and reviews the profit margin.

### Setting Sell Rates

For each item, the user sets a sell rate using either:
- **Multiplier** — e.g. entering 220% means "charge the client 2.2 times what it costs us"
- **Direct rate** — entering the dollar amount per unit directly

The "Apply Down" button copies a multiplier to all items below — useful when applying the same markup across the board.

### Margin Visibility

The system shows for each item and in summary:
- **Cost** — what we pay
- **Sell** — what we charge
- **Margin ($)** — the difference
- **Margin (%)** — the profit percentage

Green means positive margin. Red means we're losing money on that item.

### Unit Display Toggle

For wall items measured in linear metres, the user can switch the display to show rates per square metre instead. This is useful because some clients prefer to see pricing in m2. The toggle carries through to the printed quote.

### Client Notes

A free-text area for any notes to include on the quote (e.g. exclusions, assumptions, terms).

### Print Quote

Opens a professional, print-ready quote in a new tab showing:
- Company logo and variation number
- Project details (name, date, job number)
- Description of works
- Table of items with quantities, rates, and totals
- Sub total and total (excluding GST)
- Client notes
- Footer: "Works will not proceed without written approval from an authorised representative"

---

## Step 4: Premier Export

This step produces the detailed cost breakdown that Premier needs for financial tracking.

### Generating Premier Lines

The "Generate Premier Lines" button automatically creates all the cost lines:

- **Labour on-costs** — each project has percentage-based on-cost rates (superannuation, payroll tax, workcover, site allowances, etc.). The system takes the total labour cost and applies each applicable on-cost percentage to produce individual cost lines
- **Material lines** — grouped by cost code, one line per material type
- **Material on-costs** — same concept as labour on-costs, but applied to total material cost

The system handles this automatically using the project's pre-configured on-cost rates. If lines already exist and the user regenerates, a warning confirms that existing lines will be replaced.

### Editing Lines

After generation, users can review and adjust the lines in a spreadsheet-like grid. They can add, edit, or delete individual lines.

### Quick Gen (Shortcut)

A manual shortcut for experienced users: enter a dollar amount and choose "Labour" or "Material". The system generates just the on-cost lines for that amount.

### Download Excel

Downloads the variation as a spreadsheet file in the format Premier accepts for import.

### Send to Premier

One click sends the variation directly to Premier via automated integration. The system confirms before sending. Once successfully sent, the variation status changes to "Sent" and it's locked to prevent accidental changes.

---

## Variation List

The main variations page shows all variations the user has access to.

### What Users See

A table (or card view) showing each variation's number, project, date, status, description, type, total cost, and total revenue. Colour-coded status badges make it easy to scan (amber = pending, blue = sent, green = approved, red = rejected).

### Filtering

Users can filter by:
- Free-text search (searches variation number, description, and project name)
- Status
- Type
- Project (when viewing across all projects)

### Project-Level View

When accessed from within a specific project, the page shows:
- Summary cards: total approved revenue and total pending revenue for that project
- A "Sync" button to pull the latest variation data from Premier

### Actions

Each variation has a menu with: View, Edit, Download Excel, Duplicate, Send to Premier, and Delete. Edit and Send are disabled for variations that have already been sent or approved.

---

## Variation Detail Page

A read-only summary of a single variation showing:

- Variation number, status, and type at the top
- Summary cards: Total Cost, Total Revenue, Margin, Margin %
- Full details: project, date, created by, description
- Pricing items table (the internal costing)
- Premier line items table (the cost breakdown for Premier)
- Client notes

Action buttons allow: Edit, Print Quote, Download Excel, Send to Premier, and Duplicate.

---

## Duplication

Users can duplicate any variation. The copy gets "-COPY" appended to its number and starts in "pending" status. All pricing and line items are copied.

---

## Premier Sync

A background process that pulls variation data from Premier back into the system for a given project. This keeps the portal in sync with Premier — useful when variations are modified or approved in Premier directly.

---

## Who Can Do What

| Action | Admin | Manager |
|---|---|---|
| View variations | All projects | Their projects only |
| Create variations | Yes | Yes |
| Edit variations | Yes | Yes |
| Delete variations | Yes | No |
| Send to Premier | Yes | Yes |
| Sync from Premier | Yes | No |
| Download Excel | Yes | Yes |

Variations that have been sent to Premier or approved are locked — nobody can edit them regardless of role.

---

## Dependencies

For the variation system to work correctly, each project needs:
- **Cost codes** synced from Premier with on-cost percentages (variation ratios) configured
- **Conditions** set up with labour and material unit rates for the types of work on that project
- **Premier connection** available for sending variations and syncing

---

*End of Document*
