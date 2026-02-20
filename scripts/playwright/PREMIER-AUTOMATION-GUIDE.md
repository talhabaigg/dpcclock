# Premier ERP Browser Automation Guide

A comprehensive reference for building Playwright-based browser automation against **Premier ERP** (Angular/Kendo UI web application). This documents every pattern, gotcha, and coordinate discovered during the Send PO to Supplier automation.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Browser Setup](#browser-setup)
3. [Login Flow](#login-flow)
4. [Dashboard Detection](#dashboard-detection)
5. [Sidebar Navigation](#sidebar-navigation)
6. [Kendo Grid Interaction](#kendo-grid-interaction)
7. [Dropdown Menus (MORE ACTIONS)](#dropdown-menus-more-actions)
8. [Dialog Detection (Email Editor)](#dialog-detection-email-editor)
9. [Coordinate Map (1366x900 Viewport)](#coordinate-map-1366x900-viewport)
10. [What Works and What Doesn't](#what-works-and-what-doesnt)
11. [Debugging Tips](#debugging-tips)
12. [Complete Step-by-Step Flow](#complete-step-by-step-flow)

---

## Architecture Overview

Premier ERP is a **single-page Angular application** that uses **Kendo UI** for all widgets (grids, dropdowns, dialogs, rich text editors). The key architectural detail that affects automation:

### Iframe Structure

Premier renders inside **nested iframes**, not directly in the main page:

```
Main Page (PREMIER_WEB_URL)
├── iframe "loginContainer"   ← Login form renders here
│   └── (after login, becomes the SPA shell)
└── iframe "appContainer"     ← The actual Angular app renders here
    ├── Sidebar menu
    ├── Kendo Grid (PO list)
    ├── Kendo Dropdowns
    └── Kendo Dialog windows (Email Editor, etc.)
```

**Key implication**: You must always search **all frames** when looking for elements. An element visible on screen may live in `appContainer`, not the main page or `loginContainer`.

```javascript
// Pattern: search all frames for an element
for (const frame of page.frames()) {
    const element = frame.locator('text=Purchase Orders').first();
    const visible = await element.isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) {
        await element.click();
        break;
    }
}
```

### Angular + Kendo UI Rendering

- Angular renders elements that are **visually present** (confirmed by screenshots) but **invisible to Playwright locators**. This is because:
  - Kendo pre-renders ALL dropdown items as **hidden zero-sized DOM elements** in the DOM
  - `boundingBox()` returns `null` for these elements
  - `getBoundingClientRect()` returns `{x:0, y:0, width:0, height:0}`
  - The visible dropdown popup uses a completely separate rendering path

- Kendo's rich text editor (Email Editor) uses **iframes inside iframes**, not `contenteditable` divs. Detection strategies based on `contenteditable` count will fail.

---

## Browser Setup

### Persistent Context (Session Reuse)

Use `chromium.launchPersistentContext()` to preserve login sessions across runs:

```javascript
const context = await chromium.launchPersistentContext(sessionDir, {
    headless: true,
    viewport: { width: 1366, height: 900 },  // MUST be fixed — coordinates depend on this
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = context.pages()[0] || await context.newPage();
```

**Why 1366x900?** This is a common laptop resolution. Premier's layout is responsive but coordinate-based clicking requires a fixed viewport. All coordinates in this guide assume 1366x900.

**Session persistence**: Don't logout at the end of a run. Just close the browser. The persistent context saves cookies/state to `sessionDir` (disk). Next run may skip login entirely.

```javascript
// At end of script — DON'T logout
await context.close(); // Saves session state to disk
```

---

## Login Flow

### Page Structure

The login form renders inside the `loginContainer` iframe with 3 fields:
1. **Client ID** (company identifier)
2. **Username**
3. **Password**

Plus a "Remember Me" checkbox and a "Log in" button.

### Cold Start Problem

On a fresh session (no cached cookies), the iframe takes **10-20 seconds** to render the login form. You'll see:
- `page.locator('input').count()` → 0 on main page
- `page.locator('iframe').count()` → 2+ iframes exist
- But iframe inputs are **not yet rendered**

**Solution**: Poll iframes every 2 seconds for up to 30 seconds:

```javascript
let loginFrame = page;
const loginWaitStart = Date.now();
while (Date.now() - loginWaitStart < 30000) {
    for (let i = 0; i < iframeCount; i++) {
        const frame = page.frameLocator('iframe').nth(i);
        const visibleInputs = await frame.locator('input:visible').count().catch(() => 0);
        if (visibleInputs >= 2) {
            loginFrame = frame;
            break;
        }
    }
    if (loginFrame !== page) break;
    await page.waitForTimeout(2000);
}
```

### Filling the Login Form

Target only **visible** inputs (Kendo may have hidden inputs in the DOM):

```javascript
const inputs = loginFrame.locator('input:visible');
const inputCount = await inputs.count();

if (inputCount >= 3) {
    // Full form: Client ID + Username + Password
    await inputs.nth(0).fill(PREMIER_WEB_CLIENT_ID);
    await inputs.nth(1).fill(PREMIER_WEB_USERNAME);
    await inputs.nth(2).fill(PREMIER_WEB_PASSWORD);
} else if (inputCount === 2) {
    // Client ID already saved: Username + Password only
    await inputs.nth(0).fill(PREMIER_WEB_USERNAME);
    await inputs.nth(1).fill(PREMIER_WEB_PASSWORD);
}
```

### Post-Login Obstacles

After clicking "Log in", several things can happen:

| Scenario | Detection | Action |
|----------|-----------|--------|
| **"Logging in..." spinner** | Button text changes to "Logging in..." | Wait — still processing |
| **Session conflict** | Text "already in use" appears | Re-fill credentials and click Login again |
| **Email Validation popup** | Text "email validation" appears | Click "Do it later" button |
| **"Welcome back" dialog** | OK button appears over login iframe | Click OK to dismiss |
| **Dashboard loads** | `findDashboardFrame()` returns non-null | Login complete |

Handle all of these in a polling loop:

```javascript
const loginStart = Date.now();
while (Date.now() - loginStart < 45000) {
    await page.waitForTimeout(3000);

    // Check dashboard in ALL frames
    const dashResult = await findDashboardFrame(page);
    if (dashResult) return; // Success!

    // Try dismissing overlay dialogs (OK, "Do it later")
    for (const frame of page.frames()) {
        const okBtn = frame.locator('button:has-text("OK")').first();
        if (await okBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await okBtn.click();
            await page.waitForTimeout(2000);
            break;
        }
    }

    // Check for session conflict
    for (const frame of page.frames()) {
        const conflict = await frame.locator('text=/already in use/i').first()
            .isVisible({ timeout: 500 }).catch(() => false);
        if (conflict) {
            // Re-fill and retry login...
        }
    }
}
```

---

## Dashboard Detection

After login, Premier transitions from login form to SPA. Detection strategies (in priority order):

### Strategy 1: Text Match
```javascript
// Look for "Custom Dashboard" text in any frame
for (const frame of page.frames()) {
    const visible = await frame.locator('text=Custom Dashboard').first()
        .isVisible({ timeout: 500 }).catch(() => false);
    if (visible) return { frame, type: frame === page.mainFrame() ? 'main' : 'iframe' };
}
```

### Strategy 2: Content Heuristic
```javascript
// Login form is GONE + content has grown large = dashboard
for (const frame of page.frames()) {
    const bodyLen = await frame.evaluate(() => document.body?.innerText?.length || 0).catch(() => 0);
    const hasPassword = await frame.locator('input[type="password"]:visible').count().catch(() => 0);
    const hasLoginBtn = await frame.locator('button:has-text("Log in")').first()
        .isVisible({ timeout: 300 }).catch(() => false);

    if (bodyLen > 1000 && hasPassword === 0 && !hasLoginBtn) {
        return { frame, type: 'iframe' }; // This is the dashboard
    }
}
```

### App Container Loading

After dashboard shell loads in `loginContainer`, the **actual app** renders in a separate `appContainer` iframe. Wait for it:

```javascript
let appLoaded = false;
const appLoadStart = Date.now();
while (Date.now() - appLoadStart < 30000) {
    for (const fr of page.frames()) {
        const visInputs = await fr.locator('input:visible').count().catch(() => 0);
        if (visInputs > 0) {
            appFrame = fr;
            appLoaded = true;
            break;
        }
    }
    if (appLoaded) break;
    await page.waitForTimeout(2000);
}
```

---

## Sidebar Navigation

Premier has a **collapsible sidebar** on the left. By default it shows only icons. Clicking the hamburger (☰) expands it to show text labels.

### Opening the Sidebar

```javascript
// Hamburger menu icon — top-left corner
await page.mouse.click(18, 59);
await page.waitForTimeout(2000); // Animation takes ~1s
```

### Clicking Menu Items

Menu items are sometimes accessible via Playwright locators (after sidebar expands), sometimes not. Use a **locator-first, coordinate-fallback** pattern:

```javascript
// Try locator first
let clicked = false;
for (const fr of page.frames()) {
    const link = fr.locator('text=Purchase Orders').first();
    if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        await link.click();
        clicked = true;
        break;
    }
}

// Coordinate fallback
if (!clicked) {
    await page.mouse.click(140, 415); // "Purchase Orders" position
}
```

### Menu Hierarchy

Premier menu items can be **parent items** that expand sub-menus:

```
Purchase Orders (parent — click to expand)
└── POs (sub-item — click to navigate to PO list)
```

After clicking "Purchase Orders", look for and click the "POs" sub-item:

```javascript
for (const fr of page.frames()) {
    const posLink = fr.locator('text=/^POs$/').first();
    if (await posLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await posLink.click();
        break;
    }
}
```

---

## Kendo Grid Interaction

The PO list is a **Kendo Grid** with sortable/filterable columns.

### Finding the Grid

Wait for the grid to load by looking for a column header:

```javascript
let gridFound = false;
for (const fr of page.frames()) {
    const header = await fr.locator('text=PO #').first()
        .isVisible({ timeout: 3000 }).catch(() => false);
    if (header) {
        poGridFrame = fr;
        gridFound = true;
        break;
    }
}
```

### Filtering a Column

Each column header has a small filter icon. Click it to open a filter dropdown:

```javascript
// Multiple possible selectors for the Kendo filter icon
const filterSelectors = [
    'th:has-text("PO #") .k-grid-filter',
    'th:has-text("PO #") .k-grid-header-menu',
    'th:has-text("PO #") .k-i-filter',
    'th:has-text("PO #") a',
    'th:has-text("PO #") button',
];

for (const sel of filterSelectors) {
    const el = poGridFrame.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        break;
    }
}
```

The filter dropdown renders in a **Kendo animation container** (may be in a different frame than the grid):

```javascript
const filterInputSelectors = [
    '.k-animation-container input[type="text"]',
    '.k-filter-menu input',
    '.k-popup input[type="text"]',
    '.k-textbox',
];

let filterInput = null;
for (const sel of filterInputSelectors) {
    for (const fr of page.frames()) {
        const el = fr.locator(sel).first();
        if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
            filterInput = el;
            break;
        }
    }
    if (filterInput) break;
}

await filterInput.fill('PO-12345');
```

Apply the filter by clicking "Filter" button or pressing Enter:

```javascript
for (const fr of page.frames()) {
    const filterBtn = fr.locator('button:has-text("Filter")').first();
    if (await filterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await filterBtn.click();
        break;
    }
}
```

### Selecting a Grid Row

Row selection works with standard locators:

```javascript
const poRow = poGridFrame.locator(`tr:has-text("${PO_NUMBER}")`).first();
await poRow.waitFor({ timeout: 10000 });
await poRow.click();
await page.waitForTimeout(3000); // Wait for detail panel to load
```

---

## Dropdown Menus (MORE ACTIONS)

This is the **hardest part** of Premier automation. The MORE ACTIONS button opens a Kendo dropdown with items like PRINT, EMAIL, SEND FOR APPROVAL.

### Why Locators Fail

Kendo **pre-renders ALL dropdown items as hidden zero-sized DOM elements** in the DOM, then renders the visible popup separately. This means:

- `page.locator('text=EMAIL')` finds the element (at DOM index ~45)
- `element.boundingBox()` → `null`
- `element.evaluate(el => el.getBoundingClientRect())` → `{x:0, y:0, width:0, height:0}`
- `element.click()` → fails (no bounding box)
- `element.click({ force: true })` → clicks at (0,0), hitting the wrong thing
- Keyboard navigation (ArrowDown + Enter) → dropdown closes without selecting

### Why JavaScript dispatchEvent Fails

```javascript
// This creates an UNTRUSTED event — Angular ignores it
element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
// isTrusted === false → Angular's zone.js discards it
```

### The Working Approach: Coordinate-Based Clicking

The ONLY reliable method is `page.mouse.click(x, y)` which sends trusted CDP events:

```javascript
// Step 1: Click MORE ACTIONS button to open dropdown
await page.mouse.click(405, 358);
await page.waitForTimeout(1000);

// Step 2: Click the dropdown item by coordinates
// Dropdown items are stacked vertically with ~27px spacing
await page.mouse.click(413, 414); // EMAIL
```

### Coordinate Map for MORE ACTIONS Dropdown

| Item | X | Y | Notes |
|------|---|---|-------|
| MORE ACTIONS button | 405 | 358 | Opens the dropdown |
| PRINT | 413 | 387 | First dropdown item |
| EMAIL | 413 | 414 | Second dropdown item |
| SEND FOR APPROVAL | 413 | 441 | Third dropdown item |

**How these were measured**: Take a screenshot after opening the dropdown (`05-more-actions.png`), then measure pixel coordinates from the screenshot.

### Retry Pattern

The coordinate click may not work on the first try (dropdown may close, loading state, etc.). Use a retry pattern:

```javascript
// First attempt
await page.mouse.click(405, 358); // Open dropdown
await page.waitForTimeout(1000);
await page.mouse.click(413, 414); // Click EMAIL

// Poll for result (dialog appearing)
let success = false;
for (let elapsed = 0; elapsed < 15000; elapsed += 3000) {
    await page.waitForTimeout(3000);
    success = await detectEmailDialog(page);
    if (success) break;
}

if (!success) {
    // Retry: re-open dropdown and click again
    await page.mouse.click(405, 358);
    await page.waitForTimeout(1000);
    await page.mouse.click(413, 414);
    // Poll again...
}
```

---

## Dialog Detection (Email Editor)

After clicking EMAIL, the **Email Editor dialog** takes 5-15 seconds to load (server generates email content). Detection is tricky because Kendo's editor uses iframes.

### What Doesn't Work

| Method | Why it fails |
|--------|-------------|
| Count `contenteditable` elements | Kendo Editor uses iframes, not contenteditable divs |
| Count `page.frames().length > N` | Frame count varies — causes false positives |
| Wait for specific selector | Kendo dialog selectors are inconsistent |

### What Works: Multi-Strategy Detection

Check all frames for any of these indicators:

```javascript
async function detectEmailDialog(page) {
    for (const fr of page.frames()) {
        const found = await fr.evaluate(() => {
            // Strategy 1: Kendo window title "Email Editor"
            const titles = document.querySelectorAll('.k-window-title, .k-dialog-title');
            for (const t of titles) {
                if (t.textContent?.trim() === 'Email Editor') {
                    const win = t.closest('.k-window, .k-dialog');
                    if (win) {
                        const rect = win.getBoundingClientRect();
                        if (rect.height > 100 && rect.width > 100) {
                            return { method: 'k-window' };
                        }
                    }
                }
            }

            // Strategy 2: Visible SEND + CANCEL buttons (both present)
            let hasSend = false, hasCancel = false;
            for (const btn of document.querySelectorAll('button')) {
                const text = btn.textContent?.trim();
                const rect = btn.getBoundingClientRect();
                if (rect.height === 0 || rect.width === 0) continue;
                if (text === 'SEND') hasSend = true;
                if (text === 'CANCEL') hasCancel = true;
            }
            if (hasSend && hasCancel) return { method: 'buttons' };

            // Strategy 3: Email-specific field labels (To:, Cc:, Subject:)
            let emailFields = 0;
            for (const lbl of document.querySelectorAll('label, td, div')) {
                const text = lbl.textContent?.trim();
                const rect = lbl.getBoundingClientRect();
                if (rect.height === 0 || rect.width === 0) continue;
                if (['To:', 'Cc:', 'Subject:', 'Reply To:'].includes(text)) emailFields++;
            }
            if (emailFields >= 2) return { method: 'email-fields' };

            return null;
        }).catch(() => null);

        if (found) return true;
    }
    return false;
}
```

### Polling Pattern

```javascript
let dialogOpen = false;
const detectStart = Date.now();
while (Date.now() - detectStart < 15000) {
    await page.waitForTimeout(3000);
    dialogOpen = await detectEmailDialog(page);
    if (dialogOpen) break;
}
```

### Interacting with the Email Editor

The email body is a `contenteditable` element inside the dialog. Use `evaluate()` to modify it:

```javascript
const editors = emailDialogFrame.locator('[contenteditable="true"]');
const editorCount = await editors.count().catch(() => 0);
const bodyEditor = editors.nth(editorCount - 1); // Last one = email body

await bodyEditor.evaluate((el, message) => {
    el.innerHTML = `<p>${message}</p><br>` + el.innerHTML;
}, supplierMessage);
```

To send the email, click the SEND button:

```javascript
const sendButton = emailDialogFrame.locator('button:has-text("SEND")').last();
await sendButton.click({ force: true });
```

---

## Coordinate Map (1366x900 Viewport)

All coordinates assume `viewport: { width: 1366, height: 900 }`.

### Global Layout

| Element | X | Y | Notes |
|---------|---|---|-------|
| Hamburger menu (☰) | 18 | 59 | Top-left, toggles sidebar |
| Search bar | ~300 | 20 | Top center |
| User profile | ~1330 | 20 | Top right |

### Sidebar (Expanded)

| Element | X | Y | Notes |
|---------|---|---|-------|
| "Purchase Orders" | 140 | 415 | Parent menu item |
| "POs" sub-item | 75 | 142 | After expanding Purchase Orders |

### PO Detail Page

| Element | X | Y | Notes |
|---------|---|---|-------|
| PO # filter icon | 138 | 145 | In grid header |
| MORE ACTIONS button | 405 | 358 | In PO detail toolbar |

### MORE ACTIONS Dropdown

| Item | X | Y |
|------|---|---|
| PRINT | 413 | 387 |
| EMAIL | 413 | 414 |
| SEND FOR APPROVAL | 413 | 441 |

**Important**: These coordinates can shift if Premier updates its UI. Always take a screenshot after each action and verify coordinates if automation breaks.

---

## What Works and What Doesn't

### Reliable Methods

| Method | Use Case |
|--------|----------|
| `page.mouse.click(x, y)` | Clicking dropdown items, hamburger menu, MORE ACTIONS |
| `frame.locator('text=...').click()` | Menu items (after sidebar expands), grid rows, buttons |
| `frame.locator('selector').fill()` | Login form inputs, filter inputs |
| `frame.evaluate(() => ...)` | DOM inspection, element detection, content modification |
| `fullPage: true` screenshots | Capturing dialogs/overlays that extend beyond viewport |
| Persistent browser context | Session reuse across runs |

### Unreliable / Broken Methods

| Method | Why it fails |
|--------|-------------|
| `element.boundingBox()` on Kendo dropdown items | Returns null — items are zero-sized |
| `element.getBoundingClientRect()` on hidden Kendo items | Returns {0,0,0,0} |
| `element.click({ force: true })` on zero-sized elements | Clicks at (0,0) — wrong target |
| `dispatchEvent(new MouseEvent(...))` | Creates untrusted events — Angular ignores them |
| Keyboard navigation (ArrowDown/Enter) on Kendo dropdowns | Dropdown closes without selecting |
| Counting contenteditable elements for dialog detection | Kendo Editor uses iframes, not contenteditable |
| Counting `page.frames().length` for dialog detection | Frame count varies — false positives |
| `fullPage: false` for dialog screenshots | Misses overlay dialogs |

---

## Debugging Tips

### 1. Always Take Screenshots

Take a screenshot after EVERY action. This is your primary debugging tool:

```javascript
await page.screenshot({ path: `${dir}/step-name.png`, fullPage: true });
```

Use `fullPage: true` for anything involving dialogs or overlays.

### 2. Dump Frame State

When something isn't found, dump what's in each frame:

```javascript
for (const frame of page.frames()) {
    const name = frame.name() || 'main';
    const bodyLen = await frame.evaluate(() => document.body?.innerText?.length || 0).catch(() => 0);
    const inputs = await frame.locator('input:visible').count().catch(() => 0);
    const buttons = await frame.locator('button:visible').allInnerTexts().catch(() => []);
    console.error(`Frame "${name}": bodyLen=${bodyLen}, inputs=${inputs}, buttons=${JSON.stringify(buttons)}`);
}
```

### 3. Dump Element HTML

When a locator doesn't work as expected:

```javascript
const html = await frame.locator('th:has-text("PO #")').first()
    .evaluate(el => el.innerHTML).catch(() => '<not found>');
console.error(`Element HTML: ${html.substring(0, 500)}`);
```

### 4. Check Kendo Dropdown Items

To see what Kendo has pre-rendered vs what's visible:

```javascript
const items = await frame.evaluate(() => {
    const results = [];
    document.querySelectorAll('.dropdown-data-highlight, .k-item, .k-menu-item').forEach(el => {
        const rect = el.getBoundingClientRect();
        results.push({
            text: el.textContent?.trim().substring(0, 30),
            visible: rect.width > 0 && rect.height > 0,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
        });
    });
    return results;
});
console.error('Dropdown items:', JSON.stringify(items, null, 2));
```

### 5. Progress File for Real-Time Monitoring

Write a `progress.json` after each step so external systems can poll:

```javascript
function reportStep(step, phase, label, screenshotFile) {
    const progress = { total_steps: 7, events: [] };
    try {
        const existing = JSON.parse(readFileSync(progressFile, 'utf-8'));
        if (existing.events) progress = existing;
    } catch {}
    progress.events.push({ step, phase, label, screenshot: screenshotFile, timestamp: new Date().toISOString() });
    writeFileSync(progressFile, JSON.stringify(progress));
}
```

---

## Complete Step-by-Step Flow

### Send PO to Supplier — Full Flow

```
Step 1: Login
  1a. Navigate to PREMIER_WEB_URL
  1b. Wait 5s for page load
  1c. Check if already logged in (findDashboardFrame)
  1d. If not: fill login form in iframe, click "Log in"
  1e. Handle obstacles (session conflict, email validation, welcome dialog)
  1f. Wait for appContainer to have visible inputs (app loaded)

Step 2: Navigate to Purchase Orders
  2a. Click hamburger menu at (18, 59) to expand sidebar
  2b. Click "Purchase Orders" (locator or coordinate 140, 415)
  2c. Click "POs" sub-item (locator or coordinate 75, 142)
  2d. Wait for PO grid to load (look for "PO #" column header)

Step 3: Filter for specific PO
  3a. Click filter icon on "PO #" column header
  3b. Find filter input in Kendo animation container
  3c. Fill PO number, click "Filter" button or press Enter
  3d. Wait 3s for grid to update

Step 4: Select the PO
  4a. Click the filtered PO row: tr:has-text("PO-XXXXX")
  4b. Wait 3s for detail panel to load

Step 5: Open EMAIL / SEND FOR APPROVAL dialog
  5a. Click MORE ACTIONS at (405, 358)
  5b. Wait 1s for dropdown animation
  5c. Click EMAIL at (413, 414) or SEND FOR APPROVAL at (413, 441)
  5d. Poll for dialog detection every 3s for up to 15s
  5e. If not detected: retry (re-open dropdown, click again, poll again)
  5f. Optional: modify email body via contenteditable evaluate()

Step 6: Send (if not dry run)
  6a. Click SEND button in email dialog
  6b. Or click OK/Confirm in approval dialog
  6c. Wait 3s for server response
  6d. Take final screenshot

Total time: 30-90 seconds depending on Premier's load times
```

### Screenshot Naming Convention

| Filename | Description |
|----------|-------------|
| `00-page-loaded.png` | Initial page load |
| `00b-form-filled.png` | Login form filled (before submit) |
| `01-dashboard.png` | Dashboard after login |
| `01b-menu-opened.png` | Sidebar expanded |
| `01c-po-submenu.png` | Purchase Orders sub-menu visible |
| `02-po-navigation.png` | Navigating to PO list |
| `02-po-list.png` | PO grid loaded |
| `03a-filter-opened.png` | Filter dropdown open |
| `03b-po-filtered.png` | Grid filtered to target PO |
| `04-po-selected.png` | PO detail panel loaded |
| `05-more-actions.png` | MORE ACTIONS dropdown open |
| `05b-after-click.png` | After clicking EMAIL (debug) |
| `06-email-dialog.png` | Email Editor dialog ready |
| `05b-approval.png` | Approval dialog (for >$10K POs) |
| `07-completed.png` | PO sent successfully |
| `error.png` | Error state (on failure) |

---

## General Patterns for Other Premier Automations

When building new Premier automations, follow these principles:

1. **Always use a fixed viewport** (1366x900) so coordinates are consistent
2. **Search all frames** for any element — never assume it's in the main page
3. **Use locator-first, coordinate-fallback** for menu/button clicks
4. **Use coordinate-only** for Kendo dropdown items (locators always fail)
5. **Poll for results** instead of fixed waits — Premier load times vary wildly
6. **Take screenshots after every action** — they're your debugging lifeline
7. **Use persistent browser context** to skip login on repeat runs
8. **Handle session conflicts** — Premier may show "already in use" errors
9. **Use `fullPage: true`** for any screenshot that might include overlays/dialogs
10. **Don't use keyboard navigation** for Kendo dropdowns — it doesn't work
