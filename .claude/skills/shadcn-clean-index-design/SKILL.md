---
name: shadcn-clean-index-design
description: Apply this project's index-page design conventions when creating or refactoring listing pages (anything under resources/js/pages/**/index.tsx). Removes redundant page-title headers that duplicate breadcrumbs, caps the table container at max-w-5xl, and offers a text-xs density option for data-heavy tables. Use when the user asks to clean up, redesign, or improve an index page, when scaffolding a new listing page, or when the skill is invoked manually.
---

# Shadcn Clean Index Design

One design ideology for every index/listing page in this app. Apply these rules whenever you create or edit a file matching `resources/js/pages/**/index.tsx` and the user has asked you to clean it up, redesign it, or this skill is invoked manually.

## Core principle: always offer, never silently skip

**Do not assume a page is "already fine" against a rule and skip the question.** Even if the current page already looks minimal — only one secondary action button, only a few columns, no filters visible — walk through every rule and offer the choice explicitly. The point of this skill is consistency across the whole app, and the user is the only one who knows whether more actions / filters / density / bulk operations are coming.

Bad: "The page is already in good shape — title header is absent, `max-w-5xl` is applied, no grey header, pagination is wired up, and the toolbar/row actions are minimal enough to skip the Burger Menu rules."

Good: walk through every rule that involves a user choice and ask. Skip only the deterministic rules (1, 2, 5) when there is genuinely nothing to change in the file.

## The rules

### 1. No redundant page-title header

The `AppLayout` already renders breadcrumbs (and the last crumb is the page name). A separate `<h1>` / `<h2>` / "page header" block at the top of the page is duplicate noise — **remove it**.

What this looks like in practice:

- Delete any top-of-page `<h1 className="text-2xl font-bold">Suppliers</h1>` (or `text-xl`, `text-lg font-semibold`, `font-bold tracking-tight`, etc.) whose text matches the breadcrumb.
- If the header wrapper exists only to hold the title, remove the wrapper too.
- If the header wrapper also holds action buttons (Create, Export, Sync), keep the wrapper and the buttons — just delete the title element.
- Subtitles / descriptive paragraphs under the title go with it unless they convey information the breadcrumb does not.

**Keep** headers that are NOT the page title — e.g. section headings inside cards, empty-state headings, modal titles. Those are not redundant.

### 2. Cap the table container at `max-w-5xl w-full`

The container that wraps the index table (and its toolbar) should be `max-w-5xl w-full mx-auto` so the table doesn't sprawl on wide monitors and stays readable.

Typical change:

```tsx
// Before
<div className="flex flex-col gap-4 p-3 sm:p-4">
  {/* toolbar + table */}
</div>

// After
<div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
  {/* toolbar + table */}
</div>
```

If the page has multiple distinct sections (e.g. KPI cards above the table), apply `max-w-5xl w-full mx-auto` to the outermost wrapper that contains everything, not to each section individually — keeps the toolbar, header actions, and table aligned to the same column.

### 3. Ask before applying `text-xs` density

**Always ask** about density — do not pre-judge based on column count:

> "Want me to set `text-xs` on the table for denser display, or keep the default size?"

Only when the user says yes:
- Add `text-xs` to the `<Table>` element (or the wrapping div).
- Tighten cell padding if needed (e.g. `[&_td]:py-1.5 [&_th]:py-1.5`).

Do NOT apply `text-xs` unprompted.

### 4. Ask whether a card view mode is required

After handling rules 1–3, **ask the user** whether this page should support a card view in addition to the table:

> "Should this page support a card view as well as the list view?"

If the user says **no**, leave the table as the only view and stop.

If the user says **yes**, implement both views with a toggle:

- Add a `view` state: `const [view, setView] = useState<'list' | 'card'>('list')` (default to `'list'`).
- Place a view toggle in the toolbar — use shadcn `ToggleGroup` (`@/components/ui/toggle-group`) with two items (`List` / icon `List` from lucide, `Cards` / icon `LayoutGrid`). Right-aligned in the toolbar, next to existing action buttons.
- Render conditionally:
  ```tsx
  {view === 'list' ? <Table>...</Table> : (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filteredItems.map(item => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle>{item.name}</CardTitle>
            <CardDescription>{item.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>{/* key fields */}</CardContent>
        </Card>
      ))}
    </div>
  )}
  ```
