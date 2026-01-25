<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Spatie\LaravelPasskeys\Actions\GeneratePasskeyRegisterOptionsAction;
use Spatie\LaravelPasskeys\Actions\StorePasskeyAction;
use Throwable;

class PasskeyController extends Controller
{
    /**
     * Display the passkeys settings page.
     */
    public function index()
    {
        $user = auth()->user();

        return Inertia::render('settings/passkeys', [
            'passkeys' => $user->passkeys()
                ->get()
                ->map(fn ($key) => $key->only(['id', 'name', 'last_used_at', 'created_at'])),
        ]);
    }

    /**
     * Generate passkey registration options.
     */
    public function generateOptions()
    {
        $generatePasskeyOptionsAction = app(GeneratePasskeyRegisterOptionsAction::class);

        return $generatePasskeyOptionsAction->execute(auth()->user());
    }

    /**
     * Store a new passkey.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'passkey' => 'required|string',
            'options' => 'required|string',
            'name' => 'nullable|string|max:255',
        ]);

        $user = auth()->user();
        $storePasskeyAction = app(StorePasskeyAction::class);

        try {
            $storePasskeyAction->execute(
                $user,
                $data['passkey'],
                $data['options'],
                $request->getHost(),
                ['name' => $data['name'] ?? 'Passkey ' . Str::random(6)],
            );

            return redirect()->back()->with('success', 'Passkey registered successfully.');
        } catch (Throwable $e) {
            // Get the root cause exception
            $rootCause = $e->getPrevious() ? $e->getPrevious()->getMessage() : $e->getMessage();

            Log::error('Passkey registration failed', [
                'error' => $e->getMessage(),
                'root_cause' => $rootCause,
                'host' => $request->getHost(),
                'exception_class' => get_class($e),
            ]);

            throw ValidationException::withMessages([
                'passkey' => $rootCause ?: $e->getMessage(),
            ]);
        }
    }

    /**
     * Update a passkey's name.
     */
    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $passkey = auth()->user()->passkeys()->where('id', $id)->firstOrFail();
        $passkey->update(['name' => $data['name']]);

        return redirect()->back()->with('success', 'Passkey updated successfully.');
    }

    /**
     * Delete a passkey.
     */
    public function destroy(string $id)
    {
        auth()->user()->passkeys()->where('id', $id)->delete();

        return redirect()->back()->with('success', 'Passkey deleted successfully.');
    }

    /**
     * Dismiss the passkey setup prompt.
     */
    public function dismissPrompt()
    {
        auth()->user()->update(['passkey_prompt_dismissed' => true]);

        return redirect()->back();
    }
}
