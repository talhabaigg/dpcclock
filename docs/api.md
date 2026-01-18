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
        "email": "user@example.com",
        "phone": "1234567890",
        "email_verified_at": "2024-01-01T00:00:00.000000Z",
        "created_at": "2024-01-01T00:00:00.000000Z",
        "updated_at": "2024-01-01T00:00:00.000000Z"
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

## QA Stages

### List All QA Stages
```
GET /api/qa-stages
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
[
    {
        "id": 1,
        "location_id": 1,
        "name": "Stage Name",
        "created_by": 1,
        "updated_by": null,
        "created_at": "2024-01-01T00:00:00.000000Z",
        "updated_at": "2024-01-01T00:00:00.000000Z",
        "deleted_at": null,
        "location": {
            "id": 1,
            "name": "Location Name"
        },
        "created_by": { ... },
        "updated_by": null,
        "drawings": []
    }
]
```

### Get Single QA Stage
```
GET /api/qa-stages/{id}
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "id": 1,
    "location_id": 1,
    "name": "Stage Name",
    "created_by": 1,
    "updated_by": null,
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z",
    "deleted_at": null,
    "location": { ... },
    "created_by": { ... },
    "updated_by": null,
    "drawings": []
}
```

### Create QA Stage
```
POST /api/qa-stages
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
    "location_id": 1,
    "name": "New Stage Name"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `location_id` | integer | Yes | ID of the location |
| `name` | string | Yes | Name of the QA stage (max 255 chars) |

**Response (201 Created):**
```json
{
    "id": 1,
    "location_id": 1,
    "name": "New Stage Name",
    "created_by": 1,
    "updated_by": null,
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z",
    "location": { ... },
    "created_by": { ... }
}
```

### Update QA Stage
```
PUT /api/qa-stages/{id}
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
    "location_id": 2,
    "name": "Updated Stage Name"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `location_id` | integer | No | ID of the location |
| `name` | string | No | Name of the QA stage (max 255 chars) |

**Response (200 OK):**
```json
{
    "id": 1,
    "location_id": 2,
    "name": "Updated Stage Name",
    "created_by": 1,
    "updated_by": 1,
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z",
    "location": { ... },
    "created_by": { ... },
    "updated_by": { ... }
}
```

### Delete QA Stage
```
DELETE /api/qa-stages/{id}
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "message": "QA Stage deleted successfully"
}
```

---

## QA Stage Drawings

### List All Drawings
```
GET /api/qa-stage-drawings
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `qa_stage_id` | integer | No | Filter drawings by QA stage ID |

**Example:**
```
GET /api/qa-stage-drawings?qa_stage_id=1
```

**Response (200 OK):**
```json
[
    {
        "id": 1,
        "qa_stage_id": 1,
        "name": "Floor Plan",
        "file_path": "qa-drawings/1/1234567890_floor-plan.pdf",
        "file_name": "floor-plan.pdf",
        "file_type": "application/pdf",
        "file_size": 1024000,
        "created_by": 1,
        "updated_by": null,
        "created_at": "2024-01-01T00:00:00.000000Z",
        "updated_at": "2024-01-01T00:00:00.000000Z",
        "deleted_at": null,
        "file_url": "/storage/qa-drawings/1/1234567890_floor-plan.pdf",
        "qa_stage": {
            "id": 1,
            "name": "Stage Name",
            "location_id": 1
        },
        "created_by": {
            "id": 1,
            "name": "John Doe",
            "email": "user@example.com"
        },
        "updated_by": null,
        "observations": [ ... ]
    }
]
```

### Get Single Drawing
```
GET /api/qa-stage-drawings/{id}
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "id": 1,
    "qa_stage_id": 1,
    "name": "Floor Plan",
    "file_path": "qa-drawings/1/1234567890_floor-plan.pdf",
    "file_name": "floor-plan.pdf",
    "file_type": "application/pdf",
    "file_size": 1024000,
    "created_by": 1,
    "updated_by": null,
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z",
    "deleted_at": null,
    "file_url": "/storage/qa-drawings/1/1234567890_floor-plan.pdf",
    "qa_stage": {
        "id": 1,
        "name": "Stage Name",
        "location_id": 1,
        "location": {
            "id": 1,
            "name": "Location Name"
        }
    },
    "created_by": { ... },
    "updated_by": null,
    "observations": [
        {
            "id": 1,
            "qa_stage_drawing_id": 1,
            "page_number": 1,
            "x": 0.45,
            "y": 0.32,
            "type": "defect",
            "description": "Crack in wall",
            "photo_path": "qa-drawing-observations/1/1234567890_crack.jpg",
            "photo_name": "crack.jpg",
            "photo_type": "image/jpeg",
            "photo_size": 512000,
            "photo_url": "/storage/qa-drawing-observations/1/1234567890_crack.jpg",
            "created_by": 1,
            "updated_by": null,
            "created_at": "2024-01-01T00:00:00.000000Z",
            "updated_at": "2024-01-01T00:00:00.000000Z",
            "deleted_at": null,
            "created_by": { ... },
            "updated_by": null
        }
    ]
}
```

### Create Drawing
```
POST /api/qa-stage-drawings
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `qa_stage_id` | integer | Yes | ID of the parent QA stage |
| `name` | string | Yes | Drawing name (max 255 chars) |
| `file` | file | Yes | Drawing file (max 50MB) |

