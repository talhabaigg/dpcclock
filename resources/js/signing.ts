import SignaturePad from 'signature_pad';

declare global {
    interface Window {
        __signing_token: string;
        __viewed_url: string;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('signature-canvas') as HTMLCanvasElement;
    const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
    const form = document.getElementById('signing-form') as HTMLFormElement;
    const signatureDataInput = document.getElementById('signature-data') as HTMLInputElement;
    const signatureError = document.getElementById('signature-error') as HTMLElement;
    const readCheckbox = document.getElementById('read-checkbox') as HTMLInputElement;
    const signatureSection = form;

    // Resize canvas to match container width
    function resizeCanvas() {
        const wrapper = canvas.parentElement!;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = wrapper.offsetWidth * ratio;
        canvas.height = 200 * ratio;
        canvas.style.height = '200px';
        canvas.getContext('2d')!.scale(ratio, ratio);
        signaturePad.clear();
    }

    const signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
    });

    // Don't resize now — canvas is hidden (display:none). Resize when revealed.
    window.addEventListener('resize', resizeCanvas);

    // Clear button
    clearBtn.addEventListener('click', () => {
        signaturePad.clear();
        signatureError.classList.remove('visible');
    });

    // Undo button
    undoBtn.addEventListener('click', () => {
        const data = signaturePad.toData();
        if (data.length > 0) {
            data.pop();
            signaturePad.fromData(data);
        }
    });

    // Read confirmation checkbox
    let viewedMarked = false;
    readCheckbox.addEventListener('change', () => {
        if (readCheckbox.checked) {
            signatureSection.classList.add('visible');
            submitBtn.disabled = false;

            // Canvas must be resized after the section is visible (was display:none)
            requestAnimationFrame(() => resizeCanvas());

            // Mark as viewed (fire once)
            if (!viewedMarked) {
                viewedMarked = true;
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                fetch(window.__viewed_url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                }).catch(() => {
                    // Silently fail — non-critical
                });
            }
        } else {
            signatureSection.classList.remove('visible');
            submitBtn.disabled = true;
        }
    });

    // Form submission
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
