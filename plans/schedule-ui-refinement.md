# Schedule UI Refinement Plan

Target: [resources/js/pages/locations/schedule.tsx](../resources/js/pages/locations/schedule.tsx) + [schedule/](../resources/js/pages/locations/schedule/) module.

Track: **UI refinement first** (P1–P2 from critique). Feature gaps (delay notices, variance report) deferred to a second plan.

---

## 1. Industry language pass

Replace internal "Saved Plan" wording with construction-industry terms throughout UI, menus, toasts, confirms.

- [x] Rename "Saved Plan" → **Baseline** everywhere in [schedule-toolbar.tsx](../resources/js/pages/locations/schedule/schedule-toolbar.tsx)
- [x] Rename `Saved Plan Start/Finish` → `Baseline Start/Finish` in add/edit task dialogs
- [x] Update toasts in [schedule.tsx](../resources/js/pages/locations/schedule.tsx) (`Baseline set`, `Restored to baseline`)
- [x] Update `confirm()` text on revert to reference "baseline"
- [x] Internal identifiers already use `baseline_*` — no code rename needed.

## 2. Destructive action hardening

`Delete All Tasks` and `Set Baseline` are both one click + `window.confirm()`. Both overwrite irreplaceable data.

- [x] Replaced `window.confirm()` with a proper AlertDialog-based `ConfirmDialog` ([schedule/confirm-dialog.tsx](../resources/js/pages/locations/schedule/confirm-dialog.tsx)) supporting typed-to-confirm.
- [x] `Delete All Tasks` now requires typing the project name; button styled destructive.
- [x] `Set Baseline` confirm dialog warns any existing baseline is overwritten.
- [x] `Restore to Baseline` confirm lists exactly what's overwritten (start/end dates) and what is not (links, responsible, status, ownership) — verified against `ProjectTaskController::revertToBaseline`.
- [ ] Move `Delete All Tasks` out of the Tasks menu into a "Danger zone" submenu (deferred — dialog friction alone materially reduces risk).

## 3. Link-mode discoverability

Today: invisible until toggled; unlabeled orange dots; only FS linking; click-click gesture unfamiliar to MS Project users.