- The card grid should still live inside the same `max-w-5xl w-full mx-auto` wrapper from rule 2 — don't widen the page for cards.
- Card content should surface the same primary fields shown in the table (don't invent new data). Skip low-value columns (timestamps, internal IDs) in card mode unless they're meaningful at a glance.
- Persist the choice in `localStorage` under a page-specific key (e.g. `suppliers:view`) so refreshes preserve the user's preference.
- Keep search / filter behavior identical across both views — they filter the same source list.
- Follow the card header convention from `feedback_card_headers.md`: plain `<CardTitle>` / `<CardDescription>`, no icons in the header, no bordered chip around the title.

### 5. No grey background on the table header row

The `<TableHeader>` / `<TableHead>` row must NOT use a grey fill. Default shadcn `Table` already renders without a grey background — keep it that way.

- Remove any `bg-gray-*`, `bg-slate-*`, `bg-zinc-*`, `bg-neutral-*`, `bg-stone-*`, or `bg-muted` / `bg-muted/50` classes on `<TableHeader>` and `<TableHead>` elements.
- The header row should be distinguished from body rows by font weight and the bottom border only — not by a background colour.
- Hover/striped backgrounds on body rows (`hover:bg-muted/50`, etc.) are fine — this rule applies only to the **header** row.

### 6. Ask about pagination — and when used, do it on the backend

After handling rules 1–5, **ask the user** whether this page needs pagination:

> "Should this list use pagination? (Recommended for >50 rows or any query that may grow unbounded.)"

If the user says **no** (small, bounded dataset), leave it as a single client-side list.

If the user says **yes**, implement **backend** pagination and **backend** search — never load all rows and paginate/filter on the client.

**Frontend (Inertia + React):**

- Use Laravel's paginator output shape on the `usePage` props: `{ data: T[], current_page, last_page, per_page, total, links }`.
- Search input is controlled and debounced (~300ms), then triggers an Inertia GET with `preserveState: true` and `preserveScroll: true`:
  ```tsx
  router.get(route('suppliers.index'), { search, page, per_page }, { preserveState: true, preserveScroll: true, replace: true });
  ```
- Read initial `search`, `page`, and `per_page` from `usePage().props` (or URL query) so refresh / shareable URLs work.
- Both list and card views (rule 4) consume the same paginated `data` array.

**Canonical pagination footer (use this on every paginated index — do not invent a new one):**

The pagination footer is a single row, three groups: **left** = range readout ("1–25 of 1,304 items"); **right** = page-size `<Select>` followed by the shadcn `<Pagination>` nav. Use the project's existing `<Pagination>` primitives from `@/components/ui/pagination`. They ship with `Previous` / `Next` / `Link` / `Ellipsis`; add `First` and `Last` using `<PaginationLink>` with the `ChevronsLeft` / `ChevronsRight` icons.

Imports:
```tsx
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
```

Page-window helper (renders `1 … 4 5 [6] 7 8 … 20`, or all pages when `last_page ≤ 7`):

```tsx
function getPageWindow(current: number, last: number): (number | 'ellipsis')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const around = [current - 1, current, current + 1].filter((p) => p > 1 && p < last);
  const pages: (number | 'ellipsis')[] = [1];
  if (around[0] > 2) pages.push('ellipsis');
  pages.push(...around);
  if (around[around.length - 1] < last - 1) pages.push('ellipsis');
  pages.push(last);
  return pages;
}
```

Footer markup:

```tsx
const fromRow = items.total === 0 ? 0 : (items.current_page - 1) * items.per_page + 1;
const toRow = Math.min(items.current_page * items.per_page, items.total);
const pageWindow = getPageWindow(items.current_page, items.last_page);

<div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
  {/* Left — range readout */}
  <p className="text-muted-foreground text-xs sm:text-sm">
    {items.total > 0 ? `${fromRow}–${toRow} of ${items.total.toLocaleString()} items` : 'No items'}
  </p>

  {/* Right — page-size select + pagination nav */}
  <div className="flex items-center gap-3">
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
      <Select
        value={String(items.per_page)}
        onValueChange={(v) => navigate({ per_page: Number(v), page: 1 })}
      >
        <SelectTrigger size="sm" className="w-[72px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[10, 25, 50, 100].map((n) => (
            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        {/* First */}
        <PaginationItem>
          <PaginationLink
            aria-label="Go to first page"
            aria-disabled={items.current_page <= 1}
            onClick={(e) => {
              e.preventDefault();
              if (items.current_page > 1) navigate({ page: 1 });
            }}
            className={items.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
          >
            <ChevronsLeft className="h-4 w-4" />
          </PaginationLink>
        </PaginationItem>

        {/* Previous */}
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={items.current_page <= 1}
            onClick={(e) => {
              e.preventDefault();
              if (items.current_page > 1) navigate({ page: items.current_page - 1 });
            }}
            className={items.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
          />
        </PaginationItem>

        {/* Numbered pages with ellipsis */}
        {pageWindow.map((p, i) =>
          p === 'ellipsis' ? (
            <PaginationItem key={`e-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                isActive={p === items.current_page}
                onClick={(e) => {
                  e.preventDefault();
                  navigate({ page: p });
                }}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        {/* Next */}
        <PaginationItem>
          <PaginationNext
            aria-disabled={items.current_page >= items.last_page}
            onClick={(e) => {
              e.preventDefault();
              if (items.current_page < items.last_page) navigate({ page: items.current_page + 1 });
            }}
            className={items.current_page >= items.last_page ? 'pointer-events-none opacity-50' : ''}
          />
        </PaginationItem>

        {/* Last */}
        <PaginationItem>
          <PaginationLink
            aria-label="Go to last page"
            aria-disabled={items.current_page >= items.last_page}
            onClick={(e) => {
              e.preventDefault();
              if (items.current_page < items.last_page) navigate({ page: items.last_page });
            }}
            className={items.current_page >= items.last_page ? 'pointer-events-none opacity-50' : ''}
          >
            <ChevronsRight className="h-4 w-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  </div>
</div>
```

**Pagination-component rules:**

- Always use the project's `@/components/ui/pagination` primitives — never hand-roll a row of plain `<Button>` icons. If you find an existing page doing that (e.g. `materialItem/index.tsx`), migrate it to this pattern when you touch the page.
- Always include First and Last buttons — wrap `<PaginationLink>` around a `ChevronsLeft` / `ChevronsRight` icon. These primitives don't ship those out of the box; add them inline as shown above.
- Always render numbered pages with the ellipsis window helper. `current_page` gets `isActive`.
- Disabled state is `aria-disabled` + `pointer-events-none opacity-50` on the `<PaginationLink>` (Radix-style anchors don't have a native `disabled` prop).
- Override the default `mx-auto justify-center` on `<Pagination>` with `mx-0 w-auto justify-end` so it sits flush right in the action group.

**Page-size rules:**

- Options are always exactly `[10, 25, 50, 100]` — do not add 20, 200, "All", or other one-off values.
- Default `per_page` is `25` server-side (the second option) unless the user specifies otherwise.
- Changing the page size always resets `page` to `1`.
- Persist the chosen `per_page` to the URL query (via the same Inertia GET) so refresh / shareable URLs work — do **not** store it only in `localStorage`.

**Backend (Laravel controller):**

- Validate query input including `per_page` constrained to the allowed set:
  ```php
  $validated = $request->validate([
      'search'   => 'nullable|string|max:255',
      'page'     => 'nullable|integer|min:1',
      'per_page' => 'nullable|integer|in:10,25,50,100',
  ]);
  $perPage = $validated['per_page'] ?? 25;
  ```
- Apply the search filter at the query level using `when()` and indexed/searchable columns. Use `LIKE` only when columns are indexed or the table is small; otherwise prefer full-text or a dedicated search column.
  ```php
  $items = Model::query()
      ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
          $q->where('name', 'like', "%{$s}%")->orWhere('code', 'like', "%{$s}%");
      }))
      ->orderBy('name')
      ->paginate($perPage)
      ->withQueryString();
  ```
- Always `->withQueryString()` so pagination links retain the `search` + `per_page` params.
- Pass the paginator straight to Inertia; do not pre-resolve `->items()` — the React side reads `data` + meta together.

**When backend pagination is genuinely not possible** (e.g. you must aggregate the full result set client-side for a chart sitting next to the table): say so explicitly to the user before falling back to client-side, and keep the result set capped.

### 7. Offer to wrap filters in a Sheet

**Always ask** about a filter Sheet — even if the toolbar currently has zero or one filter:

> "Do you want filters in a side Sheet? (I'll move any existing secondary filters in, and you can extend it later.)"

If the user says **no**, leave the filters inline (or omit the sheet entirely if there are none yet).

If the user says **yes**:

- Use shadcn `<Sheet>` (`@/components/ui/sheet`) with `side="right"`.
- Trigger in the toolbar: an outline `<Button>` labelled `Filters` with a `SlidersHorizontal` (or `Filter`) icon from lucide. Show an active-filter count badge on the trigger when filters are applied:
  ```tsx
  <Button variant="outline" size="sm" className="gap-2">
    <SlidersHorizontal className="h-4 w-4" />
    Filters
    {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
  </Button>
  ```
- Inside the sheet: `<SheetHeader>` with `<SheetTitle>Filters</SheetTitle>`, then a `<FieldGroup>` of filter inputs, then a `<SheetFooter>` with `Reset` (ghost, clears all filters) and `Apply` (primary, closes the sheet and triggers the query).
- Search input stays **outside** the sheet in the main toolbar — only secondary filters move into the sheet.
- When backend pagination (rule 6) is enabled, applying filters resets `page` to 1 and is sent in the same Inertia GET.

### 8. Offer to collapse action buttons into a "Burger Menu" dropdown

This rule applies in **two places** — handle each independently:

**(a) Toolbar / header actions above the table.** **Always ask** about the toolbar Burger Menu — even if there's only one secondary button today, or none yet:

> "Want me to add a Burger Menu beside the `Create` button for Import / Export / Sync / etc.? (I'll move any existing secondary buttons in now and you can add more later.)"

The **primary `Create` button always stays inline** (it's the main affordance and should be the most prominent action). Everything else — Import, Export, Sync, Print, Download Template, Bulk Edit, etc. — moves into a single Burger Menu. Do not skip the offer just because there's only one secondary button today; the consistency comes from every page having the same shape.

**Position the toolbar Burger Menu all the way to the right.**

- It is always the rightmost element of the toolbar — no buttons to its right.
- If a `Create` / `New` button exists, **the Burger Menu sits to the right of the Create button** (Create on its left, Burger on the far right). This is the inverse of the obvious instinct — do not put the menu to the left of Create.
- Achieve right-alignment with `ml-auto` on the action group or `justify-between` on the toolbar (search on the left, action group on the right). Search input stays on the left of the toolbar.

```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  {/* Search on the left */}
  <div className="relative w-full sm:max-w-xs">
    <InputSearch ... />
  </div>

  {/* Action group pinned to the right; Burger is the rightmost item */}
  <div className="flex items-center gap-2">
    <Button onClick={...}>
      <Plus className="h-4 w-4" /> New Supplier
    </Button>

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="More actions">
          <Menu className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-max">
        <DropdownMenuItem className="whitespace-nowrap" onClick={...}>Import CSV</DropdownMenuItem>
        <DropdownMenuItem className="whitespace-nowrap" onClick={...}>Export CSV</DropdownMenuItem>
        <DropdownMenuItem className="whitespace-nowrap" onClick={...}>Sync from Premier</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</div>
```

If there is no `Create` button on the page, the Burger Menu is still pinned to the far right of the toolbar by itself (use `ml-auto` on it).

**(b) Row actions inside the table.** **Always ask** about the row Burger Menu — even if rows currently have only one action, or none:

> "Want a per-row Burger Menu dropdown for actions? (Keeps the actions column compact and consistent across pages.)"

If the user says **no**, leave the buttons inline.

If the user says **yes**:

- Single trigger per row using `<DropdownMenu>` + `<DropdownMenuTrigger asChild>` containing a ghost icon button. **The trigger must use the hamburger icon** (`Menu` from lucide) — call it the "Burger Menu":
  ```tsx
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Row actions">
        <Menu className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {/* items */}
    </DropdownMenuContent>
  </DropdownMenu>
  ```
- Destructive items (Delete, etc.) get `className="text-destructive focus:text-destructive"` and sit below a `<DropdownMenuSeparator />`.
- The actions cell should be right-aligned and narrow (`<TableHead className="w-12 text-right">` / `<TableCell className="text-right">`).

#### Menu-content sizing and item content (applies to BOTH toolbar 8a and row 8b)

**No menu item may wrap to two lines.** Every label must render on a single line. Two failure modes to prevent:

1. **Items wrapping** — when a label is longer than the default menu width, base-ui will let it wrap. Fix by sizing the menu to its widest item, not by truncating.
2. **Long labels truncated mid-word** — `truncate` / `text-ellipsis` is **not** the answer here. Users need to read the full action; ellipsizing menu items is a UX failure.

Apply both:

- Add `whitespace-nowrap` to every `<DropdownMenuItem>` so the label can never break onto a second line.
- Size the `<DropdownMenuContent>` with `min-w-max` (or `w-max`) so the popover grows to fit the widest item. Combine with a sensible cap (`max-w-[320px]`) only when one outlier label is dragging the menu absurdly wide; otherwise leave it unbounded.

```tsx
<DropdownMenuContent align="end" className="min-w-max">
  <DropdownMenuItem className="whitespace-nowrap" onClick={...}>Download CSV template</DropdownMenuItem>
  <DropdownMenuItem className="whitespace-nowrap" onClick={...}>Sync from Premier</DropdownMenuItem>
  {/* ... */}
</DropdownMenuContent>
```

**No icons in action menu items.** Action menus (both toolbar and row) are text-only — the trigger already carries the visual affordance (the hamburger). Adding per-item icons fights the trigger, slows scanning, and makes alignment fiddly.

- Don't put `<Upload />`, `<Download />`, `<Trash2 />`, `<Pencil />`, etc. inside `<DropdownMenuItem>`.
- The one explicit exception is `<DropdownMenuSubTrigger>` (a sub-menu within the action menu, e.g. "Toggle columns") — those may keep their chevron because the chevron is structural, not decorative. Even then, prefer no leading icon.
- Destructive intent is communicated by `text-destructive`, the separator above it, and the confirmation dialog — not by a trash icon.

#### Critical: handle focus when a menu item opens a Dialog / AlertDialog

> ⚠️ **This project uses base-ui DropdownMenu, not Radix.** The two libraries handle item-select focus differently and the "Radix pattern" (`onSelect` + `e.preventDefault()` + `setTimeout`) **does not work here** — it actually fights base-ui's auto-close and traps focus, leaving the dialog unreachable. Don't copy the Radix pattern from generic shadcn docs.
>
> A confirmed working reference in this codebase is `resources/js/pages/toolbox-talks/index.tsx` — copy that shape.

**The pattern that works in this codebase (base-ui DropdownMenu):**

1. Use plain `onClick` on `<DropdownMenuItem>`, **not** `onSelect` and **not** `e.preventDefault()`. base-ui closes the menu automatically on click — let it.
2. **Hoist the dialog out of the dropdown's container** to the page-level layout. Do not render `<Dialog>` / `<AlertDialog>` inside the same `<div>` that wraps the `<DropdownMenu>`, and never inside `<DropdownMenuContent>`. When the menu unmounts on close, anything sharing its container competes for focus on unmount.
3. Track the target via lifted state (`selectedRowId` / `dialogOpen` / `deleteTarget`) so the dialog renders at the page level and is unaffected by the menu's open/close lifecycle.

```tsx
// At the page level (outside any toolbar / row wrapper that contains the dropdown)
const [editTarget, setEditTarget] = useState<Row | null>(null);
const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

// Inside the row — note plain onClick, no onSelect, no preventDefault, no setTimeout
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="Row actions">
      <Menu className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => setEditTarget(row)}>Edit</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      className="text-destructive focus:text-destructive"
      onClick={() => setDeleteTarget(row)}
    >
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

