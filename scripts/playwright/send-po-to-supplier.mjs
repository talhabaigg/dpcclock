/* eslint-disable no-console */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// Configuration
// =============================================================================

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
    ANTHROPIC_API_KEY,
} = env;

const APPROVAL_THRESHOLD = parseFloat(env.APPROVAL_THRESHOLD || '10000');
const totalCost = parseFloat(TOTAL_COST || '0');
const needsApproval = totalCost >= APPROVAL_THRESHOLD;
const dryRun = env.DRY_RUN === '1' || env.DRY_RUN === 'true';

// Model config — default to Sonnet 4.5 (great for computer use, cost-effective)
const MODEL = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// Determine tool version + beta flag based on model
function getBetaConfig(model) {
    if (model.includes('opus-4-6') || model.includes('sonnet-4-6') || model.includes('opus-4-5')) {
        return { toolType: 'computer_20251124', beta: 'computer-use-2025-11-24' };
    }
    return { toolType: 'computer_20250124', beta: 'computer-use-2025-01-24' };
}
const { toolType, beta } = getBetaConfig(MODEL);

// Validate required config
const missing = [];
if (!PREMIER_WEB_URL) missing.push('PREMIER_WEB_URL');
if (!PREMIER_WEB_CLIENT_ID) missing.push('PREMIER_WEB_CLIENT_ID');
if (!PREMIER_WEB_USERNAME) missing.push('PREMIER_WEB_USERNAME');
if (!PREMIER_WEB_PASSWORD) missing.push('PREMIER_WEB_PASSWORD');
if (!PO_NUMBER) missing.push('PO_NUMBER');
if (!ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');

if (missing.length > 0) {
    console.error(JSON.stringify({
        success: false,
        error: `Missing required config: ${missing.join(', ')}`,
    }));
    process.exit(1);
}

// Display dimensions — must stay under Anthropic's 1.15MP limit to avoid downscaling
// 1280 * 800 = 1,024,000 pixels < 1,150,000 limit
const DISPLAY_WIDTH = 1280;
const DISPLAY_HEIGHT = 800;
const MAX_ITERATIONS = 50;
const STUCK_THRESHOLD = 10; // Premier is slow — allow many identical screenshots before aborting
const TOTAL_STEPS = dryRun ? 5 : 6;

const screenshotDir = SCREENSHOT_DIR || './screenshots';
const sessionDir = SESSION_DIR || './playwright-session';
for (const dir of [screenshotDir, sessionDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// =============================================================================
// Progress Reporting (same format the PHP job polls)
// =============================================================================

function reportStep(step, phase, label, screenshotFile, reasoning = null) {
    const progressFile = `${screenshotDir}/progress.json`;
    let progress = { total_steps: TOTAL_STEPS, events: [] };
    try {
        const existing = JSON.parse(readFileSync(progressFile, 'utf-8'));
        if (existing.events) progress = existing;
    } catch { /* first write */ }

    const event = {
        step,
        phase,
        label,
        screenshot: screenshotFile,
        timestamp: new Date().toISOString(),
    };
    if (reasoning) event.thinking = reasoning;

    progress.events.push(event);
    writeFileSync(progressFile, JSON.stringify(progress));
}

function reportThinking(text) {
    const progressFile = `${screenshotDir}/progress.json`;
    let progress = { total_steps: TOTAL_STEPS, events: [] };
    try {
        const existing = JSON.parse(readFileSync(progressFile, 'utf-8'));
        if (existing.events) progress = existing;
    } catch { /* first write */ }

    progress.events.push({
        type: 'thinking',
        text,
        timestamp: new Date().toISOString(),
    });
    writeFileSync(progressFile, JSON.stringify(progress));
}

function reportScreenshot(screenshotFile, actionDesc) {
    const progressFile = `${screenshotDir}/progress.json`;
    let progress = { total_steps: TOTAL_STEPS, events: [] };
    try {
        const existing = JSON.parse(readFileSync(progressFile, 'utf-8'));
        if (existing.events) progress = existing;
    } catch { /* first write */ }

    progress.events.push({
        type: 'screenshot',
        screenshot: screenshotFile,
        action: actionDesc || '',
        timestamp: new Date().toISOString(),
    });
    writeFileSync(progressFile, JSON.stringify(progress));
}

// =============================================================================
// Helpers
// =============================================================================

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Action Handler (Claude computer_use actions -> Playwright calls)
// =============================================================================

// Map Claude key names to Playwright key names
const KEY_MAP = {
    'Return': 'Enter',
    'return': 'Enter',
    'space': ' ',
    'Space': ' ',
    'ctrl': 'Control',
    'alt': 'Alt',
    'shift': 'Shift',
    'super': 'Meta',
    'cmd': 'Meta',
    'win': 'Meta',
    'option': 'Alt',
    'BackSpace': 'Backspace',
    'Escape': 'Escape',
    'esc': 'Escape',
    'Tab': 'Tab',
    'Delete': 'Delete',
    'Home': 'Home',
    'End': 'End',
    'Page_Up': 'PageUp',
    'Page_Down': 'PageDown',
    'Up': 'ArrowUp',
    'Down': 'ArrowDown',
    'Left': 'ArrowLeft',
    'Right': 'ArrowRight',
};

function mapKey(key) {
    return KEY_MAP[key] || key;
}

async function handleAction(page, input) {
    const action = input.action;

    switch (action) {
        case 'screenshot':
            // No physical action — we always return a screenshot after every call
            return 'screenshot (no-op)';

        case 'left_click': {
            const [x, y] = input.coordinate;
            await page.mouse.click(clamp(x, 0, DISPLAY_WIDTH), clamp(y, 0, DISPLAY_HEIGHT));
            return `left_click(${x}, ${y})`;
        }

        case 'right_click': {
            const [x, y] = input.coordinate;
            await page.mouse.click(clamp(x, 0, DISPLAY_WIDTH), clamp(y, 0, DISPLAY_HEIGHT), { button: 'right' });
            return `right_click(${x}, ${y})`;
        }

        case 'middle_click': {
            const [x, y] = input.coordinate;
            await page.mouse.click(clamp(x, 0, DISPLAY_WIDTH), clamp(y, 0, DISPLAY_HEIGHT), { button: 'middle' });
            return `middle_click(${x}, ${y})`;
        }

        case 'double_click': {
            const [x, y] = input.coordinate;
            await page.mouse.dblclick(clamp(x, 0, DISPLAY_WIDTH), clamp(y, 0, DISPLAY_HEIGHT));
            return `double_click(${x}, ${y})`;
        }

        case 'triple_click': {
            const [x, y] = input.coordinate;
            await page.mouse.click(clamp(x, 0, DISPLAY_WIDTH), clamp(y, 0, DISPLAY_HEIGHT), { clickCount: 3 });
            return `triple_click(${x}, ${y})`;
        }

        case 'type': {
            await page.keyboard.type(input.text, { delay: 30 });
            const preview = input.text.length > 40 ? input.text.substring(0, 40) + '...' : input.text;
            return `type("${preview}")`;
        }

        case 'key': {
            // Claude sends keys like "Return", "ctrl+a", "ctrl+shift+t"
            const keyStr = input.text;
            if (keyStr.includes('+')) {
                // Key combination — hold modifiers, press last key, release
                const parts = keyStr.split('+');
                const modifiers = parts.slice(0, -1).map(mapKey);
                const finalKey = mapKey(parts[parts.length - 1]);
                for (const mod of modifiers) await page.keyboard.down(mod);
                await page.keyboard.press(finalKey);
                for (const mod of modifiers.reverse()) await page.keyboard.up(mod);
            } else {
                await page.keyboard.press(mapKey(keyStr));
            }
            return `key("${keyStr}")`;
        }

        case 'mouse_move': {
            const [x, y] = input.coordinate;
            await page.mouse.move(clamp(x, 0, DISPLAY_WIDTH), clamp(y, 0, DISPLAY_HEIGHT));
            return `mouse_move(${x}, ${y})`;
        }

        case 'scroll': {
            const [x, y] = input.coordinate;
            const direction = input.scroll_direction;
            const amount = input.scroll_amount || 3;
            const pixels = amount * 100;
            await page.mouse.move(clamp(x, 0, DISPLAY_WIDTH), clamp(y, 0, DISPLAY_HEIGHT));
            if (direction === 'down') await page.mouse.wheel(0, pixels);
            else if (direction === 'up') await page.mouse.wheel(0, -pixels);
            else if (direction === 'right') await page.mouse.wheel(pixels, 0);
            else if (direction === 'left') await page.mouse.wheel(-pixels, 0);
            return `scroll(${x},${y}) ${direction} ${amount}`;
        }

        case 'left_click_drag': {
            const [startX, startY] = input.start_coordinate;
            const [endX, endY] = input.coordinate;
            await page.mouse.move(clamp(startX, 0, DISPLAY_WIDTH), clamp(startY, 0, DISPLAY_HEIGHT));
            await page.mouse.down();
            await page.mouse.move(clamp(endX, 0, DISPLAY_WIDTH), clamp(endY, 0, DISPLAY_HEIGHT), { steps: 10 });
            await page.mouse.up();
            return `drag(${startX},${startY} -> ${endX},${endY})`;
        }

        case 'wait': {
            await sleep(5000);
            return 'wait(5s)';
        }

        case 'hold_key': {
            const key = mapKey(input.text);
            const duration = (input.duration || 1) * 1000;
            await page.keyboard.down(key);
            await sleep(duration);
            await page.keyboard.up(key);
            return `hold_key("${input.text}", ${duration}ms)`;
        }

        default:
            console.error(`DEBUG: Unknown action: ${action}`);
            return `unknown(${action})`;
    }
}

// =============================================================================
// Screenshot Helper
// =============================================================================

let screenshotCounter = 0;

async function takeScreenshot(page, label) {
    const padded = String(screenshotCounter).padStart(2, '0');
    const safeName = (label || 'screen').replace(/[^a-z0-9-]/gi, '-').substring(0, 30);
    const filename = `${padded}-${safeName}.png`;
    const filepath = `${screenshotDir}/${filename}`;

    const buffer = await page.screenshot({ fullPage: false });
    writeFileSync(filepath, buffer);

    const base64 = buffer.toString('base64');
    screenshotCounter++;

    return { filename, base64 };
}

function screenshotHash(base64) {
    return createHash('md5').update(base64.substring(0, 5000)).digest('hex');
}

/**
 * Strip images from older messages to reduce API input token costs.
 * Only the latest user message keeps its screenshot — older ones get a
 * text placeholder so Claude still has the conversation context.
 */
function buildTrimmedMessages(messages) {
    if (messages.length <= 2) return messages;

    return messages.map((msg, i) => {
        if (i === messages.length - 1) return msg; // keep latest intact
        if (!Array.isArray(msg.content)) return msg;

        const trimmedContent = msg.content.map(block => {
            if (block.type === 'image') {
                return { type: 'text', text: '[previous screenshot]' };
            }
            if (block.type === 'tool_result' && Array.isArray(block.content)) {
                if (block.content.some(b => b.type === 'image')) {
                    return { ...block, content: [{ type: 'text', text: '[screenshot taken]' }] };
                }
            }
            return block;
        });

        return { ...msg, content: trimmedContent };
    });
}

// =============================================================================
// Progress Detection (map AI actions to logical steps 1-6)
// =============================================================================

const STEP_DEFINITIONS = [
    { step: 1, label: 'Logging into Premier', completedLabel: 'Logged in' },
    { step: 2, label: 'Navigating to Purchase Orders', completedLabel: 'Reached Purchase Orders' },
    { step: 3, label: `Filtering for ${PO_NUMBER}`, completedLabel: `Found ${PO_NUMBER}` },
    { step: 4, label: 'Selecting PO', completedLabel: 'PO selected' },
    { step: 5, label: 'Opening send action', completedLabel: needsApproval ? 'Approval dialog ready' : 'Email dialog ready' },
    { step: 6, label: 'Sending to supplier', completedLabel: 'PO sent to supplier' },
];

function detectStepFromAction(input, textBlocks) {
    if (!input) return null;
    const action = input.action;
    const text = (input.text || '').toLowerCase();

    // Also check any text blocks Claude sent (reasoning about what it's doing)
    const reasoning = textBlocks.map(b => b.text || '').join(' ').toLowerCase();

    // Step 1: Login
    if (action === 'type' && (text.includes(PREMIER_WEB_CLIENT_ID.toLowerCase()) ||
        text.includes(PREMIER_WEB_USERNAME.toLowerCase()) ||
        text.includes(PREMIER_WEB_PASSWORD.toLowerCase()))) {
        return 1;
    }
    if (reasoning.includes('log in') || reasoning.includes('login') || reasoning.includes('credential')) return 1;

    // Step 2: Navigation
    if (reasoning.includes('hamburger') || reasoning.includes('sidebar') ||
        (reasoning.includes('purchase order') && (reasoning.includes('menu') || reasoning.includes('navigat')))) {
        return 2;
    }

    // Step 3: Filter
    if (action === 'type' && text.includes(PO_NUMBER.toLowerCase())) return 3;
    if (reasoning.includes('filter')) return 3;

    // Step 4: Select row
    if (reasoning.includes('select') && reasoning.includes('row')) return 4;
    if (reasoning.includes('click') && reasoning.includes(PO_NUMBER.toLowerCase())) return 4;

    // Step 5: More Actions / Email
    if (reasoning.includes('more action') || reasoning.includes('email editor') ||
        reasoning.includes('email dialog') || reasoning.includes('approval')) return 5;

    // Step 6: Send
    if (reasoning.includes('send button') || reasoning.includes('clicking send') ||
        reasoning.includes('click send')) return 6;

    return null;
}

// =============================================================================
// System Prompt
// =============================================================================

function buildSystemPrompt() {
    const action = needsApproval ? 'SEND FOR APPROVAL' : 'EMAIL';

    return `You are an AI agent automating a task in the Premier procurement system (Jonas Premier).
Your goal is to send Purchase Order ${PO_NUMBER} to the supplier.

ENVIRONMENT:
- You are controlling a browser pointed at the Premier web application.
- The viewport is ${DISPLAY_WIDTH}x${DISPLAY_HEIGHT} pixels.
- Premier is an Angular SPA that uses iframes and Kendo UI components.
- Elements may render in iframes named "loginContainer" or "appContainer".

TASK - Complete these steps in order:

Step 1 - LOGIN (usually already handled):
- Login is typically handled automatically before you start.
- If you see a dashboard or the main application, skip this step entirely.
- If you somehow see a login form, fill in:
  - Client ID: ${PREMIER_WEB_CLIENT_ID}
  - Username: ${PREMIER_WEB_USERNAME}
  - Password: ${PREMIER_WEB_PASSWORD}
  Then click "Log in".
- If you see "username already in use" conflict, re-fill credentials and click Login again.
- If you see "Email Validation" popup, click "Do it later".
- If you see any "OK" or welcome dialog, dismiss it.

Step 2 - NAVIGATE TO PURCHASE ORDERS:
- Look for a hamburger menu icon (three horizontal lines) in the top-left area of the sidebar.
- Click it to expand the navigation menu.
- Find and click "Purchase Orders" in the expanded menu.
- Then click the "POs" sub-item to open the PO list.
- Wait for the PO grid/table to load (you should see column headers like "PO #").

Step 3 - FILTER FOR THE PO:
- Find the "PO #" column header in the grid.
- Click the filter icon on that column header (small icon near the column title).
- In the filter dropdown/popup, type: ${PO_NUMBER}
- Click the "Filter" button or press Enter to apply.
- Wait for the grid to show the filtered results with ${PO_NUMBER}.

Step 4 - SELECT THE PO:
- Click on the row containing ${PO_NUMBER} to open the PO detail view.
- Wait for the PO details to load on the right side or below the grid.

Step 5 - OPEN ${action} DIALOG:
- Look for a "MORE ACTIONS" button in the PO detail view.
- Click it to reveal the action dropdown menu.
- Click "${action}" from the dropdown options.
${!needsApproval ? `- Wait for the Email Editor dialog to appear (may take 5-15 seconds).
- The dialog will have To, Cc, Subject fields and a SEND button.` : `- Wait for the approval confirmation dialog to appear.`}
${SUPPLIER_MESSAGE ? `- If you see an email body editor area, try to add this message at the top: "${SUPPLIER_MESSAGE}"` : ''}

${dryRun ? `Step 6 - STOP (DRY RUN):
- Do NOT click SEND or any final confirmation button.
- The email/approval dialog is open - that is sufficient.
- Stop taking actions. The task is complete.` : `Step 6 - SEND:
- Click the "SEND" button to send the ${!needsApproval ? 'email' : 'approval request'}.
- Wait briefly for confirmation.
- Stop taking actions. The task is complete.`}

IMPORTANT RULES:
- After each step, take a screenshot and verify you achieved the right outcome before proceeding.
- CRITICAL: Premier is VERY SLOW. After clicking anything, use the "wait" action before taking a screenshot. Loading spinners and blank screens are normal — just wait and try again.
- If you see a loading spinner, blank white area, or "Loading..." text, use the "wait" action 2-3 times before concluding something is wrong.
- After login, wait at least 10-15 seconds for the dashboard to fully render.
- After navigating to Purchase Orders, wait 5-10 seconds for the grid to load.
- After filtering, wait 3-5 seconds for results to appear.
- After completing all steps, stop taking actions.
- If something unexpected happens (error dialog, wrong page), try to recover.
- Do not navigate away from the Premier application.
- If a dropdown or UI element is hard to click, try using keyboard shortcuts.`;
}

// =============================================================================
// CUA Agent Loop
// =============================================================================

async function runCUALoop(page) {
    // Take initial screenshot
    const initial = await takeScreenshot(page, 'initial');
    const screenshots = [initial.filename];

    // Build initial messages
    const messages = [{
        role: 'user',
        content: [
            {
                type: 'text',
                text: `Please send PO ${PO_NUMBER} to the supplier. Here is the current browser state:`,
            },
            {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: initial.base64,
                },
            },
        ],
    }];

    let currentStep = 0;
    let lastReportedStep = 0;
    const recentHashes = [];

    reportStep(1, 'starting', 'Logging into Premier...', null);

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        // Call Claude API
        let response;
        // Strip old screenshots to reduce input tokens (~67% cost saving)
        const trimmedMessages = buildTrimmedMessages(messages);

        try {
            response = await anthropic.beta.messages.create({
                model: MODEL,
                max_tokens: 1024,
                system: buildSystemPrompt(),
                tools: [{
                    type: toolType,
                    name: 'computer',
                    display_width_px: DISPLAY_WIDTH,
                    display_height_px: DISPLAY_HEIGHT,
                }],
                messages: trimmedMessages,
                betas: [beta],
            });
        } catch (err) {
            // Retry once on transient API errors
            console.error(`DEBUG: Anthropic API error: ${err.message} — retrying in 5s`);
            await sleep(5000);
            response = await anthropic.beta.messages.create({
                model: MODEL,
                max_tokens: 1024,
                system: buildSystemPrompt(),
                tools: [{
                    type: toolType,
                    name: 'computer',
                    display_width_px: DISPLAY_WIDTH,
                    display_height_px: DISPLAY_HEIGHT,
                }],
                messages: trimmedMessages,
                betas: [beta],
            });
        }

        // Add assistant response to conversation history
        messages.push({ role: 'assistant', content: response.content });

        // Extract text blocks (Claude's reasoning) and tool_use blocks
        const textBlocks = response.content.filter(b => b.type === 'text');
        const toolUses = response.content.filter(b => b.type === 'tool_use');

        // Log and report Claude's reasoning to progress.json
        for (const tb of textBlocks) {
            if (tb.text) {
                console.error(`DEBUG: Claude: ${tb.text.substring(0, 200)}`);
                reportThinking(tb.text);
            }
        }

        // If no tool calls or stop_reason is end_turn, task is complete
        if (toolUses.length === 0 || response.stop_reason === 'end_turn') {
            console.error('DEBUG: No tool calls — task complete');
            break;
        }

        // Process each tool_use call
        const toolResults = [];

        for (const toolUse of toolUses) {
            const input = toolUse.input;
            console.error(`DEBUG: [${iteration + 1}/${MAX_ITERATIONS}] ${input.action} ${JSON.stringify(input).substring(0, 120)}`);

            // Detect and report progress
            const detectedStep = detectStepFromAction(input, textBlocks);
            if (detectedStep && detectedStep > currentStep) {
                // Complete previous step
                if (currentStep > 0 && currentStep > lastReportedStep) {
                    const prevDef = STEP_DEFINITIONS[currentStep - 1];
                    reportStep(currentStep, 'completed', prevDef.completedLabel, screenshots[screenshots.length - 1]);
                    lastReportedStep = currentStep;
                }
                // Start new step
                currentStep = detectedStep;
                const stepDef = STEP_DEFINITIONS[currentStep - 1];
                reportStep(currentStep, 'starting', stepDef.label + '...', null);
            }

            // Execute the action
            const actionDesc = await handleAction(page, input);
            console.error(`DEBUG: Executed: ${actionDesc}`);

            // Generous pause after action — Premier is slow with Angular rendering + spinners
            if (input.action === 'left_click' || input.action === 'double_click') {
                await sleep(3000); // Clicks often trigger navigation/loading
            } else if (input.action !== 'wait' && input.action !== 'screenshot') {
                await sleep(1500);
            }

            // Take screenshot after action
            const screenshot = await takeScreenshot(page, `step-${iteration}`);
            screenshots.push(screenshot.filename);

            // Report every screenshot for real-time streaming to UI
            reportScreenshot(screenshot.filename, actionDesc);

            // Stuck detection
            const hash = screenshotHash(screenshot.base64);
            recentHashes.push(hash);
            if (recentHashes.length > STUCK_THRESHOLD) recentHashes.shift();
            if (recentHashes.length >= STUCK_THRESHOLD && recentHashes.every(h => h === recentHashes[0])) {
                console.error('DEBUG: AI appears stuck (same screenshot repeated) — aborting');
                throw new Error(`AI agent stuck after ${iteration + 1} iterations — identical screenshots detected`);
            }

            // Build tool result with screenshot
            toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: [{
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: 'image/png',
                        data: screenshot.base64,
                    },
                }],
            });
        }

        // Add tool results to conversation
        messages.push({ role: 'user', content: toolResults });
    }

    // Complete final reported step
    if (currentStep > lastReportedStep && currentStep > 0) {
        const def = STEP_DEFINITIONS[currentStep - 1];
        reportStep(currentStep, 'completed', def.completedLabel, screenshots[screenshots.length - 1]);
    }

    if (dryRun) {
        // Dry run — Claude stopped on its own after opening the dialog
        if (currentStep < 5) {
            reportStep(5, 'completed', needsApproval ? 'Approval dialog ready' : 'Email dialog ready', screenshots[screenshots.length - 1]);
        }
        return { screenshots, dryRunStopped: true, completed: true };
    }

    // Check if the CUA agent actually completed the task
    // If we exhausted iterations without reaching step 6, this is NOT a success
    if (currentStep < 6) {
        return { screenshots, dryRunStopped: false, completed: false };
    }

    reportStep(6, 'completed', 'PO sent to supplier', screenshots[screenshots.length - 1]);
    return { screenshots, dryRunStopped: false, completed: true };
}

