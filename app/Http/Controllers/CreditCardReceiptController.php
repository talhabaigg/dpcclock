<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCreditCardReceiptRequest;
use App\Jobs\ExtractReceiptData;
use App\Models\CreditCardReceipt;
use App\Models\PremierGlAccount;
use App\Models\PremierVendor;
use App\Models\User;
use App\Services\CreditCardInvoiceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CreditCardReceiptController extends Controller
{
    /**
     * My Receipts — own receipts only, hide reconciled.
     */
    public function index(Request $request): Response
    {
        $query = CreditCardReceipt::with(['user', 'media'])
            ->where('user_id', $request->user()->id)
            ->where('is_reconciled', false)
            ->orderByDesc('created_at');

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
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        if ($request->filled('search')) {
            $query->where('merchant_name', 'like', '%'.$request->search.'%');
        }

        $receipts = $query->paginate(25)->withQueryString();
        $this->transformMediaUrls($receipts);

        return Inertia::render('credit-card-receipts/index', [
            'receipts' => $receipts,
            'filters' => $request->only(['date_from', 'date_to', 'amount_min', 'amount_max', 'category', 'search']),
            'categories' => CreditCardReceipt::CATEGORIES,
        ]);
    }

    /**
     * Manage Receipts — all users, full CRUD, export.
     * Hides reconciled by default unless show_reconciled filter is set.
     */
    public function manage(Request $request): Response
    {
        $query = CreditCardReceipt::with(['user', 'media'])
            ->orderByDesc('created_at');

        // Only show reconciled if explicitly requested
        if ($request->input('show_reconciled') === '1') {
            // show all
        } else {
            $query->where('is_reconciled', false);
        }

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

        $receipts = $query->paginate(50)->withQueryString();
        $this->transformMediaUrls($receipts);

        return Inertia::render('credit-card-receipts/manage', [
            'receipts' => $receipts,
            'filters' => $request->only(['date_from', 'date_to', 'amount_min', 'amount_max', 'user_id', 'category', 'search', 'show_reconciled']),
            'categories' => CreditCardReceipt::CATEGORIES,
            'users' => User::select('id', 'name')->orderBy('name')->get(),
            'vendors' => PremierVendor::where('code', 'like', 'CC%')
                ->orWhere('name', 'like', '%credit%')
                ->orderBy('name')
                ->get(['id', 'premier_vendor_id', 'code', 'name']),
            'glAccounts' => PremierGlAccount::orderBy('account_number')->get(['id', 'premier_account_id', 'account_number', 'description']),
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
        if ($creditCardReceipt->user_id !== $request->user()->id && ! $request->user()->can('receipts.manage')) {
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

    public function reconcile(Request $request, CreditCardReceipt $creditCardReceipt): RedirectResponse
    {
        if (! $request->user()->can('receipts.manage')) {
            abort(403);
        }

        $creditCardReceipt->update([
            'is_reconciled' => ! $creditCardReceipt->is_reconciled,
        ]);

        $status = $creditCardReceipt->is_reconciled ? 'reconciled' : 'unreconciled';

        return back()->with('success', "Receipt marked as {$status}.");
    }

    public function destroy(Request $request, CreditCardReceipt $creditCardReceipt): RedirectResponse
    {
        if (! $request->user()->can('receipts.manage')) {
            abort(403);
        }

        $creditCardReceipt->delete();

        return back()->with('success', 'Receipt deleted.');
    }

    public function createInvoice(Request $request, CreditCardReceipt $creditCardReceipt): RedirectResponse
    {
        if (! $request->user()->can('receipts.manage')) {
            abort(403);
        }

        if ($creditCardReceipt->premier_invoice_id) {
            return back()->with('error', 'This receipt has already been sent to Premier.');
        }

        $validated = $request->validate([
            'gl_account_id' => ['required', 'exists:premier_gl_accounts,id'],
            'vendor_id' => ['required', 'exists:premier_vendors,id'],
        ]);

        $vendor = PremierVendor::findOrFail($validated['vendor_id']);
        $glAccount = PremierGlAccount::findOrFail($validated['gl_account_id']);

        $service = new CreditCardInvoiceService;
        $payload = $service->generateInvoicePayload($creditCardReceipt, $vendor, $glAccount);
        $result = $service->sendInvoiceToPremier($creditCardReceipt, $payload);

        if ($result['success']) {
            $creditCardReceipt->update([
                'premier_invoice_id' => $result['invoice_id'] ?? 'sent',
                'invoice_status' => 'success',
                'gl_account_id' => $glAccount->id,
                'is_reconciled' => true,
            ]);

            activity()
                ->performedOn($creditCardReceipt)
                ->event('invoice created')
                ->causedBy(auth()->user())
                ->log("CC Receipt #{$creditCardReceipt->id} sent to Premier. Invoice ID: " . ($result['invoice_id'] ?? 'N/A'));

            return back()->with('success', 'Invoice created in Premier successfully.');
        }

        $creditCardReceipt->update(['invoice_status' => 'failed']);

        activity()
            ->performedOn($creditCardReceipt)
            ->event('invoice failed')
            ->causedBy(auth()->user())
            ->log("CC Receipt #{$creditCardReceipt->id} failed to send to Premier: " . ($result['message'] ?? 'Unknown error'));

        return back()->with('error', 'Failed to create invoice in Premier. ' . ($result['message'] ?? ''));
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
            fputcsv($handle, ['Date', 'Employee', 'Merchant', 'Amount', 'Currency', 'GST', 'Category', 'Card Last 4', 'Description', 'Reconciled']);

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
                        $receipt->is_reconciled ? 'Yes' : 'No',
                    ]);
                }
            });

            fclose($handle);
        }, 'credit-card-receipts-'.now()->format('Y-m-d').'.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }

    private function transformMediaUrls($receipts): void
    {
        $receipts->getCollection()->transform(function ($receipt) {
            $media = $receipt->getFirstMedia('receipts');
            if ($media) {
                $receipt->mime_type = $media->mime_type;
                try {
                    $receipt->image_url = $media->getTemporaryUrl(now()->addMinutes(30));
                } catch (\RuntimeException) {
                    $receipt->image_url = $media->getUrl();
                    if ($media->disk !== 's3') {
                        $receipt->image_url = str_replace(
                            $media->file_name,
                            rawurlencode($media->file_name),
                            $receipt->image_url
                        );
                    }
                }
            }

            $processedMedia = $receipt->getFirstMedia('processed_receipts');
            if ($processedMedia) {
                try {
                    $receipt->processed_image_url = $processedMedia->getTemporaryUrl(now()->addMinutes(30));
                } catch (\RuntimeException) {
                    $receipt->processed_image_url = $processedMedia->getUrl();
                }
            }

            // Merchant logo from Google Favicon API
            if ($receipt->merchant_website) {
                $receipt->merchant_logo_url = 'https://www.google.com/s2/favicons?domain=' . $receipt->merchant_website . '&sz=128';
            }

            return $receipt;
        });
    }
}
