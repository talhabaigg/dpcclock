<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SignatureController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('settings/signature', [
            'savedSignatureUrl' => $user->savedSignatureUrl(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'signature_data' => 'required|string',
        ]);

        $user = $request->user();
        $user->clearMediaCollection('signature');
        $user->addMediaFromBase64($validated['signature_data'])
            ->usingFileName('signature.png')
            ->toMediaCollection('signature');

        return redirect()->route('signature.edit')->with('success', 'Signature saved.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->user()->clearMediaCollection('signature');

        return redirect()->route('signature.edit')->with('success', 'Signature removed.');
    }
}
