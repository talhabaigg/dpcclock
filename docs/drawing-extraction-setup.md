# Drawing Sheet Metadata Extraction Setup Guide

This document covers the setup and configuration for the AWS Textract-based drawing metadata extraction system.

## Overview

The system allows users to upload multi-page PDF drawings and automatically extracts metadata (drawing number, title, revision) from each page using AWS Textract's QUERIES feature.

### Key Features

- **Auto-first extraction**: Attempts heuristic bottom-right crop + Textract queries
- **Exception-only review**: Only sheets that fail validation need manual review
- **Template learning**: User-drawn capture boxes become reusable templates
- **Template matching**: Templates are matched by orientation and size bucket

## Prerequisites

### Server Requirements

1. **PHP Extensions**:
   - `imagick` (preferred) or `gd` - for image manipulation
   - `fileinfo` - for MIME type detection

2. **System Packages** (at least one):
   - **Poppler Utils** (recommended): `pdftoppm`, `pdfinfo`
   - **ImageMagick**: `convert` command with Ghostscript
   - **Ghostscript**: Required by ImageMagick for PDF processing

3. **PHP Packages** (via Composer):
   ```bash
   composer require aws/aws-sdk-php intervention/image
   ```

### Installing PDF Rendering Tools

#### Ubuntu/Debian
```bash
# Poppler (recommended)
sudo apt-get install poppler-utils

# ImageMagick + Ghostscript (alternative)
sudo apt-get install imagemagick ghostscript

# Enable PDF processing in ImageMagick policy
sudo sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml
```

#### macOS
```bash
# Using Homebrew
brew install poppler
# or
brew install imagemagick ghostscript
```

#### Windows
1. Download Poppler for Windows from: https://github.com/oschwartz10612/poppler-windows/releases
2. Extract to `C:\poppler` and add `C:\poppler\Library\bin` to PATH
3. Or install ImageMagick from: https://imagemagick.org/script/download.php#windows

## AWS Configuration

### 1. IAM Policy

Create an IAM user/role with the following policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "textract:AnalyzeDocument"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

### 2. Environment Variables

Add to your `.env` file:

```env
# AWS Credentials (used for both S3 and Textract)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_DEFAULT_REGION=ap-southeast-2
AWS_BUCKET=your-bucket-name

# Optional: Use different region for Textract
AWS_TEXTRACT_REGION=ap-southeast-2

# Confidence Thresholds (optional, defaults shown)
TEXTRACT_CONFIDENCE_NUMBER=0.60
TEXTRACT_CONFIDENCE_TITLE=0.50
TEXTRACT_CONFIDENCE_REVISION=0.60
```

### 3. S3 Bucket Structure

The system stores files in the following structure:

```
your-bucket/
├── drawing-sets/
│   └── {project_id}/
│       └── {timestamp}_{hash}.pdf    # Original uploaded PDFs
├── drawing-previews/
│   └── {project_id}/
│       └── {set_id}/
│           └── page_0001.png         # Rendered page images (300 DPI)
```

## Queue Configuration

The extraction pipeline uses Laravel queues. Configure your queue worker:

### Database Queue (Development)
```env
QUEUE_CONNECTION=database
```

### Redis Queue (Production)
```env
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

### Running Queue Workers

```bash
# Development (single worker)
php artisan queue:work --tries=3 --backoff=60 --timeout=600

# Production (supervisor config)
# /etc/supervisor/conf.d/laravel-worker.conf
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/artisan queue:work --sleep=3 --tries=3 --backoff=60 --timeout=600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=4
redirect_stderr=true
stdout_logfile=/path/to/storage/logs/worker.log
stopwaitsecs=3600
```

## Database Migrations

Run migrations to create the required tables:

```bash
php artisan migrate
```

This creates:
- `drawing_sets` - Multi-page PDF uploads
- `title_block_templates` - Reusable crop templates
- Adds extraction columns to `qa_stage_drawings`

## Usage

### 1. Uploading a Drawing Set

```
POST /projects/{project_id}/drawing-sets
Content-Type: multipart/form-data

file: [PDF file]
```

### 2. Review Extracted Data

Navigate to `/drawing-sets/{id}` to review extracted metadata.

### 3. Creating Templates

When extraction fails, users can:
1. Click "Draw Template" on a sheet
2. Draw a box around the title block
3. Name and save the template
4. The template will be used for similar sheets automatically

## Architecture

### Processing Pipeline

```
Upload PDF
    │
    ▼
ProcessDrawingSetJob
    │
    ├── Download PDF from S3
    ├── For each page:
    │   ├── Render to PNG (300 DPI)
    │   ├── Upload PNG to S3
    │   ├── Store dimensions/orientation
    │   └── Dispatch ExtractSheetMetadataJob
    │
    ▼
ExtractSheetMetadataJob (per sheet)
    │
    ├── Try template-based extraction (if templates exist)
    │   ├── Match templates by orientation/size
    │   ├── Crop image using template rect
    │   ├── Call Textract QUERIES
    │   └── Validate results
    │
    ├── Try heuristic extraction (bottom-right crop)
    │   ├── Crop to default region (55%, 60%, 45%, 40%)
    │   ├── Call Textract QUERIES
    │   └── Validate results
    │
    ├── Try full-page extraction (last resort)
    │   ├── Call Textract QUERIES on full image
    │   └── Validate results
    │
    └── Save results
        ├── Success → extraction_status = 'success'
        └── Validation failed → extraction_status = 'needs_review'
```

### Textract Queries

The system sends these queries to Textract:

| Alias | Query Text |
|-------|-----------|
| drawing_number | What is the drawing number? |
| sheet_number | What is the sheet number? |
| drawing_title | What is the drawing title? |
| title | What is the sheet title? |
| revision | What is the revision? |
| rev | What is the current revision? |

### Validation Rules

**Drawing Number**:
- Minimum 2 characters
- Not "N/A"
- Matches common patterns (A-101, DWG-001, etc.)

**Title**:
- Minimum 3 characters
- Not purely numeric
- Not same as drawing number

**Revision**:
- Matches patterns: A, B, 1, 2, P1, etc.
- Strips "REV", "REVISION" prefixes

## Troubleshooting

### PDF Rendering Fails

1. Check if poppler/ImageMagick is installed:
   ```bash
   which pdftoppm
   which convert
   ```

2. Check ImageMagick policy allows PDF:
   ```bash
   cat /etc/ImageMagick-6/policy.xml | grep PDF
   ```

3. Check PHP Imagick extension:
   ```php
   <?php var_dump(extension_loaded('imagick'));
   ```

### Textract Returns Low Confidence

1. Ensure images are rendered at 300 DPI
2. Check if title block is in expected location
3. Try creating a custom template for the drawing type

### Queue Jobs Failing

1. Check queue worker is running:
   ```bash
   php artisan queue:work --verbose
   ```

2. Check failed jobs:
   ```bash
   php artisan queue:failed
   ```

3. Retry failed jobs:
   ```bash
   php artisan queue:retry all
   ```

## Cost Considerations

- **Textract**: ~$1.50 per 1,000 pages for AnalyzeDocument with Queries
- **S3**: Standard storage and transfer costs
- **Compute**: Queue worker processing time

For a typical project with 100 drawings, expect:
- 100 Textract API calls (~$0.15)
- ~100MB S3 storage for previews
- ~5-10 minutes queue processing time
