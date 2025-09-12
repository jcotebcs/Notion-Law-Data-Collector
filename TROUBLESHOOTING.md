# Troubleshooting Guide for Notion Law Data Collector

This guide helps you diagnose and fix common issues with the Notion Law Data Collector application.

## Common Errors and Solutions

### 1. "Unexpected token '<', '<!DOCTYPE'..." Error

**Error Message**: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

**Cause**: The application is receiving an HTML response instead of JSON from the Notion API.

**Solutions**:

#### Check API Key Configuration
```bash
# Verify your API key is set correctly
echo $NOTION_API_KEY

# API key should start with 'secret_'
# Example: secret_abc123def456...
```

**Common API Key Issues**:
- API key not set in environment variables
- API key doesn't start with `secret_`
- API key has been regenerated but not updated
- API key has expired or been revoked

#### Verify Database Configuration
```bash
# Test database access manually
curl -X GET \
  "https://api.notion.com/v1/databases/YOUR_DATABASE_ID" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json"
```

**Common Database Issues**:
- Database ID is incorrect (should be exactly 32 hexadecimal characters)
- Database is not shared with your integration
- Integration lacks read permissions
- Database has been deleted or moved

#### Check Network and Endpoints
```bash
# Test basic connectivity to Notion API
curl -I https://api.notion.com/v1/users/me \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Notion-Version: 2022-06-28"
```

**Common Network Issues**:
- Firewall blocking requests to api.notion.com
- Corporate proxy interfering with HTTPS requests
- DNS resolution issues
- Rate limiting by Notion API

### 2. Authentication Errors

**Error Message**: `Authentication failed. Please verify your NOTION_API_KEY`

**Solutions**:

1. **Check API Key Format**:
   ```javascript
   // Valid format
   NOTION_API_KEY=secret_abc123def456ghi789...
   
   // Invalid formats
   NOTION_API_KEY=abc123def456...  // Missing 'secret_' prefix
   NOTION_API_KEY=Bearer secret_... // Extra 'Bearer' prefix
   ```

