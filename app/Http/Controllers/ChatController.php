<?php

namespace App\Http\Controllers;

use App\Models\AiChatMessage;
use App\Models\JobSummary;
use App\Models\Location;
use App\Models\MaterialItem;
use App\Models\Requisition;
use App\Models\RequisitionLineItem;
use App\Models\Supplier;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class ChatController extends Controller
{
    /**
     * OpenAI API configuration
     */
    private const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

    private const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

    private const DEFAULT_MODEL = 'gpt-4.1';

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
            'model' => ['nullable', 'string', 'in:gpt-4.1,gpt-4.1-mini,gpt-4.1-nano,o4-mini,gpt-4o,gpt-4o-mini,claude-sonnet-4-20250514,claude-3-5-haiku-20241022'],
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
            'description' => 'ALWAYS use this tool for ANY question about jobs. Get job summary data including: job numbers, start dates, estimated end dates, actual end dates, status, original/current estimate costs, original/current estimate revenue, and over/under billing. Use this for questions like "which job ends next", "show job costs", "job summaries", "project financials", "visualize jobs".',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'job_number' => [
                        'type' => 'string',
                        'description' => 'Filter by specific job number',
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
     * Execute a tool function call and return the result
     */
    private function executeToolCall(string $name, array $arguments): string
    {
        try {
            return match ($name) {
                // Read tools
                'read_requisition' => $this->toolReadRequisition($arguments),
                'search_requisitions' => $this->toolSearchRequisitions($arguments),
                'get_requisition_stats' => $this->toolGetRequisitionStats($arguments),
                'list_locations' => $this->toolListLocations($arguments),
                'list_suppliers' => $this->toolListSuppliers($arguments),
                'search_materials' => $this->toolSearchMaterials($arguments),
                'get_material_price' => $this->toolGetMaterialPrice($arguments),
                // Create tools
                'create_requisition' => $this->toolCreateRequisition($arguments),
                // Update tools
                'add_line_items' => $this->toolAddLineItems($arguments),
                'update_line_item' => $this->toolUpdateLineItem($arguments),
                'remove_line_item' => $this->toolRemoveLineItem($arguments),
                'update_requisition' => $this->toolUpdateRequisition($arguments),
                // Delete tools
                'delete_requisition' => $this->toolDeleteRequisition($arguments),
                // Visualization tools
                'get_job_summary' => $this->toolGetJobSummary($arguments),
                // Image generation tools
                'generate_image' => $this->toolGenerateImage($arguments),
                // Legacy
                'list_materials' => $this->toolSearchMaterials($arguments),
                default => json_encode(['error' => "Unknown tool: {$name}"]),
            };
        } catch (Throwable $e) {
            Log::error('Tool execution error', ['tool' => $name, 'error' => $e->getMessage()]);

            return json_encode(['error' => "Failed to execute {$name}: ".$e->getMessage()]);
        }
    }

    /**
     * Tool: Read a single requisition by ID
     */
    private function toolReadRequisition(array $arguments): string
    {
        $requisitionId = (int) ($arguments['requisition_id'] ?? 0);

        $requisition = Requisition::query()
            ->with(['creator', 'location', 'supplier', 'lineItems'])
            ->find($requisitionId);

        if (! $requisition) {
            return json_encode(['error' => "No requisition found with ID {$requisitionId}"]);
        }

        $payload = [
            'id' => $requisition->id,
            'status' => $requisition->status ?? null,
            'date_required' => $requisition->date_required ?? null,
            'delivery_contact' => $requisition->delivery_contact ?? null,
            'requested_by' => $requisition->requested_by ?? null,
            'deliver_to' => $requisition->deliver_to ?? null,
            'order_reference' => $requisition->order_reference ?? null,
            'po_number' => $requisition->po_number ?? null,
            'created_at' => optional($requisition->created_at)->toDateTimeString(),
            'created_by' => optional($requisition->creator)->only(['id', 'name', 'email']),
            'location' => $requisition->location ? [
                'id' => $requisition->location->id,
                'name' => $requisition->location->name,
            ] : null,
            'supplier' => $requisition->supplier ? [
                'id' => $requisition->supplier->id,
                'name' => $requisition->supplier->name,
            ] : null,
            'total' => (float) ($requisition->total ?? 0),
            'lines' => $requisition->lineItems ? $requisition->lineItems->map(fn ($line) => [
                'id' => $line->id,
                'serial_number' => $line->serial_number ?? null,
                'code' => $line->code ?? null,
                'description' => $line->description ?? null,
                'qty' => (float) ($line->qty ?? 0),
                'unit_cost' => (float) ($line->unit_cost ?? 0),
                'total_cost' => (float) ($line->total_cost ?? (($line->qty ?? 0) * ($line->unit_cost ?? 0))),
                'cost_code' => $line->cost_code ?? null,
                'price_list' => $line->price_list ?? null,
            ])->values()->all() : [],
        ];

        return json_encode($payload, JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Search requisitions by various criteria
     */
    private function toolSearchRequisitions(array $arguments): string
    {
        $query = Requisition::query()->with(['location', 'supplier', 'creator', 'lineItems']);

        if (! empty($arguments['status'])) {
            $query->where('status', $arguments['status']);
        }

        if (! empty($arguments['location_id'])) {
            $query->where('project_number', $arguments['location_id']);
        }

        if (! empty($arguments['supplier_id'])) {
            $query->where('supplier_number', $arguments['supplier_id']);
        }

        if (! empty($arguments['po_number'])) {
            $query->where('po_number', 'like', '%'.$arguments['po_number'].'%');
        }

        if (! empty($arguments['date_from'])) {
            $query->whereDate('created_at', '>=', $arguments['date_from']);
        }

        if (! empty($arguments['date_to'])) {
            $query->whereDate('created_at', '<=', $arguments['date_to']);
        }

        if (! empty($arguments['search'])) {
            $search = $arguments['search'];
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
                    ->orWhere('order_reference', 'like', "%{$search}%")
                    ->orWhere('po_number', 'like', "%{$search}%")
                    ->orWhere('requested_by', 'like', "%{$search}%");
            });
        }

        $limit = min((int) ($arguments['limit'] ?? 10), 50);

        $requisitions = $query->orderBy('created_at', 'desc')->limit($limit)->get();

        $results = $requisitions->map(fn ($req) => [
            'id' => $req->id,
            'status' => $req->status,
            'po_number' => $req->po_number,
            'location' => optional($req->location)->name,
            'supplier' => optional($req->supplier)->name,
            'total' => (float) ($req->total ?? 0),
            'line_count' => $req->lineItems->count(),
            'date_required' => $req->date_required,
            'created_at' => optional($req->created_at)->toDateTimeString(),
            'requested_by' => $req->requested_by,
        ])->all();

        return json_encode(['requisitions' => $results, 'count' => count($results)], JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Get requisition statistics
     */
    private function toolGetRequisitionStats(array $arguments): string
    {
        $dateFrom = $arguments['date_from'] ?? Carbon::today()->toDateString();
        $dateTo = $arguments['date_to'] ?? Carbon::today()->toDateString();

        $query = Requisition::query()
            ->whereDate('created_at', '>=', $dateFrom)
            ->whereDate('created_at', '<=', $dateTo);

        if (! empty($arguments['location_id'])) {
            $query->where('project_number', $arguments['location_id']);
        }

        if (! empty($arguments['supplier_id'])) {
            $query->where('supplier_number', $arguments['supplier_id']);
        }

        $requisitions = $query->with('lineItems')->get();

        $stats = [
            'date_range' => ['from' => $dateFrom, 'to' => $dateTo],
            'total_requisitions' => $requisitions->count(),
            'by_status' => $requisitions->groupBy('status')->map->count()->toArray(),
            'total_value' => $requisitions->sum('total'),
            'total_line_items' => $requisitions->sum(fn ($r) => $r->lineItems->count()),
            'requisitions' => $requisitions->map(fn ($r) => [
                'id' => $r->id,
                'status' => $r->status,
                'total' => (float) $r->total,
                'line_count' => $r->lineItems->count(),
            ])->values()->all(),
        ];

        return json_encode($stats, JSON_PRETTY_PRINT);
    }

    /**
     * Tool: List locations
     */
    private function toolListLocations(array $arguments): string
    {
        $query = Location::query();

        if (! empty($arguments['search'])) {
            $search = $arguments['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('external_id', 'like', "%{$search}%");
            });
        }

        $locations = $query->orderBy('name')->limit(50)->get(['id', 'name', 'external_id']);

        return json_encode(['locations' => $locations->toArray(), 'count' => $locations->count()], JSON_PRETTY_PRINT);
    }

    /**
     * Tool: List suppliers
     */
    private function toolListSuppliers(array $arguments): string
    {
        $query = Supplier::query();

        if (! empty($arguments['search'])) {
            $search = $arguments['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $suppliers = $query->orderBy('name')->limit(50)->get(['id', 'name', 'code']);

        return json_encode(['suppliers' => $suppliers->toArray(), 'count' => $suppliers->count()], JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Search materials with location-specific pricing
     */
    private function toolSearchMaterials(array $arguments): string
    {
        $query = MaterialItem::query()->with('costCode');
        $locationId = $arguments['location_id'] ?? null;

        if (! empty($arguments['supplier_id'])) {
            $query->where('supplier_id', $arguments['supplier_id']);
        }

        if (! empty($arguments['search'])) {
            $search = $arguments['search'];
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $limit = min((int) ($arguments['limit'] ?? 20), 100);
        $materials = $query->orderBy('description')->limit($limit)->get();

        // Get location-specific pricing if location_id provided
        $locationPrices = [];
        if ($locationId) {
            $locationPrices = DB::table('location_item_pricing')
                ->where('location_id', $locationId)
                ->whereIn('material_item_id', $materials->pluck('id'))
                ->pluck('unit_cost_override', 'material_item_id')
                ->toArray();
        }

        $results = $materials->map(function ($item) use ($locationPrices) {
            $hasLocationPrice = isset($locationPrices[$item->id]);
            $unitCost = $hasLocationPrice ? $locationPrices[$item->id] : $item->unit_cost;

            return [
                'id' => $item->id,
                'code' => $item->code,
                'description' => $item->description,
                'unit' => $item->unit,
                'unit_cost' => (float) $unitCost,
                'price_list' => $hasLocationPrice ? 'location_price' : 'base_price',
                'cost_code' => $item->costCode?->code,
            ];
        })->all();

        return json_encode(['materials' => $results, 'count' => count($results)], JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Get material price for a specific location
     */
    private function toolGetMaterialPrice(array $arguments): string
    {
        $materialCode = $arguments['material_code'] ?? '';
        $locationId = (int) ($arguments['location_id'] ?? 0);

        $item = MaterialItem::with('costCode')->where('code', $materialCode)->first();

        if (! $item) {
            return json_encode(['error' => "Material with code '{$materialCode}' not found"]);
        }

        // Check for location-specific pricing
        $locationPrice = DB::table('location_item_pricing')
            ->join('locations', 'location_item_pricing.location_id', '=', 'locations.id')
            ->where('material_item_id', $item->id)
            ->where('location_item_pricing.location_id', $locationId)
            ->select('locations.name as location_name', 'location_item_pricing.unit_cost_override')
            ->first();

        $result = [
            'id' => $item->id,
            'code' => $item->code,
            'description' => $item->description,
            'unit' => $item->unit,
            'unit_cost' => (float) ($locationPrice ? $locationPrice->unit_cost_override : $item->unit_cost),
            'price_list' => $locationPrice ? $locationPrice->location_name : 'base_price',
            'cost_code' => $item->costCode?->code,
        ];

        return json_encode($result, JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Create a new requisition
     */
    private function toolCreateRequisition(array $arguments): string
    {
        $locationId = (int) ($arguments['location_id'] ?? 0);
        $supplierId = (int) ($arguments['supplier_id'] ?? 0);
        $items = $arguments['items'] ?? [];

        // Validate location exists
        $location = Location::find($locationId);
        if (! $location) {
            return json_encode(['error' => "Location with ID {$locationId} not found"]);
        }

        // Validate supplier exists
        $supplier = Supplier::find($supplierId);
        if (! $supplier) {
            return json_encode(['error' => "Supplier with ID {$supplierId} not found"]);
        }

        if (empty($items)) {
            return json_encode(['error' => 'At least one line item is required']);
        }

        // Get current user
        $userId = auth()->id();
        $userName = auth()->user()?->name ?? 'AI Assistant';

        // Create requisition
        $requisition = Requisition::create([
            'project_number' => $locationId,
            'supplier_number' => $supplierId,
            'date_required' => Carbon::parse($arguments['date_required'] ?? Carbon::tomorrow())->toDateString(),
            'delivery_contact' => $arguments['delivery_contact'] ?? null,
            'requested_by' => $arguments['requested_by'] ?? $userName,
            'deliver_to' => $arguments['deliver_to'] ?? $location->name,
            'order_reference' => $arguments['order_reference'] ?? null,
            'status' => 'pending',
            'created_by' => $userId,
        ]);

        // Get location-specific pricing for all material codes
        $materialCodes = collect($items)->pluck('code')->filter()->unique()->values()->all();
        $materialItems = MaterialItem::with('costCode')
            ->whereIn('code', $materialCodes)
            ->get()
            ->keyBy('code');

        $locationPrices = DB::table('location_item_pricing')
            ->where('location_id', $locationId)
            ->whereIn('material_item_id', $materialItems->pluck('id'))
            ->pluck('unit_cost_override', 'material_item_id')
            ->toArray();

        // Create line items
        $lineNumber = 1;
        $createdLines = [];
        foreach ($items as $item) {
            $materialCode = $item['code'] ?? null;
            $material = $materialCode ? ($materialItems[$materialCode] ?? null) : null;

            // Determine unit cost
            $unitCost = $item['unit_cost'] ?? null;
            $priceList = 'manual';

            if ($unitCost === null && $material) {
                $hasLocationPrice = isset($locationPrices[$material->id]);
                $unitCost = $hasLocationPrice ? $locationPrices[$material->id] : $material->unit_cost;
                $priceList = $hasLocationPrice ? $location->name : 'base_price';
            }

            $unitCost = (float) ($unitCost ?? 0);
            $qty = (float) ($item['qty'] ?? 1);
            $totalCost = $qty * $unitCost;

            $lineItem = RequisitionLineItem::create([
                'requisition_id' => $requisition->id,
                'serial_number' => $lineNumber++,
                'code' => $materialCode ?? null,
                'description' => $item['description'] ?? ($material?->description ?? 'Item'),
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'cost_code' => $item['cost_code'] ?? ($material?->costCode?->code ?? null),
                'price_list' => $priceList,
            ]);

            $createdLines[] = [
                'id' => $lineItem->id,
                'code' => $lineItem->code,
                'description' => $lineItem->description,
                'qty' => $lineItem->qty,
                'unit_cost' => $lineItem->unit_cost,
                'total_cost' => $lineItem->total_cost,
            ];
        }

        // Reload to get total
        $requisition->load(['location', 'supplier', 'lineItems']);

        return json_encode([
            'success' => true,
            'message' => 'Requisition created successfully',
            'requisition' => [
                'id' => $requisition->id,
                'status' => $requisition->status,
                'location' => $location->name,
                'supplier' => $supplier->name,
                'date_required' => $requisition->date_required,
                'requested_by' => $requisition->requested_by,
                'total' => (float) $requisition->total,
                'line_count' => count($createdLines),
                'lines' => $createdLines,
            ],
        ], JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Add line items to existing requisition
     */
    private function toolAddLineItems(array $arguments): string
    {
        $requisitionId = (int) ($arguments['requisition_id'] ?? 0);
        $items = $arguments['items'] ?? [];

        $requisition = Requisition::with(['location', 'supplier', 'lineItems'])->find($requisitionId);

        if (! $requisition) {
            return json_encode(['error' => "Requisition with ID {$requisitionId} not found"]);
        }

        if ($requisition->status !== 'pending') {
            return json_encode(['error' => "Cannot modify requisition with status '{$requisition->status}'. Only pending requisitions can be modified."]);
        }

        if (empty($items)) {
            return json_encode(['error' => 'At least one line item is required']);
        }

        $locationId = $requisition->project_number;

        // Get location-specific pricing
        $materialCodes = collect($items)->pluck('code')->filter()->unique()->values()->all();
        $materialItems = MaterialItem::with('costCode')
            ->whereIn('code', $materialCodes)
            ->get()
            ->keyBy('code');

        $locationPrices = DB::table('location_item_pricing')
            ->where('location_id', $locationId)
            ->whereIn('material_item_id', $materialItems->pluck('id'))
            ->pluck('unit_cost_override', 'material_item_id')
            ->toArray();

        // Get next serial number
        $maxSerial = $requisition->lineItems->max('serial_number') ?? 0;
        $lineNumber = $maxSerial + 1;

        $createdLines = [];
        foreach ($items as $item) {
            $materialCode = $item['code'] ?? null;
            $material = $materialCode ? ($materialItems[$materialCode] ?? null) : null;

            $unitCost = $item['unit_cost'] ?? null;
            $priceList = 'manual';

            if ($unitCost === null && $material) {
                $hasLocationPrice = isset($locationPrices[$material->id]);
                $unitCost = $hasLocationPrice ? $locationPrices[$material->id] : $material->unit_cost;
                $priceList = $hasLocationPrice ? ($requisition->location?->name ?? 'location_price') : 'base_price';
            }

            $unitCost = (float) ($unitCost ?? 0);
            $qty = (float) ($item['qty'] ?? 1);
            $totalCost = $qty * $unitCost;

            $lineItem = RequisitionLineItem::create([
                'requisition_id' => $requisition->id,
                'serial_number' => $lineNumber++,
                'code' => $materialCode,
                'description' => $item['description'] ?? ($material?->description ?? 'Item'),
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'cost_code' => $item['cost_code'] ?? ($material?->costCode?->code ?? null),
                'price_list' => $priceList,
            ]);

            $createdLines[] = [
                'id' => $lineItem->id,
                'code' => $lineItem->code,
                'description' => $lineItem->description,
                'qty' => $lineItem->qty,
                'unit_cost' => $lineItem->unit_cost,
                'total_cost' => $lineItem->total_cost,
            ];
        }

        $requisition->refresh();

        return json_encode([
            'success' => true,
            'message' => count($createdLines).' line item(s) added',
            'requisition_id' => $requisition->id,
            'new_total' => (float) $requisition->total,
            'total_lines' => $requisition->lineItems->count(),
            'added_lines' => $createdLines,
        ], JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Update a line item
     */
    private function toolUpdateLineItem(array $arguments): string
    {
        $lineItemId = (int) ($arguments['line_item_id'] ?? 0);

        $lineItem = RequisitionLineItem::with('requisition')->find($lineItemId);

        if (! $lineItem) {
            return json_encode(['error' => "Line item with ID {$lineItemId} not found"]);
        }

        if ($lineItem->requisition->status !== 'pending') {
            return json_encode(['error' => "Cannot modify line item on requisition with status '{$lineItem->requisition->status}'"]);
        }

        $updates = [];

        if (isset($arguments['qty'])) {
            $lineItem->qty = (float) $arguments['qty'];
            $updates[] = 'qty';
        }

        if (isset($arguments['unit_cost'])) {
            $lineItem->unit_cost = (float) $arguments['unit_cost'];
            $updates[] = 'unit_cost';
        }

        if (isset($arguments['cost_code'])) {
            $lineItem->cost_code = $arguments['cost_code'];
            $updates[] = 'cost_code';
        }

        // Recalculate total
        $lineItem->total_cost = $lineItem->qty * $lineItem->unit_cost;
        $lineItem->save();

        return json_encode([
            'success' => true,
            'message' => 'Line item updated',
            'updated_fields' => $updates,
            'line_item' => [
                'id' => $lineItem->id,
                'code' => $lineItem->code,
                'description' => $lineItem->description,
                'qty' => (float) $lineItem->qty,
                'unit_cost' => (float) $lineItem->unit_cost,
                'total_cost' => (float) $lineItem->total_cost,
                'cost_code' => $lineItem->cost_code,
            ],
            'requisition_new_total' => (float) $lineItem->requisition->fresh()->total,
        ], JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Remove a line item
     */
    private function toolRemoveLineItem(array $arguments): string
    {
        $lineItemId = (int) ($arguments['line_item_id'] ?? 0);

        $lineItem = RequisitionLineItem::with('requisition')->find($lineItemId);

        if (! $lineItem) {
            return json_encode(['error' => "Line item with ID {$lineItemId} not found"]);
        }

        if ($lineItem->requisition->status !== 'pending') {
            return json_encode(['error' => "Cannot remove line item from requisition with status '{$lineItem->requisition->status}'"]);
        }

        $requisitionId = $lineItem->requisition_id;
        $removedItem = [
            'id' => $lineItem->id,
            'code' => $lineItem->code,
            'description' => $lineItem->description,
        ];

        $lineItem->delete();

        $requisition = Requisition::with('lineItems')->find($requisitionId);

        return json_encode([
            'success' => true,
            'message' => 'Line item removed',
            'removed_item' => $removedItem,
            'requisition_id' => $requisitionId,
            'remaining_lines' => $requisition->lineItems->count(),
            'new_total' => (float) $requisition->total,
        ], JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Update requisition header
     */
    private function toolUpdateRequisition(array $arguments): string
    {
        $requisitionId = (int) ($arguments['requisition_id'] ?? 0);

        $requisition = Requisition::find($requisitionId);

        if (! $requisition) {
            return json_encode(['error' => "Requisition with ID {$requisitionId} not found"]);
        }

        if ($requisition->status !== 'pending') {
            return json_encode(['error' => "Cannot modify requisition with status '{$requisition->status}'. Only pending requisitions can be modified."]);
        }

        $updates = [];

        if (isset($arguments['date_required'])) {
            $requisition->date_required = Carbon::parse($arguments['date_required'])->toDateString();
            $updates[] = 'date_required';
        }

        if (isset($arguments['requested_by'])) {
            $requisition->requested_by = $arguments['requested_by'];
            $updates[] = 'requested_by';
        }

        if (isset($arguments['delivery_contact'])) {
            $requisition->delivery_contact = $arguments['delivery_contact'];
            $updates[] = 'delivery_contact';
        }

        if (isset($arguments['deliver_to'])) {
            $requisition->deliver_to = $arguments['deliver_to'];
            $updates[] = 'deliver_to';
        }

        if (isset($arguments['order_reference'])) {
            $requisition->order_reference = $arguments['order_reference'];
            $updates[] = 'order_reference';
        }

        $requisition->save();

        return json_encode([
            'success' => true,
            'message' => 'Requisition updated',
            'updated_fields' => $updates,
            'requisition' => [
                'id' => $requisition->id,
                'date_required' => $requisition->date_required,
                'requested_by' => $requisition->requested_by,
                'delivery_contact' => $requisition->delivery_contact,
                'deliver_to' => $requisition->deliver_to,
                'order_reference' => $requisition->order_reference,
            ],
        ], JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Delete a requisition
     */
    private function toolDeleteRequisition(array $arguments): string
    {
        $requisitionId = (int) ($arguments['requisition_id'] ?? 0);
        $confirm = (bool) ($arguments['confirm'] ?? false);

        if (! $confirm) {
            return json_encode(['error' => 'Deletion not confirmed. Set confirm to true to delete.']);
        }

        $requisition = Requisition::with('lineItems')->find($requisitionId);

        if (! $requisition) {
            return json_encode(['error' => "Requisition with ID {$requisitionId} not found"]);
        }

        if ($requisition->status !== 'pending') {
            return json_encode(['error' => "Cannot delete requisition with status '{$requisition->status}'. Only pending requisitions can be deleted."]);
        }

        $summary = [
            'id' => $requisition->id,
            'line_count' => $requisition->lineItems->count(),
            'total' => (float) $requisition->total,
        ];

        // Delete line items first
        $requisition->lineItems()->delete();
        $requisition->delete();

        return json_encode([
            'success' => true,
            'message' => 'Requisition deleted',
            'deleted_requisition' => $summary,
        ], JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Get job summary data for visualization
     */
    private function toolGetJobSummary(array $arguments): string
    {
        $query = JobSummary::query();

        if (! empty($arguments['job_number'])) {
            $query->where('job_number', 'like', '%'.$arguments['job_number'].'%');
        }

        if (! empty($arguments['status'])) {
            $query->where('status', $arguments['status']);
        }

        $limit = min((int) ($arguments['limit'] ?? 20), 100);
        $includeChart = (bool) ($arguments['include_chart'] ?? false);

        $jobs = $query->orderBy('job_number')->limit($limit)->get();

        if ($jobs->isEmpty()) {
            return json_encode(['error' => 'No job summaries found matching the criteria']);
        }

        $results = $jobs->map(fn ($job) => [
            'job_number' => $job->job_number,
            'company_code' => $job->company_code,
            'status' => $job->status,
            'start_date' => optional($job->start_date)->toDateString(),
            'estimated_end_date' => optional($job->estimated_end_date)->toDateString(),
            'actual_end_date' => optional($job->actual_end_date)->toDateString(),
            'original_estimate_cost' => (float) ($job->original_estimate_cost ?? 0),
            'current_estimate_cost' => (float) ($job->current_estimate_cost ?? 0),
            'original_estimate_revenue' => (float) ($job->original_estimate_revenue ?? 0),
            'current_estimate_revenue' => (float) ($job->current_estimate_revenue ?? 0),
            'over_under_billing' => (float) ($job->over_under_billing ?? 0),
        ])->all();

        $response = [
            'jobs' => $results,
            'count' => count($results),
            'summary' => [
                'total_original_cost' => collect($results)->sum('original_estimate_cost'),
                'total_current_cost' => collect($results)->sum('current_estimate_cost'),
                'total_original_revenue' => collect($results)->sum('original_estimate_revenue'),
                'total_current_revenue' => collect($results)->sum('current_estimate_revenue'),
                'total_over_under_billing' => collect($results)->sum('over_under_billing'),
            ],
        ];

        // Add chart-formatted data if requested
        if ($includeChart) {
            $response['chart_data'] = [
                'type' => 'bar',
                'title' => 'Job Summary - Cost vs Revenue',
                'labels' => collect($results)->pluck('job_number')->all(),
                'datasets' => [
                    [
                        'label' => 'Current Est. Cost',
                        'data' => collect($results)->pluck('current_estimate_cost')->all(),
                        'backgroundColor' => 'rgba(239, 68, 68, 0.7)',
                    ],
                    [
                        'label' => 'Current Est. Revenue',
                        'data' => collect($results)->pluck('current_estimate_revenue')->all(),
                        'backgroundColor' => 'rgba(34, 197, 94, 0.7)',
                    ],
                ],
            ];
        }

        return json_encode($response, JSON_PRETTY_PRINT);
    }

    /**
     * Tool: Generate an image using DALL-E
     */
    private function toolGenerateImage(array $arguments): string
    {
        $prompt = $arguments['prompt'] ?? '';

        if (empty($prompt)) {
            return json_encode(['error' => 'A prompt is required to generate an image']);
        }

        $size = $arguments['size'] ?? '1024x1024';
        $quality = $arguments['quality'] ?? 'standard';
        $style = $arguments['style'] ?? 'vivid';

        // Validate size
        if (! in_array($size, ['1024x1024', '1792x1024', '1024x1792'])) {
            $size = '1024x1024';
        }

        // Validate quality
        if (! in_array($quality, ['standard', 'hd'])) {
            $quality = 'standard';
        }

        // Validate style
        if (! in_array($style, ['vivid', 'natural'])) {
            $style = 'vivid';
        }

        try {
            $apiKey = $this->getApiKey();

            $response = Http::withToken($apiKey)
                ->timeout(120)
                ->post('https://api.openai.com/v1/images/generations', [
                    'model' => 'dall-e-3',
                    'prompt' => $prompt,
                    'n' => 1,
                    'size' => $size,
                    'quality' => $quality,
                    'style' => $style,
                    'response_format' => 'url',
                ]);

            if ($response->failed()) {
                Log::error('DALL-E API error', [
                    'status' => $response->status(),
                    'body' => $response->json(),
                ]);

                return json_encode(['error' => 'Failed to generate image: '.($response->json()['error']['message'] ?? 'Unknown error')]);
            }

            $result = $response->json();

            if (empty($result['data'][0]['url'])) {
                return json_encode(['error' => 'No image URL returned from API']);
            }

            $imageUrl = $result['data'][0]['url'];
            $revisedPrompt = $result['data'][0]['revised_prompt'] ?? $prompt;

            return json_encode([
                'success' => true,
                'image_url' => $imageUrl,
                'revised_prompt' => $revisedPrompt,
                'size' => $size,
                'quality' => $quality,
                'style' => $style,
                'display_type' => 'generated_image',
            ], JSON_PRETTY_PRINT);

        } catch (Throwable $e) {
            Log::error('Image generation error', ['error' => $e->getMessage()]);

            return json_encode(['error' => 'Failed to generate image: '.$e->getMessage()]);
        }
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
