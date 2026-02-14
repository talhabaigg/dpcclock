# API Documentation

## Authentication

All API endpoints (except `/api/login`) require authentication via Bearer token.

### Login
```
POST /api/login
```

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "your-password",
    "device_name": "my-app"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email address |
| `password` | string | Yes | User password |
| `device_name` | string | No | Device/app identifier for the token |

**Response (200 OK):**
```json
{
    "token": "1|abc123xyz...",
    "user": {
        "id": 1,
        "name": "John Doe",
        "email": "user@example.com"
    }
}
```

### Logout
```
POST /api/logout
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "message": "Logged out successfully"
}
```

---

## Drawings

A Drawing represents a single-page construction drawing file belonging to a project (Location). Each file uploaded creates one Drawing record with all metadata stored directly on it.

### List Drawings
```
GET /api/drawings
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | integer | No | Filter drawings by project (location) ID |
| `include_all_revisions` | boolean | No | Include superseded/archived revisions (default: only active) |

**Example:**
```
GET /api/drawings?project_id=1
```

**Response (200 OK):**
```json
[
    {
        "id": 1,
        "project_id": 1,
        "sheet_number": "A-101",
        "title": "Ground Floor Plan",
        "discipline": "Architectural",
        "storage_path": "drawings/1/1234567890_floor-plan.pdf",
        "original_name": "floor-plan.pdf",
        "mime_type": "application/pdf",
        "file_size": 1024000,
        "revision_number": "C",
        "revision_date": "2026-01-15",
        "status": "active",
        "extraction_status": "success",
        "metadata_confirmed": true,
        "created_at": "2026-01-01T00:00:00.000000Z",
        "updated_at": "2026-01-01T00:00:00.000000Z",
        "file_url": "https://...",
        "thumbnail_url": "https://...",
        "observations": [ ... ],
        "created_by": { "id": 1, "name": "John Doe", "email": "user@example.com" },
        "updated_by": null
    }
]
```

### Create Drawing
```
POST /api/drawings
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | integer | Yes | ID of the project (location) |
| `file` | file | Yes | Drawing file (max 50MB) |
| `sheet_number` | string | No | Sheet number (e.g., "A-101") |
| `title` | string | No | Drawing title (defaults to filename) |
| `revision_number` | string | No | Revision identifier (e.g., "C") |
| `revision_date` | date | No | Revision date |
| `revision_notes` | string | No | Notes about this revision |

**Response (201 Created):**
```json
{
    "id": 1,
    "project_id": 1,
    "sheet_number": "A-101",
    "title": "Ground Floor Plan",
    "storage_path": "drawings/1/1234567890_floor-plan.pdf",
    "original_name": "floor-plan.pdf",
    "mime_type": "application/pdf",
    "file_size": 1024000,
    "status": "draft",
    "extraction_status": "queued",
    "created_at": "2026-01-01T00:00:00.000000Z",
    "created_by": { ... }
}
```

**Notes:**
- If `sheet_number` is provided and a drawing with the same `sheet_number` + `project_id` already exists, the existing drawing is marked as "superseded" and the new drawing becomes the active revision.
- After upload, the drawing is processed asynchronously (thumbnail generation, metadata extraction via Textract).

### Get Drawing
```
GET /api/drawings/{id}
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "id": 1,
    "project_id": 1,
    "sheet_number": "A-101",
    "title": "Ground Floor Plan",
    "discipline": "Architectural",
    "storage_path": "drawings/1/1234567890_floor-plan.pdf",
    "original_name": "floor-plan.pdf",
    "mime_type": "application/pdf",
    "file_size": 1024000,
    "revision_number": "C",
    "revision_date": "2026-01-15",
    "status": "active",
    "extraction_status": "success",
    "drawing_number": "NTA-DRW-ARC-0101-GRF",
    "drawing_title": "GROUND FLOOR PLAN",
    "previous_revision_id": 5,
    "created_at": "2026-01-01T00:00:00.000000Z",
    "project": { "id": 1, "name": "Project Name" },
    "observations": [ ... ],
    "previous_revision": { "id": 5, "title": "Ground Floor Plan", "revision_number": "B" },
    "created_by": { ... },
    "updated_by": null
}
```