**Response (201 Created):**
```json
{
    "id": 1,
    "qa_stage_id": 1,
    "name": "Floor Plan",
    "file_path": "qa-drawings/1/1234567890_floor-plan.pdf",
    "file_name": "floor-plan.pdf",
    "file_type": "application/pdf",
    "file_size": 1024000,
    "file_url": "/storage/qa-drawings/1/1234567890_floor-plan.pdf",
    "created_by": 1,
    "updated_by": null,
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z",
    "qa_stage": { ... },
    "created_by": { ... }
}
```

### Update Drawing
```
PUT /api/qa-stage-drawings/{id}
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Drawing name (max 255 chars) |
| `file` | file | No | New drawing file (max 50MB) - replaces existing |

**Response (200 OK):**
```json
{
    "id": 1,
    "qa_stage_id": 1,
    "name": "Updated Floor Plan",
    "file_path": "qa-drawings/1/1234567890_new-file.pdf",
    "file_name": "new-file.pdf",
    "file_type": "application/pdf",
    "file_size": 2048000,
    "file_url": "/storage/qa-drawings/1/1234567890_new-file.pdf",
    "created_by": 1,
    "updated_by": 1,
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z",
    "qa_stage": { ... },
    "created_by": { ... },
    "updated_by": { ... }
}
```

### Delete Drawing
```
DELETE /api/qa-stage-drawings/{id}
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "message": "Drawing deleted successfully"
}
```

---

## QA Stage Drawing Observations

### List All Observations
```
GET /api/qa-stage-drawing-observations
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `qa_stage_drawing_id` | integer | No | Filter observations by drawing ID |

**Example:**
```
GET /api/qa-stage-drawing-observations?qa_stage_drawing_id=1
```

**Response (200 OK):**
```json
[
    {
        "id": 1,
        "qa_stage_drawing_id": 1,
        "page_number": 1,
        "x": 0.45,
        "y": 0.32,
        "type": "defect",
        "description": "Crack in wall near window",
        "photo_path": "qa-drawing-observations/1/1234567890_crack.jpg",
        "photo_name": "crack.jpg",
        "photo_type": "image/jpeg",
        "photo_size": 512000,
        "photo_url": "/storage/qa-drawing-observations/1/1234567890_crack.jpg",
        "created_by": 1,
        "updated_by": null,
        "created_at": "2024-01-01T00:00:00.000000Z",
        "updated_at": "2024-01-01T00:00:00.000000Z",
        "deleted_at": null,
        "drawing": {
            "id": 1,
            "name": "Floor Plan",
            "qa_stage": { ... }
        },
        "created_by": { ... },
        "updated_by": null
    }
]
```

### Get Single Observation
```
GET /api/qa-stage-drawing-observations/{id}
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "id": 1,
    "qa_stage_drawing_id": 1,
    "page_number": 1,
    "x": 0.45,
    "y": 0.32,
    "type": "defect",
    "description": "Crack in wall near window",
    "photo_path": "qa-drawing-observations/1/1234567890_crack.jpg",
    "photo_name": "crack.jpg",
    "photo_type": "image/jpeg",
    "photo_size": 512000,
    "photo_url": "/storage/qa-drawing-observations/1/1234567890_crack.jpg",
    "created_by": 1,
    "updated_by": null,
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z",
    "deleted_at": null,
    "drawing": {
        "id": 1,
        "name": "Floor Plan",
        "qa_stage": {
            "id": 1,
            "name": "Stage Name",
            "location": { ... }
        }
    },
    "created_by": { ... },
    "updated_by": null
}
```

### Create Observation
```
POST /api/qa-stage-drawing-observations
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `qa_stage_drawing_id` | integer | Yes | ID of the parent drawing |
| `page_number` | integer | Yes | Page number in the drawing (min: 1) |
| `x` | float | Yes | X coordinate (0-1, relative position) |
| `y` | float | Yes | Y coordinate (0-1, relative position) |
| `type` | string | Yes | Type: `defect` or `observation` |
| `description` | string | Yes | Description (max 2000 chars) |
| `photo` | file | No | Photo attachment (image, max 5MB) |

**Response (201 Created):**
```json
{
    "id": 1,
    "qa_stage_drawing_id": 1,
    "page_number": 1,
    "x": 0.45,
    "y": 0.32,
    "type": "defect",
    "description": "Crack in wall near window",
    "photo_path": "qa-drawing-observations/1/1234567890_crack.jpg",
    "photo_name": "crack.jpg",
    "photo_type": "image/jpeg",
    "photo_size": 512000,
    "photo_url": "/storage/qa-drawing-observations/1/1234567890_crack.jpg",
    "created_by": 1,
    "updated_by": null,
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z",
    "drawing": { ... },
    "created_by": { ... }
}
```

### Update Observation
```
PUT /api/qa-stage-drawing-observations/{id}
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `page_number` | integer | No | Page number in the drawing (min: 1) |
| `x` | float | No | X coordinate (0-1, relative position) |
| `y` | float | No | Y coordinate (0-1, relative position) |
| `type` | string | No | Type: `defect` or `observation` |
| `description` | string | No | Description (max 2000 chars) |
| `photo` | file | No | New photo (replaces existing) |

