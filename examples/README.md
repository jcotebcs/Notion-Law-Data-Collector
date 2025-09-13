# Example Integration for AWS Lambda Backend

This directory contains examples of how to integrate with the AWS Lambda backend.

## Basic Lambda Function Testing

```bash
# Test all Lambda functions
./scripts/test-lambda-functions.sh

# Test specific function manually
aws lambda invoke \
  --function-name notion-law-collector-test-connection \
  --payload '{"httpMethod": "GET", "queryStringParameters": {"databaseId": "YOUR_DATABASE_ID"}}' \
  response.json
```

## Frontend Integration Examples

### Using API Gateway (Recommended for Production)

```javascript
// Configure API Gateway endpoint
const API_BASE_URL = 'https://your-api-id.execute-api.us-east-1.amazonaws.com/prod';

// Test connection
async function testConnection(databaseId) {
  const response = await fetch(`${API_BASE_URL}/test-connection?databaseId=${databaseId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
}

// Create page
async function createPage(databaseId, properties) {
  const response = await fetch(`${API_BASE_URL}/create-page`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      databaseId: databaseId,
      properties: properties
    })
  });
  
  return await response.json();
}
```

### Using Direct Lambda Invocation

```javascript
// Requires AWS SDK for JavaScript
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({region: 'us-east-1'});

async function invokeLambda(functionName, payload) {
  const params = {
    FunctionName: functionName,
    Payload: JSON.stringify(payload)
  };
  
  const result = await lambda.invoke(params).promise();
  return JSON.parse(result.Payload);
}

// Example usage
const result = await invokeLambda('notion-law-collector-test-connection', {
  httpMethod: 'GET',
  queryStringParameters: {
    databaseId: 'your-database-id'
  }
});
```

## Error Handling Examples

### Handling Common Errors

```javascript
async function handleApiCall(apiFunction) {
  try {
    const result = await apiFunction();
    
    if (result.error) {
      throw new Error(result.message);
    }
    
    return result.data;
    
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('401')) {
      console.error('Authentication error: Check your Notion API token');
    } else if (error.message.includes('404')) {
      console.error('Database not found: Check database ID and permissions');
    } else if (error.message.includes('429')) {
      console.error('Rate limit exceeded: Wait before retrying');
    } else {
      console.error('Unexpected error:', error.message);
    }
    
    throw error;
  }
}
```

### Retry Logic with Exponential Backoff

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Usage
const result = await retryWithBackoff(() => testConnection(databaseId));
```

## Monitoring and Logging

### CloudWatch Logs

```bash
# View recent logs
aws logs describe-log-streams \
  --log-group-name /aws/lambda/notion-law-collector-test-connection \
  --order-by LastEventTime \
  --descending \
  --max-items 5

# Get specific log events
aws logs get-log-events \
  --log-group-name /aws/lambda/notion-law-collector-test-connection \
  --log-stream-name "LATEST_STREAM_NAME"
```

### Custom Metrics

```javascript
// Add custom metrics to your Lambda functions
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

async function publishMetric(metricName, value, unit = 'Count') {
  const params = {
    Namespace: 'NotionLawCollector',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date()
    }]
  };
  
  await cloudwatch.putMetricData(params).promise();
}
```

## Security Best Practices

### Environment Variables

```javascript
// Always use environment variables for sensitive data
const NOTION_API_SECRET_ARN = process.env.NOTION_API_SECRET_ARN;
const AWS_REGION = process.env.AWS_DEFAULT_REGION || 'us-east-1';

// Never hardcode secrets
// ❌ BAD
const token = 'secret_hardcoded_token';

// ✅ GOOD
const token = await getSecretFromSecretsManager(NOTION_API_SECRET_ARN);
```

### Input Validation

```javascript
function validateDatabaseId(databaseId) {
  if (!databaseId) {
    throw new Error('Database ID is required');
  }
  
  const cleanId = databaseId.replace(/-/g, '').toLowerCase();
  
  if (cleanId.length !== 32 || !/^[a-f0-9]{32}$/.test(cleanId)) {
    throw new Error('Invalid database ID format');
  }
  
  return cleanId;
}
```

## Performance Optimization

### Connection Reuse

```javascript
// Reuse connections within Lambda execution context
let notionClient;

function getNotionClient() {
  if (!notionClient) {
    notionClient = new NotionClient();
  }
  return notionClient;
}
```

### Caching

```javascript
// Cache secrets within execution context
let cachedToken;

async function getNotionToken() {
  if (!cachedToken) {
    cachedToken = await retrieveFromSecretsManager();
  }
  return cachedToken;
}
```

## Testing Examples

### Unit Tests

```javascript
const { testConnection } = require('./lambda/test_connection');

describe('Test Connection Lambda', () => {
  test('should return 400 for missing database ID', async () => {
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {}
    };
    
    const result = await testConnection.lambda_handler(event, {});
    
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe(true);
  });
});
```

### Integration Tests

```javascript
async function integrationTest() {
  const databaseId = 'your-test-database-id';
  
  // Test connection
  const connectionResult = await testConnection(databaseId);
  console.assert(connectionResult.error === false, 'Connection test failed');
  
  // Test page creation
  const pageResult = await createPage(databaseId, {
    Title: {
      title: [{ text: { content: 'Integration Test Case' } }]
    }
  });
  console.assert(pageResult.error === false, 'Page creation failed');
  
  // Test querying
  const queryResult = await queryDatabase(databaseId, { page_size: 1 });
  console.assert(queryResult.error === false, 'Database query failed');
  
  console.log('All integration tests passed!');
}
```