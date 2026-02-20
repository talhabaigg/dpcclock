/* eslint-disable no-console */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

// Load config from JSON file (passed via --config flag) or fall back to env vars
let config = {};
const configIdx = process.argv.indexOf('--config');
if (configIdx !== -1 && process.argv[configIdx + 1]) {
    config = JSON.parse(readFileSync(process.argv[configIdx + 1], 'utf-8'));
}
const env = { ...process.env, ...config };

const {
    PREMIER_WEB_URL,
    PREMIER_WEB_CLIENT_ID,
    PREMIER_WEB_USERNAME,
    PREMIER_WEB_PASSWORD,
    PO_NUMBER,
    TOTAL_COST,
    SUPPLIER_MESSAGE,
    SCREENSHOT_DIR,
    SESSION_DIR,
} = env;

// $10K threshold — EMAIL below, SEND FOR APPROVAL at or above
const APPROVAL_THRESHOLD = parseFloat(env.APPROVAL_THRESHOLD || '10000');

// Validate required env vars
if (!PREMIER_WEB_URL || !PREMIER_WEB_CLIENT_ID || !PREMIER_WEB_USERNAME || !PREMIER_WEB_PASSWORD || !PO_NUMBER) {
    console.error(JSON.stringify({
        success: false,
        error: 'Missing required environment variables',
    }));
    process.exit(1);
}

const totalCost = parseFloat(TOTAL_COST || '0');
const needsApproval = totalCost >= APPROVAL_THRESHOLD;
const dryRun = env.DRY_RUN === '1' || env.DRY_RUN === 'true';

