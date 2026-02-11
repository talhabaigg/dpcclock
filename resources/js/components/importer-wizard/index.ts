/**
 * # Importer Wizard
 *
 * A reusable 4-step import wizard dialog for uploading CSV/Excel data.
 *
 * ## Steps
 * 1. **Upload** - Drag & drop or select a CSV/XLSX/XLS file
 * 2. **Map Columns** - Auto-maps file headers to target columns via fuzzy matching; user can adjust
 * 3. **Preview** - Editable AG Grid showing all rows with validation status (client + server)
 * 4. **Finalize** - Summary of valid/error counts, confirm and import
 *
 * ## Quick Start
 *
 * ```tsx
 * import { ImporterWizardTrigger } from '@/components/importer-wizard';
 *
 * <ImporterWizardTrigger
 *     title="Import Items"
 *     description="Upload a CSV or Excel file."
 *     columns={[
 *         { key: 'name', label: 'Name', required: true, aliases: ['item_name', 'title'] },
 *         { key: 'price', label: 'Price', required: true, type: 'number',
 *           validate: (v) => Number(v) < 0 ? 'Must be >= 0' : null },
 *         { key: 'category', label: 'Category', aliases: ['cat', 'group'] },
 *     ]}
 *     onSubmit={async (validRows) => {
 *         // validRows: Record<string, string>[] - only rows that passed validation
 *         await myApiCall(validRows);
 *     }}
 *     serverValidateUrl="/my-endpoint/validate-import"  // optional
 * />
 * ```
 *
 * ## Props (ImporterWizardConfig)
 *
 * | Prop               | Type                                              | Required | Description |
 * |--------------------|---------------------------------------------------|----------|-------------|
 * | `title`            | `string`                                          | No       | Dialog header title |
 * | `description`      | `string`                                          | No       | Dialog header subtitle |
 * | `columns`          | `ImporterColumnDef[]`                             | Yes      | Target column definitions (see below) |
 * | `validateRow`      | `(row) => RowValidationResult`                    | No       | Cross-field validation function |
 * | `onSubmit`         | `(rows: Record<string, string>[]) => Promise<void>` | Yes    | Called with valid rows on import |
 * | `serverValidateUrl`| `string`                                          | No       | URL for server-side dry-run validation |
 *
 * ## ImporterColumnDef
 *
 * | Field      | Type                          | Required | Description |
 * |------------|-------------------------------|----------|-------------|
 * | `key`      | `string`                      | Yes      | Internal field key returned in mapped data |
 * | `label`    | `string`                      | Yes      | Human-readable label shown in UI |
 * | `required` | `boolean`                     | No       | Whether the column must be mapped and non-empty |
 * | `type`     | `'string'|'number'|'date'|'boolean'` | No | Data type for built-in validation |
 * | `aliases`  | `string[]`                    | No       | Alternative names for auto-mapping (e.g. ['sku', 'item_code']) |
 * | `validate` | `(value, row) => string|null` | No       | Custom per-cell validator (return error string or null) |
 *
 * ## Server-Side Validation (Dry Run)
 *
 * When `serverValidateUrl` is provided, the wizard POSTs all rows to the server on entering step 3.
 * The server validates without persisting and returns per-row errors.
 *
 * **Request:** `POST serverValidateUrl`
 * ```json
 * {
 *   "rows": [
 *     { "code": "ABC", "description": "Item", "unit_cost": "10", "supplier_code": "SUP1" },
 *     ...
 *   ]
 * }
 * ```
 *
 * **Response:** `200 OK`
 * ```json
 * {
 *   "results": [
 *     { "row": 0, "status": "valid", "errors": {} },
 *     { "row": 1, "status": "error", "errors": { "supplier_code": "Supplier \"XYZ\" not found" } },
 *     ...
 *   ]
 * }
 * ```
 *
 * The `row` field matches the 0-based index of the input array. Error keys must match column `key` values.
 * Server errors are merged with client-side validation errors and displayed in the AG Grid.
 *
 * **Laravel example:**
 * ```php
 * public function validateImport(Request $request)
 * {
 *     $request->validate(['rows' => 'required|array']);
 *     $suppliers = Supplier::select('id', 'code')->get()->keyBy(fn ($s) => trim($s->code));
 *
 *     $results = [];
 *     foreach ($request->input('rows') as $index => $row) {
 *         $errors = [];
 *         if (!$suppliers->has(trim($row['supplier_code'] ?? ''))) {
 *             $errors['supplier_code'] = 'Supplier not found';
 *         }
 *         $results[] = ['row' => $index, 'status' => empty($errors) ? 'valid' : 'error', 'errors' => $errors];
 *     }
 *     return response()->json(['results' => $results]);
 * }
 * ```
 *
 * ## Auto-Mapping
 *
 * The wizard automatically maps file headers to target columns using:
 * 1. **Exact match** - file header matches column `key` or `label` (score 1.0)
 * 2. **Alias match** - file header matches any entry in `aliases` (score 0.95)
 * 3. **Fuzzy match** - Dice coefficient bigram similarity above 0.6 threshold
 *
 * ## Components
 *
 * - `ImporterWizardTrigger` - Self-contained: renders a trigger button + dialog. Manages open state internally.
 * - `ImporterWizardDialog` - Controlled: you manage `open`/`onOpenChange` externally.
 *
 * ## File Structure
 *
 * ```
 * importer-wizard/
 *   index.ts                    - This file (barrel exports + docs)
 *   types.ts                    - TypeScript interfaces
 *   use-importer.ts             - Core state machine hook
 *   importer-wizard-dialog.tsx  - Main dialog wrapper with step indicator
 *   utils/
 *     file-parser.ts            - CSV/Excel parsing (PapaParse + SheetJS)
 *     auto-mapper.ts            - Fuzzy column matching (Dice coefficient)
 *     row-validator.ts          - Client-side per-row validation
 *   steps/
 *     upload-step.tsx           - Step 1: file drop zone
 *     mapping-step.tsx          - Step 2: column mapping with preview panel
 *     preview-step.tsx          - Step 3: editable AG Grid with validation
 *     finalize-step.tsx         - Step 4: summary + import button
 * ```
 */

export { ImporterWizardDialog, ImporterWizardTrigger } from './importer-wizard-dialog';
export type {
    ColumnMapping,
    ImporterColumnDef,
    ImporterColumnType,
    ImporterWizardConfig,
    ImporterWizardProps,
    ImporterWizardTriggerProps,
    MappedRow,
    RowValidationResult,
    RowValidationStatus,
} from './types';
