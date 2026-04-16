<?php

namespace App\Http\Controllers;

use App\Support\FeatureFlags;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FeatureFlagController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/feature-flags/index', [
            'flags' => FeatureFlags::all(),
        ]);
    }

    public function update(Request $request, string $feature)
    {
        abort_unless(FeatureFlags::exists($feature), 404);

        $validated = $request->validate([
            'active' => ['required', 'boolean'],
        ]);

        FeatureFlags::set($feature, $validated['active']);

        $flag = FeatureFlags::get($feature);

        return back()->with('success', "{$flag['label']} ".($validated['active'] ? 'enabled' : 'disabled').'.');
    }
}
