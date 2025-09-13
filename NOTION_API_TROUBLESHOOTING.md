# Notion API Error Analysis and Troubleshooting Guide

## 🔍 Error Analysis: "Unexpected token '<'" Error

### Root Cause Analysis

The error `"Connection failed: Unexpected token '<', '<!DOCTYPE "... is not valid JSON"` occurs when:

1. **HTML Response Instead of JSON**: The client receives an HTML document (likely an error page) instead of the expected JSON response from the Notion API.

2. **Common Causes**:
   - **CORS Restrictions**: Direct browser calls to Notion API are blocked by CORS policy
   - **Invalid Authentication**: Missing or incorrect `Authorization` header
   - **Wrong API Endpoint**: Using incorrect URL or API version
   - **Missing Required Headers**: Notion API requires specific headers including `Notion-Version`
   - **Network Issues**: DNS resolution problems or network connectivity issues

### Detailed Diagnosis Steps

#### 1. Endpoint Verification
```bash
# Correct Notion API endpoint format
curl -X GET "https://api.notion.com/v1/databases/40c4cef5c8cd4cb4891a35c3710df6e9/query" \
  -H "Authorization: Bearer YOUR_NOTION_TOKEN" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -v
```

**Common Issues**:
- Using `http://` instead of `https://`
- Missing `/v1` in the URL path
- Incorrect database ID format
- Wrong HTTP method for the operation

#### 2. HTTP Headers Validation

**Required Headers for Notion API**:
```javascript
{
  "Authorization": "Bearer secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "Notion-Version": "2025-09-03",
  "Content-Type": "application/json"
}
```

**Validation Checklist**:
- ✅ `Authorization` header starts with "Bearer "
- ✅ Token is valid and has not expired
- ✅ `Notion-Version` matches the current API version (2025-09-03)
- ✅ `Content-Type` is set to "application/json"

#### 3. CORS Issue Detection

**Browser Console Error Examples**:
```
Access to fetch at 'https://api.notion.com/v1/databases/...' from origin 'https://yoursite.com' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Solution**: Use the serverless proxy (Lambda function) instead of direct API calls.

#### 4. Authentication Troubleshooting

**Token Validation**:
```bash
# Test your token
curl -X GET "https://api.notion.com/v1/users/me" \
  -H "Authorization: Bearer YOUR_NOTION_TOKEN" \
  -H "Notion-Version: 2025-09-03"
```

**Common Authentication Issues**:
- Token not shared with the specific database
- Token has insufficient permissions
- Token format is incorrect (missing `secret_` prefix)
- Integration not properly configured in Notion

#### 5. Network Debugging

**Complete Request/Response Analysis**:
```bash
# Detailed network trace
curl -X GET "https://api.notion.com/v1/databases/40c4cef5c8cd4cb4891a35c3710df6e9/query" \
  -H "Authorization: Bearer YOUR_NOTION_TOKEN" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\nDNS Lookup: %{time_namelookup}s\n" \
  -v
```

## 🛠️ Lambda Function Troubleshooting

### Common Lambda Deployment Issues

#### 1. IAM Permission Errors

**Error**: `User: arn:aws:iam::ACCOUNT:user/USERNAME is not authorized to perform: lambda:CreateFunction`

**Solution**:
```bash
# Ensure your AWS user has the necessary policies:
# - AWSLambdaFullAccess (or custom policy with lambda:* permissions)
# - IAMFullAccess (for creating execution roles)
# - SecretsManagerReadWrite (for managing secrets)
```

#### 2. Secrets Manager Access Issues

**Error**: `An error occurred (AccessDenied) when calling the GetSecretValue operation`

**Solution**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:notion-api-token-*"
    }
  ]
}
```

#### 3. Lambda Package Size Issues

**Error**: `RequestEntityTooLargeException: Request must be smaller than 69905067 bytes`

**Solutions**:
```bash
# Optimize package size
pip install --target ./package --upgrade --only-binary=all --no-cache-dir requests boto3 urllib3

# Remove unnecessary files
find ./package -type d -name "__pycache__" -exec rm -rf {} +
find ./package -type f -name "*.pyc" -delete
find ./package -type d -name "*.dist-info" -exec rm -rf {} +
```

#### 4. Function URL CORS Issues

**Error**: CORS errors when calling Lambda function URL

**Solution**:
```bash
# Update CORS configuration
aws lambda update-function-url-config \
  --function-name notion-api-proxy \
  --cors AllowCredentials=false,AllowHeaders=["*"],AllowMethods=["*"],AllowOrigins=["*"],MaxAge=3600
```

### Lambda Function Logging and Monitoring

#### CloudWatch Logs Analysis

**Access logs**:
```bash
# View recent logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/notion-api-proxy"

# Get log events
aws logs get-log-events \
  --log-group-name "/aws/lambda/notion-api-proxy" \
  --log-stream-name "LATEST_STREAM_NAME"
```

**Common Log Patterns**:
- `ERROR: Failed to retrieve secret`: Secrets Manager access issue
- `Unexpected error in lambda_handler`: General application error
- `Authentication configuration error`: Missing environment variables

#### Performance Monitoring

**Key Metrics to Monitor**:
- Duration: Function execution time
- Error Rate: Percentage of failed invocations
- Throttles: Rate limiting by AWS
- Memory Usage: Memory consumption patterns

## 🔧 GitHub Actions Troubleshooting

### Common CI/CD Issues

#### 1. AWS Credentials Configuration

**Error**: `Unable to locate credentials. You can configure credentials by running "aws configure"`

**Solution**:
```yaml
# Ensure these secrets are set in GitHub repository settings:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY

# Verify in workflow:
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1
```

