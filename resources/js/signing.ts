import SignaturePad from 'signature_pad';

declare global {
    interface Window {
        __signing_token: string;
        __viewed_url: string;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const agreementBody = document.getElementById('agreement-body')!;
    const agreementEnd = document.getElementById('agreement-end')!;
    const scrollHint = document.getElementById('scroll-hint')!;
    const readConfirmation = document.getElementById('read-confirmation')!;
    const readCheckbox = document.getElementById('read-checkbox') as HTMLInputElement;
    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
    const form = document.getElementById('signing-form') as HTMLFormElement;
    const signatureSection = form;
    const signatureDataInput = document.getElementById('signature-data') as HTMLInputElement;
    const signatureError = document.getElementById('signature-error')!;
    const signatureCanvas = document.getElementById('signature-canvas') as HTMLCanvasElement;
    const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;

    // ─── Scroll-to-bottom detection ──────────────────────────
    let hasScrolledToBottom = false;

    const observer = new IntersectionObserver(
        (entries) => {
            if (entries[0].isIntersecting && !hasScrolledToBottom) {
                hasScrolledToBottom = true;
                readConfirmation.classList.add('active');
                scrollHint.classList.add('hidden');
                observer.disconnect();
            }
        },
        { root: agreementBody, threshold: 0.5 },
    );

    // If content doesn't overflow (short agreement), activate immediately
    if (agreementBody.scrollHeight <= agreementBody.clientHeight + 10) {
        hasScrolledToBottom = true;
        readConfirmation.classList.add('active');
        scrollHint.classList.add('hidden');
    } else {
        observer.observe(agreementEnd);
    }

    // ─── Signature pad setup ─────────────────────────────────
    const signaturePad = new SignaturePad(signatureCanvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
    });

    function resizeSignatureCanvas() {
        const wrapper = signatureCanvas.parentElement!;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        signatureCanvas.width = wrapper.offsetWidth * ratio;
        signatureCanvas.height = 200 * ratio;
        signatureCanvas.style.height = '200px';
        signatureCanvas.getContext('2d')!.scale(ratio, ratio);
        signaturePad.clear();
    }

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

    // ─── Read confirmation ───────────────────────────────────
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

    // ─── Form submission ─────────────────────────────────────
    form.addEventListener('submit', (e) => {
        if (signaturePad.isEmpty()) {
            e.preventDefault();
            signatureError.classList.add('visible');
            return;
        }

        signatureError.classList.remove('visible');
        signatureDataInput.value = signaturePad.toDataURL('image/png');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    });
});