### Update Drawing
```
PUT /api/drawings/{id}
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Drawing title |
| `sheet_number` | string | No | Sheet number |
| `discipline` | string | No | Discipline (e.g., "Architectural") |
| `revision_number` | string | No | Revision identifier |
| `revision_date` | date | No | Revision date |
| `revision_notes` | string | No | Revision notes |
| `status` | string | No | One of: `draft`, `active`, `superseded`, `archived` |
| `file` | file | No | New file creates a new revision (old drawing becomes superseded) |

**Response (200 OK):**
Returns the updated drawing (or the new revision if file was provided).

### Delete Drawing
```
DELETE /api/drawings/{id}
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "message": "Drawing deleted successfully"
}
```

### Download Drawing File
```
GET /api/drawings/{id}/file
Authorization: Bearer {token}
```

Streams the drawing file with appropriate Content-Type headers.

### Get Thumbnail
```
GET /api/drawings/{id}/thumbnail
Authorization: Bearer {token}
```

Returns the thumbnail image (PNG or JPEG).

### Get Diff Image
```
GET /api/drawings/{id}/diff
Authorization: Bearer {token}
```

Returns a diff image comparing this revision to the previous one.

### Get Revisions
```
GET /api/drawings/{id}/revisions
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "sheet_number": "A-101",
    "revisions": [
        {
            "id": 3,
            "sheet_number": "A-101",
            "title": "Ground Floor Plan",
            "revision_number": "C",
            "revision_date": "2026-01-15",
            "status": "active",
            "created_at": "2026-01-15T00:00:00.000000Z"
        },
        {
            "id": 2,
            "sheet_number": "A-101",
            "title": "Ground Floor Plan",
            "revision_number": "B",
            "revision_date": "2025-12-01",
            "status": "superseded",
            "created_at": "2025-12-01T00:00:00.000000Z"
        }
    ]
}
```

### Compare Revisions
```
POST /api/drawings/{id}/compare
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
    "compare_to": 2
}
```

Returns a diff image (PNG) comparing this drawing to the specified drawing.

### Reprocess Drawing
```
POST /api/drawings/{id}/reprocess
Authorization: Bearer {token}
```

Queues the drawing for re-processing (thumbnail regeneration, diff generation).

### Get Metadata
```
GET /api/drawings/{id}/metadata
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "has_metadata": true,
    "drawing_number": "NTA-DRW-ARC-0101-GRF",
    "drawing_title": "GROUND FLOOR PLAN",
    "revision": "C",
    "extraction_status": "success",
    "is_confirmed": true
}
```

### Extract Metadata
```
POST /api/drawings/{id}/extract-metadata
Authorization: Bearer {token}
```

Queues Textract metadata extraction for the drawing.

**Response (200 OK):**
```json
{
    "message": "Metadata extraction queued"
}
```

### Confirm Metadata
```
POST /api/drawings/{id}/confirm-metadata
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
    "sheet_number": "A-101",
    "title": "Ground Floor Plan",
    "revision": "C",
    "discipline": "Architectural"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sheet_number` | string | No | Confirmed sheet number |
| `title` | string | No | Confirmed title |
| `revision` | string | No | Confirmed revision |
| `revision_date` | date | No | Confirmed revision date |
| `discipline` | string | No | Confirmed discipline |

**Response (200 OK):**
```json
{
    "message": "Metadata confirmed successfully",
    "drawing": { ... }
}
```

---

## Drawing Observations

Observations are field notes, defects, or AI-detected changes pinned to a specific location on a drawing.

### List Observations
```
GET /api/drawing-observations
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `drawing_id` | integer | No | Filter observations by drawing ID |

**Example:**
```
GET /api/drawing-observations?drawing_id=1
```

**Response (200 OK):**
```json
[
    {
        "id": 1,
        "drawing_id": 1,
        "page_number": 1,
        "x": 0.45,
        "y": 0.32,
        "type": "defect",
        "description": "Crack in wall near window",
        "photo_path": "drawing-observations/1/1234567890_crack.jpg",
        "photo_name": "crack.jpg",
        "photo_type": "image/jpeg",
        "photo_size": 512000,
        "is_360_photo": false,
        "created_at": "2026-01-01T00:00:00.000000Z",
        "drawing": { ... },
        "created_by": { ... },
        "updated_by": null
    }
]
```


