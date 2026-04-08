<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GlTransactionDetail extends Model
{
    protected $fillable = [
        'client_id',
        'company_code',
        'transaction_date',
        'journal_type',
        'account',
        'account_name',
        'sub_account',
        'sub_account_name',
        'division',
        'description',
        'debit',
        'credit',
        'debit_for_currency',
        'credit_for_currency',
        'currency',
        'audit_number',
        'reference_document_number',
        'source_is_journal_entry',
        'company_from',
        'company_to',
        'update_user',
        'update_date',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'update_date' => 'datetime',
        'debit' => 'decimal:4',
        'credit' => 'decimal:4',
        'source_is_journal_entry' => 'boolean',
    ];
}
