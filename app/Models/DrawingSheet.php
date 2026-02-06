<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DrawingSheet extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'qa_stage_id',
        'sheet_number',
        'title',
        'discipline',
        'current_revision_id',
        'revision_count',
        'last_revision_at',
        'extraction_confidence',
        'metadata_confirmed',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'last_revision_at' => 'datetime',
        'metadata_confirmed' => 'boolean',
        'extraction_confidence' => 'integer',
        'revision_count' => 'integer',
    ];

    protected $appends = ['display_name'];

    protected static function booted()
    {
        static::creating(function ($model) {
            // Only set created_by from auth if not already set (allows job context to pass it explicitly)
            if ($model->created_by === null) {
                $model->created_by = auth()->id();
            }
        });

        static::updating(function ($model) {
            $model->updated_by = auth()->id();
        });
    }

    // Relationships

    public function project()
    {
        return $this->belongsTo(Location::class, 'project_id');
    }

    public function qaStage()
    {
        return $this->belongsTo(QaStage::class);
    }

    public function revisions()
    {
        return $this->hasMany(QaStageDrawing::class, 'drawing_sheet_id')
            ->orderBy('created_at', 'desc');
    }

    public function currentRevision()
    {
        return $this->belongsTo(QaStageDrawing::class, 'current_revision_id');
    }

    public function activeRevisions()
    {
        return $this->hasMany(QaStageDrawing::class, 'drawing_sheet_id')
            ->whereIn('status', ['active', 'superseded'])
            ->orderBy('created_at', 'desc');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    // Accessors

    public function getDisplayNameAttribute(): string
    {
        if ($this->sheet_number && $this->title) {
            return "{$this->sheet_number} - {$this->title}";
        }
        if ($this->sheet_number) {
            return $this->sheet_number;
        }
        if ($this->title) {
            return $this->title;
        }

        return "Sheet #{$this->id}";
    }

    // Methods

    /**
     * Add a new revision to this sheet
     */
    public function addRevision(QaStageDrawing $drawing, ?string $revisionNumber = null): void
    {
        // Mark current revision as superseded
        if ($this->current_revision_id) {
            QaStageDrawing::where('id', $this->current_revision_id)
                ->update(['status' => 'superseded']);

            // Link new revision to previous
            $drawing->previous_revision_id = $this->current_revision_id;
        }

        // Auto-generate revision number if not provided
        if (! $revisionNumber) {
            $revisionNumber = $this->getNextRevisionNumber();
        }

        // Update the drawing
        $drawing->drawing_sheet_id = $this->id;
        $drawing->revision_number = $revisionNumber;
        $drawing->status = 'active';
        $drawing->save();

        // Update sheet metadata
        $this->current_revision_id = $drawing->id;
        $this->revision_count = $this->revisions()->count();
        $this->last_revision_at = now();
        $this->save();
    }

    /**
     * Get the next revision number (A, B, C... or 1, 2, 3...)
     */
    public function getNextRevisionNumber(): string
    {
        $lastRevision = $this->revisions()
            ->whereNotNull('revision_number')
            ->orderBy('created_at', 'desc')
            ->first();

        if (! $lastRevision || ! $lastRevision->revision_number) {
            return 'A';
        }

        $current = $lastRevision->revision_number;

        // If numeric, increment
        if (is_numeric($current)) {
            return (string) ((int) $current + 1);
        }

        // If single letter, increment (A -> B, Z -> AA)
        if (preg_match('/^[A-Z]+$/', $current)) {
            return $this->incrementLetterRevision($current);
        }

        // Default fallback
        return 'A';
    }

    private function incrementLetterRevision(string $letters): string
    {
        $letters = strtoupper($letters);
        $length = strlen($letters);

        for ($i = $length - 1; $i >= 0; $i--) {
            if ($letters[$i] !== 'Z') {
                $letters[$i] = chr(ord($letters[$i]) + 1);

                return $letters;
            }
            $letters[$i] = 'A';
        }

        return 'A'.$letters;
    }

    /**
     * Find or create a sheet by sheet number within a QA stage
     */
    public static function findOrCreateBySheetNumber(
        int $qaStageId,
        ?string $sheetNumber,
        ?string $title = null,
        ?string $discipline = null
    ): self {
        if ($sheetNumber) {
            $sheet = self::where('qa_stage_id', $qaStageId)
                ->where('sheet_number', $sheetNumber)
                ->first();

            if ($sheet) {
                return $sheet;
            }
        }

        return self::create([
            'qa_stage_id' => $qaStageId,
            'sheet_number' => $sheetNumber,
            'title' => $title,
            'discipline' => $discipline,
            'revision_count' => 0,
        ]);
    }

    /**
     * Find or create a sheet by drawing number within a project.
     * Used for grouping sheets from drawing sets (bulk PDF uploads).
     *
     * @param  int|null  $createdBy  User ID to use when creating (for job context where auth() is unavailable)
     */
    public static function findOrCreateByDrawingNumber(
        int $projectId,
        string $drawingNumber,
        ?string $title = null,
        ?string $discipline = null,
        ?int $createdBy = null
    ): self {
        // Normalize drawing number for comparison
        $normalizedNumber = strtoupper(trim($drawingNumber));

        $sheet = self::where('project_id', $projectId)
            ->whereRaw('UPPER(TRIM(sheet_number)) = ?', [$normalizedNumber])
            ->first();

        if ($sheet) {
            // Update title if not set and we have one
            if (! $sheet->title && $title) {
                $sheet->title = $title;
                $sheet->save();
            }

            return $sheet;
        }

        return self::create([
            'project_id' => $projectId,
            'qa_stage_id' => null, // Project-level sheet, not tied to a specific stage
            'sheet_number' => $normalizedNumber,
            'title' => $title,
            'discipline' => $discipline,
            'revision_count' => 0,
            'created_by' => $createdBy,
        ]);
    }
}