### Create Observation
```
POST /api/drawing-observations
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `drawing_id` | integer | Yes | ID of the drawing |
| `page_number` | integer | Yes | Page number (min: 1) |
| `x` | float | Yes | X coordinate (0-1, relative position) |
| `y` | float | Yes | Y coordinate (0-1, relative position) |
| `type` | string | Yes | Type: `defect` or `observation` |
| `description` | string | Yes | Description (max 2000 chars) |
| `photo` | file | No | Photo attachment (image, max 50MB for 360 photos) |
| `is_360_photo` | boolean | No | Whether the photo is a 360-degree photo |

**Response (201 Created):**
```json
{
    "id": 1,
    "drawing_id": 1,
    "page_number": 1,
    "x": 0.45,
    "y": 0.32,
    "type": "defect",
    "description": "Crack in wall near window",
    "photo_path": "drawing-observations/1/1234567890_crack.jpg",
    "is_360_photo": false,
    "drawing": { ... },
    "created_by": { ... }
}
```

### Get Observation
```
GET /api/drawing-observations/{id}
Authorization: Bearer {token}
```

### Update Observation
```
PUT /api/drawing-observations/{id}
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | No | Type: `defect` or `observation` |
| `description` | string | No | Description (max 2000 chars) |
| `page_number` | integer | No | Page number |
| `x` | float | No | X coordinate (0-1) |
| `y` | float | No | Y coordinate (0-1) |
| `photo` | file | No | New photo (replaces existing) |
| `remove_photo` | boolean | No | Set to true to remove existing photo |
| `is_360_photo` | boolean | No | Whether the photo is a 360-degree photo |

### Delete Observation
```
DELETE /api/drawing-observations/{id}
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "message": "Observation deleted successfully"
}
```

### Get Observation Photo
```
GET /api/drawing-observations/{id}/photo
Authorization: Bearer {token}
```

Streams the observation photo with appropriate Content-Type headers.

---

## Projects

### List Projects
```
GET /api/projects
Authorization: Bearer {token}
```

Returns SWCP and GRE company projects with drawing counts.

**Response (200 OK):**
```json
[
    {
        "id": 1,
        "name": "Project Name",
        "eh_location_id": 12345,
        "eh_parent_id": 1249093,
        "external_id": "PRJ-001",
        "state": "VIC",
        "drawings_count": 42
    }
]
```

### List Project Drawings
```
GET /api/projects/{project_id}/drawings
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `discipline` | string | No | Filter by discipline (e.g., "Architectural") |

Returns all active drawings for a project with observations loaded.

### Get Project Drawing
```
GET /api/projects/{project_id}/drawings/{drawing_id}
Authorization: Bearer {token}
```

Returns a single drawing with full details.

---

## Site Walks

Site Walks represent physical walk-throughs of a project site, capturing 360-degree photos pinned to specific locations on drawings. They enable virtual tours of the construction site.

### List Site Walks
```
GET /api/projects/{project_id}/site-walks
Authorization: Bearer {token}
```

Returns all site walks for a project, ordered by walk date (newest first).

**Response (200 OK):**
```json
[
    {
        "id": 1,
        "project_id": 1,
        "name": "Level 3 Walkthrough",
        "description": "Weekly progress check",
        "walk_date": "2026-02-10",
        "status": "in_progress",
        "photo_count": 12,
        "cover_photo_url": "https://...",
        "created_by": 1,
        "created_at": "2026-02-10T00:00:00.000000Z",
        "updated_at": "2026-02-10T00:00:00.000000Z"
    }
]
```

### Create Site Walk
```
POST /api/projects/{project_id}/site-walks
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Name of the site walk (max 255 chars) |
| `description` | string | No | Description (max 2000 chars) |
| `walk_date` | date | Yes | Date the walk took place |

**Response (201 Created):**
```json
{
    "id": 1,
    "project_id": 1,
    "name": "Level 3 Walkthrough",
    "description": "Weekly progress check",
    "walk_date": "2026-02-10",
    "status": "in_progress",
    "photo_count": 0,
    "created_by": 1,
    "created_at": "2026-02-10T00:00:00.000000Z"
}
```

### Get Site Walk
```
GET /api/site-walks/{id}
Authorization: Bearer {token}
```

Returns a single site walk with all photos and their associated drawings.

