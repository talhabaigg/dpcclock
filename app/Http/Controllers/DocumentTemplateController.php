<?php

namespace App\Http\Controllers;

use App\Models\DocumentTemplate;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DocumentTemplateController extends Controller
{
    public function index()
    {
        $templates = DocumentTemplate::query()
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'is_active', 'created_at', 'updated_at']);

        return Inertia::render('document-templates/index', [
            'templates' => $templates,
        ]);
    }

    public function create()
    {
        return Inertia::render('document-templates/create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
            'body_json' => 'required|string',
            'body_html' => 'required|string',
            'placeholders' => 'nullable|array',
            'placeholders.*.key' => 'required|string',
            'placeholders.*.label' => 'required|string',
            'placeholders.*.type' => 'nullable|string|in:text,date,number,email,phone',
            'placeholders.*.required' => 'nullable|boolean',
        ]);

        $template = DocumentTemplate::create([
            ...$validated,
            'created_by' => auth()->id(),
            'updated_by' => auth()->id(),
        ]);

        return redirect()->route('document-templates.index')
            ->with('success', 'Template created successfully.');
    }

    public function edit(DocumentTemplate $documentTemplate)
    {
        return Inertia::render('document-templates/edit', [
            'template' => $documentTemplate,
        ]);
    }

    public function update(Request $request, DocumentTemplate $documentTemplate)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
            'body_json' => 'required|string',
            'body_html' => 'required|string',
            'placeholders' => 'nullable|array',
            'placeholders.*.key' => 'required|string',
            'placeholders.*.label' => 'required|string',
            'placeholders.*.type' => 'nullable|string|in:text,date,number,email,phone',
            'placeholders.*.required' => 'nullable|boolean',
            'is_active' => 'boolean',
        ]);

        $documentTemplate->update([
            ...$validated,
            'updated_by' => auth()->id(),
        ]);

        return redirect()->route('document-templates.index')
            ->with('success', 'Template updated successfully.');
    }

    public function destroy(DocumentTemplate $documentTemplate)
    {
        $documentTemplate->delete();

        return redirect()->route('document-templates.index')
            ->with('success', 'Template deleted successfully.');
    }
}
