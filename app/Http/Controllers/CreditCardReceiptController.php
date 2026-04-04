<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCreditCardReceiptRequest;
use App\Jobs\ExtractReceiptData;
use App\Models\CreditCardReceipt;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CreditCardReceiptController extends Controller
{
    public function index(Request $request): Response
    {
        $canViewAll = $request->user()->can('receipts.view-all');

        $query = CreditCardReceipt::with(['user', 'media'])
            ->orderByDesc('created_at');

        if (! $canViewAll) {
            $query->where('user_id', $request->user()->id);
        }

        // Filters
        if ($request->filled('date_from')) {
            $query->where('transaction_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('transaction_date', '<=', $request->date_to);
        }
        if ($request->filled('amount_min')) {
            $query->where('total_amount', '>=', $request->amount_min);
        }
        if ($request->filled('amount_max')) {
            $query->where('total_amount', '<=', $request->amount_max);
        }
        if ($request->filled('user_id') && $canViewAll) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        if ($request->filled('search')) {
            $query->where('merchant_name', 'like', '%'.$request->search.'%');
        }

        $receipts = $query->paginate(25)->withQueryString();

        // Transform media URLs
        $receipts->getCollection()->transform(function ($receipt) {
            $receipt->image_url = $receipt->getFirstMediaUrl('receipts');

            return $receipt;
        });

        return Inertia::render('credit-card-receipts/index', [
            'receipts' => $receipts,
            'filters' => $request->only(['date_from', 'date_to', 'amount_min', 'amount_max', 'user_id', 'category', 'search']),
            'canViewAll' => $canViewAll,
            'categories' => CreditCardReceipt::CATEGORIES,
            'users' => $canViewAll ? User::select('id', 'name')->orderBy('name')->get() : [],
        ]);
    }

    public function store(StoreCreditCardReceiptRequest $request): RedirectResponse
    {
        foreach ($request->file('receipts') as $file) {
            $receipt = CreditCardReceipt::create([
                'user_id' => $request->user()->id,
                'extraction_status' => CreditCardReceipt::STATUS_PENDING,
                'currency' => $request->input('currency') ?: 'AUD',
            ]);

            $receipt->addMedia($file)->toMediaCollection('receipts');

            ExtractReceiptData::dispatch($receipt->id);
        }

        return back()->with('success', 'Receipt(s) uploaded. Extracting data...');
    }

    public function update(Request $request, CreditCardReceipt $creditCardReceipt): RedirectResponse
    {
        if ($creditCardReceipt->user_id !== $request->user()->id && ! $request->user()->can('receipts.view-all')) {
            abort(403);
        }

        $validated = $request->validate([
            'merchant_name' => ['nullable', 'string', 'max:255'],
            'total_amount' => ['nullable', 'numeric', 'min:0'],
            'gst_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'transaction_date' => ['nullable', 'date'],
            'card_last_four' => ['nullable', 'string', 'size:4'],
            'category' => ['nullable', 'string', 'in:'.implode(',', CreditCardReceipt::CATEGORIES)],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $creditCardReceipt->update($validated);

        return back()->with('success', 'Receipt updated.');
    }

    public function destroy(Request $request, CreditCardReceipt $creditCardReceipt): RedirectResponse
    {
        if ($creditCardReceipt->user_id !== $request->user()->id && ! $request->user()->can('receipts.view-all')) {
            abort(403);
        }

        $creditCardReceipt->delete();

        return back()->with('success', 'Receipt deleted.');
    }

    public function export(Request $request): StreamedResponse
    {
        $query = CreditCardReceipt::with('user')
            ->orderByDesc('transaction_date');

        if ($request->filled('date_from')) {
            $query->where('transaction_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('transaction_date', '<=', $request->date_to);
        }
        if ($request->filled('amount_min')) {
            $query->where('total_amount', '>=', $request->amount_min);
        }
        if ($request->filled('amount_max')) {
            $query->where('total_amount', '<=', $request->amount_max);
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        if ($request->filled('search')) {
            $query->where('merchant_name', 'like', '%'.$request->search.'%');
        }

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Date', 'Employee', 'Merchant', 'Amount', 'Currency', 'GST', 'Category', 'Card Last 4', 'Description']);

            $query->chunk(200, function ($receipts) use ($handle) {
                foreach ($receipts as $receipt) {
                    fputcsv($handle, [
                        $receipt->transaction_date?->format('Y-m-d'),
                        $receipt->user?->name,
                        $receipt->merchant_name,
                        $receipt->total_amount,
                        $receipt->currency,
                        $receipt->gst_amount,
                        $receipt->category,
                        $receipt->card_last_four,
                        $receipt->description,
                    ]);
                }
            });

            fclose($handle);
        }, 'credit-card-receipts-'.now()->format('Y-m-d').'.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }
}