**Response (200 OK):**
```json
{
    "id": 1,
    "project_id": 1,
    "name": "Level 3 Walkthrough",
    "description": "Weekly progress check",
    "walk_date": "2026-02-10",
    "status": "in_progress",
    "photo_count": 2,
    "photos": [
        {
            "id": 1,
            "site_walk_id": 1,
            "drawing_sheet_id": 5,
            "page_number": 1,
            "x": 0.45,
            "y": 0.32,
            "heading": 180.0,
            "sequence_order": 1,
            "caption": "Looking towards stairwell",
            "photo_url": "/api/site-walk-photos/1/file",
            "drawing": { "id": 5, "sheet_number": "A-301", "title": "Level 3 Plan" }
        }
    ],
    "created_by": { "id": 1, "name": "John Doe" }
}
```

### Update Site Walk
```
PUT /api/site-walks/{id}
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Name of the site walk |
| `description` | string | No | Description |
| `walk_date` | date | No | Walk date |
| `status` | string | No | One of: `in_progress`, `completed`, `archived` |

**Response (200 OK):**
Returns the updated site walk.

### Delete Site Walk
```
DELETE /api/site-walks/{id}
Authorization: Bearer {token}
```

**Response (204 No Content)**

### Get Tour Data
```
GET /api/site-walks/{id}/tour
Authorization: Bearer {token}
```

Returns everything needed to render a virtual tour — photos grouped by drawing sheet with scene IDs for the panorama viewer.

**Response (200 OK):**
```json
{
    "walk": {
        "id": 1,
        "name": "Level 3 Walkthrough",
        "description": "Weekly progress check",
        "walk_date": "2026-02-10",
        "status": "in_progress",
        "photo_count": 12
    },
    "photos": [
        {
            "id": 1,
            "scene_id": "photo_1",
            "site_walk_id": 1,
            "drawing_sheet_id": 5,
            "page_number": 1,
            "x": 0.45,
            "y": 0.32,
            "heading": 180.0,
            "sequence_order": 1,
            "caption": "Looking towards stairwell",
            "photo_url": "/api/site-walk-photos/1/file",
            "hotspot_overrides": null,
            "sheet_display_name": "A-301 - Level 3 Plan",
            "created_at": "2026-02-10T00:00:00.000000Z"
        }
    ],
    "sheets": [
        {
            "id": 5,
            "sheet_number": "A-301",
            "title": "Level 3 Plan",
            "display_name": "A-301 - Level 3 Plan",
            "background_url": "/api/drawings/5/file",
            "photo_ids": [1, 2, 3]
        }
    ]
}
```

### Upload Site Walk Photo
```
POST /api/site-walks/{id}/photos
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `drawing_sheet_id` | integer | Yes | ID of the drawing this photo is pinned to |
| `page_number` | integer | Yes | Page number (min: 1) |
| `x` | float | Yes | X coordinate (0-1, relative position on drawing) |
| `y` | float | Yes | Y coordinate (0-1, relative position on drawing) |
| `heading` | float | No | Camera heading in degrees |
| `sequence_order` | integer | Yes | Order in the tour sequence (min: 1) |
| `caption` | string | No | Photo caption (max 255 chars) |
| `photo` | file | Yes | 360-degree photo (image, max 50MB) |

**Response (201 Created):**
```json
{
    "id": 1,
    "site_walk_id": 1,
    "drawing_sheet_id": 5,
    "page_number": 1,
    "x": 0.45,
    "y": 0.32,
    "heading": 180.0,
    "sequence_order": 1,
    "caption": "Looking towards stairwell",
    "photo_path": "site-walk-photos/1/1234567890_photo.jpg",
    "photo_name": "photo.jpg",
    "photo_type": "image/jpeg",
    "photo_size": 5120000,
    "photo_url": "/api/site-walk-photos/1/file",
    "drawing": { "id": 5, "sheet_number": "A-301", "title": "Level 3 Plan" }
}
```