// Ensure directories exist
const screenshotDir = SCREENSHOT_DIR || './screenshots';
const sessionDir = SESSION_DIR || './playwright-session';
for (const dir of [screenshotDir, sessionDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Helper: report step progress to progress.json for PHP job to poll
// Uses an append-based events array so no events are lost between polls
const TOTAL_STEPS = dryRun ? 5 : 6;
function reportStep(step, phase, label, screenshotFile) {
    const progressFile = `${screenshotDir}/progress.json`;
    let progress = { total_steps: TOTAL_STEPS, events: [] };
    try {
        const existing = JSON.parse(readFileSync(progressFile, 'utf-8'));
        if (existing.events) progress = existing;
    } catch { /* first write */ }

    progress.events.push({
        step,
        phase,
        label,
        screenshot: screenshotFile,
        timestamp: new Date().toISOString(),
    });

    writeFileSync(progressFile, JSON.stringify(progress));
}

// Helper: find the dashboard/app frame (main page or iframes)
// Premier renders the app inside the "loginContainer" iframe.
// After login, the iframe content changes from the login form to the full SPA.
// The SPA uses Angular/Kendo — innerText returns mostly whitespace, so we can't
// rely on text matching. Instead we detect dashboard by:
//   1. Text locator "Custom Dashboard" (works if text is in accessible DOM)
//   2. Login form is GONE (no visible password input) AND content grew large
//   3. Frame has visible <input> elements that look like a search bar (not login inputs)
async function findDashboardFrame(page) {
    const frames = page.frames();

    // Strategy 1: try "Custom Dashboard" text locator in all frames
    for (const frame of frames) {
        const visible = await frame.locator('text=Custom Dashboard').first().isVisible({ timeout: 500 }).catch(() => false);
        if (visible) {
            const type = frame === page.mainFrame() ? 'main' : 'iframe';
            console.error(`DEBUG: findDashboard: "Custom Dashboard" text found in ${type}`);
            return { frame, type };
        }
    }

    // Strategy 2: find a frame where login form is GONE and content has grown
    for (const frame of frames) {
        if (frame === page.mainFrame()) continue;

        const bodyLen = await frame.evaluate(() => document.body?.innerText?.length || 0).catch(() => 0);
        const hasPasswordInput = await frame.locator('input[type="password"]:visible').count().catch(() => 0);
        const hasLoginButton = await frame.locator('button:has-text("Log in"), button:has-text("Logging in")').first().isVisible({ timeout: 300 }).catch(() => false);

        console.error(`DEBUG: findDashboard: frame "${frame.name()}" bodyLen=${bodyLen}, passwordInputs=${hasPasswordInput}, loginBtn=${hasLoginButton}`);

        // Dashboard: content is large (>1000 chars), no login form visible
        if (bodyLen > 1000 && hasPasswordInput === 0 && !hasLoginButton) {
            console.error(`DEBUG: findDashboard: frame "${frame.name()}" looks like dashboard (large content, no login form)`);
            return { frame, type: 'iframe' };
        }
    }

    return null;
}

// Detect Email Editor dialog by looking for visible SEND/CANCEL buttons or Kendo window title.
// The contenteditable-based detection fails because Kendo's rich text editor uses iframes,
// not contenteditable divs, and Playwright's locator considers them "hidden".
async function detectEmailDialog(page) {
    // Strategy 1: Look for visible Kendo window dialog (k-window with non-zero rect)
    for (const fr of page.frames()) {
        const found = await fr.evaluate(() => {
            // Check for Kendo window title "Email Editor" that's visible
            const titles = document.querySelectorAll('.k-window-title, .k-dialog-title');
            for (const t of titles) {
                if (t.textContent?.trim() === 'Email Editor') {
                    const win = t.closest('.k-window, .k-dialog');
                    if (win) {
                        const rect = win.getBoundingClientRect();
                        if (rect.height > 100 && rect.width > 100) {
                            return { method: 'k-window', w: Math.round(rect.width), h: Math.round(rect.height) };
                        }
                    }
                }
            }

            // Check for visible SEND + CANCEL buttons (both must be present)
            let hasSend = false, hasCancel = false;
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                const text = btn.textContent?.trim();
                const rect = btn.getBoundingClientRect();
                if (rect.height === 0 || rect.width === 0) continue;
                if (text === 'SEND') hasSend = true;
                if (text === 'CANCEL') hasCancel = true;
            }
            if (hasSend && hasCancel) {
                return { method: 'buttons' };
            }

            // Check for email-specific fields (To, Cc, Subject labels near inputs)
            const labels = document.querySelectorAll('label, td, div');
            let emailFields = 0;
            for (const lbl of labels) {
                const text = lbl.textContent?.trim();
                const rect = lbl.getBoundingClientRect();
                if (rect.height === 0 || rect.width === 0) continue;
                if (['To:', 'Cc:', 'Subject:', 'Reply To:'].includes(text)) emailFields++;
            }
            if (emailFields >= 2) {
                return { method: 'email-fields', count: emailFields };
            }

            return null;
        }).catch(() => null);

        if (found) {
            console.error(`DEBUG: Email dialog detected via ${found.method}`, JSON.stringify(found));
            return true;
        }
    }

    console.error('DEBUG: Email dialog NOT detected in any frame');
    return false;
}

async function sendPOToSupplier() {
    // Use persistent context — reuses cookies/session from previous runs
    const context = await chromium.launchPersistentContext(sessionDir, {
        headless: true,
        viewport: { width: 1366, height: 900 },
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = context.pages()[0] || await context.newPage();
    const screenshots = [];

    try {
        // ============================================================
        // STEP 1: Navigate to Premier — check if already logged in
        // ============================================================
        reportStep(1, 'starting', 'Logging into Premier...', null);

        await page.goto(PREMIER_WEB_URL, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(5000);

        await page.screenshot({ path: `${screenshotDir}/00-page-loaded.png`, fullPage: true });
        screenshots.push('00-page-loaded.png');

        // Check if we're already on the dashboard (session from previous run)
        // Dashboard may be in an iframe — check ALL frames
        let dashResult = await findDashboardFrame(page);

        if (dashResult) {
            console.error(`DEBUG: Already logged in — dashboard found in ${dashResult.type}`);
        } else {
            console.error('DEBUG: Not logged in — starting login flow');
            await doLogin(page, screenshotDir, screenshots);
            // After login, find the dashboard frame
            dashResult = await findDashboardFrame(page);
            if (!dashResult) {
                // Last resort: wait a bit more and try again
                await page.waitForTimeout(5000);
                dashResult = await findDashboardFrame(page);
            }
        }

        if (!dashResult) {
            throw new Error('Could not find dashboard in any frame after login');
        }

        // The SPA shell loads first (shows loading spinner), then the actual UI renders.
        // Wait for the app to fully load — look for a visible input (search bar) in the frame.
        let appFrame = dashResult.frame;
        console.error(`DEBUG: Dashboard shell detected in ${dashResult.type} — waiting for app to fully load...`);

        const appLoadStart = Date.now();
        let appLoaded = false;

        // The SPA shell loads in loginContainer but the actual app renders in appContainer.
        // Wait for appContainer to have visible content.
        while (Date.now() - appLoadStart < 30000) {
            for (const fr of page.frames()) {
                const visInputs = await fr.locator('input:visible').count().catch(() => 0);
                if (visInputs > 0) {
                    const fname = fr.name() || 'main';
                    console.error(`DEBUG: Frame "${fname}" has ${visInputs} visible inputs — app is ready!`);
                    // Switch appFrame to the frame that actually has visible content
                    if (fr !== appFrame) {
                        console.error(`DEBUG: Switching appFrame to "${fname}"`);
                        appFrame = fr;
                    }
                    appLoaded = true;
                    break;
                }
            }
            if (appLoaded) break;

            const elapsed = Math.round((Date.now() - appLoadStart) / 1000);
            console.error(`DEBUG: Waiting for app to render... (${elapsed}s)`);
            await page.waitForTimeout(2000);
        }

        if (!appLoaded) {
            await page.screenshot({ path: `${screenshotDir}/app-loading-timeout.png`, fullPage: true });
            screenshots.push('app-loading-timeout.png');
            throw new Error('Dashboard detected but app UI did not load within 30s');
        }

        await page.screenshot({ path: `${screenshotDir}/01-dashboard.png`, fullPage: true });
        screenshots.push('01-dashboard.png');
        reportStep(1, 'completed', 'Logged in', '01-dashboard.png');

        // ============================================================
        // STEP 2: Navigate to Purchase Orders via Sidebar Menu
        // ============================================================
        reportStep(2, 'starting', 'Navigating to Purchase Orders...', null);

        // Premier uses Angular with rendering that makes DOM elements invisible to
        // Playwright locators, despite being visually rendered (screenshots confirm this).
        // We use coordinate-based clicking which is reliable since viewport is fixed 1366x900.
        //
        // Layout (from screenshots):
        //   - Hamburger ☰ icon: top-left sidebar at ~(18, 59)
        //   - Sidebar expands to show menu items including "Purchase Orders"

        // Click the hamburger menu icon to expand the sidebar
        console.error('DEBUG: Clicking hamburger menu at (18, 59)');
        await page.mouse.click(18, 59);
        await page.waitForTimeout(2000);

        await page.screenshot({ path: `${screenshotDir}/01b-menu-opened.png`, fullPage: true });
        screenshots.push('01b-menu-opened.png');

        // Now look for "Purchase Orders" in the expanded menu.
        // First try locator-based approach (in case the expanded menu IS accessible).
        let poMenuClicked = false;
        for (const fr of page.frames()) {
            const poLink = fr.locator('text=Purchase Orders').first();
            const vis = await poLink.isVisible({ timeout: 2000 }).catch(() => false);
            if (vis) {
                console.error(`DEBUG: Found "Purchase Orders" menu item in frame "${fr.name() || 'main'}"`);
                await poLink.click();
                poMenuClicked = true;
                break;
            }
        }

        if (!poMenuClicked) {
            console.error('DEBUG: Locator failed for "Purchase Orders" — trying coordinate click');
            await page.mouse.click(140, 415);
        }

        await page.waitForTimeout(1500);

        // "Purchase Orders" is a parent menu — clicking it reveals a sub-item "POs".
        // We need to click "POs" to actually navigate to the PO list.
        await page.screenshot({ path: `${screenshotDir}/01c-po-submenu.png`, fullPage: true });
        screenshots.push('01c-po-submenu.png');

        let posClicked = false;
        for (const fr of page.frames()) {
            // Look for the "POs" sub-menu item
            const posLink = fr.locator('text=/^POs$/').first();
            const vis = await posLink.isVisible({ timeout: 2000 }).catch(() => false);
            if (vis) {
                console.error(`DEBUG: Found "POs" sub-item in frame "${fr.name() || 'main'}"`);
                await posLink.click();
                posClicked = true;
                break;
            }
        }

        if (!posClicked) {
            // From screenshot: "POs" sub-item appears below "Purchase Orders" at ~y=142
            console.error('DEBUG: Locator failed for "POs" — trying coordinate click at (75, 142)');
            await page.mouse.click(75, 142);
        }

        await page.waitForTimeout(3000);

        // After clicking "Purchase Orders", Premier may show a sub-menu or navigate to POs.
        // Check if we need to click a sub-item like "Purchase Orders-POs"
        for (const fr of page.frames()) {
            const poSubItem = fr.locator('text=Purchase Orders-POs').first();
            const subVis = await poSubItem.isVisible({ timeout: 2000 }).catch(() => false);
            if (subVis) {
                console.error('DEBUG: Found sub-menu item "Purchase Orders-POs" — clicking');
                await poSubItem.click();
                await page.waitForTimeout(3000);
                break;
            }
        }

        await page.screenshot({ path: `${screenshotDir}/02-po-navigation.png`, fullPage: true });
        screenshots.push('02-po-navigation.png');

        // Wait for POs grid to load — check all frames for "PO #" column header
        let poGridFrame = appFrame;
        let gridFound = false;
        for (const fr of page.frames()) {
            const poHeader = await fr.locator('text=PO #').first().isVisible({ timeout: 3000 }).catch(() => false);
            if (poHeader) {
                poGridFrame = fr;
                console.error(`DEBUG: PO grid found in frame "${fr.name() || 'main'}"`);
                gridFound = true;
                break;
            }
        }

        if (!gridFound) {
            // Wait longer, the page might still be loading
            console.error('DEBUG: PO grid not found yet, waiting...');
            await page.waitForTimeout(5000);
            await page.screenshot({ path: `${screenshotDir}/02b-waiting-grid.png`, fullPage: true });
            screenshots.push('02b-waiting-grid.png');

            for (const fr of page.frames()) {
                const poHeader = await fr.locator('text=PO #').first().isVisible({ timeout: 5000 }).catch(() => false);
                if (poHeader) {
                    poGridFrame = fr;
                    console.error(`DEBUG: PO grid found in frame "${fr.name() || 'main'}" (delayed)`);
                    gridFound = true;
                    break;
                }
            }
        }

        if (!gridFound) {
            throw new Error('Could not find PO grid after navigating to Purchase Orders');
        }

        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${screenshotDir}/02-po-list.png`, fullPage: false });
        screenshots.push('02-po-list.png');
        reportStep(2, 'completed', 'Reached Purchase Orders', '02-po-list.png');

        // ============================================================
        // STEP 3: Filter PO # column to find our specific PO
        // ============================================================
        reportStep(3, 'starting', `Filtering for ${PO_NUMBER}...`, null);

        // MUST always filter by PO number — the PO could be anywhere in the list.
        // The Kendo grid column headers each have a small filter icon (≡).
        // Click the filter icon on the "PO #" column to open the filter dropdown.

        // Try multiple selectors for the filter icon in the PO # column header
        const filterSelectors = [
            'th:has-text("PO #") .k-grid-filter',
            'th:has-text("PO #") .k-grid-header-menu',
            'th:has-text("PO #") .k-i-filter',
            'th:has-text("PO #") .k-i-more-vertical',
            'th:has-text("PO #") [class*="filter"]',
            'th:has-text("PO #") a',
            'th:has-text("PO #") button',
        ];

        let filterClicked = false;
        for (const sel of filterSelectors) {
            const el = poGridFrame.locator(sel).first();
            const vis = await el.isVisible({ timeout: 1000 }).catch(() => false);
            if (vis) {
                console.error(`DEBUG: Filter icon found with "${sel}"`);
                await el.click();
                filterClicked = true;
                break;
            }
        }

        if (!filterClicked) {
            // Dump the PO # th element's inner HTML for debugging
            const thHtml = await poGridFrame.locator('th:has-text("PO #")').first()
                .evaluate(el => el.innerHTML).catch(() => '<not found>');
            console.error(`DEBUG: PO # th innerHTML: ${thHtml.substring(0, 300)}`);

            // Fall back to coordinate click — filter icon is at the right edge of PO # column header
            // From screenshot: PO # header is at ~x=80 y=145, filter icon at ~x=138, y=145
            console.error('DEBUG: Trying coordinate click for PO # filter icon at (138, 145)');
            await page.mouse.click(138, 145);
            filterClicked = true;
        }

        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${screenshotDir}/03a-filter-opened.png`, fullPage: true });
        screenshots.push('03a-filter-opened.png');

        // The filter dropdown should now be open with an input field.
        // Look for the filter input in the Kendo animation container or popup.
        const filterInputSelectors = [
            '.k-animation-container input[type="text"]',
            '.k-filter-menu input',
            '.k-popup input[type="text"]',
            '[class*="filter"] input[type="text"]',
            '.k-textbox',
        ];

        let filterInput = null;
        for (const sel of filterInputSelectors) {
            // Check all frames — Kendo popups may render outside the grid frame
            for (const fr of page.frames()) {
                const el = fr.locator(sel).first();
                const vis = await el.isVisible({ timeout: 1000 }).catch(() => false);
                if (vis) {
                    filterInput = el;
                    console.error(`DEBUG: Filter input found with "${sel}" in frame "${fr.name() || 'main'}"`);
                    break;
                }
            }
            if (filterInput) break;
        }

        if (!filterInput) {
            console.error('DEBUG: Filter input not found via locator — checking all visible inputs');
            // Try any newly appeared input
            for (const fr of page.frames()) {
                const inputs = fr.locator('input:visible');
                const count = await inputs.count().catch(() => 0);
                if (count > 0) {
                    for (let i = 0; i < count; i++) {
                        const attrs = await inputs.nth(i).evaluate(el => ({
                            type: el.type, placeholder: el.placeholder, class: el.className.substring(0, 50),
                        })).catch(() => null);
                        if (attrs) console.error(`DEBUG:   input[${i}]: ${JSON.stringify(attrs)}`);
                    }
                }
            }
            throw new Error('Could not find filter input after clicking PO # filter icon');
        }

        await filterInput.fill(PO_NUMBER);
        await page.waitForTimeout(500);

        // Click the Filter button to apply
        let filterApplied = false;
        for (const fr of page.frames()) {
            const filterBtn = fr.locator('button:has-text("Filter"), button:has-text("FILTER")').first();
            const vis = await filterBtn.isVisible({ timeout: 2000 }).catch(() => false);
            if (vis) {
                await filterBtn.click();
                filterApplied = true;
                console.error('DEBUG: Clicked Filter button');
                break;
            }
        }

        if (!filterApplied) {
            // Try pressing Enter instead
            await filterInput.press('Enter');
            console.error('DEBUG: Pressed Enter to apply filter');
        }

        await page.waitForTimeout(3000);

        await page.screenshot({ path: `${screenshotDir}/03b-po-filtered.png`, fullPage: true });
        screenshots.push('03b-po-filtered.png');
        reportStep(3, 'completed', `Found ${PO_NUMBER}`, '03b-po-filtered.png');

        // ============================================================
        // STEP 4: Select the filtered PO row
        // ============================================================
        reportStep(4, 'starting', 'Selecting PO...', null);

        const poRow = poGridFrame.locator(`tr:has-text("${PO_NUMBER}")`).first();
        await poRow.waitFor({ timeout: 10000 });
        console.error(`DEBUG: Found PO row "${PO_NUMBER}" — clicking`);
        await poRow.click();
        await page.waitForTimeout(3000); // Wait for PO detail panel to load

        await page.screenshot({ path: `${screenshotDir}/04-po-selected.png`, fullPage: false });
        screenshots.push('04-po-selected.png');
        reportStep(4, 'completed', 'PO selected', '04-po-selected.png');

        // ============================================================
        // STEP 5: Click MORE ACTIONS → open EMAIL or APPROVAL dialog
        // ============================================================
        reportStep(5, 'starting', 'Opening send action...', null);

        const actionLabel = needsApproval ? 'SEND FOR APPROVAL' : 'EMAIL';

        // Step 5a: Click MORE ACTIONS to open dropdown
        console.error('DEBUG: Clicking MORE ACTIONS at (405, 358)');
        await page.mouse.click(405, 358);
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${screenshotDir}/05-more-actions.png`, fullPage: false });
        screenshots.push('05-more-actions.png');

        // Step 5b: Click the dropdown item using coordinates.
        // Keyboard nav doesn't work (dropdown doesn't receive keyboard focus).
        // Coordinate map (measured from 05-more-actions.png screenshot):
        //   PRINT:             y ≈ 387
        //   EMAIL:             y ≈ 414
        //   SEND FOR APPROVAL: y ≈ 441
        const targetY = needsApproval ? 441 : 414;
        console.error(`DEBUG: Clicking "${actionLabel}" at (413, ${targetY})`);
        await page.mouse.click(413, targetY);

        // Wait for the Email Editor / Approval dialog to appear.
        // The dialog can take 5-15 seconds to load (server generates email content).
        // Poll every 3 seconds instead of a single check.
        let emailDialogFrame = poGridFrame;
        if (!needsApproval) {
            let dialogOpen = false;
            const detectStart = Date.now();
            while (Date.now() - detectStart < 15000) {
                await page.waitForTimeout(3000);
                dialogOpen = await detectEmailDialog(page);
                if (dialogOpen) break;
                console.error(`DEBUG: Email dialog not detected yet... (${Math.round((Date.now() - detectStart) / 1000)}s)`);
            }

            if (!dialogOpen) {
                // Take debug screenshot to see current state
                await page.screenshot({ path: `${screenshotDir}/05b-after-click.png`, fullPage: true });
                screenshots.push('05b-after-click.png');

                // Retry: re-open dropdown and click EMAIL again
                console.error('DEBUG: Email dialog not detected — retrying coordinate click');
                await page.mouse.click(405, 358); // Re-open dropdown
                await page.waitForTimeout(1000);
                await page.mouse.click(413, targetY); // Click EMAIL again
                console.error(`DEBUG: Retry click at (413, ${targetY})`);

                // Poll again for up to 15 seconds
                const retryStart = Date.now();
                while (Date.now() - retryStart < 15000) {
                    await page.waitForTimeout(3000);
                    dialogOpen = await detectEmailDialog(page);
                    if (dialogOpen) break;
                    console.error(`DEBUG: Retry — dialog not detected yet... (${Math.round((Date.now() - retryStart) / 1000)}s)`);
                }
            }

            if (!dialogOpen) {
                await page.screenshot({ path: `${screenshotDir}/05c-no-email-dialog.png`, fullPage: true });
                screenshots.push('05c-no-email-dialog.png');
                throw new Error('Email Editor dialog did not appear after clicking EMAIL action');
            }

            await page.waitForTimeout(2000); // Let dialog fully render

            if (SUPPLIER_MESSAGE) {
                // Get the LAST contenteditable (most likely the newly opened email body)
                const editors = emailDialogFrame.locator('[contenteditable="true"]');
                const editorCount = await editors.count().catch(() => 0);
                const bodyEditor = editors.nth(editorCount - 1);
                try {
                    await bodyEditor.evaluate((el, msg) => {
                        el.innerHTML = `<p>${msg}</p><br>` + el.innerHTML;
                    }, SUPPLIER_MESSAGE);
                } catch {
                    console.error('DEBUG: Could not modify email body editor');
                }
            }

            await page.screenshot({ path: `${screenshotDir}/06-email-dialog.png`, fullPage: true });
            screenshots.push('06-email-dialog.png');
            reportStep(5, 'completed', 'Email dialog ready', '06-email-dialog.png');
        } else {
            await page.waitForTimeout(3000);
            await page.screenshot({ path: `${screenshotDir}/05b-approval.png`, fullPage: false });
            screenshots.push('05b-approval.png');
            reportStep(5, 'completed', 'Approval dialog ready', '05b-approval.png');
        }

        // ============================================================
        // DRY RUN: Stop here — dialog is open but we don't send
        // ============================================================
        if (dryRun) {
            console.log(JSON.stringify({
                success: true,
                dry_run: true,
                po_number: PO_NUMBER,
                action: needsApproval ? 'would_send_for_approval' : 'would_email',
                total_cost: totalCost,
                screenshots,
                timestamp: new Date().toISOString(),
            }));
            return;
        }

        // ============================================================
        // STEP 6: Actually send to supplier
        // ============================================================
        reportStep(6, 'starting', 'Sending to supplier...', null);

        if (!needsApproval) {
            const sendButton = emailDialogFrame.locator('button:has-text("SEND"), button:has-text("Send")').last();
            try {
                await sendButton.waitFor({ state: 'attached', timeout: 5000 });
                await sendButton.click({ force: true });
            } catch {
                // Coordinate fallback — SEND button is typically bottom-right of email dialog
                console.error('DEBUG: SEND button not found via locator — using force click');
                const allBtns = emailDialogFrame.locator('button');
                const btnCount = await allBtns.count().catch(() => 0);
                for (let i = btnCount - 1; i >= 0; i--) {
                    const txt = await allBtns.nth(i).textContent().catch(() => '');
                    if (/send/i.test(txt)) {
                        await allBtns.nth(i).click({ force: true });
                        console.error(`DEBUG: Force-clicked SEND button at index ${i}`);
                        break;
                    }
                }
            }
            await page.waitForTimeout(3000);
        } else {
            const confirmButton = poGridFrame.locator('button:has-text("OK"), button:has-text("Yes"), button:has-text("Confirm")').first();
            try {
                await confirmButton.waitFor({ timeout: 5000 });
                await confirmButton.click();
                await page.waitForTimeout(2000);
            } catch {
                // No confirmation dialog needed
            }
        }

        await page.screenshot({ path: `${screenshotDir}/07-completed.png`, fullPage: false });
        screenshots.push('07-completed.png');
        reportStep(6, 'completed', 'PO sent to supplier', '07-completed.png');

        // ============================================================
        // Output success
        // ============================================================
        console.log(JSON.stringify({
            success: true,
            po_number: PO_NUMBER,
            action: needsApproval ? 'sent_for_approval' : 'emailed',
            screenshots,
            timestamp: new Date().toISOString(),
        }));

    } catch (error) {
        try {
            await page.screenshot({ path: `${screenshotDir}/error.png`, fullPage: true });
            screenshots.push('error.png');
        } catch { /* can't take screenshot */ }

        console.error(JSON.stringify({
            success: false,
            error: error.message,
            po_number: PO_NUMBER,
            screenshots,
            timestamp: new Date().toISOString(),
        }));
        process.exit(1);
    } finally {
        // Don't logout — we WANT the session to persist for next run.
        // Just close the browser (persistent context saves state to disk).
        await context.close();
    }
}

// ============================================================
// Login helper — handles iframe login, popups, session conflicts
// ============================================================
async function doLogin(page, screenshotDir, screenshots) {
    // Detect where the login form lives (main page or iframe)
    const mainInputCount = await page.locator('input').count();
    const iframeCount = await page.locator('iframe').count();
    console.error(`DEBUG: main page inputs=${mainInputCount}, iframes=${iframeCount}`);

    let loginFrame = page;

    if (mainInputCount === 0 && iframeCount > 0) {
        // Wait for iframe login form to render — can take 10-20s on cold start
        const loginWaitStart = Date.now();
        while (Date.now() - loginWaitStart < 30000) {
            for (let i = 0; i < iframeCount; i++) {
                const frame = page.frameLocator('iframe').nth(i);
                const visibleInputs = await frame.locator('input:visible').count().catch(() => 0);
                if (visibleInputs >= 2) {
                    loginFrame = frame;
                    console.error(`DEBUG: Using iframe[${i}] as login frame (${visibleInputs} inputs)`);
                    break;
                }
            }
            if (loginFrame !== page) break;
            const elapsed = Math.round((Date.now() - loginWaitStart) / 1000);
            console.error(`DEBUG: No login inputs yet in iframes... (${elapsed}s)`);
            await page.waitForTimeout(2000);
        }
        if (loginFrame === page) {
            console.error('DEBUG: Login form never appeared in iframes after 30s');
        }
    } else if (mainInputCount === 0) {
        console.error('DEBUG: No inputs found, waiting longer...');
        await page.waitForSelector('input', { timeout: 15000 });
    }

    // Fill login form — only target VISIBLE inputs
    const inputs = loginFrame.locator('input:visible');
    const inputCount = await inputs.count();
    console.error(`DEBUG: Found ${inputCount} visible inputs in login form`);

    if (inputCount >= 3) {
        await inputs.nth(0).fill(PREMIER_WEB_CLIENT_ID);
        await inputs.nth(1).fill(PREMIER_WEB_USERNAME);
        await inputs.nth(2).fill(PREMIER_WEB_PASSWORD);
    } else if (inputCount === 2) {
        await inputs.nth(0).fill(PREMIER_WEB_USERNAME);
        await inputs.nth(1).fill(PREMIER_WEB_PASSWORD);
    }

    // Check "Remember Me" if available
    const rememberMe = loginFrame.locator('input[type="checkbox"]:visible').first();
    if (await rememberMe.isVisible({ timeout: 500 }).catch(() => false)) {
        await rememberMe.check().catch(() => {});
        console.error('DEBUG: Checked "Remember Me"');
    }

    await page.screenshot({ path: `${screenshotDir}/00b-form-filled.png`, fullPage: true });
    screenshots.push('00b-form-filled.png');

    await loginFrame.getByRole('button', { name: /log in/i }).click();

    // Wait for login to complete — "Logging in..." button appears while processing
    console.error('DEBUG: Waiting for login to complete...');
    const loginStart = Date.now();
    while (Date.now() - loginStart < 45000) {
        await page.waitForTimeout(3000);

        // Check if dashboard appeared — search ALL frames
        const dashResult = await findDashboardFrame(page);
        if (dashResult) {
            console.error(`DEBUG: Dashboard found in ${dashResult.type}! Login successful.`);
            return;
        }

        // Before checking login state, try to dismiss any overlay dialogs
        // (e.g. "Welcome back" dialog that appears OVER the login iframe)
        // Check both main page AND all frames for OK/dismiss buttons
        for (const frame of page.frames()) {
            const okBtn = frame.locator('button:has-text("OK"), button:has-text("Ok")').first();
            if (await okBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                console.error(`DEBUG: Found OK button in frame "${frame.name() || 'main'}" — clicking to dismiss`);
                await okBtn.click();
                await page.waitForTimeout(2000);
                break;
            }

            const doItLaterBtn = frame.locator('button:has-text("Do it later")').first();
            if (await doItLaterBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                console.error(`DEBUG: Found "Do it later" in frame "${frame.name() || 'main'}" — dismissing`);
                await doItLaterBtn.click();
                await page.waitForTimeout(2000);
                break;
            }
        }

        // Re-check after dismissing dialogs
        const dashAfterDismiss = await findDashboardFrame(page);
        if (dashAfterDismiss) {
            console.error(`DEBUG: Dashboard found in ${dashAfterDismiss.type} after dismissing dialog!`);
            return;
        }

        // Check if still "Logging in..."
        let stillLogging = false;
        for (const frame of page.frames()) {
            const btns = await frame.locator('button:visible').allInnerTexts().catch(() => []);
            if (btns.some(t => /logging in/i.test(t))) {
                stillLogging = true;
                break;
            }
        }
        if (stillLogging) {
            console.error(`DEBUG: Still "Logging in..." (${Math.round((Date.now() - loginStart) / 1000)}s)`);
            continue;
        }

        // Check for session conflict ("username already in use")
        let conflictHandled = false;
        for (const frame of page.frames()) {
            const conflict = await frame.locator('text=/already in use/i').first().isVisible({ timeout: 500 }).catch(() => false);
            if (conflict) {
                console.error('DEBUG: Session conflict — re-filling credentials and retrying');

                // Re-fill all fields
                const visInputs = frame.locator('input:visible:not([type="checkbox"]):not([type="hidden"])');
                const count = await visInputs.count().catch(() => 0);
                if (count >= 3) {
                    await visInputs.nth(0).fill(PREMIER_WEB_CLIENT_ID);
                    await visInputs.nth(1).fill(PREMIER_WEB_USERNAME);
                    await visInputs.nth(2).fill(PREMIER_WEB_PASSWORD);
                }

                // Click Login again
                const loginBtn = frame.locator('button:has-text("Login"), button:has-text("Log in")').first();
                if (await loginBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                    await loginBtn.click();
                    console.error('DEBUG: Re-clicked Login');
                    await page.waitForTimeout(5000);
                    conflictHandled = true;
                }
                break;
            }
        }
        if (conflictHandled) continue;

        // Check for "Email Validation" popup in all frames
        for (const frame of page.frames()) {
            const emailVal = await frame.locator('text=/email validation/i').first().isVisible({ timeout: 500 }).catch(() => false);
            if (emailVal) {
                console.error('DEBUG: Email Validation popup detected');
                const doItLater = frame.locator('button:has-text("Do it later")').first();
                if (await doItLater.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await doItLater.click();
                    console.error('DEBUG: Clicked "Do it later"');
                    await page.waitForTimeout(2000);
                }
                break;
            }
        }

        // Debug: dump frame state
        const elapsed = Math.round((Date.now() - loginStart) / 1000);
        console.error(`DEBUG: (${elapsed}s) ${page.frames().length} frames — no dashboard detected yet`);
    }

    // Final check — search ALL frames
    const finalDash = await findDashboardFrame(page);
    if (!finalDash) {
        await page.screenshot({ path: `${screenshotDir}/login-failed.png`, fullPage: true });
        screenshots.push('login-failed.png');
        throw new Error('Login failed — could not reach dashboard after 45s');
    }
    console.error(`DEBUG: Dashboard found in ${finalDash.type} on final check`);
}

sendPOToSupplier().catch((err) => {
    console.error(JSON.stringify({
        success: false,
        error: err.message,
    }));
    process.exit(1);
});
