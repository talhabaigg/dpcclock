import SignaturePad from 'signature_pad';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

declare global {
    interface Window {
        __signing_token: string;
        __viewed_url: string;
        __preview_pdf_url: string;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const pdfPagesContainer = document.getElementById('pdf-pages')!;
    const pdfLoading = document.getElementById('pdf-loading')!;
    const readConfirmation = document.getElementById('read-confirmation')!;
    const readCheckbox = document.getElementById('read-checkbox') as HTMLInputElement;
    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
    const form = document.getElementById('signing-form') as HTMLFormElement;
    const signatureSection = form;
    const signatureDataInput = document.getElementById('signature-data') as HTMLInputElement;
    const initialsDataInput = document.getElementById('initials-data') as HTMLInputElement;
    const signatureError = document.getElementById('signature-error')!;
    const initialsError = document.getElementById('initials-error')!;
    const signatureCanvas = document.getElementById('signature-canvas') as HTMLCanvasElement;
    const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;

    // Shared state
    let totalPages = 0;
    let currentPage = 0;
    const pageInitialsData: (string | null)[] = [];
    const pageInitialed: boolean[] = [];
    let initialsPad: SignaturePad | null = null;

    // ─── Load PDF with pdf.js ───────────────────────────────
    try {
        const pdfDoc = await pdfjsLib.getDocument(window.__preview_pdf_url).promise;
        totalPages = pdfDoc.numPages;
        pdfLoading.style.display = 'none';

        // Initialize arrays
        for (let i = 0; i < totalPages; i++) {
            pageInitialsData.push(null);
            pageInitialed.push(false);
        }

        // Build the page viewer
        pdfPagesContainer.innerHTML = `
            <div class="page-viewer" id="page-viewer">
                <div class="page-header">
                    <span id="page-label">Page 1 of ${totalPages}</span>
                    <span id="page-initial-status" class="initials-status">Not initialed</span>
                </div>
                <div class="page-canvas-wrapper">
                    <canvas id="pdf-canvas"></canvas>
                </div>
                <div class="initials-section">
                    <h4 id="initials-label">Initial this page</h4>
                    <div class="initials-row">
                        <div class="initials-canvas-wrapper">
                            <canvas id="initials-canvas" width="200" height="80"></canvas>
                        </div>
                        <div>
                            <div id="initials-status-text" class="initials-status">Draw your initials</div>
                            <div class="initials-actions">
                                <button type="button" id="initials-clear-btn">Clear</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="page-nav">
                    <button type="button" class="page-nav-btn" id="prev-btn" disabled>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                        Previous
                    </button>
                    <span class="page-nav-info" id="progress-text">0 of ${totalPages} initialed</span>
                    <button type="button" class="page-nav-btn primary" id="next-btn">
                        Next
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                </div>
                <div class="page-dots" id="page-dots"></div>
            </div>
        `;

        const pdfCanvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
        const initialsCanvas = document.getElementById('initials-canvas') as HTMLCanvasElement;
        const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
        const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
        const pageLabel = document.getElementById('page-label')!;
        const pageInitialStatus = document.getElementById('page-initial-status')!;
        const initialsLabel = document.getElementById('initials-label')!;
        const initialsStatusText = document.getElementById('initials-status-text')!;
        const initialsClearBtn = document.getElementById('initials-clear-btn') as HTMLButtonElement;
        const progressText = document.getElementById('progress-text')!;
        const dotsContainer = document.getElementById('page-dots')!;

        // Create initials pad
        initialsPad = new SignaturePad(initialsCanvas, {
            backgroundColor: 'rgba(0, 0, 0, 0)',
            penColor: 'rgb(0, 0, 0)',
            minWidth: 0.5,
            maxWidth: 2,
        });

        // Build dots
        for (let i = 0; i < totalPages; i++) {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'page-dot';
            dot.title = `Page ${i + 1}`;
            dot.addEventListener('click', () => goToPage(i));
            dotsContainer.appendChild(dot);
        }

        function saveCurrentInitials() {
            if (!initialsPad) return;
            if (!initialsPad.isEmpty()) {
                pageInitialsData[currentPage] = initialsPad.toDataURL('image/png');
                pageInitialed[currentPage] = true;
            } else {
                pageInitialsData[currentPage] = null;
                pageInitialed[currentPage] = false;
            }
        }

        function restoreInitials(pageIndex: number) {
            if (!initialsPad) return;
            initialsPad.clear();
            if (pageInitialsData[pageIndex]) {
                initialsPad.fromDataURL(pageInitialsData[pageIndex]!, { ratio: 1, width: 200, height: 80 });
            }
        }

        async function renderPage(pageIndex: number) {
            const page = await pdfDoc.getPage(pageIndex + 1);
            const scale = 1.5;
            const viewport = page.getViewport({ scale });

            pdfCanvas.width = viewport.width;
            pdfCanvas.height = viewport.height;

            const ctx = pdfCanvas.getContext('2d')!;
            await page.render({ canvasContext: ctx, viewport }).promise;
        }

        function updateUI() {
            const doneCount = pageInitialed.filter(Boolean).length;

            pageLabel.textContent = `Page ${currentPage + 1} of ${totalPages}`;
            initialsLabel.textContent = `Initial page ${currentPage + 1}`;

            if (pageInitialed[currentPage]) {
                pageInitialStatus.textContent = 'Initialed';
                pageInitialStatus.className = 'initials-status done';
                initialsStatusText.textContent = 'Initialed';
                initialsStatusText.className = 'initials-status done';
            } else {
                pageInitialStatus.textContent = 'Not initialed';
                pageInitialStatus.className = 'initials-status';
                initialsStatusText.textContent = 'Draw your initials';
                initialsStatusText.className = 'initials-status';
            }

            prevBtn.disabled = currentPage === 0;

            if (currentPage === totalPages - 1) {
                nextBtn.innerHTML = 'Done reviewing <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
            } else {
                nextBtn.innerHTML = 'Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';
            }

            progressText.textContent = `${doneCount} of ${totalPages} initialed`;

            const dots = dotsContainer.querySelectorAll('.page-dot');
            dots.forEach((dot, i) => {
                dot.className = 'page-dot';
                if (i === currentPage) dot.classList.add('active');
                if (pageInitialed[i]) dot.classList.add('initialed');
            });

            if (doneCount === totalPages) {
                readConfirmation.classList.add('visible');
            }
        }

        async function goToPage(pageIndex: number) {
            if (pageIndex < 0 || pageIndex >= totalPages) return;

            saveCurrentInitials();
            currentPage = pageIndex;

            await renderPage(currentPage);
            restoreInitials(currentPage);
            updateUI();

            document.getElementById('page-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Track initials strokes
        initialsPad.addEventListener('endStroke', () => {
            if (!initialsPad) return;
            pageInitialed[currentPage] = !initialsPad.isEmpty();
            pageInitialsData[currentPage] = initialsPad.isEmpty() ? null : initialsPad.toDataURL('image/png');
            updateUI();
        });

        // Clear initials
        initialsClearBtn.addEventListener('click', () => {
            if (!initialsPad) return;
            initialsPad.clear();
            pageInitialed[currentPage] = false;
            pageInitialsData[currentPage] = null;
            updateUI();
        });

        // Navigation
        prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages - 1) {
                goToPage(currentPage + 1);
            } else {
                saveCurrentInitials();
                updateUI();
                if (pageInitialed.every(Boolean)) {
                    readConfirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    const firstMissing = pageInitialed.findIndex((v) => !v);
                    if (firstMissing !== -1) goToPage(firstMissing);
                }
            }
        });

        // Render first page
        await renderPage(0);
        updateUI();
    } catch (err) {
        pdfLoading.textContent = 'Failed to load document. Please refresh the page.';
        // eslint-disable-next-line no-console
        console.error('PDF load error:', err);
        return;
    }

    // ─── Signature pad setup ────────────────────────────────
    // eslint-disable-next-line prefer-const
    let signaturePad: SignaturePad;

    function resizeSignatureCanvas() {
        const wrapper = signatureCanvas.parentElement!;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        signatureCanvas.width = wrapper.offsetWidth * ratio;
        signatureCanvas.height = 200 * ratio;
        signatureCanvas.style.height = '200px';
        signatureCanvas.getContext('2d')!.scale(ratio, ratio);
        signaturePad.clear();
    }

    signaturePad = new SignaturePad(signatureCanvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
    });

    window.addEventListener('resize', resizeSignatureCanvas);

    clearBtn.addEventListener('click', () => {
        signaturePad.clear();
        signatureError.classList.remove('visible');
    });

    undoBtn.addEventListener('click', () => {
        const data = signaturePad.toData();
        if (data.length > 0) {
            data.pop();
            signaturePad.fromData(data);
        }
    });

    // ─── Read confirmation ──────────────────────────────────
    let viewedMarked = false;
    readCheckbox.addEventListener('change', () => {
        if (readCheckbox.checked) {
            signatureSection.classList.add('visible');
            submitBtn.disabled = false;
            requestAnimationFrame(() => resizeSignatureCanvas());

            if (!viewedMarked) {
                viewedMarked = true;
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                fetch(window.__viewed_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                }).catch(() => {});
            }
        } else {
            signatureSection.classList.remove('visible');
            submitBtn.disabled = true;
        }
    });

    // ─── Form submission ────────────────────────────────────
    form.addEventListener('submit', (e) => {
        let hasError = false;

        if (!pageInitialed.every(Boolean)) {
            e.preventDefault();
            initialsError.classList.add('visible');
            hasError = true;
        } else {
            initialsError.classList.remove('visible');
        }

        if (signaturePad.isEmpty()) {
            e.preventDefault();
            signatureError.classList.add('visible');
            hasError = true;
        } else {
            signatureError.classList.remove('visible');
        }

        if (hasError) return;

        // Capture signature
        signatureDataInput.value = signaturePad.toDataURL('image/png');

        // Use the first page's saved initials as the representative stamp
        initialsDataInput.value = pageInitialsData[0] || '';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    });
});
