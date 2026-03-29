<?php

namespace App\Http\Controllers;

use App\Models\WorkerScreening;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WorkerScreeningController extends Controller
{
    public function search(Request $request)
    {
        $result = null;
        $searched = false;

        $phone = $request->query('phone');
        $email = $request->query('email');
        $firstName = $request->query('first_name');
        $surname = $request->query('surname');
        $dob = $request->query('date_of_birth');

        // Must have phone, email, or name+DOB (name alone is not enough)
        $hasNameWithIdentifier = ($firstName || $surname) && ($dob || $phone || $email);
        $hasSearchParams = $phone || $email || $hasNameWithIdentifier;

        if ($hasSearchParams) {
            $searched = true;
            $match = WorkerScreening::checkWorker([
                'phone' => $phone,
                'email' => $email,
                'first_name' => $firstName,
                'surname' => $surname,
                'date_of_birth' => $dob,
            ]);

            $result = $match
                ? ['alert' => true, 'name' => "{$match->first_name} {$match->surname}"]
                : 'clear';
        }

        return Inertia::render('worker-screening/search', [
            'result' => $result,
            'searched' => $searched,
            'query' => [
                'phone' => $phone,
                'email' => $email,
                'first_name' => $firstName,
                'surname' => $surname,
                'date_of_birth' => $dob,
            ],
        ]);
    }

    public function index()
    {
        $screenings = WorkerScreening::with(['addedByUser:id,name', 'removedByUser:id,name'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (WorkerScreening $s) => [
                'id' => $s->id,
                'first_name' => $s->first_name,
                'surname' => $s->surname,
                'phone' => $s->phone,
                'email' => $s->email,
                'date_of_birth' => $s->date_of_birth?->format('Y-m-d'),
                'reason' => $s->reason,
                'status' => $s->status,
                'added_by_name' => $s->addedByUser?->name,
                'removed_by_name' => $s->removedByUser?->name,
                'removed_at' => $s->removed_at?->format('Y-m-d H:i'),
                'created_at' => $s->created_at->format('Y-m-d H:i'),
            ]);

        return Inertia::render('worker-screening/index', [
            'screenings' => $screenings,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'surname' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'date_of_birth' => 'nullable|date',
            'reason' => 'required|string',
        ]);

        $phone = WorkerScreening::normalizePhone($validated['phone'] ?? null);
        $email = $validated['email'] ?? null;
        $firstName = $validated['first_name'];
        $surname = $validated['surname'];
        $dob = $validated['date_of_birth'] ?? null;

        if (! $phone && ! $email && ! ($firstName && $surname && $dob)) {
            return back()->withErrors([
                'phone' => 'At least one identifier is required: phone, email, or name with date of birth.',
            ]);
        }

        // Check for existing active entry with same identifiers
        $existing = WorkerScreening::checkWorker([
            'phone' => $phone,
            'email' => $email,
            'first_name' => $firstName,
            'surname' => $surname,
            'date_of_birth' => $dob,
        ]);

        if ($existing) {
            return back()->withErrors([
                'first_name' => 'An active screening entry already exists for this person.',
            ]);
        }

        WorkerScreening::create([
            ...$validated,
            'added_by' => auth()->id(),
            'status' => 'active',
        ]);

        return back()->with('success', 'Screening entry added.');
    }

    public function update(Request $request, WorkerScreening $workerScreening)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'surname' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'date_of_birth' => 'nullable|date',
            'reason' => 'required|string',
        ]);

        $workerScreening->update($validated);

        return back()->with('success', 'Screening entry updated.');
    }

    public function remove(WorkerScreening $workerScreening)
    {
        $workerScreening->update([
            'status' => 'removed',
            'removed_by' => auth()->id(),
            'removed_at' => now(),
        ]);

        return back()->with('success', 'Screening entry removed.');
    }
}