// Page-level dialogs — siblings of the table/toolbar, NOT nested inside them
<Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
  {editTarget && <EditForm row={editTarget} onClose={() => setEditTarget(null)} />}
</Dialog>

<AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
  {/* confirm UI */}
</AlertDialog>
```

Rules of thumb for this pattern:

- **`onClick`, not `onSelect`** — `onSelect` + `preventDefault()` is a Radix workaround and breaks base-ui's close cycle.
- **No `setTimeout` / `queueMicrotask`** dance — not needed in base-ui; trust its close behavior.
- **No `e.preventDefault()`** — letting base-ui auto-close is the whole point.
- **Hoist dialog state and the dialog JSX to the page level.** A reliable mental model: the dropdown owns "which action was chosen", the page owns "which row is being acted on". If the dialog renders inside the toolbar `<div>` or inside `<DropdownMenuContent>`, fix it before debugging anything else.
- **One dialog per action at the page level**, not one per row. Drive the open state from a lifted `target` value (`editTarget`, `deleteTarget`) — avoids mounting N dialogs and is the pattern used elsewhere in this repo.
- Do NOT use `modal={false}` on the dropdown as a workaround — it breaks click-outside dismissal and accessibility.

**Toolbar (rule 8a) Burger Menu has the same gotcha** — if any of its items (e.g. "Import CSV") opens a dialog, the dialog must live at the page level, not inside the toolbar `<div>` next to the dropdown trigger. See `resources/js/pages/costTypes/index.tsx` for a worked example where the `CsvImporterDialog` is hoisted out of the toolbar after this was diagnosed.

### 9. Offer multi-select / bulk actions when row actions exist

If rule 8(b) is in play (rows have per-row actions like Delete, Archive, etc.), some of those actions are likely safe to perform on many rows at once. **Ask the user**:

> "Some row actions look like they could be done in bulk (e.g. Delete). Want me to add multi-select with a bulk-action bar?"

If the user says **no**, skip this rule.

If the user says **yes**, only enable bulk versions of actions that are **idempotent / non-form-driven**. Good candidates: Delete, Archive, Restore, Mark as ..., Approve, Reject, Bulk Export. Bad candidates: Edit (needs a form per row), Duplicate-with-overrides, anything that opens a single-row dialog.

**Implementation:**

- Add a leading checkbox column: `<TableHead className="w-10">` with a master `<Checkbox>` (select-all / select-page) wired to indeterminate state.
- Each row gets `<TableCell className="w-10"><Checkbox checked={isSelected(row.id)} onCheckedChange={(c) => toggle(row.id, c)} /></TableCell>`.
- Selection state: `const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())`. Use a `Set` — much faster than array `.includes()` for large pages.
- Master checkbox semantics:
  - All current-page rows selected → checked
  - Some selected → `indeterminate` (set via ref / shadcn `data-state="indeterminate"`)
  - None selected → unchecked
  - Click cycles: indeterminate/none → all-on-page; all-on-page → none.
- When **backend pagination (rule 6) is enabled**, "select all" defaults to selecting only the current page. Offer an inline "Select all N matching" link in the action bar when at least one full page is selected — this triggers backend selection by query (send `select_all=true` + current filters to the API, not a list of IDs).
- Clear selection when filters / search / page change unless the user explicitly opted into cross-page selection.

**Bulk action bar:**

- Appears at the top of the table (above the toolbar or as a floating bar over it) only when `selectedIds.size > 0`.
- Left side: count — `"N selected"` with a small `Clear` ghost button (`X` icon).
- Right side: action buttons drawn from the row actions filtered to bulk-safe ones. If there are >2, collapse them into a Burger Menu the same way rule 8 does for the toolbar.
- Destructive bulk actions (Bulk Delete) always go through a confirmation `<AlertDialog>` — never delete on a single click.

**Backend:**

- Accept an array of IDs: `$request->validate(['ids' => 'required|array|min:1', 'ids.*' => 'integer|exists:table,id']);`
- For "select all matching": accept `select_all=true` + the same filter params used by the index query, and resolve IDs server-side.
- Authorize per-item where relevant — don't trust the client to filter out non-permitted rows.
- Return JSON with the affected count and any failed IDs so the UI can toast a useful message.

### 10. Use Combobox (not Select) when there can be more than 5 options

**Never use the raw HTML `<select>` element.** All single-choice dropdowns on index pages are either the shadcn `<Select>` from `@/components/ui/select` or the shadcn `<Combobox>` from `@/components/ui/combobox` — there is no third option. This restates the project-wide rule in `use-shadcn-components.md`; if you ever find a `<select>`/`<option>` tag in an index page, replace it.

Pick between the two shadcn components by **option count and growth**:

- **shadcn `<Select>`** — short, fixed enums defined in code (status, priority, yes/no/maybe). Capped, bounded, and small.
- **shadcn `<Combobox>`** — anything whose option list **can grow past 5 items**, including future growth as more rows are added.

Scrolling a long `<Select>` to find an option is far worse than typing two letters in a combobox.

**When this applies on an index page:**

- Filter Sheet controls (rule 7) — e.g. "Project", "Supplier", "Category", "Assigned to", "Cost code" almost always have >5 options. Use `<Combobox>`.
- Page-size selector (rule 6) — has exactly 4 options (10/25/50/100), so **`<Select>` is correct** there. Don't combobox-ify it.
- Card view's group-by or sort-by (rule 4) — if the list of fields is small and fixed (≤5), `<Select>` is fine; otherwise `<Combobox>`.
- Bulk-action target pickers (rule 9) — e.g. "Move to project" — always `<Combobox>`.

**How to judge "more than 5":**

- Count the options the field can have, not just what it has today. A "Supplier" filter with three suppliers seeded right now still uses Combobox because suppliers grow.
- Free-form-feeling fields (people, locations, categories, codes) → always Combobox.
- Bounded enums defined in code (status, severity, priority) → Select.

**Pattern:**

```tsx
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty, ComboboxValue, ComboboxTrigger } from '@/components/ui/combobox';

