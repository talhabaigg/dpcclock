document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-fill') as HTMLFormElement;
    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
    const submitError = document.getElementById('submit-error')!;

    form.addEventListener('submit', (e) => {
        // Clear previous errors
        document.querySelectorAll('.field-error').forEach((el) => {
            el.classList.remove('visible');
            el.textContent = '';
        });
        document.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
        submitError.classList.remove('visible');

        // Check required checkbox groups (HTML5 doesn't validate checkbox groups natively)
        let hasError = false;
        const checkboxGroups = form.querySelectorAll<HTMLDivElement>('.option-list');
        checkboxGroups.forEach((group) => {
            const checkboxes = group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
            if (checkboxes.length === 0) return;

            // Find the parent field-group to check if required
            const fieldGroup = group.closest('.field-group');
            if (!fieldGroup) return;
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