**Response (200 OK):**
```json
{
    "id": 1,
    "qa_stage_drawing_id": 1,
    "page_number": 1,
    "x": 0.50,
    "y": 0.35,
    "type": "defect",
    "description": "Updated description",
    "photo_path": "qa-drawing-observations/1/1234567890_new-photo.jpg",
    "photo_name": "new-photo.jpg",
    "photo_type": "image/jpeg",
    "photo_size": 256000,
    "photo_url": "/storage/qa-drawing-observations/1/1234567890_new-photo.jpg",
    "created_by": 1,
    "updated_by": 1,
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z",
    "drawing": { ... },
    "created_by": { ... },
    "updated_by": { ... }
}
```

### Delete Observation
```
DELETE /api/qa-stage-drawing-observations/{id}
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
    "message": "Observation deleted successfully"
}
```

---

## Data Models Reference

### QaStage Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique identifier |
| `location_id` | integer | ID of the associated location |
| `name` | string | Stage name |
| `created_by` | integer | User ID who created the stage |
| `updated_by` | integer\|null | User ID who last updated the stage |
| `created_at` | datetime | Creation timestamp |
| `updated_at` | datetime | Last update timestamp |
| `deleted_at` | datetime\|null | Soft delete timestamp |

### QaStageDrawing Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique identifier |
| `qa_stage_id` | integer | ID of the parent QA stage |
| `name` | string | Drawing name |
| `file_path` | string | Storage path of the file |
| `file_name` | string | Original file name |
| `file_type` | string | MIME type (e.g., "application/pdf") |
| `file_size` | integer | File size in bytes |
| `created_by` | integer | User ID who created the drawing |
| `updated_by` | integer\|null | User ID who last updated the drawing |
| `created_at` | datetime | Creation timestamp |
| `updated_at` | datetime | Last update timestamp |
| `deleted_at` | datetime\|null | Soft delete timestamp |
| `file_url` | string | URL to access the file (computed) |

### QaStageDrawingObservation Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique identifier |
| `qa_stage_drawing_id` | integer | ID of the parent drawing |
| `page_number` | integer | Page number in the drawing |
| `x` | float | X coordinate (0-1 range, relative position) |
| `y` | float | Y coordinate (0-1 range, relative position) |
| `type` | string | Observation type: `defect` or `observation` |
| `description` | string | Description of the observation |
| `photo_path` | string\|null | Storage path of the photo |
| `photo_name` | string\|null | Original photo file name |
| `photo_type` | string\|null | MIME type of the photo |
| `photo_size` | integer\|null | Photo file size in bytes |
| `created_by` | integer | User ID who created the observation |
| `updated_by` | integer\|null | User ID who last updated the observation |
| `created_at` | datetime | Creation timestamp |
| `updated_at` | datetime | Last update timestamp |
| `deleted_at` | datetime\|null | Soft delete timestamp |
| `photo_url` | string\|null | URL to access the photo (computed) |

### User Properties (in relationships)

| Property | Type | Description |
|----------|------|-------------|
| `id` | integer | Unique identifier |
| `name` | string | User's full name |
| `email` | string | User's email address |

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
    "message": "No query results for model [App\\Models\\QaStageDrawing] 999"
}
```

### 422 Validation Error
```json
{
    "message": "The given data was invalid.",
    "errors": {
        "name": ["The name field is required."],
        "type": ["The selected type is invalid."]
    }
}
```

### 500 Server Error
```json
{
    "message": "Failed to save observation."
}
```

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Authenticate and get token |
| POST | `/api/logout` | Revoke current token |
| GET | `/api/qa-stages` | List all QA stages |
| POST | `/api/qa-stages` | Create a QA stage |
| GET | `/api/qa-stages/{id}` | Get a QA stage |
| PUT | `/api/qa-stages/{id}` | Update a QA stage |
| DELETE | `/api/qa-stages/{id}` | Delete a QA stage |
| GET | `/api/qa-stage-drawings` | List all drawings |
| POST | `/api/qa-stage-drawings` | Create a drawing |
| GET | `/api/qa-stage-drawings/{id}` | Get a drawing |
| PUT | `/api/qa-stage-drawings/{id}` | Update a drawing |
| DELETE | `/api/qa-stage-drawings/{id}` | Delete a drawing |
| GET | `/api/qa-stage-drawing-observations` | List all observations |
| POST | `/api/qa-stage-drawing-observations` | Create an observation |
| GET | `/api/qa-stage-drawing-observations/{id}` | Get an observation |
| PUT | `/api/qa-stage-drawing-observations/{id}` | Update an observation |
| DELETE | `/api/qa-stage-drawing-observations/{id}` | Delete an observation |
