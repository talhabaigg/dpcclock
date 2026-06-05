<?php

namespace App\Http\Controllers;

use App\Models\GlAccountGroup;
use App\Models\GlAccountGroupAssignment;
use App\Models\PremierGlAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class GlAccountGroupController extends Controller
{
    public function index()
    {
        $groups = GlAccountGroup::with(['assignments.account:id,account_number,description'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn ($g) => [
                'id' => $g->id,
                'name' => $g->name,
                'sort_order' => $g->sort_order,
                'accounts' => $g->assignments->map(fn ($a) => [
                    'id' => $a->account->id,
                    'account_number' => $a->account->account_number,
                    'description' => $a->account->description,
                    'sort_order' => $a->sort_order,
                ])->values(),
            ])
            ->values();

        $assignedIds = GlAccountGroupAssignment::pluck('premier_gl_account_id')->all();
        $unassigned = PremierGlAccount::whereNotIn('id', $assignedIds)
            ->orderBy('account_number')
            ->get(['id', 'account_number', 'description']);

        return Inertia::render('gl-account-groups/index', [
            'groups' => $groups,
            'unassigned' => $unassigned,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
        ]);

        $maxSort = (int) GlAccountGroup::max('sort_order');
        GlAccountGroup::create([
            'name' => $validated['name'],
            'sort_order' => $maxSort + 1,
        ]);

        return back()->with('success', 'Group created.');
    }

    public function update(Request $request, GlAccountGroup $glAccountGroup)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
        ]);

        $glAccountGroup->update($validated);

        return back()->with('success', 'Group renamed.');
    }

    public function destroy(GlAccountGroup $glAccountGroup)
    {
        $glAccountGroup->delete();

        return back()->with('success', 'Group deleted. Accounts in this group are now ungrouped.');
    }

    /**
     * Bulk-apply the entire group/account layout in one transaction.
     * Payload mirrors what the management screen renders:
     *   groups: [
     *     { id, name, sort_order, account_ids: [in display order] },
     *     ...
     *   ]
     *
     * Account IDs not listed in any group are detached (become ungrouped).
     * Existing groups not listed are deleted.
     * Groups without an id are inserted; with id, updated.
     */
    public function syncLayout(Request $request)
    {
        $validated = $request->validate([
            'groups' => 'array',
            'groups.*.id' => 'nullable|integer|exists:gl_account_groups,id',
            'groups.*.name' => 'required|string|max:120',
            'groups.*.account_ids' => 'array',
            'groups.*.account_ids.*' => 'integer|exists:premier_gl_accounts,id',
        ]);

        DB::transaction(function () use ($validated) {
            $payloadGroups = $validated['groups'] ?? [];
            $keptGroupIds = [];

            foreach ($payloadGroups as $index => $g) {
                if (! empty($g['id'])) {
                    $group = GlAccountGroup::find($g['id']);
                    $group->update(['name' => $g['name'], 'sort_order' => $index]);
                } else {
                    $group = GlAccountGroup::create(['name' => $g['name'], 'sort_order' => $index]);
                }
                $keptGroupIds[] = $group->id;

                // Sync this group's accounts
                $accountIds = $g['account_ids'] ?? [];
                GlAccountGroupAssignment::where('gl_account_group_id', $group->id)
                    ->whereNotIn('premier_gl_account_id', $accountIds)
                    ->delete();

                foreach ($accountIds as $sort => $accountId) {
                    GlAccountGroupAssignment::updateOrCreate(
                        ['premier_gl_account_id' => (int) $accountId],
                        ['gl_account_group_id' => $group->id, 'sort_order' => $sort]
                    );
                }
            }

            // Remove groups absent from payload
            GlAccountGroup::whereNotIn('id', $keptGroupIds)->delete();
        });

        return back()->with('success', 'GL group layout saved.');
    }
}
