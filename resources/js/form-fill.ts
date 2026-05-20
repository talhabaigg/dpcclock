import SignaturePad from 'signature_pad';

type Operator = 'equals' | 'not_equals' | 'empty' | 'not_empty';
type Rule = { field_id: number; operator: Operator; value: string | null };
type FieldEntry = { id: number; wrapper: HTMLElement; rule: Rule | null; isHeading: boolean };

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-fill') as HTMLFormElement;
    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
    const submitError = document.getElementById('submit-error')!;

    // ── Signature pads ───────────────────────────────────────────────────────
    // Each signature canvas pairs with a hidden input that holds the data URL.
    // We resize the canvas to its CSS width so the drawing is crisp on HiDPI.
    const signaturePads = new Map<number, SignaturePad>();
    form.querySelectorAll<HTMLCanvasElement>('canvas[data-signature-canvas-for]').forEach((canvas) => {
        const fieldId = Number(canvas.dataset.signatureCanvasFor);
        const hidden = form.querySelector<HTMLInputElement>(`input[data-signature-hidden-for="${fieldId}"]`);
        if (!hidden) return;

        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);

        const pad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
        pad.addEventListener('endStroke', () => {
            hidden.value = pad.isEmpty() ? '' : pad.toDataURL('image/png');
            // Strokes change effective values → re-evaluate visibility downstream.
            form.dispatchEvent(new Event('input', { bubbles: true }));
        });

        const clearBtn = form.querySelector<HTMLButtonElement>(`button[data-signature-clear-for="${fieldId}"]`);
        clearBtn?.addEventListener('click', () => {
            pad.clear();
            hidden.value = '';
            form.dispatchEvent(new Event('input', { bubbles: true }));
        });

        signaturePads.set(fieldId, pad);
    });

    // ── Conditional visibility ───────────────────────────────────────────────
    const fieldGroups = Array.from(form.querySelectorAll<HTMLElement>('.field-group[data-field-id]'));
    const fields: FieldEntry[] = fieldGroups.map((wrapper) => {
        const id = Number(wrapper.dataset.fieldId);
        const raw = wrapper.dataset.visibleIf;
        let rule: Rule | null = null;
        if (raw) {
            try {
                rule = JSON.parse(raw) as Rule;
            } catch {
                rule = null;
            }
        }
        return { id, wrapper, rule, isHeading: wrapper.dataset.fieldType === 'heading' };
    });

    function readFieldValue(wrapper: HTMLElement): string | string[] | null {
        const checkboxes = wrapper.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
        if (checkboxes.length > 0) {
            return Array.from(checkboxes).filter((cb) => cb.checked).map((cb) => cb.value);
        }
        const radios = wrapper.querySelectorAll<HTMLInputElement>('input[type="radio"]');
        if (radios.length > 0) {
            const chosen = Array.from(radios).find((r) => r.checked);
            return chosen ? chosen.value : '';
        }
        const input = wrapper.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            'input, textarea, select',
        );
        return input ? input.value : null;
    }

    function isEmpty(v: string | string[] | null): boolean {
        if (v === null || v === undefined) return true;
        if (Array.isArray(v)) return v.length === 0;
        return v === '';
    }

    function evalRule(rule: Rule, effective: Record<number, string | string[] | null>): boolean {
        const source = effective[rule.field_id];
        const empty = isEmpty(source ?? null);
        const matches = (() => {
            if (rule.value === null || rule.value === undefined) return false;
            if (Array.isArray(source)) return source.includes(rule.value);
            return String(source ?? '') === rule.value;
        })();
        return (
            rule.operator === 'empty' ? empty
            : rule.operator === 'not_empty' ? !empty
            : rule.operator === 'equals' ? matches
            : rule.operator === 'not_equals' ? !matches
            : true
        );
    }

    function applyVisibility() {
        // Walk in DOM (sort) order. Headings open sections — their rule
        // cascades to every following field until the next heading. A field's
        // own rule is AND-ed with its parent section's. Matches
        // FormVisibilityEvaluator on the server.
        const effective: Record<number, string | string[] | null> = {};
        let sectionVisible = true; // before the first heading: no section

        for (const entry of fields) {
            let show: boolean;
            if (entry.isHeading) {
                sectionVisible = entry.rule ? evalRule(entry.rule, effective) : true;
                show = sectionVisible;
            } else {
                const ownRule = entry.rule ? evalRule(entry.rule, effective) : true;
                show = sectionVisible && ownRule;
            }
            effective[entry.id] = show ? readFieldValue(entry.wrapper) : null;

            entry.wrapper.classList.toggle('is-hidden', !show);
            // Disable inputs in hidden wrappers so the browser doesn't validate
            // them and they don't get submitted with the form.
            entry.wrapper.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
                'input, textarea, select',
            ).forEach((el) => {
                el.disabled = !show;
            });
        }
    }

    // Re-evaluate on any input change anywhere in the form. Cheap (handful of fields).
    form.addEventListener('input', applyVisibility);
    form.addEventListener('change', applyVisibility);
    applyVisibility();

    // ── Pagination ───────────────────────────────────────────────────────────
    // Forms can be split into pages via page_break markers. Server renders each
    // page as a .form-page wrapper with data-page=N. Single-page forms have no
    // .form-page wrapper logic to worry about (nav buttons aren't rendered).
    const pageEls = Array.from(form.querySelectorAll<HTMLElement>('.form-page'));
    const pageCount = pageEls.length;
    const isPaginated = pageCount > 1;
    let currentPage = 0;

    function pageHasErrors(pageEl: HTMLElement): boolean {
        let bad = false;
        // Required visible inputs (text/select/textarea/date/etc.)
        pageEl.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            '.field-group:not(.is-hidden) input[required], .field-group:not(.is-hidden) select[required], .field-group:not(.is-hidden) textarea[required]',
        ).forEach((el) => {
            if (!el.disabled && !el.checkValidity()) {
                bad = true;
                el.classList.add('has-error');
                const wrapper = el.closest('.field-group');
                const id = wrapper?.getAttribute('data-field-id');
                if (id) {
                    const errorEl = document.getElementById(`error_field_${id}`);
                    if (errorEl) {
                        errorEl.textContent = el.validationMessage || 'This field is required.';
                        errorEl.classList.add('visible');
                    }
                }
            }
        });
        // Required checkbox groups (HTML5 doesn't enforce these).
        pageEl.querySelectorAll<HTMLDivElement>('.field-group:not(.is-hidden) .option-list').forEach((group) => {
            const cbs = group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
            if (cbs.length === 0) return;
            const wrapper = group.closest('.field-group');
            const label = wrapper?.querySelector('label');
            if (!label?.querySelector('.required-star')) return;
            if (!Array.from(cbs).some((cb) => cb.checked)) {
                bad = true;
                const id = wrapper?.getAttribute('data-field-id');
                if (id) {
                    const errorEl = document.getElementById(`error_field_${id}`);
                    if (errorEl) {
                        errorEl.textContent = 'Please select at least one option.';
                        errorEl.classList.add('visible');
                    }
                }
            }
        });
        // Required signatures on this page.
        signaturePads.forEach((pad, fieldId) => {
            const wrapper = pageEl.querySelector<HTMLElement>(`.field-group[data-field-id="${fieldId}"]`);
            if (!wrapper || wrapper.classList.contains('is-hidden')) return;
            if (!wrapper.querySelector('label')?.querySelector('.required-star')) return;
            if (pad.isEmpty()) {
                bad = true;
                wrapper.querySelector('canvas')?.classList.add('has-error');
                const errorEl = document.getElementById(`error_field_${fieldId}`);
                if (errorEl) {
                    errorEl.textContent = 'Signature is required.';
                    errorEl.classList.add('visible');
                }
            }
        });
        return bad;
    }

    function showPage(index: number) {
        if (!isPaginated) return;
        currentPage = Math.max(0, Math.min(pageCount - 1, index));
        pageEls.forEach((el, i) => {
            el.style.display = i === currentPage ? '' : 'none';
        });
        const prevBtn = document.getElementById('nav-prev') as HTMLButtonElement | null;
        const nextBtn = document.getElementById('nav-next') as HTMLButtonElement | null;
        const submitOnLast = document.getElementById('submit-btn') as HTMLButtonElement | null;
        const indicator = document.getElementById('page-current');
        if (prevBtn) prevBtn.style.display = currentPage === 0 ? 'none' : '';
        if (nextBtn) nextBtn.style.display = currentPage === pageCount - 1 ? 'none' : '';
        if (submitOnLast) submitOnLast.style.display = currentPage === pageCount - 1 ? '' : 'none';
        if (indicator) indicator.textContent = String(currentPage + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (isPaginated) {
        document.getElementById('nav-next')?.addEventListener('click', () => {
            // Clear previous errors on this page before re-checking.
            pageEls[currentPage]?.querySelectorAll('.field-error').forEach((el) => {
                el.classList.remove('visible');
                el.textContent = '';
            });
            pageEls[currentPage]?.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
            if (pageHasErrors(pageEls[currentPage])) return;
            showPage(currentPage + 1);
        });
        document.getElementById('nav-prev')?.addEventListener('click', () => showPage(currentPage - 1));
        showPage(0);
    }

    // ── Submit ───────────────────────────────────────────────────────────────
    form.addEventListener('submit', (e) => {
        // Clear previous errors
        document.querySelectorAll('.field-error').forEach((el) => {
            el.classList.remove('visible');
            el.textContent = '';
        });
        document.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
        submitError.classList.remove('visible');

        // Check required checkbox groups (HTML5 doesn't validate checkbox groups
        // natively). Skip hidden field-groups.
        let hasError = false;
        const checkboxGroups = form.querySelectorAll<HTMLDivElement>('.option-list');
        checkboxGroups.forEach((group) => {
            const checkboxes = group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
            if (checkboxes.length === 0) return;

            const fieldGroup = group.closest('.field-group');
            if (!fieldGroup || fieldGroup.classList.contains('is-hidden')) return;
            const label = fieldGroup.querySelector('label');
            if (!label || !label.querySelector('.required-star')) return;

            const checked = Array.from(checkboxes).some((cb) => cb.checked);
            if (!checked) {
                hasError = true;
                const name = checkboxes[0].name;
                const fieldId = name.replace('field_', '').replace('[]', '');
                const errorEl = document.getElementById(`error_field_${fieldId}`);
                if (errorEl) {
                    errorEl.textContent = 'Please select at least one option.';
                    errorEl.classList.add('visible');
                }
            }
        });

        // Required signatures: if the wrapper has a required-star and the pad
        // is empty, flag it. Hidden signature wrappers are skipped.
        signaturePads.forEach((pad, fieldId) => {
            const wrapper = form.querySelector<HTMLElement>(`.signature-block[data-signature-field="${fieldId}"]`)?.closest<HTMLElement>('.field-group');
            if (!wrapper || wrapper.classList.contains('is-hidden')) return;
            const label = wrapper.querySelector('label');
            if (!label || !label.querySelector('.required-star')) return;
            if (pad.isEmpty()) {
                hasError = true;
                const canvas = wrapper.querySelector<HTMLCanvasElement>('canvas[data-signature-canvas-for]');
                canvas?.classList.add('has-error');
                const errorEl = document.getElementById(`error_field_${fieldId}`);
                if (errorEl) {
                    errorEl.textContent = 'Signature is required.';
                    errorEl.classList.add('visible');
                }
            } else {
                wrapper.querySelector('canvas')?.classList.remove('has-error');
            }
        });

        if (hasError) {
            e.preventDefault();
            return;
        }

        // Disable button to prevent double submit
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    });
});
