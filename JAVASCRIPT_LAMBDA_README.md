# JavaScript AWS Lambda Handlers for Notion API

This directory contains JavaScript implementations of AWS Lambda handlers that serve as a proxy for the Notion API, providing CORS support and secure token management for client-side applications.

## Files Overview

### Main Handlers

- **`lambda-handler.js`** - Main Lambda handler that can handle multiple endpoints
- **`lambda-test-connection.js`** - Standalone handler for testing database connections
- **`lambda-create-page.js`** - Standalone handler for creating pages in Notion databases
- **`lambda-query-database.js`** - Standalone handler for querying Notion databases

### Testing

- **`test-lambda-handlers.js`** - Basic validation tests for all handlers

## Features

### ✅ Comprehensive Error Handling
- Input validation (database ID format, required fields)
- Proper HTTP status codes
- Detailed error messages for debugging

### ✅ CORS Support
- Handles preflight OPTIONS requests
- Configurable CORS headers for cross-origin requests
- Supports all necessary HTTP methods

### ✅ Security
- AWS Secrets Manager integration for secure token storage
- Environment variable configuration
- No hardcoded credentials

### ✅ API Compatibility
- Full support for Notion API v2025-09-03
- Data source ID management and caching
- Automatic metadata injection

## Handler Functions

### Test Connection Handler
**File**: `lambda-test-connection.js`  
**Method**: GET  
**Purpose**: Tests connectivity and permissions for a Notion database

**Event Format**:
```json
{
  "httpMethod": "GET",
  "queryStringParameters": {
    "databaseId": "32-character-hex-string"
  }
}
```

**Response**: Database information including properties, data sources, and connection status.

### Create Page Handler
**File**: `lambda-create-page.js`  
**Method**: POST  
**Purpose**: Creates a new page in a Notion database

**Event Format**:
```json
{
  "httpMethod": "POST",
  "body": "{\"databaseId\": \"...\", \"properties\": {...}}"
}
```

**Response**: Created page information including ID, URL, and metadata.

### Query Database Handler
**File**: `lambda-query-database.js`  
**Method**: POST  
**Purpose**: Queries a Notion database with filtering, sorting, and pagination

**Event Format**:
```json
{
  "httpMethod": "POST",
  "body": "{\"databaseId\": \"...\", \"sorts\": [...], \"filter\": {...}, \"page_size\": 10}"
}
```

**Response**: Query results with processed property values and pagination info.

## Configuration

### Environment Variables
- `NOTION_API_SECRET_ARN` - ARN of the AWS Secrets Manager secret containing the Notion API token
- `AWS_DEFAULT_REGION` - AWS region (defaults to 'us-east-1')

### Secrets Manager Format
The secret should contain a JSON object:
```json
{
  "notion_api_token": "secret_your_notion_api_token_here"
}
```

## Dependencies

- `@aws-sdk/client-secrets-manager` - AWS SDK for Secrets Manager
- `axios` - HTTP client for Notion API requests

## Deployment

### AWS Lambda Deployment
1. Package the handlers with dependencies
2. Configure environment variables
3. Set up IAM roles with Secrets Manager permissions
4. Deploy using AWS CLI, CDK, or CloudFormation

### Example AWS CLI Deployment
```bash
# Package the function
zip -r lambda-function.zip lambda-test-connection.js node_modules/

# Create/update the function
aws lambda create-function \
  --function-name notion-law-collector-test-connection \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --handler lambda-test-connection.handler \
  --zip-file fileb://lambda-function.zip \
  --environment Variables="{NOTION_API_SECRET_ARN=arn:aws:secretsmanager:...}"
```

## Testing

### Local Testing
Run the basic validation tests:
```bash
node test-lambda-handlers.js
```

### AWS Testing
Use the provided test script:
```bash
./scripts/test-lambda-functions.sh
```

## API Compatibility

These handlers are compatible with:
- **Python Lambda handlers** - Same event format and response structure
- **Node.js API handlers** - Can be used as drop-in replacements for Vercel deployments
- **Frontend applications** - Provides the same interface as the Python implementation

## Error Handling

All handlers return consistent error responses:
```json
{
  "error": "Error type",
  "details": "Detailed error message"
}
```

Common error scenarios:
- `400` - Invalid input (missing parameters, invalid format)
- `401` - Authentication failure
- `404` - Database not found or no access
- `405` - Method not allowed
- `500` - Internal server error

## Performance Considerations

- **Connection Caching**: Data source IDs are cached in memory during Lambda container lifetime
- **Cold Start**: First request may be slower due to AWS SDK initialization
- **Memory Usage**: Recommended 256MB for optimal performance

## Differences from Python Implementation

While functionally equivalent, the JavaScript handlers:
- Use ES modules instead of CommonJS
- Use axios instead of urllib3
- Use AWS SDK v3 instead of boto3
- Include more detailed property processing in query results

## Next Steps

1. Deploy handlers to AWS Lambda
2. Configure API Gateway (optional) for HTTP endpoints
3. Test with actual Notion databases
4. Monitor performance and adjust memory allocation
5. Set up CloudWatch alerts for error monitoring