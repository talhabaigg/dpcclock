<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $formRequest->formTemplate->name }}</title>
    @vite(['resources/js/form-fill.ts'])
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; line-height: 1.6; }
        .container { max-width: 720px; margin: 0 auto; padding: 20px 16px; }

        /* Header */
        .header { text-align: center; padding: 24px 0 20px; }
        .header img { max-height: 44px; margin-bottom: 12px; }
        .header h1 { font-size: 20px; font-weight: 600; color: #0f172a; }
        .header p { font-size: 14px; color: #64748b; margin-top: 2px; }

        /* Greeting */
        .greeting { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; font-size: 15px; color: #334155; }
        .greeting strong { color: #0f172a; }

        /* Form card */
        .form-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
        .form-header { padding: 14px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .form-header h2 { font-size: 14px; font-weight: 600; color: #334155; }
        .form-body { padding: 24px 28px; }

        /* Field groups */
        .field-group { margin-bottom: 20px; }
        .field-group:last-child { margin-bottom: 0; }
        .field-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #1e293b; }
        .field-group .required-star { color: #dc2626; margin-left: 2px; }
        .field-group .help-text { font-size: 12px; color: #64748b; margin-top: 4px; }
        .field-group .field-error { font-size: 12px; color: #dc2626; margin-top: 4px; display: none; }
        .field-group .field-error.visible { display: block; }

        /* Inputs */
        .field-group input[type="text"],
        .field-group input[type="email"],
        .field-group input[type="number"],
        .field-group input[type="tel"],
        .field-group input[type="date"],
        .field-group select,
        .field-group textarea {
            width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px;
            font-size: 15px; color: #1e293b; background: #fff; font-family: inherit;
        }
        .field-group input:focus, .field-group select:focus, .field-group textarea:focus {
            outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .field-group input.has-error, .field-group select.has-error, .field-group textarea.has-error {
            border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
        }
        .field-group textarea { resize: vertical; min-height: 100px; }
        .field-group select { appearance: auto; }

        /* Radio & checkbox groups */
        .option-list { display: flex; flex-direction: column; gap: 8px; }
        .option-item { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #334155; cursor: pointer; }
        .option-item input[type="radio"],
        .option-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: #2563eb; flex-shrink: 0; }

        /* Display-only types */
        .section-heading { font-size: 17px; font-weight: 600; color: #0f172a; padding: 8px 0 4px; border-bottom: 2px solid #e2e8f0; margin-bottom: 4px; }
        .info-text { font-size: 14px; color: #64748b; line-height: 1.6; padding: 4px 0; }

        /* Submit area */
        .submit-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
        .submit-btn { width: 100%; padding: 14px; background: #2563eb; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .submit-btn:hover { background: #1d4ed8; }
        .submit-btn:disabled { background: #93c5fd; cursor: not-allowed; }
        .submit-error { color: #dc2626; font-size: 13px; margin-bottom: 12px; display: none; text-align: center; }
        .submit-error.visible { display: block; }

        /* Footer */
        .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #94a3b8; }

        /* Mobile */
        @media (max-width: 640px) {
            .container { padding: 12px; }
            .form-body { padding: 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="{{ asset('logo.png') }}" alt="DPC">
            <h1>{{ $formRequest->formTemplate->name }}</h1>
            <p>Please fill out the form below</p>
        </div>

        <div class="greeting">
            Hi <strong>{{ $formRequest->recipient_name }}</strong>, please complete the following form and submit when ready.
        </div>

        @if(($pendingDocuments ?? collect())->count() + ($pendingForms ?? collect())->count() > 0)
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 20px; margin-bottom: 16px; font-size: 14px; color: #1e40af;">
                After submitting this form you'll be taken to the next item automatically.
            </div>
        @endif

        <form id="form-fill" method="POST" action="{{ route('form.submit', $token) }}">
            @csrf

            <div class="form-card">
                <div class="form-header">
                    <h2>{{ $formRequest->formTemplate->name }}</h2>
                </div>
                <div class="form-body">
                    @foreach($fields as $field)
                        @if($field->type === 'heading')
                            <div class="field-group">
                                <div class="section-heading">{{ $field->label }}</div>
                            </div>
                        @elseif($field->type === 'paragraph')
                            <div class="field-group">
                                <div class="info-text">{{ $field->label }}</div>
                            </div>
                        @else
                            <div class="field-group">
                                <label for="field_{{ $field->id }}">
                                    {{ $field->label }}
                                    @if($field->is_required)
                                        <span class="required-star">*</span>
                                    @endif
                                </label>

                                @if($field->type === 'text')
                                    <input type="text" id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        placeholder="{{ $field->placeholder }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                @elseif($field->type === 'email')
                                    <input type="email" id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        placeholder="{{ $field->placeholder }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                @elseif($field->type === 'number')
                                    <input type="number" id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        placeholder="{{ $field->placeholder }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                @elseif($field->type === 'phone')
                                    <input type="tel" id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        placeholder="{{ $field->placeholder }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                @elseif($field->type === 'date')
                                    <input type="date" id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                @elseif($field->type === 'textarea')
                                    <textarea id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        placeholder="{{ $field->placeholder }}"
                                        {{ $field->is_required ? 'required' : '' }}></textarea>
                                @elseif($field->type === 'select')
                                    <select id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                        <option value="">Select an option</option>
                                        @foreach($field->options ?? [] as $option)
                                            <option value="{{ $option }}">{{ $option }}</option>
                                        @endforeach
                                    </select>
                                @elseif($field->type === 'radio')
                                    <div class="option-list">
                                        @foreach($field->options ?? [] as $option)
                                            <label class="option-item">
                                                <input type="radio" name="field_{{ $field->id }}" value="{{ $option }}"
                                                    {{ $field->is_required ? 'required' : '' }}>
                                                {{ $option }}
                                            </label>
                                        @endforeach
                                    </div>
                                @elseif($field->type === 'checkbox')
                                    <div class="option-list">
                                        @foreach($field->options ?? [] as $option)
                                            <label class="option-item">
                                                <input type="checkbox" name="field_{{ $field->id }}[]" value="{{ $option }}">
                                                {{ $option }}
                                            </label>
                                        @endforeach
                                    </div>
                                @endif

                                @if($field->help_text)
                                    <div class="help-text">{{ $field->help_text }}</div>
                                @endif
                                <div class="field-error" id="error_field_{{ $field->id }}"></div>
                            </div>
                        @endif
                    @endforeach
                </div>
            </div>

            <div class="submit-section">
                <p class="submit-error" id="submit-error"></p>
                <button type="submit" class="submit-btn" id="submit-btn">Submit Form</button>
            </div>
        </form>

        <div class="footer">
            @if($formRequest->expires_at)
                This link expires {{ $formRequest->expires_at->timezone('Australia/Sydney')->format('d M Y \\a\\t h:i A') }} AEST
            @endif
        </div>
    </div>
</body>
</html>