2. **Regenerate API Key**:
   - Go to [Notion Integrations](https://www.notion.so/my-integrations)
   - Find your integration
   - Click "Show" then "Regenerate"
   - Update your environment variables

3. **Check Integration Status**:
   - Ensure integration is active
   - Verify workspace permissions
   - Check if integration was accidentally disabled

### 3. Database Access Errors

**Error Message**: `Database not found or integration lacks access`

**Solutions**:

1. **Verify Database ID**:
   ```javascript
   // Extract from Notion URL
   // https://notion.so/workspace/DATABASE_ID?v=...
   //                     ^^^^^^^^^^^^^^^^
   //                     This is your database ID
   
   // Should be 32 characters: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```

2. **Share Database with Integration**:
   - Open your database in Notion
   - Click the "Share" button
   - Click "Invite" and search for your integration name
   - Give it "Edit" permissions

3. **Verify Database Structure**:
   - Ensure required properties exist
   - Check property types match expectations
   - Verify database is not archived

### 4. Rate Limiting Issues

**Error Message**: `Rate limit exceeded. Please wait before making more requests`

**Solutions**:

1. **Implement Backoff Strategy**:
   ```javascript
   // Add delay between requests
   const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
   await delay(1000); // Wait 1 second
   ```

2. **Check Request Frequency**:
   - Notion API allows ~3 requests per second
   - Batch operations when possible
   - Implement exponential backoff

3. **Monitor Usage**:
   - Check server logs for request patterns
   - Implement request queuing
   - Add request caching where appropriate

### 5. Deployment Issues

#### Vercel Deployment

**Common Issues**:
- Environment variables not set in Vercel dashboard
- Function timeout (default 10s, max 60s for Pro)
- Cold start latency

**Solutions**:
```bash
# Set environment variables
vercel env add NOTION_API_KEY

# Increase timeout in vercel.json
{
  "functions": {
    "api/*.js": {
      "maxDuration": 30
    }
  }
}
```

#### AWS Lambda Deployment

**Common Issues**:
- IAM permissions missing
- Environment variables not configured
- Package size too large

**Solutions**:
```bash
# Check function configuration
aws lambda get-function-configuration \
  --function-name notion-law-data-collector

# Update environment variables
aws lambda update-function-configuration \
  --function-name notion-law-data-collector \
  --environment Variables="{NOTION_API_KEY=secret_...}"
```

#### Google Cloud Functions

**Common Issues**:
- Service account permissions
- Runtime version mismatch
- Memory/timeout limits

**Solutions**:
```bash
# Deploy with specific configuration
gcloud functions deploy notion-law-data-collector \
  --runtime nodejs18 \
  --memory 512MB \
  --timeout 60s \
  --set-env-vars NOTION_API_KEY=secret_...
```

## Debugging Steps

### 1. Enable Debug Logging

Set `NODE_ENV=development` to enable detailed error messages:

```bash
export NODE_ENV=development
npm start
```

This will show:
- Full error stack traces
- Request/response details
- API call logging
- Troubleshooting suggestions

### 2. Test Individual Components

**Test API Key**:
```bash
curl -X GET "http://localhost:3000/health"
```

**Test Database Connection**:
```bash
curl -X GET "http://localhost:3000/api/testConnection?databaseId=YOUR_DB_ID"
```

**Test Page Creation**:
```bash
curl -X POST "http://localhost:3000/api/createPage" \
  -H "Content-Type: application/json" \
  -d '{
    "databaseId": "YOUR_DB_ID",
    "properties": {
      "Title": {
        "title": [{"text": {"content": "Test Case"}}]
      }
    }
  }'
```

### 3. Check Server Logs

**Local Development**:
```bash
npm start
# Check console output for errors
```

**Vercel**:
```bash
vercel logs
```

**AWS Lambda**:
```bash
aws logs tail /aws/lambda/notion-law-data-collector --follow
```

**Google Cloud Functions**:
```bash
gcloud functions logs read notion-law-data-collector --limit=50
```

## Performance Optimization

### 1. Database Query Optimization

- Use proper filtering to reduce response size
- Implement pagination for large datasets
- Cache frequently accessed data

### 2. API Request Optimization

- Batch multiple operations when possible
- Implement request deduplication
- Use appropriate timeout values

### 3. Error Handling Optimization

- Implement exponential backoff for retries
- Add circuit breaker pattern for failing services
- Log errors with sufficient context

## Security Best Practices

### 1. API Key Management

- Never commit API keys to code
- Use environment variables or secret managers
- Rotate API keys regularly
- Monitor API key usage

### 2. Input Validation

- Validate all user inputs
- Sanitize database IDs
- Check request size limits
- Implement rate limiting

### 3. Error Information

- Don't expose sensitive information in errors
- Log detailed errors server-side only
- Provide helpful but safe error messages to users

## Monitoring and Alerts

### 1. Health Checks

Set up monitoring for:
- API endpoint availability
- Response time metrics
- Error rate thresholds
- Resource usage limits

### 2. Alert Configuration

**Recommended Alerts**:
- High error rate (>5% in 5 minutes)
- Slow response times (>30 seconds)
- Authentication failures
- Rate limit hits

### 3. Logging Best Practices

```javascript
// Example structured logging
console.log('API Request', {
  method: req.method,
  path: req.path,
  databaseId: req.body.databaseId,
  timestamp: new Date().toISOString(),
  requestId: req.headers['x-request-id']
});
```

## Getting Help

If you're still experiencing issues:

1. **Check the GitHub Issues**: Look for similar problems and solutions
2. **Enable Debug Mode**: Set `NODE_ENV=development` for detailed error info
3. **Collect Information**: Gather error messages, logs, and configuration details
4. **Test Components**: Isolate the problem to specific functionality
5. **Create Minimal Reproduction**: Provide steps to reproduce the issue

### Information to Include in Bug Reports

- Error messages (full text)
- Environment details (Node.js version, deployment platform)
- Configuration (without sensitive data)
- Steps to reproduce
- Expected vs actual behavior
- Logs and stack traces

### Useful Commands for Bug Reports

```bash
# System information
node --version
npm --version
curl --version

# Application information
npm list --depth=0
npm audit

# Network connectivity
curl -I https://api.notion.com
dig api.notion.com

# Environment check
env | grep -E "(NODE_|NOTION_|VERCEL_)" | sed 's/secret_.*/secret_[REDACTED]/'
```