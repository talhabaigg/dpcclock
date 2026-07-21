<?php

namespace App\Http\Controllers;

use App\Models\SiteTaskCategory;
use App\Models\SiteTaskTitlePreset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin CRUD for site-task categories and their title presets — the
 * vocabulary offered during quick task creation. Options for the pickers
 * themselves are served by SiteTaskController::categories().
 */
class SiteTaskCategoryController extends Controller
{
    public function index(): Response
    {
        $categories = SiteTaskCategory::with('titlePresets')
            ->withCount('tasks')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $globalPresets = SiteTaskTitlePreset::whereNull('category_id')
            ->orderBy('sort_order')->orderBy('id')
            ->get();

        return Inertia::render('site-tasks/categories', [
            'categories' => $categories,
            'globalPresets' => $globalPresets,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        SiteTaskCategory::create($this->validated($request));

        return back();
    }

    public function update(Request $request, SiteTaskCategory $category): RedirectResponse
    {
        $category->update($this->validated($request));

        return back();
    }

    /**
     * Presets cascade-delete with the category; tasks keep existing but lose
     * their classification (category_id nulls out via the FK).
     */
    public function destroy(SiteTaskCategory $category): RedirectResponse
    {
        $category->delete();

        return back();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:4'],
            'color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ]);
    }

    // ── Title presets ─────────────────────────────────────────

    /** Null category_id = global preset (offered under every category). */
    public function storePreset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => ['nullable', 'integer', 'exists:site_task_categories,id'],
            'title' => ['required', 'string', 'max:200'],
        ]);

        $categoryId = $validated['category_id'] ?? null;

        $preset = SiteTaskTitlePreset::create([
            'category_id' => $categoryId,
            'title' => $validated['title'],
            'sort_order' => (int) SiteTaskTitlePreset::where('category_id', $categoryId)->max('sort_order') + 1,
        ]);

        return response()->json(['preset' => $preset], 201);
    }

    public function updatePreset(Request $request, SiteTaskTitlePreset $preset): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'sort_order' => ['sometimes', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $preset->update($validated);

        return response()->json(['preset' => $preset]);
    }

    public function destroyPreset(SiteTaskTitlePreset $preset): JsonResponse
    {
        $preset->delete();

        return response()->json(['ok' => true]);
    }
}