- [x] Bar-hover reveals faint connector dots even when Link Tasks mode is OFF — purely visual (dots are `pointer-events-none` so they don't block bar drag or resize handles).
- [x] `onEnableLinkMode` wiring in place so that *if* dots are ever made clickable when off, clicking auto-enables link mode. Currently inert by design (resize/drag take precedence).
- [x] Connector dots have `aria-label` and native `title` tooltips ("predecessor" / "successor").
- [x] Added a help popover (`?`) beside the Link Tasks button explaining the mechanic + FS/SS/FF/SF dependency types.
- [x] Existing inline chip-row hint ("Click the dots on two bars to connect tasks.") retained — provides the in-mode reminder.
- [ ] Drag-to-link gesture (deferred — click-click now discoverable via hover + auto-enable; drag is a larger event-model change best sized separately).

## 4. Toolbar chip farm

Active-filter chips currently can stack 8+ items, wrapping onto 2–3 rows and pushing the Gantt down.

- [x] Collapsed all filter-state chips into a single `N filters` pill (popover) — Late, Critical, Our Team, search, task-filter, start-range, end-range all live inside it, each removable, with `Clear all`.
- [x] Kept mode indicators (`Baseline`, `Link Tasks On`) inline as small chips.
- [x] Removed the inline "Click the dots on two bars…" hint — help popover + hover affordance replace it.
- [x] Unified chip colour system as a side-effect — filter popover uses one neutral palette instead of 4 competing tints (destructive/primary/green/muted).

## 5. Readability on-site (tablet/sunlight)

Grid cells use `text-[10px]` and `text-[11px]`; drag tooltip is also 10px.

- [x] Bumped grid body text `text-[11px]` → `text-xs` across task-tree-row, gantt-bar, gantt-header year row.
- [x] Bumped drag-preview tooltip and bar-label text to 12px.
- [x] Red-overload audit:
  - Today indicator line → **blue** (was red). It's a temporal reference, not a warning.
  - Critical path ring stays red (industry convention).
  - Overdue status badge stays red (correct warning semantics).
  - Late-Tasks filter no longer uses destructive red (Section 4 collapsed it into neutral popover).
- [ ] Density toggle (Comfortable / Compact) — **deferred**. Would require threading `ROW_HEIGHT` through dependency-arrows, gantt-row, gantt-panel, task-tree-panel (pixel-perfect math). Text-size bump delivers most of the readability win already; density is a larger, separable change.

## 6. Bulk-edit responsible & status (new)

Today bulk action only works as "Mark as Ours / Unmark" on search results.

- [x] Generalised the bulk-edit bar — now visible whenever *any* filter narrows the visible set (search, task filter, date ranges, Late/Critical/Ours filters), not only search.
- [x] Added `Responsible…` bulk picker (combobox with search + create-new + clear option) reusing the row-cell pattern.
- [x] Added `Status…` bulk picker (dropdown of `not_started/in_progress/blocked/done` + clear).
- [x] Kept `Mark as Ours` / `Unmark` alongside; added a count indicator ("N visible:") before the actions.
- [x] Backend: added `bulkUpdate` method + `POST /locations/{location}/tasks/bulk-update` route. Accepts `task_ids` + optional `responsible` / `status` / `is_owned`.
- [x] Confirm dialog (native confirm) before every bulk action showing the exact count and value.
- [x] Leaf tasks only — `filteredTaskCount` and ID list both filter `!t.hasChildren`.
- [x] Added bulk **Colour…** picker (PRESET_COLORS + default) — same confirm-before-apply pattern.

## 7. Row density & control noise

Every row shows drag-handle + indent/outdent + kebab menu + inline cells — 4+ controls per row on a 500-task program.

- [x] Kebab menu fully hidden until row hover (was 50% idle); kebab already consolidates Rename/Delete/Add Sub-task/Indent/Outdent — no separate buttons exist.
- [x] Drag-handle dimmed to 25% at rest, full opacity on hover (kept faintly visible so users know rows are draggable).
- [x] Ownership + status cells stay always-visible — they're the data foremen scan for.

## 8. Feedback polish

- [x] Loading overlay replaced with a compact top-right pill — non-blocking; the Gantt stays visible. Message is contextual ("Importing tasks…", "Saving baseline…", "Restoring baseline…", etc.).
- [x] Row flash on save — green flash animates row background for 700ms after dates/responsible/status persist successfully. New `@keyframes flash-save` in [app.css](../resources/css/app.css); `flashTaskId` state in schedule.tsx plumbed through panel → row.
- [x] `onSetBaseline` now uses the shared loading state + confirm dialog (from Section 2) — previously silent.

## 9. Accessibility + keyboard

- [x] Keyboard shortcuts wired in a global `keydown` listener (ignored while typing in inputs/selects/contenteditable):
  - `T` — go to today
  - `F` — focus search
  - `B` — toggle baseline overlay
  - `+` / `=` — zoom in (year → quarter → month → week)
  - `-` / `_` — zoom out
  - Search placeholder now hints "(F)".
- [x] Chip close buttons have `aria-label` (added in Sections 4 and 6 during chip/mode rebuild).
- [x] Date popover in task-tree-row uses shadcn `Popover` — native focus/Escape handling. No custom focus trap required.
- [ ] `Ctrl/Cmd+Z` undo for date changes — **deferred** (requires history stack; separable feature, not small).

## 10. Final polish

- [x] `/polish` pass — caught:
  - "Colour" → "Color" (matches existing add/edit dialogs and import header)
  - Removed redundant "Link Tasks On" chip (the toggle button already turns primary)
  - Column filter active state aligned with `DateRangeFilter` (font-medium + text-primary; was font-semibold)
- [ ] Re-run `/critique` and compare heuristic scores.

---

## Out of scope for this plan

**Deferred to a later phase:**
- Variance / drift report vs baseline — useful but not yet

**Not doing (confirmed out of scope):**
- Delay-notice generation — notices are issued in the builder's portal, not from this app
- Progress % per task — we can't reliably track another subtrade's % complete
- Weekly snapshot / audit trail of actuals (revisit only if variance report needs it)
- Typed Responsible (Party enum) instead of free-text (revisit only if variance report needs it)
