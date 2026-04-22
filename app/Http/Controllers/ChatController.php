<?php

namespace App\Http\Controllers;

use App\Models\AiChatMessage;
use App\Traits\ExecutesAiTools;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class ChatController extends Controller
{
    use ExecutesAiTools;
    /**
     * OpenAI API configuration
     */
    private const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

    private const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

    private const DEFAULT_MODEL = 'gpt-5.4-mini';

    private const MAX_MESSAGE_LENGTH = 10000;

    private const MAX_HISTORY_MESSAGES = 50;

    private const CLAUDE_MODELS = ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'];

    /**
     * Get the OpenAI API key from environment
     */
    private function getApiKey(): string
    {
        $key = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: env('VITE_OPEN_AI_API_KEY');

        if (! $key) {
            throw new \RuntimeException('OpenAI API key is not configured');
        }

        return $key;
    }

    /**
     * Get the Anthropic API key from environment
     */
    private function getAnthropicApiKey(): string
    {
        $key = config('services.anthropic.api_key') ?: env('ANTHROPIC_API_KEY');

        if (! $key) {
            throw new \RuntimeException('Anthropic API key is not configured');
        }

        return $key;
    }

    /**
     * Check if the given model is a Claude model
     */
    private function isClaudeModel(string $model): bool
    {
        return in_array($model, self::CLAUDE_MODELS);
    }

    /**
     * Get the vector store ID for file search
     */
    private function getVectorStoreId(): ?string
    {
        return config('services.openai.vector_store_id') ?: env('OPENAI_VECTOR_STORE_ID', 'vs_693b42274360819194f48f75a299bea9');
    }

    /**
     * Get the system instructions for the AI
     */
    private function getSystemInstructions(): string
    {
        $defaultInstructions = <<<'INSTRUCTIONS'
You are Superior AI, a helpful assistant for the Superior Portal application.

## Tool Usage Priority
IMPORTANT: You have access to database tools that can query live data. Use these tools FIRST for any questions about:
- Requisitions, orders, or POs (use search_requisitions, read_requisition, get_requisition_stats)
- Materials, items, or pricing (use search_materials, get_material_price)
- Locations or projects (use list_locations)
- Suppliers or vendors (use list_suppliers)
- Jobs, job summaries, project financials, costs, revenue, end dates (use get_job_summary)

When a user asks about specific data like "which items are in PO PO400015" or "how many orders today", ALWAYS use the database tools - do NOT use file_search for these queries.

ALWAYS use get_job_summary when the user asks about:
- Job information, job data, job summaries
- Which job will end next, job end dates, estimated end dates
- Job costs, job revenue, cost vs revenue
- Project financials or job financials
- Over/under billing

Only use file_search for:
- General documentation or help topics
- Policy or procedure questions
- Information not stored in the database

## Creating Requisitions
When creating requisitions, you can help users by:
1. First searching for materials to find the correct codes and prices
2. Creating the requisition with proper location-specific pricing
3. The system automatically applies location-specific pricing when available

## Response Guidelines
- Provide accurate and concise information based on the user's queries
- If you do not know the answer, respond with "I am not sure about that."
- Do not make up answers
- Format your responses using markdown when appropriate for better readability

## Data Visualization
When asked to visualize data or show charts, use the get_job_summary tool with include_chart=true to get chart-ready data.
Then output the chart data as a JSON code block with the language set to "chart". Example:

```chart
{
  "type": "bar",
  "title": "Job Summary",
  "labels": ["Job1", "Job2"],
  "datasets": [
    {"label": "Cost", "data": [1000, 2000], "backgroundColor": "rgba(239, 68, 68, 0.7)"},
    {"label": "Revenue", "data": [1500, 2500], "backgroundColor": "rgba(34, 197, 94, 0.7)"}
  ]
}
```

Supported chart types: "bar", "line", "pie"
For pie charts, use this format:
```chart
{
  "type": "pie",
  "title": "Distribution",
  "data": [{"name": "Category A", "value": 100}, {"name": "Category B", "value": 200}]
}
```

## Image Generation
When asked to generate, create, draw, or make an image/picture/illustration, use the generate_image tool.
After the image is generated, output the result as a JSON code block so it displays properly:
```json
{
  "success": true,
  "image_url": "[URL from the tool result]",
  "revised_prompt": "[prompt from the tool result]",
  "size": "[size from the tool result]",
  "display_type": "generated_image"
}
```
IMPORTANT: Always copy the exact image_url from the tool result into the JSON block.
INSTRUCTIONS;

        return config('services.openai.system_instructions') ?: $defaultInstructions;
    }

    /**
     * Validate and sanitize user input
     */
    private function validateRequest(Request $request): array
    {
        return $request->validate([
            'message' => ['required', 'string', 'max:'.self::MAX_MESSAGE_LENGTH],
            'conversation_id' => ['nullable', 'string', 'max:36'],
            'force_tool' => ['nullable', 'string', 'max:50'],
            'model' => ['nullable', 'string', 'in:gpt-5.4,gpt-5.4-mini,gpt-5.4-nano,gpt-4.1,gpt-4.1-mini,gpt-4.1-nano,o4-mini,claude-sonnet-4-20250514,claude-3-5-haiku-20241022'],
            'files' => ['nullable', 'array', 'max:5'],
            'files.*' => ['file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,pdf,csv,xlsx,xls,doc,docx,txt'],
        ]);
    }

    /**
     * Get the authenticated user ID
     */
    private function getUserId(): int
    {
        $userId = auth()->id();

        if (! $userId) {
            throw new \RuntimeException('User must be authenticated to use chat');
        }

        return $userId;
    }

    /**
     * Build conversation history for the AI
     */
    private function buildConversationHistory(string $conversationId): array
    {
        return AiChatMessage::where('conversation_id', $conversationId)
            ->orderBy('created_at')
            ->limit(self::MAX_HISTORY_MESSAGES)
            ->get()
            ->map(fn ($msg) => [
                'role' => $msg->role,
                'content' => $msg->message,
            ])
            ->toArray();
    }

    /**
     * Process uploaded files into image inputs and document context text
     */
    private function processUploadedFiles(array $files): array
    {
        $imageInputs = [];
        $documentContext = '';

        foreach ($files as $file) {
            $mime = $file->getMimeType();
            $name = $file->getClientOriginalName();

            if (str_starts_with($mime, 'image/')) {
                $base64 = base64_encode(file_get_contents($file->getRealPath()));
                $imageInputs[] = [
                    'type' => 'input_image',
                    'image_url' => "data:{$mime};base64,{$base64}",
                ];
            } else {
                $text = $this->extractTextFromFile($file);
                if ($text) {
                    $documentContext .= "\n\n--- File: {$name} ---\n{$text}";
                }
            }
        }

        return [
            'image_inputs' => $imageInputs,
            'document_context' => trim($documentContext),
        ];
    }

    /**
     * Extract text content from an uploaded file
     */
    private function extractTextFromFile(\Illuminate\Http\UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $mime = $file->getMimeType();

        try {
            // Plain text / CSV
            if (in_array($extension, ['txt', 'csv']) || in_array($mime, ['text/plain', 'text/csv'])) {
                return mb_substr(file_get_contents($file->getRealPath()), 0, 50000);
            }

            // PDF
            if ($extension === 'pdf' || $mime === 'application/pdf') {
                $parser = new \Smalot\PdfParser\Parser();
                $pdf = $parser->parseFile($file->getRealPath());

                return mb_substr($pdf->getText(), 0, 50000);
            }

            // Excel
            if (in_array($extension, ['xlsx', 'xls'])) {
                $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getRealPath());
                $text = '';
                foreach ($spreadsheet->getAllSheets() as $sheet) {
                    $text .= "Sheet: {$sheet->getTitle()}\n";
                    foreach ($sheet->toArray() as $row) {
                        $text .= implode("\t", array_map(fn ($v) => $v ?? '', $row))."\n";
                    }
                    $text .= "\n";
                }

                return mb_substr($text, 0, 50000);
            }

            // DOCX
            if ($extension === 'docx') {
                $zip = new \ZipArchive();
                if ($zip->open($file->getRealPath()) === true) {
                    $xml = $zip->getFromName('word/document.xml');
                    $zip->close();
                    if ($xml) {
                        $text = strip_tags(str_replace('<', ' <', $xml));

                        return mb_substr(preg_replace('/\s+/', ' ', $text), 0, 50000);
                    }
                }
            }

            // Legacy DOC
            if ($extension === 'doc') {
                return '[Old .doc format – please convert to .docx for best results]';
            }

            return '';
        } catch (Throwable $e) {
            Log::warning('File text extraction failed', ['file' => $file->getClientOriginalName(), 'error' => $e->getMessage()]);

            return '[Failed to extract text from this file]';
        }
    }

    /**
     * Build the tools configuration for OpenAI
     */
    private function buildToolsConfig(): array
    {
        $tools = [];

        // File search tool (for document knowledge base)
        $vectorStoreId = $this->getVectorStoreId();
        if ($vectorStoreId) {
            $tools[] = [
                'type' => 'file_search',
                'vector_store_ids' => [$vectorStoreId],
            ];
        }

        // ===== READ TOOLS =====

        $tools[] = [
            'type' => 'function',
            'name' => 'read_requisition',
            'description' => 'Look up a single requisition by ID and get detailed information including status, location, supplier, line items, and costs.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'requisition_id' => [
                        'type' => 'integer',
                        'description' => 'The numeric ID of the requisition to look up',
                    ],
                ],
                'required' => ['requisition_id'],
            ],
        ];

        $tools[] = [
            'type' => 'function',
            'name' => 'search_requisitions',
            'description' => 'Search for requisitions by various criteria. Use this to answer questions like "how many orders today", "show pending requisitions", "find requisitions for location X".',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'status' => [
                        'type' => 'string',
                        'description' => 'Filter by requisition status: pending, processed, failed',
                    ],
                    'location_id' => [
                        'type' => 'integer',
                        'description' => 'Filter by location/project ID',
                    ],
                    'supplier_id' => [
                        'type' => 'integer',
                        'description' => 'Filter by supplier ID',
                    ],
                    'po_number' => [
                        'type' => 'string',
                        'description' => 'Filter by PO number (exact or partial match)',
                    ],
                    'date_from' => [
                        'type' => 'string',
                        'description' => 'Filter requisitions created on or after this date (YYYY-MM-DD)',
                    ],
                    'date_to' => [
                        'type' => 'string',
                        'description' => 'Filter requisitions created on or before this date (YYYY-MM-DD)',
                    ],
                    'search' => [
                        'type' => 'string',
                        'description' => 'Search term to match against PO number, order reference, or requested_by',
                    ],
                    'limit' => [
                        'type' => 'integer',
                        'description' => 'Maximum number of results to return (default: 10, max: 50)',
                    ],
                ],
                'required' => [],
            ],
        ];

        $tools[] = [
            'type' => 'function',
            'name' => 'get_requisition_stats',
            'description' => 'Get statistics about requisitions. Use for questions like "how many orders today", "total spend this month", "orders by status".',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'date_from' => [
                        'type' => 'string',
                        'description' => 'Start date for stats (YYYY-MM-DD). Defaults to today.',
                    ],
                    'date_to' => [
                        'type' => 'string',
                        'description' => 'End date for stats (YYYY-MM-DD). Defaults to today.',
                    ],
                    'location_id' => [
                        'type' => 'integer',
                        'description' => 'Filter stats by location/project ID',
                    ],
                    'supplier_id' => [
                        'type' => 'integer',
                        'description' => 'Filter stats by supplier ID',
                    ],
                ],
                'required' => [],
            ],
        ];

        $tools[] = [
            'type' => 'function',
            'name' => 'list_locations',
            'description' => 'List all locations/projects in the system. Use to help user select a location for creating requisitions.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'search' => [
                        'type' => 'string',
                        'description' => 'Optional search term to filter locations by name or external ID',
                    ],
                ],
                'required' => [],
            ],
        ];

        $tools[] = [
            'type' => 'function',
            'name' => 'list_suppliers',
            'description' => 'List all suppliers in the system. Use to help user select a supplier for creating requisitions.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'search' => [
                        'type' => 'string',
                        'description' => 'Optional search term to filter suppliers by name or code',
                    ],
                    'location_id' => [
                        'type' => 'integer',
                        'description' => 'Filter suppliers that have materials for this location',
                    ],
                ],
                'required' => [],
            ],
        ];

        $tools[] = [
            'type' => 'function',
            'name' => 'search_materials',
            'description' => 'Search for material items available for ordering. Returns items with pricing (location-specific if available, otherwise base price).',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'search' => [
                        'type' => 'string',
                        'description' => 'Search term to filter materials by code or description',
                    ],
                    'location_id' => [
                        'type' => 'integer',
                        'description' => 'Location ID to get location-specific pricing. Required for accurate prices.',
                    ],
                    'supplier_id' => [
                        'type' => 'integer',
                        'description' => 'Filter materials by supplier ID',
                    ],
                    'limit' => [
                        'type' => 'integer',
                        'description' => 'Maximum number of results (default: 20)',
                    ],
                ],
                'required' => [],
            ],
        ];

        $tools[] = [
            'type' => 'function',
            'name' => 'get_material_price',
            'description' => 'Get the price for a specific material item at a location. Uses location-specific pricing if available, otherwise base price.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'material_code' => [
                        'type' => 'string',
                        'description' => 'The material item code',
                    ],
                    'location_id' => [
                        'type' => 'integer',
                        'description' => 'The location ID to check pricing for',
                    ],
                ],
                'required' => ['material_code', 'location_id'],
            ],
        ];

        // ===== CREATE TOOLS =====

        $tools[] = [
            'type' => 'function',
            'name' => 'create_requisition',
            'description' => 'Create a new requisition/order. Automatically applies location-specific pricing. Use this when user wants to create an order via voice or chat.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'location_id' => [
                        'type' => 'integer',
                        'description' => 'The location/project ID for this requisition',
                    ],
                    'supplier_id' => [
                        'type' => 'integer',
                        'description' => 'The supplier ID for this requisition',
                    ],
                    'date_required' => [
                        'type' => 'string',
                        'description' => 'Required delivery date (YYYY-MM-DD). Defaults to tomorrow if not specified.',
                    ],
                    'requested_by' => [
                        'type' => 'string',
                        'description' => 'Name of person requesting the order',
                    ],
                    'delivery_contact' => [
                        'type' => 'string',
                        'description' => 'Contact person for delivery',
                    ],
                    'deliver_to' => [
                        'type' => 'string',
                        'description' => 'Delivery address or location name',
                    ],
                    'order_reference' => [
                        'type' => 'string',
                        'description' => 'Optional order reference number',
                    ],
                    'items' => [
                        'type' => 'array',
                        'description' => 'Array of line items to add to the requisition',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'code' => [
                                    'type' => 'string',
                                    'description' => 'Material item code (will lookup price automatically)',
                                ],
                                'description' => [
                                    'type' => 'string',
                                    'description' => 'Item description (required if code not provided)',
                                ],
                                'qty' => [
                                    'type' => 'number',
                                    'description' => 'Quantity to order',
                                ],
                                'unit_cost' => [
                                    'type' => 'number',
                                    'description' => 'Unit cost (optional - will be looked up from material code if not provided)',
                                ],
                                'cost_code' => [
                                    'type' => 'string',
                                    'description' => 'Cost code for this line item',
                                ],
                            ],
                            'required' => ['qty'],
                        ],
                    ],
                ],
                'required' => ['location_id', 'supplier_id', 'items'],
            ],
        ];

        // ===== UPDATE TOOLS =====

        $tools[] = [
            'type' => 'function',
            'name' => 'add_line_items',
            'description' => 'Add line items to an existing requisition. Only works for pending requisitions.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'requisition_id' => [
                        'type' => 'integer',
                        'description' => 'The requisition ID to add items to',
                    ],
                    'items' => [
                        'type' => 'array',
                        'description' => 'Array of line items to add',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'code' => [
                                    'type' => 'string',
                                    'description' => 'Material item code',
                                ],
                                'description' => [
                                    'type' => 'string',
                                    'description' => 'Item description',
                                ],
                                'qty' => [
                                    'type' => 'number',
                                    'description' => 'Quantity to order',
                                ],
                                'unit_cost' => [
                                    'type' => 'number',
                                    'description' => 'Unit cost (optional)',
                                ],
                                'cost_code' => [
                                    'type' => 'string',
                                    'description' => 'Cost code',
                                ],
                            ],
                            'required' => ['qty'],
                        ],
                    ],
                ],
                'required' => ['requisition_id', 'items'],
            ],
        ];

        $tools[] = [
            'type' => 'function',
            'name' => 'update_line_item',
            'description' => 'Update an existing line item on a requisition. Only works for pending requisitions.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'line_item_id' => [
                        'type' => 'integer',
                        'description' => 'The line item ID to update',
                    ],
                    'qty' => [
                        'type' => 'number',
                        'description' => 'New quantity',
                    ],
                    'unit_cost' => [
                        'type' => 'number',
                        'description' => 'New unit cost',
                    ],
                    'cost_code' => [
                        'type' => 'string',
                        'description' => 'New cost code',
                    ],
                ],
                'required' => ['line_item_id'],
            ],
        ];

        $tools[] = [
            'type' => 'function',
            'name' => 'remove_line_item',
            'description' => 'Remove a line item from a requisition. Only works for pending requisitions.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'line_item_id' => [
                        'type' => 'integer',
                        'description' => 'The line item ID to remove',
                    ],
                ],
                'required' => ['line_item_id'],
            ],
        ];

        $tools[] = [
            'type' => 'function',
            'name' => 'update_requisition',
            'description' => 'Update requisition header details. Only works for pending requisitions.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'requisition_id' => [
                        'type' => 'integer',
                        'description' => 'The requisition ID to update',
                    ],
                    'date_required' => [
                        'type' => 'string',
                        'description' => 'New required date (YYYY-MM-DD)',
                    ],
                    'requested_by' => [
                        'type' => 'string',
                        'description' => 'New requestor name',
                    ],
                    'delivery_contact' => [
                        'type' => 'string',
                        'description' => 'New delivery contact',
                    ],
                    'deliver_to' => [
                        'type' => 'string',
                        'description' => 'New delivery address',
                    ],
                    'order_reference' => [
                        'type' => 'string',
                        'description' => 'New order reference',
                    ],
                ],
                'required' => ['requisition_id'],
            ],
        ];

        // ===== DELETE TOOL =====

        $tools[] = [
            'type' => 'function',
            'name' => 'delete_requisition',
            'description' => 'Delete a requisition. Only works for pending requisitions. This action cannot be undone.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'requisition_id' => [
                        'type' => 'integer',
                        'description' => 'The requisition ID to delete',
                    ],
                    'confirm' => [
                        'type' => 'boolean',
                        'description' => 'Must be true to confirm deletion',
                    ],
                ],
                'required' => ['requisition_id', 'confirm'],
            ],
        ];

        // ===== VISUALIZATION TOOLS =====

        $tools[] = [
            'type' => 'function',
            'name' => 'get_job_summary',
            'description' => 'ALWAYS use this tool for ANY question about jobs. Get job summary data including: job numbers, project names, start dates, estimated end dates, actual end dates, status, original/current estimate costs, original/current estimate revenue, and over/under billing. Use "search" to find jobs by project name (e.g. "Southbank", "CBD") — this is the PREFERRED parameter when the user refers to a project by name. Only use "job_number" if the user gives an exact job number.',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'search' => [
                        'type' => 'string',
                        'description' => 'Search by project name, location name, or job number. Use this when the user says a project name like "Southbank" or "CBD Tower". This is the most flexible filter.',
                    ],
                    'job_number' => [
                        'type' => 'string',
                        'description' => 'Filter by exact job number (e.g. "SWC-1234"). Only use if the user gives a specific number.',
                    ],
                    'company_code' => [
                        'type' => 'string',
                        'description' => 'Filter by company code (e.g. "SWC", "GREEN", "SWCP")',
                    ],
                    'status' => [
                        'type' => 'string',
                        'description' => 'Filter by job status (e.g., active, completed, pending)',
                    ],
                    'limit' => [
                        'type' => 'integer',
                        'description' => 'Maximum number of jobs to return (default: 20, max: 100)',
                    ],
                    'include_chart' => [
                        'type' => 'boolean',
                        'description' => 'If true, returns data formatted for chart visualization',
                    ],
                ],
                'required' => [],
            ],
        ];

        // ===== IMAGE GENERATION TOOLS =====

        $tools[] = [
            'type' => 'function',
            'name' => 'generate_image',
            'description' => 'Generate an AI image using DALL-E. Use this when the user asks to create, generate, draw, or make an image, picture, illustration, or visual. Examples: "create an image of a sunset", "generate a logo", "draw a cat", "make me a picture of mountains".',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'prompt' => [
                        'type' => 'string',
                        'description' => 'Detailed description of the image to generate. Be specific about style, colors, composition, and subject matter.',
                    ],
                    'size' => [
                        'type' => 'string',
                        'description' => 'Image size: "1024x1024" (square), "1792x1024" (landscape), or "1024x1792" (portrait). Default: "1024x1024".',
                        'enum' => ['1024x1024', '1792x1024', '1024x1792'],
                    ],
                    'quality' => [
                        'type' => 'string',
                        'description' => 'Image quality: "standard" or "hd" for higher detail. Default: "standard".',
                        'enum' => ['standard', 'hd'],
                    ],
                    'style' => [
                        'type' => 'string',
                        'description' => 'Image style: "vivid" for hyper-real/dramatic or "natural" for more natural look. Default: "vivid".',
                        'enum' => ['vivid', 'natural'],
                    ],
                ],
                'required' => ['prompt'],
            ],
        ];

        return $tools;
    }

    /**
     * Execute a tool function call and return the result.
     * Delegates to ExecutesAiTools trait.
     */
    private function executeToolCall(string $name, array $arguments): string
    {
        return $this->executeAiToolCall($name, $arguments);
    }

    /**
     * Handle non-streaming chat request
     */
    public function handle(Request $request)
    {
        try {
            $data = $this->validateRequest($request);
            $conversationId = $data['conversation_id'] ?? Str::uuid()->toString();
            $userId = $this->getUserId();

            // Save user message
            AiChatMessage::create([
                'user_id' => $userId,
                'conversation_id' => $conversationId,
                'role' => 'user',
                'message' => $data['message'],
            ]);

            // Build conversation history
            $input = $this->buildConversationHistory($conversationId);

            // Call OpenAI API
            $response = Http::withToken($this->getApiKey())
                ->timeout(60)
                ->post(self::OPENAI_API_URL, [
                    'model' => self::DEFAULT_MODEL,
                    'input' => $input,
                    'instructions' => $this->getSystemInstructions(),
                    'tools' => $this->buildToolsConfig(),
                ]);

            if ($response->failed()) {
                Log::error('OpenAI API error', [
                    'status' => $response->status(),
                    'body' => $response->json(),
                ]);

                return response()->json([
                    'error' => 'Failed to get response from AI',
                    'message' => 'Please try again later',
                ], 503);
            }

            $result = $response->json();
            $assistantMessage = $this->extractAssistantMessage($result);

            // Save assistant response with token breakdown
            AiChatMessage::create([
                'user_id' => $userId,
                'conversation_id' => $conversationId,
                'role' => 'assistant',
                'message' => $assistantMessage,
                'model_used' => $result['model'] ?? self::DEFAULT_MODEL,
                'tokens_used' => $result['usage']['total_tokens'] ?? null,
                'input_tokens' => $result['usage']['input_tokens'] ?? null,
                'output_tokens' => $result['usage']['output_tokens'] ?? null,
            ]);

            return response()->json([
                'reply' => $assistantMessage,
                'conversation_id' => $conversationId,
            ]);
        } catch (Throwable $e) {
            Log::error('Chat error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'An error occurred',
                'message' => app()->isProduction() ? 'Please try again later' : $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Handle streaming chat request
     */
    public function handleStream(Request $request)
    {
        try {
            $data = $this->validateRequest($request);
            $conversationId = $data['conversation_id'] ?? Str::uuid()->toString();
            $userId = $this->getUserId();
            $forceTool = $data['force_tool'] ?? null;
            $selectedModel = $data['model'] ?? self::DEFAULT_MODEL;

            // Process uploaded files before entering the stream
            $fileData = ['image_inputs' => [], 'document_context' => ''];
            if ($request->hasFile('files')) {
                $fileData = $this->processUploadedFiles($request->file('files'));
            }

            // Save the user message
            AiChatMessage::create([
                'user_id' => $userId,
                'conversation_id' => $conversationId,
                'role' => 'user',
                'message' => $data['message'],
            ]);

            // Build conversation history
            $input = $this->buildConversationHistory($conversationId);

            // If files were uploaded, modify the last user message to include file content
            if (! empty($fileData['image_inputs']) || ! empty($fileData['document_context'])) {
                $lastIndex = count($input) - 1;
                $messageText = $input[$lastIndex]['content'];

                if (! empty($fileData['document_context'])) {
                    $messageText = "The user has uploaded the following file(s) for analysis:\n"
                        .$fileData['document_context']
                        ."\n\nUser's message: ".$messageText;
                }

                $contentParts = [
                    ['type' => 'input_text', 'text' => $messageText],
                ];

                foreach ($fileData['image_inputs'] as $imageInput) {
                    $contentParts[] = $imageInput;
                }

                $input[$lastIndex]['content'] = $contentParts;
            }

            // Get API key before entering stream to fail early
            $apiKey = $this->getApiKey();
            $instructions = $this->getSystemInstructions();
            $tools = $this->buildToolsConfig();

            Log::info('Chat stream starting', ['conversation_id' => $conversationId, 'user_id' => $userId, 'force_tool' => $forceTool, 'model' => $selectedModel]);

            // Get Anthropic key early if needed
            $anthropicApiKey = $this->isClaudeModel($selectedModel) ? $this->getAnthropicApiKey() : null;

            return response()->stream(function () use ($input, $conversationId, $userId, $apiKey, $anthropicApiKey, $instructions, $tools, $forceTool, $selectedModel) {
                $this->configureStreamOutput();

                $fullText = '';
                $totalTokens = 0;
                $inputTokens = 0;
                $outputTokens = 0;

                try {
                    // Route to Claude or OpenAI based on model
                    if ($this->isClaudeModel($selectedModel) && $anthropicApiKey) {
                        $this->streamClaudeResponse($input, $instructions, $selectedModel, $anthropicApiKey, $fullText, $totalTokens, $inputTokens, $outputTokens);
                    } else {
                        $this->streamOpenAiResponse($input, $instructions, $tools, $selectedModel, $apiKey, $forceTool, $fullText, $totalTokens, $inputTokens, $outputTokens);
                    }
                } catch (Throwable $e) {
                    Log::error('Stream error', [
                        'message' => $e->getMessage(),
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                    $this->sendSSEData(['error' => 'An error occurred: '.$e->getMessage()]);
                }

                // Save the assistant message
                if ($fullText !== '') {
                    AiChatMessage::create([
                        'user_id' => $userId,
                        'conversation_id' => $conversationId,
                        'role' => 'assistant',
                        'message' => $fullText,
                        'model_used' => $selectedModel,
                        'tokens_used' => $totalTokens,
                        'input_tokens' => $inputTokens,
                        'output_tokens' => $outputTokens,
                    ]);
                }

                // Send completion event
                $this->sendSSEEvent('done', ['conversation_id' => $conversationId]);
            }, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache, no-transform',
                'Connection' => 'keep-alive',
                'X-Accel-Buffering' => 'no',
            ]);
        } catch (Throwable $e) {
            Log::error('Stream setup error', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Failed to start chat stream',
                'message' => app()->isProduction() ? 'Please try again later' : $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Stream response from OpenAI API with tool call support
     */
    private function streamOpenAiResponse(array $input, string $instructions, array $tools, string $model, string $apiKey, ?string $forceTool, string &$fullText, int &$totalTokens, int &$inputTokens, int &$outputTokens): void
    {
        $maxIterations = 10;
        $currentInput = $input;

        for ($iteration = 0; $iteration < $maxIterations; $iteration++) {
            Log::info('Making OpenAI API request', ['iteration' => $iteration]);

            $requestPayload = [
                'model' => $model,
                'input' => $currentInput,
                'instructions' => $instructions,
                'tools' => $tools,
                'stream' => true,
            ];

            if ($forceTool && $iteration === 0) {
                $requestPayload['tool_choice'] = [
                    'type' => 'function',
                    'name' => $forceTool,
                ];
            }

            $response = Http::withToken($apiKey)
                ->withHeaders([
                    'Accept' => 'text/event-stream',
                    'Content-Type' => 'application/json',
                ])
                ->withOptions(['stream' => true])
                ->timeout(120)
                ->post(self::OPENAI_API_URL, $requestPayload);

            if ($response->failed()) {
                Log::error('OpenAI API failed', ['status' => $response->status(), 'body' => $response->body()]);
                $this->sendSSEData(['error' => 'OpenAI API request failed: '.$response->status()]);
                break;
            }

            $stream = $response->toPsrResponse()->getBody();
            $buffer = '';
            $pendingToolCalls = [];
            $currentToolCall = null;
            $needsToolExecution = false;

            while (! $stream->eof()) {
                $chunk = $stream->read(1024);
                if ($chunk === '' || $chunk === false) {
                    usleep(20000);
                    continue;
                }

                $buffer .= $chunk;

                while (($pos = strpos($buffer, "\n")) !== false) {
                    $line = trim(substr($buffer, 0, $pos));
                    $buffer = substr($buffer, $pos + 1);

                    if ($line === '' || strpos($line, 'data: ') !== 0) {
                        continue;
                    }

                    $payload = substr($line, 6);

                    if ($payload === '[DONE]') {
                        break 2;
                    }

                    $event = json_decode($payload, true);
                    if (! is_array($event)) {
                        continue;
                    }

                    $eventType = $event['type'] ?? null;

                    if ($eventType === 'response.output_text.delta') {
                        $delta = $event['delta'] ?? '';
                        if (is_string($delta) && $delta !== '') {
                            $fullText .= $delta;
                            $this->sendSSEData(['delta' => $delta]);
                        }
                    }

                    if ($eventType === 'response.function_call_arguments.start') {
                        $currentToolCall = [
                            'call_id' => $event['call_id'] ?? $event['item_id'] ?? null,
                            'name' => $event['name'] ?? null,
                            'arguments' => '',
                        ];
                    }

                    if ($eventType === 'response.function_call_arguments.delta') {
                        if ($currentToolCall !== null) {
                            $currentToolCall['arguments'] .= $event['delta'] ?? '';
                        }
                    }

                    if ($eventType === 'response.function_call_arguments.done') {
                        if ($currentToolCall !== null) {
                            $currentToolCall['arguments'] = $event['arguments'] ?? $currentToolCall['arguments'];
                            $pendingToolCalls[] = $currentToolCall;
                            $currentToolCall = null;
                            $needsToolExecution = true;
                        }
                    }

                    if ($eventType === 'response.output_item.added') {
                        $item = $event['item'] ?? [];
                        if (($item['type'] ?? null) === 'function_call') {
                            $callId = $item['call_id'] ?? $item['id'] ?? null;
                            $name = $item['name'] ?? null;
                            if ($callId && $name && $currentToolCall === null) {
                                $currentToolCall = [
                                    'call_id' => $callId,
                                    'name' => $name,
                                    'arguments' => '',
                                ];
                            }
                        }
                    }

                    if ($eventType === 'response.completed') {
                        $usage = $event['response']['usage'] ?? [];
                        $totalTokens += $usage['total_tokens'] ?? 0;
                        $inputTokens += $usage['input_tokens'] ?? 0;
                        $outputTokens += $usage['output_tokens'] ?? 0;

                        $output = $event['response']['output'] ?? [];
                        foreach ($output as $item) {
                            if (($item['type'] ?? null) === 'function_call') {
                                $callId = $item['call_id'] ?? $item['id'] ?? null;
                                $name = $item['name'] ?? null;
                                $args = $item['arguments'] ?? '';

                                if ($callId && $name) {
                                    $found = false;
                                    foreach ($pendingToolCalls as &$tc) {
                                        if ($tc['call_id'] === $callId) {
                                            $tc['arguments'] = $args;
                                            $found = true;
                                            $needsToolExecution = true;
                                            break;
                                        }
                                    }
                                    unset($tc);

                                    if (! $found) {
                                        $pendingToolCalls[] = [
                                            'call_id' => $callId,
                                            'name' => $name,
                                            'arguments' => $args,
                                        ];
                                        $needsToolExecution = true;
                                    }
                                }
                            }
                        }
                        break 2;
                    }
                }
            }

            if ($needsToolExecution && ! empty($pendingToolCalls)) {
                Log::info('Executing tool calls', ['tools' => array_column($pendingToolCalls, 'name')]);
                $this->sendSSEData(['status' => 'calling_tools', 'tools' => array_column($pendingToolCalls, 'name')]);

                $toolItems = [];
                foreach ($pendingToolCalls as $toolCall) {
                    $toolItems[] = [
                        'type' => 'function_call',
                        'call_id' => $toolCall['call_id'],
                        'name' => $toolCall['name'],
                        'arguments' => $toolCall['arguments'],
                    ];

                    $args = json_decode($toolCall['arguments'], true) ?? [];
                    $result = $this->executeToolCall($toolCall['name'], $args);

                    $toolItems[] = [
                        'type' => 'function_call_output',
                        'call_id' => $toolCall['call_id'],
                        'output' => $result,
                    ];

                    Log::info('Tool executed', ['tool' => $toolCall['name'], 'result_length' => strlen($result)]);
                }

                $currentInput = array_merge($currentInput, $toolItems);
                $pendingToolCalls = [];
                continue;
            }

            break;
        }
    }

    /**
     * Stream response from Anthropic Claude API
     */
    private function streamClaudeResponse(array $input, string $instructions, string $model, string $apiKey, string &$fullText, int &$totalTokens, int &$inputTokens, int &$outputTokens): void
    {
        // Convert OpenAI-style input to Anthropic messages format
        $messages = [];
        foreach ($input as $item) {
            $role = $item['role'] ?? null;
            $content = $item['content'] ?? '';

            if ($role === 'user' || $role === 'assistant') {
                // Handle array content (multimodal)
                if (is_array($content)) {
                    $anthropicContent = [];
                    foreach ($content as $part) {
                        if (($part['type'] ?? '') === 'input_text') {
                            $anthropicContent[] = ['type' => 'text', 'text' => $part['text']];
                        } elseif (($part['type'] ?? '') === 'input_image') {
                            $anthropicContent[] = [
                                'type' => 'image',
                                'source' => [
                                    'type' => 'base64',
                                    'media_type' => $part['image_url']['detail'] ?? 'image/jpeg',
                                    'data' => $part['image_url']['url'] ?? '',
                                ],
                            ];
                        }
                    }
                    $messages[] = ['role' => $role, 'content' => $anthropicContent];
                } else {
                    $messages[] = ['role' => $role, 'content' => $content];
                }
            }
        }

        $requestPayload = [
            'model' => $model,
            'max_tokens' => 4096,
            'system' => $instructions,
            'messages' => $messages,
            'stream' => true,
        ];

        Log::info('Making Anthropic API request', ['model' => $model]);

        $response = Http::withHeaders([
            'x-api-key' => $apiKey,
            'anthropic-version' => '2023-06-01',
            'Accept' => 'text/event-stream',
            'Content-Type' => 'application/json',
        ])
            ->withOptions(['stream' => true])
            ->timeout(120)
            ->post(self::ANTHROPIC_API_URL, $requestPayload);

        if ($response->failed()) {
            Log::error('Anthropic API failed', ['status' => $response->status(), 'body' => $response->body()]);
            $this->sendSSEData(['error' => 'Anthropic API request failed: '.$response->status()]);

            return;
        }

        $stream = $response->toPsrResponse()->getBody();
        $buffer = '';

        while (! $stream->eof()) {
            $chunk = $stream->read(1024);
            if ($chunk === '' || $chunk === false) {
                usleep(20000);
                continue;
            }

            $buffer .= $chunk;

            while (($pos = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);

                if ($line === '' || strpos($line, 'data: ') !== 0) {
                    continue;
                }

                $payload = substr($line, 6);
                $event = json_decode($payload, true);

                if (! is_array($event)) {
                    continue;
                }

                $eventType = $event['type'] ?? null;

                // Handle text deltas
                if ($eventType === 'content_block_delta') {
                    $delta = $event['delta']['text'] ?? '';
                    if ($delta !== '') {
                        $fullText .= $delta;
                        $this->sendSSEData(['delta' => $delta]);
                    }
                }

                // Handle usage from message_start
                if ($eventType === 'message_start') {
                    $usage = $event['message']['usage'] ?? [];
                    $inputTokens += $usage['input_tokens'] ?? 0;
                }

                // Handle message_delta (stop reason + output token usage)
                if ($eventType === 'message_delta') {
                    $usage = $event['usage'] ?? [];
                    $outputTokens += $usage['output_tokens'] ?? 0;
                    $totalTokens = $inputTokens + $outputTokens;
                }

                // Handle message_stop
                if ($eventType === 'message_stop') {
                    break 2;
                }

                // Handle errors
                if ($eventType === 'error') {
                    $errorMsg = $event['error']['message'] ?? 'Unknown Anthropic error';
                    $this->sendSSEData(['error' => $errorMsg]);
                    break 2;
                }
            }
        }
    }

    /**
     * Extract assistant message from OpenAI response
     */
    private function extractAssistantMessage(array $result): string
    {
        if (! isset($result['output']) || ! is_array($result['output'])) {
            return 'I apologize, but I was unable to generate a response.';
        }

        foreach ($result['output'] as $entry) {
            if (
                ($entry['type'] ?? null) === 'message' &&
                isset($entry['content']) &&
                is_array($entry['content'])
            ) {
                foreach ($entry['content'] as $content) {
                    if (($content['type'] ?? null) === 'output_text' && isset($content['text'])) {
                        return $content['text'];
                    }
                }
            }
        }

        return 'I apologize, but I was unable to generate a response.';
    }

    /**
     * Configure output settings for streaming
     */
    private function configureStreamOutput(): void
    {
        @ini_set('output_buffering', 'off');
        @ini_set('zlib.output_compression', 0);
        @ini_set('implicit_flush', 1);

        if (ob_get_level()) {
            ob_end_clean();
        }
    }

    /**
     * Send SSE data event
     */
    private function sendSSEData(array $data): void
    {
        echo 'data: '.json_encode($data)."\n\n";
        $this->flushOutput();
    }

    /**
     * Send SSE event with custom event name
     */
    private function sendSSEEvent(string $event, array $data): void
    {
        echo "event: {$event}\n";
        echo 'data: '.json_encode($data)."\n\n";
        $this->flushOutput();
    }

    /**
     * Flush output buffers
     */
    private function flushOutput(): void
    {
        if (ob_get_level() > 0) {
            @ob_flush();
        }
        @flush();
    }
}