<Combobox value={selected} onValueChange={setSelected} items={suppliers}>
  <ComboboxTrigger>
    <ComboboxValue placeholder="Select supplier..." />
  </ComboboxTrigger>
  <ComboboxContent className="min-w-(--anchor-width)">
    <ComboboxInput placeholder="Search suppliers..." />
    <ComboboxEmpty>No supplier found.</ComboboxEmpty>
    <ComboboxList>
      {suppliers.map((s) => (
        <ComboboxItem key={s.id} value={s.id}>{s.name}</ComboboxItem>
      ))}
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

#### Combobox dropdown width — always match the trigger

By default, `<ComboboxContent>` applies `min-w-[calc(var(--anchor-width)+--spacing(7))]`, which makes the popup **28px wider** than the trigger. In narrow containers (Sheet, side panels, cramped toolbars) this causes base-ui's positioner to give up on `align="start"` and shift the popup horizontally — sometimes clipping it outside the Sheet entirely.

**Unless the user explicitly asks for a wider popup, always force the popup width to match the trigger** by adding `min-w-(--anchor-width)` to the `<ComboboxContent>` className. This overrides the default and pins the popup's `min-width` to the anchor width instead of `anchor-width + 28px`.

```tsx
<ComboboxContent className="min-w-(--anchor-width)">
  {/* ... */}
</ComboboxContent>
```

