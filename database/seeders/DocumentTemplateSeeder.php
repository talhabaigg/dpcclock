<?php

namespace Database\Seeders;

use App\Models\DocumentTemplate;
use Illuminate\Database\Seeder;

class DocumentTemplateSeeder extends Seeder
{
    public function run(): void
    {
        if (DocumentTemplate::where('name', 'Standard Employment Contract')->exists()) {
            return;
        }

        $bodyJson = json_encode([
            'type' => 'doc',
            'content' => [
                ['type' => 'heading', 'attrs' => ['level' => 1], 'content' => [['type' => 'text', 'text' => 'Employment Contract']]],
                ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'This Employment Contract ("Contract") is entered into between DPC Group Pty Ltd ("the Employer") and {{recipient_name}} ("the Employee").']]],
                ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [['type' => 'text', 'text' => '1. Position & Commencement']]],
                ['type' => 'paragraph', 'content' => [
                    ['type' => 'text', 'text' => 'Position: {{position}}'],
                ]],
                ['type' => 'paragraph', 'content' => [
                    ['type' => 'text', 'text' => 'Start Date: {{start_date}}'],
                ]],
                ['type' => 'paragraph', 'content' => [
                    ['type' => 'text', 'text' => 'Pay Rate: {{pay_rate}}'],
                ]],
                ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [['type' => 'text', 'text' => '2. Terms of Employment']]],
                ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'The Employee agrees to perform the duties associated with the above position to the best of their ability and in accordance with all applicable workplace health and safety requirements.']]],
                ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'The Employee acknowledges that they have read, understood, and agree to the terms outlined in this contract.']]],
                ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [['type' => 'text', 'text' => '3. Signature']]],
                ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'By signing below, both parties agree to the terms and conditions of this employment contract.']]],
                ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => '{{signature_box}}']]],
                ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Date: {{date_signed}}']]],
            ],
        ]);

        $bodyHtml = '<h1>Employment Contract</h1>'
            . '<p>This Employment Contract ("Contract") is entered into between DPC Group Pty Ltd ("the Employer") and {{recipient_name}} ("the Employee").</p>'
            . '<h2>1. Position &amp; Commencement</h2>'
            . '<p>Position: {{position}}</p>'
            . '<p>Start Date: {{start_date}}</p>'
            . '<p>Pay Rate: {{pay_rate}}</p>'
            . '<h2>2. Terms of Employment</h2>'
            . '<p>The Employee agrees to perform the duties associated with the above position to the best of their ability and in accordance with all applicable workplace health and safety requirements.</p>'
            . '<p>The Employee acknowledges that they have read, understood, and agree to the terms outlined in this contract.</p>'
            . '<h2>3. Signature</h2>'
            . '<p>By signing below, both parties agree to the terms and conditions of this employment contract.</p>'
            . '<p>{{signature_box}}</p>'
            . '<p>Date: {{date_signed}}</p>';

        DocumentTemplate::create([
            'name' => 'Standard Employment Contract',
            'category' => 'employment',
            'body_json' => $bodyJson,
            'body_html' => $bodyHtml,
            'placeholders' => [
                ['key' => 'position', 'label' => 'Position/Occupation'],
                ['key' => 'start_date', 'label' => 'Start Date'],
                ['key' => 'pay_rate', 'label' => 'Pay Rate'],
            ],
            'is_active' => true,
        ]);
    }
}