#### 2. Lambda Function Creation Failures

**Error**: `The role defined for the function cannot be assumed by Lambda`

**Solution**:
```bash
# Wait for role propagation
sleep 10

# Verify role trust policy
aws iam get-role --role-name notion-api-proxy-execution-role --query Role.AssumeRolePolicyDocument
```

#### 3. Package Upload Failures

**Error**: `An error occurred (RequestEntityTooLargeException) when calling the CreateFunction operation`

**Solution**:
```bash
# Use S3 for large packages
aws s3 cp lambda-function.zip s3://your-deployment-bucket/lambda-function.zip
aws lambda create-function \
  --function-name notion-api-proxy \
  --code S3Bucket=your-deployment-bucket,S3Key=lambda-function.zip \
  # ... other parameters
```

## 🔐 Security Best Practices

### Token Management

1. **Never hardcode tokens**:
   ```python
   # ❌ Wrong
   notion_token = "secret_abc123"
   
   # ✅ Correct
   notion_token = get_secret(os.environ['NOTION_API_SECRET_ARN'])
   ```

2. **Rotate tokens regularly**:
   ```bash
   # Update secret in AWS Secrets Manager
   aws secretsmanager update-secret \
     --secret-id notion-api-token \
     --secret-string "new_secret_token_value"
   ```

3. **Use least privilege IAM policies**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "secretsmanager:GetSecretValue"
         ],
         "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:notion-api-token-*"
       }
     ]
   }
   ```

### Network Security

1. **Implement rate limiting**:
   ```python
   import time
   from functools import wraps
   
   def rate_limit(calls_per_minute=60):
       def decorator(func):
           @wraps(func)
           def wrapper(*args, **kwargs):
               # Implementation of rate limiting logic
               return func(*args, **kwargs)
           return wrapper
       return decorator
   ```

2. **Validate input data**:
   ```python
   def validate_database_id(db_id):
       if not re.match(r'^[a-f0-9]{32}$', db_id.replace('-', '')):
           raise ValueError("Invalid database ID format")
   ```

## 🚨 Common Error Scenarios and Solutions

### Scenario 1: "Invalid token" Error

**Symptoms**:
- HTTP 401 Unauthorized
- Error message: "API token is invalid"

**Solutions**:
1. Verify token format (should start with `secret_`)
2. Check if integration is shared with the database
3. Ensure token hasn't expired
4. Recreate integration if necessary

### Scenario 2: "Rate limit exceeded" Error

**Symptoms**:
- HTTP 429 Too Many Requests
- Frequent timeout errors

**Solutions**:
1. Implement exponential backoff:
   ```python
   import time
   import random
   
   def retry_with_backoff(func, max_retries=3):
       for attempt in range(max_retries):
           try:
               return func()
           except Exception as e:
               if attempt == max_retries - 1:
                   raise e
               wait_time = (2 ** attempt) + random.uniform(0, 1)
               time.sleep(wait_time)
   ```

2. Cache responses when possible
3. Batch API calls efficiently

### Scenario 3: Lambda Cold Start Issues

**Symptoms**:
- First request takes significantly longer
- Timeout on initial invocations

**Solutions**:
1. Increase timeout and memory:
   ```bash
   aws lambda update-function-configuration \
     --function-name notion-api-proxy \
     --timeout 60 \
     --memory-size 512
   ```

2. Implement connection pooling
3. Use provisioned concurrency for critical applications

## 📊 Testing and Validation

### Unit Testing Checklist

- [ ] Token retrieval from Secrets Manager
- [ ] Notion API request formatting
- [ ] Error handling for various HTTP status codes
- [ ] CORS header validation
- [ ] Request body parsing
- [ ] Response formatting

### Integration Testing

```bash
# Test complete flow
curl -X POST "https://LAMBDA_FUNCTION_URL/databases/40c4cef5c8cd4cb4891a35c3710df6e9/query" \
  -H "Content-Type: application/json" \
  -d '{
    "page_size": 10
  }' \
  -v
```

### Load Testing

```python
import concurrent.futures
import requests
import time

def test_lambda_endpoint():
    response = requests.get("https://LAMBDA_FUNCTION_URL/databases/40c4cef5c8cd4cb4891a35c3710df6e9/query")
    return response.status_code

# Run concurrent tests
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(test_lambda_endpoint) for _ in range(100)]
    results = [future.result() for future in concurrent.futures.as_completed(futures)]

print(f"Success rate: {results.count(200) / len(results) * 100}%")
```

## 🎯 Performance Optimization

### Lambda Optimization

1. **Memory vs. CPU allocation**:
   - More memory = more CPU power
   - Test different memory settings (128MB to 3008MB)

2. **Connection reuse**:
   ```python
   # Global connection pool (persists across invocations)
   http = urllib3.PoolManager(
       maxsize=10,
       timeout=30,
       retries=urllib3.util.Retry(total=3, backoff_factor=0.1)
   )
   ```

3. **Environment variable caching**:
   ```python
   # Cache environment variables
   CACHED_SECRET_ARN = os.environ.get('NOTION_API_SECRET_ARN')
   ```

### Notion API Optimization

1. **Use appropriate page sizes**:
   ```python
   # Balance between API calls and memory usage
   optimal_page_size = min(requested_size, 100)  # Notion API limit
   ```

2. **Implement smart caching**:
   ```python
   # Cache responses based on content hash
   import hashlib
   
   def get_cache_key(endpoint, params):
       content = f"{endpoint}:{sorted(params.items())}"
       return hashlib.md5(content.encode()).hexdigest()
   ```

This comprehensive troubleshooting guide should help identify and resolve most issues with the Notion API Lambda integration.