Notes:

- The `(--anchor-width)` syntax is a Tailwind v4 arbitrary-property shorthand for `var(--anchor-width)`. Base-ui sets that CSS variable on the popup's positioning context.
- The chips variant (`<ComboboxChips>`) already pins to `--anchor-width` via the built-in `data-[chips=true]:min-w-(--anchor-width)` selector — no override needed there.
- If a user explicitly wants the popup to extend beyond the trigger (e.g. long item labels that would otherwise wrap), drop the override and either let the default `+28px` ride or set an explicit wider value like `min-w-[320px]`. Document the choice with a one-line comment because it overrides this rule.

For very large datasets (1000+ options — employees, all locations across years, etc.), don't ship the whole list as `items` to the client. Use a server-backed Combobox: debounce the input, fire a search request to a lightweight endpoint, and render whatever comes back. The toolbar search input from rule 6 is your model for this — same Inertia / fetch shape.

**Multi-select selects always use Combobox.** Even with ≤5 options, the multi-select native pattern is awful. Use `<ComboboxChips>` + `<ComboboxChipsInput>` from the same module.

## Workflow when invoked

1. Read the target index page file (and its controller if the user agrees to add pagination/search in step 7).
2. Identify the redundant page-title header (compare against the `breadcrumbs` array in the same file). Remove it.
3. Find the outermost content wrapper inside `<AppLayout>` and apply `max-w-5xl w-full mx-auto`.
4. Strip any grey background classes from `<TableHeader>` / `<TableHead>` (rule 5).
5. Count visible table columns / inspect data density. If the table looks heavy, ask the user about `text-xs` before making that change.
6. Ask the user whether this page should support a card view. If yes, implement the toggle per rule 4.
7. Ask the user whether this page needs pagination. If yes, implement backend pagination + backend search per rule 6 (touches both the React page and the Laravel controller).
8. Scan the toolbar for filter controls beyond the search input. If present, ask about moving them into a Sheet (rule 7).
9. Scan the toolbar for secondary action buttons (Import / Export / Sync / etc.) sitting alongside a primary `Create` button. If ≥2 secondary buttons exist, ask about collapsing them into a Burger Menu (rule 8a) — `Create` stays inline.
10. Scan rows for multiple action buttons. If present, ask about collapsing them into a Burger Menu dropdown (rule 8b), and implement the focus-safe pattern when actions open dialogs.
11. If row actions exist and at least one is bulk-safe (Delete, Archive, etc.), ask about enabling multi-select with a bulk-action bar (rule 9).
12. Audit every dropdown/select on the page (filter Sheet controls, group-by, bulk-action target pickers, etc.) against rule 10 — anything whose option list can grow past 5 must be a `<Combobox>`, not a `<Select>`. Migrate any `<Select>` that violates the rule.
13. Apply edits.
14. **After every pass, run `npm run lint` and clear the errors before reporting back.** See the lint-pass section below.