### Update Site Walk Photo
```
PUT /api/site-walk-photos/{id}
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `caption` | string | No | Photo caption |
| `x` | float | No | X coordinate (0-1) |
| `y` | float | No | Y coordinate (0-1) |
| `heading` | float | No | Camera heading in degrees |
| `sequence_order` | integer | No | Order in tour sequence |
| `hotspot_overrides` | array | No | Array of hotspot position overrides (`{yaw, pitch}` per hotspot) |

**Response (200 OK):**
Returns the updated photo.

### Delete Site Walk Photo
```
DELETE /api/site-walk-photos/{id}
Authorization: Bearer {token}
```

**Response (204 No Content)**

### Get Site Walk Photo File
```
GET /api/site-walk-photos/{id}/file
Authorization: Bearer {token}
```

Streams the 360-degree photo file from S3 with appropriate Content-Type headers.

---

## Data Models Reference

### Drawing Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique identifier |
| `project_id` | integer | ID of the project (location) |
| `sheet_number` | string\|null | Sheet number (e.g., "A-101") |
| `title` | string\|null | Drawing title |
| `discipline` | string\|null | Engineering discipline |
| `storage_path` | string\|null | S3 storage path |
| `original_name` | string\|null | Original upload filename |
| `mime_type` | string\|null | File MIME type |
| `file_size` | integer\|null | File size in bytes |
| `revision_number` | string\|null | Revision identifier (e.g., "C") |
| `revision_date` | date\|null | Date of revision |
| `status` | string | One of: `draft`, `processing`, `pending_review`, `active`, `superseded`, `archived` |
| `extraction_status` | string\|null | Textract status: `queued`, `processing`, `success`, `needs_review`, `failed` |
| `drawing_number` | string\|null | Extracted drawing number (from Textract) |
| `drawing_title` | string\|null | Extracted title (from Textract) |
| `revision` | string\|null | Extracted revision (from Textract) |
| `metadata_confirmed` | boolean | Whether metadata has been user-confirmed |
| `previous_revision_id` | integer\|null | ID of the previous revision |
| `created_by` | integer | User ID who created |
| `updated_by` | integer\|null | User ID who last updated |
| `created_at` | datetime | Creation timestamp |
| `updated_at` | datetime | Last update timestamp |
| `deleted_at` | datetime\|null | Soft delete timestamp |
| `file_url` | string | URL to download the file (computed) |
| `thumbnail_url` | string\|null | URL for the thumbnail (computed) |

### DrawingObservation Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique identifier |
| `drawing_id` | integer | ID of the drawing |
| `page_number` | integer | Page number in the drawing |
| `x` | float | X coordinate (0-1 range) |
| `y` | float | Y coordinate (0-1 range) |
| `type` | string | `defect` or `observation` |
| `description` | string | Description |
| `photo_path` | string\|null | S3 path of the photo |
| `photo_name` | string\|null | Original photo filename |
| `photo_type` | string\|null | MIME type of the photo |
| `photo_size` | integer\|null | Photo file size in bytes |
| `is_360_photo` | boolean | Whether the photo is 360-degree |
| `created_by` | integer | User ID who created |
| `updated_by` | integer\|null | User ID who last updated |
| `created_at` | datetime | Creation timestamp |
| `updated_at` | datetime | Last update timestamp |

### SiteWalk Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique identifier |
| `project_id` | integer | ID of the project (location) |
| `name` | string | Name of the site walk |
| `description` | string\|null | Description |
| `walk_date` | date | Date the walk took place |
| `status` | string | One of: `in_progress`, `completed`, `archived` |
| `photo_count` | integer | Denormalized count of photos |
| `cover_photo_url` | string\|null | URL of the first photo (computed) |
| `created_by` | integer | User ID who created |
| `updated_by` | integer\|null | User ID who last updated |
| `created_at` | datetime | Creation timestamp |
| `updated_at` | datetime | Last update timestamp |
| `deleted_at` | datetime\|null | Soft delete timestamp |

### SiteWalkPhoto Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique identifier |
| `site_walk_id` | integer | ID of the parent site walk |
| `drawing_sheet_id` | integer | ID of the drawing this photo is pinned to |
| `page_number` | integer | Page number on the drawing |
| `x` | float | X coordinate (0-1 range, relative position) |
| `y` | float | Y coordinate (0-1 range, relative position) |
| `heading` | float\|null | Camera heading in degrees |
| `sequence_order` | integer | Order in the tour sequence |
| `caption` | string\|null | Photo caption |
| `photo_path` | string | S3 storage path |
| `photo_name` | string | Original filename |
| `photo_type` | string | MIME type (e.g., `image/jpeg`) |
| `photo_size` | integer | File size in bytes |
| `hotspot_overrides` | array\|null | Custom hotspot positions (`{yaw, pitch}` overrides) |
| `photo_url` | string | URL to stream the photo file (computed) |
| `created_by` | integer | User ID who created |
| `updated_by` | integer\|null | User ID who last updated |
| `created_at` | datetime | Creation timestamp |
| `updated_at` | datetime | Last update timestamp |
| `deleted_at` | datetime\|null | Soft delete timestamp |

---

## Error Responses

### 401 Unauthorized
```json
{
    "message": "Unauthenticated."
}
```

### 404 Not Found
```json
{
    "message": "No query results for model [App\\Models\\Drawing] 999"
}
```

### 422 Validation Error
```json
{
    "message": "The given data was invalid.",
    "errors": {
        "project_id": ["The project id field is required."],
        "type": ["The selected type is invalid."]
    }
}
```

### 500 Server Error
```json
{
    "message": "Failed to upload: error details"
}
```

---

## Production Tracking

Production tracking allows field workers to record percent-complete progress on takeoff measurements, per labour cost code (LCC). Statuses use carry-forward logic: the most recent status on or before the selected work date is used.

### Get Production Data
```
GET /api/drawings/{id}/production
Authorization: Bearer {token}
```

Returns everything needed to render the production view for a drawing.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `work_date` | date | No | Work date for status lookups (default: today) |

**Response (200 OK):**
```json
{
    "drawing": {
        "id": 1,
        "project_id": 1,
        "sheet_number": "A-101",
        "title": "Ground Floor Plan",
        "tiles_info": { "baseUrl": "...", "maxZoom": 5, "width": 4096, "height": 2048, "tileSize": 256 },
        "project": { "id": 1, "name": "Project Name" }
    },
    "measurements": [
        {
            "id": 10,
            "type": "linear",
            "points": [{ "x": 0.1, "y": 0.2 }, { "x": 0.3, "y": 0.4 }],
            "computed_value": 125.5,
            "color": "#ff0000",
            "takeoff_condition_id": 3,
            "condition": {
                "id": 3,
                "name": "Interior Wall",
                "condition_labour_codes": [
                    {
                        "id": 1,
                        "labour_cost_code_id": 45,
                        "production_rate": 15.0,
                        "hourly_rate": 65.0,
                        "labour_cost_code": {
                            "id": 45,
                            "code": "M-101",
                            "name": "Install Drywall",
                            "unit": "LF"
                        }
                    }
                ]
            }
        }
    ],
    "calibration": {
        "points": [{ "x": 0.1, "y": 0.5 }, { "x": 0.9, "y": 0.5 }],
        "real_distance": 10.0,
        "unit": "m"
    },
    "statuses": {
        "10-45": 70
    },
    "segmentStatuses": {
        "10-0": 100,
        "10-1": 50
    },
    "lccSummary": [
        {
            "labour_cost_code_id": 45,
            "code": "M-101",
            "name": "Install Drywall",
            "unit": "LF",
            "total_qty": 125.5,
            "budget_hours": 8.37,
            "earned_hours": 5.86,
            "weighted_percent": 70.0,
            "measurement_count": 1
        }
    ],
    "workDate": "2026-02-15"
}
```

**Key data structures:**
- `statuses`: Map of `"{measurementId}-{lccId}"` to percent complete (0-100)
- `segmentStatuses`: Map of `"{measurementId}-{segmentIndex}"` to percent complete (for linear measurements with 3+ points)
- `lccSummary`: Aggregated progress per labour cost code (quantity-weighted)

### Get Production Statuses
```
GET /api/drawings/{id}/production-statuses
Authorization: Bearer {token}
```

Lightweight endpoint for reloading statuses when the work date changes. Same response shape as the `statuses`, `segmentStatuses`, and `lccSummary` fields above.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `work_date` | date | No | Work date for status lookups (default: today) |

**Response (200 OK):**
```json
{
    "statuses": { "10-45": 70 },
    "segmentStatuses": { "10-0": 100, "10-1": 50 },
    "lccSummary": [ ... ]
}
```

### Update Measurement Status
```
POST /api/drawings/{id}/measurement-status
Authorization: Bearer {token}
Content-Type: application/json
```

Set percent complete for a single measurement / labour cost code pair.

**Request Body:**
```json
{
    "measurement_id": 10,
    "labour_cost_code_id": 45,
    "percent_complete": 70,
    "work_date": "2026-02-15"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `measurement_id` | integer | Yes | ID of the measurement |
| `labour_cost_code_id` | integer | Yes | ID of the labour cost code |
| `percent_complete` | integer | Yes | Percent complete (0-100) |
| `work_date` | date | No | Work date (default: today) |

**Response (200 OK):**
```json
{
    "success": true,
    "status": { "id": 1, "drawing_measurement_id": 10, "labour_cost_code_id": 45, "percent_complete": 70 },
    "lccSummary": [ ... ]
}
```

### Bulk Update Measurement Status
```
POST /api/drawings/{id}/measurement-status-bulk
Authorization: Bearer {token}
Content-Type: application/json
```

Set percent complete for multiple measurements at once.

**Request Body:**
```json
{
    "measurement_ids": [10, 11, 12],
    "labour_cost_code_id": 45,
    "percent_complete": 100,
    "work_date": "2026-02-15"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `measurement_ids` | integer[] | Yes | Array of measurement IDs |
| `labour_cost_code_id` | integer | Yes | ID of the labour cost code |
| `percent_complete` | integer | Yes | Percent complete (0-100) |
| `work_date` | date | No | Work date (default: today) |

**Response (200 OK):**
```json
{
    "success": true,
    "updated_count": 3,
    "lccSummary": [ ... ]
}
```

### Update Segment Status
```
POST /api/drawings/{id}/segment-status
Authorization: Bearer {token}
Content-Type: application/json
```

Set percent complete for a single segment of a linear measurement (measurements with 3+ points have individually-trackable segments).

**Request Body:**
```json
{
    "measurement_id": 10,
    "labour_cost_code_id": 45,
    "segment_index": 0,
    "percent_complete": 100,
    "work_date": "2026-02-15"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `measurement_id` | integer | Yes | ID of the measurement |
| `labour_cost_code_id` | integer | Yes | ID of the labour cost code |
| `segment_index` | integer | Yes | Zero-based segment index |
| `percent_complete` | integer | Yes | Percent complete (0-100) |
| `work_date` | date | No | Work date (default: today) |

**Response (200 OK):**
```json
{
    "success": true,
    "statuses": { "10-45": 75 },
    "segmentStatuses": { "10-0": 100, "10-1": 50 },
    "lccSummary": [ ... ]
}
```

**Note:** Updating a segment automatically recalculates the parent measurement's overall percent as a length-weighted average of its segments.

### Bulk Update Segment Status
```
POST /api/drawings/{id}/segment-status-bulk
Authorization: Bearer {token}
Content-Type: application/json
```

Set percent complete for multiple items (mix of whole measurements and individual segments) at once.

**Request Body:**
```json
{
    "items": [
        { "measurement_id": 10 },
        { "measurement_id": 11, "segment_index": 0 },
        { "measurement_id": 11, "segment_index": 1 }
    ],
    "labour_cost_code_id": 45,
    "percent_complete": 100,
    "work_date": "2026-02-15"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | array | Yes | Array of items to update |
| `items[].measurement_id` | integer | Yes | ID of the measurement |
| `items[].segment_index` | integer | No | Segment index (omit for whole measurement) |
| `labour_cost_code_id` | integer | Yes | ID of the labour cost code |
| `percent_complete` | integer | Yes | Percent complete (0-100) |
| `work_date` | date | No | Work date (default: today) |

**Response (200 OK):**
```json
{
    "success": true,
    "statuses": { ... },
    "segmentStatuses": { ... },
    "lccSummary": [ ... ]
}
```

### Get Drawing Tiles
```
GET /api/drawings/{id}/tiles/{z}/{x}_{y}
Authorization: Bearer {token}
```

Serves individual tile images for the Leaflet-style map viewer. Redirects to a signed S3 URL (when using S3 storage) or streams the PNG directly.

| Parameter | Type | Description |
|-----------|------|-------------|
| `z` | integer | Zoom level |
| `x` | integer | Tile X coordinate |
| `y` | integer | Tile Y coordinate |

**Response:** PNG image (200) or 404 if tile not found.

### Get Drawing Preview
```
GET /api/drawings/{id}/preview
Authorization: Bearer {token}
```

Returns the high-resolution page preview image. Redirects to a signed S3 URL.

**Response:** 302 redirect to signed S3 URL, or 404 if no preview available.

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Authenticate and get token |
| POST | `/api/logout` | Revoke current token |
| **Drawings** | | |
| GET | `/api/drawings` | List drawings (filter by `project_id`) |
| POST | `/api/drawings` | Upload a drawing |
| GET | `/api/drawings/{id}` | Get a drawing |
| PUT | `/api/drawings/{id}` | Update drawing / upload new revision |
| DELETE | `/api/drawings/{id}` | Delete a drawing |
| GET | `/api/drawings/{id}/file` | Download drawing file |
| GET | `/api/drawings/{id}/thumbnail` | Get thumbnail image |
| GET | `/api/drawings/{id}/diff` | Get diff image |
| GET | `/api/drawings/{id}/revisions` | Get all revisions for this sheet |
| POST | `/api/drawings/{id}/compare` | Compare with another drawing |
| POST | `/api/drawings/{id}/reprocess` | Reprocess drawing |
| GET | `/api/drawings/{id}/metadata` | Get extracted metadata |
| POST | `/api/drawings/{id}/extract-metadata` | Queue metadata extraction |
| POST | `/api/drawings/{id}/confirm-metadata` | Confirm extracted metadata |
| GET | `/api/drawings/{id}/tiles/{z}/{x}_{y}` | Get map tile image |
| GET | `/api/drawings/{id}/preview` | Get high-res page preview |
| **Production** | | |
| GET | `/api/drawings/{id}/production` | Get production data (measurements, statuses, LCC summary) |
| GET | `/api/drawings/{id}/production-statuses` | Get statuses for a work date |
| POST | `/api/drawings/{id}/measurement-status` | Update single measurement status |
| POST | `/api/drawings/{id}/measurement-status-bulk` | Bulk update measurement statuses |
| POST | `/api/drawings/{id}/segment-status` | Update single segment status |
| POST | `/api/drawings/{id}/segment-status-bulk` | Bulk update segment/measurement statuses |
| **Observations** | | |
| GET | `/api/drawing-observations` | List observations (filter by `drawing_id`) |
| POST | `/api/drawing-observations` | Create an observation |
| GET | `/api/drawing-observations/{id}` | Get an observation |
| PUT | `/api/drawing-observations/{id}` | Update an observation |
| DELETE | `/api/drawing-observations/{id}` | Delete an observation |
| GET | `/api/drawing-observations/{id}/photo` | Get observation photo |
| **Projects** | | |
| GET | `/api/projects` | List projects |
| GET | `/api/projects/{id}/drawings` | List active drawings for project |
| GET | `/api/projects/{id}/drawings/{drawing_id}` | Get project drawing |
| **Site Walks** | | |
| GET | `/api/projects/{id}/site-walks` | List site walks for a project |
| POST | `/api/projects/{id}/site-walks` | Create a site walk |
| GET | `/api/site-walks/{id}` | Get a site walk with photos |
| PUT | `/api/site-walks/{id}` | Update a site walk |
| DELETE | `/api/site-walks/{id}` | Delete a site walk |
| GET | `/api/site-walks/{id}/tour` | Get tour data for panorama viewer |
| POST | `/api/site-walks/{id}/photos` | Upload a 360 photo |
| PUT | `/api/site-walk-photos/{id}` | Update a photo (caption, position) |
| DELETE | `/api/site-walk-photos/{id}` | Delete a photo |
| GET | `/api/site-walk-photos/{id}/file` | Stream a photo file |

## Migration Notes (for Mobile App)

The following breaking changes were made from the previous API:

| Old Endpoint | New Endpoint |
|---|---|
| `/api/qa-stages/*` | **Removed** |
| `/api/qa-stage-drawings` | `/api/drawings` |
| `/api/qa-stage-drawings/{id}/*` | `/api/drawings/{id}/*` |
| `/api/qa-stage-drawing-observations` | `/api/drawing-observations` |
| `/api/qa-stage-drawing-observations/{id}/*` | `/api/drawing-observations/{id}/*` |

**Key field changes:**
- Filter: `project_id` (replaces old `qa_stage_id`)
- Observations use `drawing_id` FK
- Drawing response includes `sheet_number`, `title`, `discipline`, `storage_path` directly (no nested objects)
