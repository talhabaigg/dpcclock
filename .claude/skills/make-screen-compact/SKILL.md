---
name: make-screen-compact
description: Make a screen compact by capping its content width and shrinking every interactive element to text-xs density. Offers max-w-5xl on the outer container, then converts the table, inputs, selects, comboboxes, date pickers, filter buttons, badges, dropdown triggers, tabs, and pagination to text-xs with proportionally tighter padding. Use when the user asks to make a page compact, denser, smaller text, fit more on screen, or invokes /make-screen-compact.
---

# Make Screen Compact

A two-step density pass for any page (index, detail, form, dashboard — not just listings). The goal: more information visible at once, without breaking layout or accessibility.

## Step 1 — Offer the width cap

Before touching density, ask:

> "Cap the outer content container at `max-w-5xl w-full mx-auto` so it doesn't sprawl on wide monitors? (y/n)"

If the user says yes:

- Find the outermost wrapper that contains the page body (usually the first `<div>` inside the `AppLayout` children, or the `<Head>` sibling).
- Apply `mx-auto flex w-full max-w-5xl flex-col` (preserve existing `gap-*` / `p-*` classes).
- If the page already has a wider cap (`max-w-6xl`, `max-w-7xl`, `container`), replace it with `max-w-5xl`.
- If the page already has `max-w-5xl`, say so and move on — do not duplicate.
- If the page is a full-bleed dashboard the user explicitly wants edge-to-edge, skip this step.

Apply the cap to **one outermost wrapper**, not to every section — otherwise the toolbar, header actions, and content lose alignment.

## Step 2 — Apply `text-xs` density to everything

This is the heart of the skill. Walk through the page and convert **every** visible interactive or data-bearing element to `text-xs`. Do not skip elements because "they already look fine" — consistency is the point.

### What to change

For each element type below, add `text-xs` to the className (or replace any existing `text-sm` / `text-base` on that element). When padding is listed, apply it too — `text-xs` without tighter padding leaves the element visually the same size.

#### Tables
- `<Table>` element: add `text-xs`.
- Tighten cell padding via a wrapping class on the table: `[&_td]:py-1.5 [&_th]:py-1.5 [&_td]:px-2 [&_th]:px-2`.
- `<TableHead>` content (sort buttons, column header text) should inherit; do not add `text-sm` anywhere inside.
- Row action triggers (the EllipsisVertical Burger Menu) stay icon-sized — no text class needed.

#### Inputs
- `<Input>`: add `text-xs` and `h-7` (down from default `h-8`). Reduce `px-2.5` → `px-2` for proportion.
- `<Textarea>`: add `text-xs` only (keep its variable height).
- `<Label>`: add `text-xs`.

#### Selects / Comboboxes / Date pickers
- `<Select>` / `<SelectTrigger>`: add `text-xs h-7 px-2`.
- `<SelectContent>` / `<SelectItem>`: add `text-xs` on the content wrapper so options match.
- `<Combobox>` trigger button: same as SelectTrigger.
- `<DatePicker>` / `<DateTimePicker>` trigger: `text-xs h-7 px-2`.
- `<Calendar>` itself: leave alone (its own grid sizing).

#### Buttons (filter buttons, secondary actions, toolbar buttons)
- Use the `size="sm"` variant if present, then add `text-xs h-7 px-2.5`.
- Primary CTA buttons (Create, Save) can stay `size="sm"` with `text-xs` — keep them recognizable, just smaller.
- Icon-only buttons: add `h-7 w-7` and shrink the icon (`size-3.5` instead of `size-4`).

#### Badges, pills, status chips
- `<Badge>`: add `text-xs` and `px-1.5 py-0` if the existing classes are bigger.

#### Tabs
- `<TabsList>`: add `text-xs h-8`.
- `<TabsTrigger>`: add `text-xs px-2.5 py-1`.

#### Pagination
- Pagination buttons: `text-xs h-7 min-w-7 px-2`.
- "Showing X of Y" caption: `text-xs`.

#### Dropdown menus (Burger Menu and other triggers)
- `<DropdownMenuTrigger>` icon-only buttons: shrink as above.
- `<DropdownMenuContent>`: add `text-xs` so all items inherit.
- `<DropdownMenuItem>`: should inherit; if it has explicit `text-sm`, change to `text-xs`.

#### Cards / KPI tiles (if present)
- Card title: `text-xs font-medium` (was likely `text-sm` or larger).
- Card big-number value: keep large — that's the focal point.
- Card description/subtitle: `text-xs text-muted-foreground`.

#### Section headings within the page
- Inline section headings (inside cards, above tables): drop one step — `text-sm` → `text-xs`, `text-base` → `text-sm`.
- **Do not shrink the breadcrumb area** — `AppLayout` controls that.

### What NOT to change

- Page title / breadcrumbs in `AppLayout`.
- Modal/Dialog titles — those have their own scale.
- Empty-state messaging — keep it readable, it's already centered and minimal.
- Toast/notification text — separate concern.
- Form field error messages — `text-destructive text-xs` is usually already the default; verify.
- Inline icons inside buttons — adjust `size-*` only if the button gets `h-7` or smaller.

## How to apply

1. Read the page file (e.g. `resources/js/pages/foo/index.tsx`) and any sub-components it renders that are page-specific (not the shared `ui/*` primitives).
2. Ask the width-cap question from Step 1.
3. Make a single edit pass adding `text-xs` (and the paired padding/height classes) to every category present on the page. Do **not** edit the shared `ui/*` primitives (Input, Select, etc.) — apply via className on the usage site so the change is local to this screen.
4. After editing, list what changed in 1–2 sentences ("Added `text-xs` to table, 4 filter buttons, search input, status select, and pagination; tightened cell padding to `py-1.5`.") so the user can spot anything missed.

## Edge cases

- **Page uses a shared `<DataTable>` wrapper**: pass density classes via the `className` prop on the wrapper rather than digging into the shared component.
- **Page has charts**: leave chart internals alone. Shrink the surrounding card title/legend text to `text-xs`.
- **Page already partially compact** (some elements at `text-xs`, others at `text-sm`): bring the stragglers down — that's the inconsistency this skill exists to fix.
- **User pushes back on a specific element looking too small**: revert that element only; don't undo the whole pass.