## Lint pass — required after every edit

After applying changes from any rule, run the project's linter and fix what it reports. The script is `npm run lint` (defined in [package.json](package.json) — runs `eslint . --fix`, so most issues are auto-corrected; only the remaining manual ones need attention).

```bash
npm run lint
```

What to do with the output:

- **Auto-fixed issues** — the `--fix` flag already wrote them; no further action.
- **Remaining errors** — read and fix them. Common culprits after this skill's edits:
  - `no-unused-vars` / `@typescript-eslint/no-unused-vars` — imports left behind after removing the old page-title header, old inline action buttons (when moved into the Burger Menu), or old icon imports (after stripping per-item icons per rule 8). Delete unused imports.
  - `react-hooks/exhaustive-deps` — debounced search effects added in rule 6 may complain about missing deps. Add them, or `// eslint-disable-next-line` only if the omission is intentional and you explain why.
  - `react/jsx-no-undef` — using a lucide icon (`Menu`, `ChevronsLeft`, `ChevronsRight`, etc.) without importing it.
  - `@typescript-eslint/no-explicit-any` — avoid `any` on Inertia paginator props; type them as the paginator shape `{ data: T[]; current_page: number; last_page: number; per_page: number; total: number; }`.
- **Warnings** — fix them if they're in the code you touched; leave pre-existing warnings elsewhere alone (no scope creep).

**Do not skip the lint pass and do not silence errors with broad `eslint-disable` comments.** If a rule is genuinely wrong for the line, disable that specific rule on that specific line with a one-line justification.

Only report the task as complete after `npm run lint` exits clean.

## What NOT to do

- Don't change column structure or unrelated sort logic.
- Don't introduce new wrapper components, abstractions, or "shared index layout" components.
- Don't restyle buttons, inputs, or toolbars beyond what these rules require.
- Don't add comments explaining the design choices — the skill is the documentation.
- Don't apply `max-w-5xl` to full-screen dashboards or canvas-style pages (calendars, kanban boards, drawing viewers) — only to standard table-driven index pages.
- Don't implement client-side pagination or client-side filtering of a fully-loaded dataset when the user has opted into pagination — backend only.
