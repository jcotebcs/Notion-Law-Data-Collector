# POST /api/createPage - API Documentation

## Overview

The `POST /api/createPage` endpoint creates a new page in a Notion database. This endpoint supports both regular Notion databases and multi-source databases (Notion API 2025-09-03).

## Endpoint

```
POST /api/createPage
```

## Authentication

The endpoint requires a valid Notion API key to be configured as the `NOTION_API_KEY` environment variable on the server.

## Request Format

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "databaseId": "32-character-database-id",
  "properties": {
    "Title": {
      "title": [{"text": {"content": "Case Title"}}]
    },
    "Case Number": {
      "rich_text": [{"text": {"content": "CASE-2025-001"}}]
    },
    "Status": {
      "select": {"name": "Active"}
    },
    "Tags": {
      "multi_select": [
        {"name": "Criminal"},
        {"name": "High Priority"}
      ]
    },
    "Date": {
      "date": {"start": "2025-01-15"}
    }
  }
}
```

## Required Fields

- `databaseId` (string): 32-character Notion database ID
- `properties` (object): Page properties following Notion API format
- `properties.Title` (object): Title property is required for all pages

## Response Format

### Success Response (201)
```json
{
  "error": false,
  "data": {
    "id": "page-id-from-notion",
    "url": "https://notion.so/page-url",
    "created_time": "2025-01-15T10:30:00.000Z",
    "properties": {
      // Full page properties from Notion
    },
    "api_version": "2025-09-03",
    "data_source_id": "optional-data-source-id"
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Required Fields
```json
{
  "error": true,
  "message": "Missing required fields: databaseId, properties"
}
```

#### 400 Bad Request - Invalid Database ID
```json
{
  "error": true,
  "message": "Invalid database ID format"
}
```

#### 400 Bad Request - Missing Title Property
```json
{
  "error": true,
  "message": "Title property is required"
}
```

#### 401 Unauthorized
```json
{
  "error": true,
  "message": "Invalid Notion API key"
}
```

#### 404 Not Found
```json
{
  "error": true,
  "message": "Database not found or integration lacks access"
}
```

#### 405 Method Not Allowed
```json
{
  "error": true,
  "message": "Method GET not allowed"
}
```

#### 429 Rate Limited
```json
{
  "error": true,
  "message": "Rate limit exceeded. Please try again later."
}
```

## Property Types

The endpoint supports all Notion property types. Common examples:

### Title
```json
"Title": {
  "title": [{"text": {"content": "Page Title"}}]
}
```

### Rich Text
```json
"Description": {
  "rich_text": [{"text": {"content": "Page description"}}]
}
```

### Select
```json
"Status": {
  "select": {"name": "Active"}
}
```

### Multi-select
```json
"Tags": {
  "multi_select": [
    {"name": "Tag1"},
    {"name": "Tag2"}
  ]
}
```

### Date
```json
"Due Date": {
  "date": {"start": "2025-01-15"}
}
```

### Number
```json
"Priority": {
  "number": 5
}
```

### Checkbox
```json
"Completed": {
  "checkbox": true
}
```

## Usage Examples

### JavaScript (Frontend)
```javascript
async function createNotionPage(databaseId, properties) {
  try {
    const response = await fetch('/api/createPage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        databaseId,
        properties
      })
    });

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.message);
    }
    
    return result.data;
  } catch (error) {
    console.error('Failed to create page:', error);
    throw error;
  }
}

// Example usage
const newPage = await createNotionPage('12345678901234567890123456789012', {
  Title: {
    title: [{ text: { content: 'New Legal Case' } }]
  },
  'Case Number': {
    rich_text: [{ text: { content: 'CASE-2025-001' } }]
  },
  Status: {
    select: { name: 'Active' }
  }
});
```

### cURL
```bash
curl -X POST \
  https://your-app.vercel.app/api/createPage \
  -H 'Content-Type: application/json' \
  -d '{
    "databaseId": "12345678901234567890123456789012",
    "properties": {
      "Title": {
        "title": [{"text": {"content": "Test Case"}}]
      },
      "Case Number": {
        "rich_text": [{"text": {"content": "CASE-2025-001"}}]
      }
    }
  }'
```

## Advanced Features

### Multi-Source Database Support

The endpoint automatically detects and handles multi-source databases (Notion 2025-09-03):

- Attempts to retrieve `data_source_id` from the database
- Falls back gracefully to standard `database_id` if data sources are not available
- Includes `data_source_id` in response when used

### CORS Support

The endpoint includes proper CORS headers for cross-origin requests:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

### Error Handling

Comprehensive error handling covers:
- Input validation
- Notion API errors
- Rate limiting
- Authentication issues
- Network errors

## Integration with Frontend

The endpoint is designed to work seamlessly with the included frontend form. The frontend automatically formats form data into the correct Notion property format before sending to this endpoint.

## Security Notes

- API keys are stored securely on the server side
- No sensitive data is exposed to the client
- Input validation prevents malformed requests
- Proper error handling avoids information disclosure