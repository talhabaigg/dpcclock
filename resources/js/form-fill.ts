type Operator = 'equals' | 'not_equals' | 'empty' | 'not_empty';
type Rule = { field_id: number; operator: Operator; value: string | null };
type FieldEntry = { id: number; wrapper: HTMLElement; rule: Rule | null; isHeading: boolean };

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-fill') as HTMLFormElement;
    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
    const submitError = document.getElementById('submit-error')!;

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

        if (hasError) {
            e.preventDefault();
            return;
        }

        // Disable button to prevent double submit
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    });
});