// =============================================================================
// Main
// =============================================================================

/**
 * Handle login programmatically via Playwright (not CUA).
 * The login form lives in the "loginContainer" iframe with 4 visible inputs:
 * ClientID, Username, Password, and Remember Me checkbox.
 * Returns true if login was performed, false if already logged in.
 */
async function handleLoginProgrammatically(page) {
    // Check if we're on the login page by looking for the loginContainer iframe
    const loginFrame = page.frame('loginContainer');
    if (!loginFrame) {
        console.error('DEBUG: No loginContainer iframe found — may already be logged in');
        return false;
    }

    // Look for the password input field inside the login frame
    const passwordField = loginFrame.locator('input[type="password"]');
    const hasLoginForm = await passwordField.count().catch(() => 0);

    if (!hasLoginForm) {
        // Could also check for any visible input fields
        const inputs = loginFrame.locator('input:visible');
        const inputCount = await inputs.count().catch(() => 0);
        if (inputCount < 3) {
            console.error('DEBUG: No login form detected — already logged in');
            return false;
        }
    }

    console.error('DEBUG: Login form detected — filling credentials programmatically');
    reportStep(1, 'starting', 'Logging into Premier...', null);

    try {
        // Get all visible inputs in the login frame
        const inputs = loginFrame.locator('input:visible');
        const inputCount = await inputs.count();
        console.error(`DEBUG: Found ${inputCount} visible inputs in loginContainer`);

        // Fill Client ID (first text input)
        const clientIdField = loginFrame.locator('input[type="text"]').first();
        await clientIdField.fill(PREMIER_WEB_CLIENT_ID);
        await page.waitForTimeout(300);

        // Fill Username (second text input)
        const usernameField = loginFrame.locator('input[type="text"]').nth(1);
        await usernameField.fill(PREMIER_WEB_USERNAME);
        await page.waitForTimeout(300);

        // Fill Password
        await passwordField.first().fill(PREMIER_WEB_PASSWORD);
        await page.waitForTimeout(300);

        // Check Remember Me if available
        const rememberCheckbox = loginFrame.locator('input[type="checkbox"]');
        if (await rememberCheckbox.count() > 0) {
            const isChecked = await rememberCheckbox.first().isChecked().catch(() => false);
            if (!isChecked) {
                await rememberCheckbox.first().check();
            }
        }

        // Take screenshot of filled form
        await takeScreenshot(page, '00b-form-filled');

        // Click the login button
        const loginButton = loginFrame.locator('button:visible, input[type="submit"]:visible').first();
        await loginButton.click();
        console.error('DEBUG: Clicked login button');

        // Wait for navigation / dashboard load (Premier is slow)
        await page.waitForTimeout(15000);

        // Take screenshot after login
        const dashScreenshot = await takeScreenshot(page, '01-dashboard');
        reportStep(1, 'completed', 'Logged in', dashScreenshot.filename);

        // Check for "username already in use" or similar conflict dialogs
        const pageContent = await page.content().catch(() => '');
        if (pageContent.toLowerCase().includes('already in use') || pageContent.toLowerCase().includes('username in use')) {
            console.error('DEBUG: Session conflict detected — retrying login');
            // Try to dismiss and re-login
            const okButton = loginFrame.locator('button:has-text("OK"), button:has-text("ok")').first();
            if (await okButton.count() > 0) {
                await okButton.click();
                await page.waitForTimeout(2000);
            }
            // Re-fill and re-submit
            await passwordField.first().fill(PREMIER_WEB_PASSWORD);
            await loginButton.click();
            await page.waitForTimeout(15000);
        }

        // Dismiss any "Email Validation" or welcome popups
        try {
            const doItLater = page.locator('text="Do it later"').first();
            if (await doItLater.isVisible({ timeout: 3000 })) {
                await doItLater.click();
                await page.waitForTimeout(1000);
            }
        } catch { /* no popup */ }

        try {
            const okBtn = page.locator('button:has-text("OK")').first();
            if (await okBtn.isVisible({ timeout: 2000 })) {
                await okBtn.click();
                await page.waitForTimeout(1000);
            }
        } catch { /* no popup */ }

        console.error('DEBUG: Programmatic login completed');
        return true;

    } catch (err) {
        console.error(`DEBUG: Programmatic login failed: ${err.message} — CUA will handle login`);
        return false;
    }
}

async function sendPOToSupplier() {
    const context = await chromium.launchPersistentContext(sessionDir, {
        headless: true,
        viewport: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = context.pages()[0] || await context.newPage();

    try {
        console.error(`DEBUG: Navigating to ${PREMIER_WEB_URL}`);
        console.error(`DEBUG: Model: ${MODEL}, Tool: ${toolType}, Beta: ${beta}`);
        await page.goto(PREMIER_WEB_URL, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(10000); // Premier SPA takes 10+ seconds to initialize

        // Handle login programmatically (more reliable than CUA for form filling)
        const didLogin = await handleLoginProgrammatically(page);
        if (didLogin) {
            console.error('DEBUG: Login handled programmatically — CUA starts from dashboard');
        }

        // Run the AI agent loop
        const result = await runCUALoop(page);

        // If the CUA agent did not complete the task, treat as failure
        if (!result.completed) {
            console.error(JSON.stringify({
                success: false,
                error: `CUA agent exhausted ${MAX_ITERATIONS} iterations without completing the task`,
                po_number: PO_NUMBER,
                screenshots: result.screenshots,
                timestamp: new Date().toISOString(),
            }));
            process.exit(1);
        }

        // Output success JSON to stdout (PHP job reads this)
        console.log(JSON.stringify({
            success: true,
            dry_run: result.dryRunStopped || false,
            po_number: PO_NUMBER,
            action: result.dryRunStopped
                ? (needsApproval ? 'would_send_for_approval' : 'would_email')
                : (needsApproval ? 'sent_for_approval' : 'emailed'),
            total_cost: totalCost,
            screenshots: result.screenshots,
            timestamp: new Date().toISOString(),
        }));

    } catch (error) {
        try {
            await page.screenshot({ path: `${screenshotDir}/error.png`, fullPage: true });
        } catch { /* can't screenshot */ }

        console.error(JSON.stringify({
            success: false,
            error: error.message,
            po_number: PO_NUMBER,
            screenshots: [],
            timestamp: new Date().toISOString(),
        }));
        process.exit(1);
    } finally {
        await context.close();
    }
}

sendPOToSupplier().catch((err) => {
    console.error(JSON.stringify({
        success: false,
        error: err.message,
    }));
    process.exit(1);
});
