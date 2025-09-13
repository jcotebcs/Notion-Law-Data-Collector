# AWS Lambda Deployment Guide

This guide provides step-by-step instructions for deploying the Notion Law Data Collector using AWS Lambda functions with Python 3.9+ and GitHub Actions for automated deployment.

## Architecture Overview

The AWS Lambda solution provides a secure, scalable serverless architecture:

```
Frontend (GitHub Pages) → AWS API Gateway → AWS Lambda Functions → AWS Secrets Manager → Notion API
```

### Benefits of AWS Lambda Implementation

- **Enhanced Security**: Notion API tokens stored in AWS Secrets Manager
- **Scalability**: Auto-scaling Lambda functions handle varying loads
- **Cost-Effective**: Pay only for actual function invocations
- **Reliability**: Built-in error handling and retry mechanisms
- **Modern API**: Uses latest Notion API version 2025-09-03 with multi-source database support

## Prerequisites

Before deploying, ensure you have:

1. **AWS Account** with administrative access
2. **GitHub Repository** (this repository)
3. **Notion Integration** and database setup
4. **AWS CLI** installed and configured (for manual setup)

## Step 1: AWS Setup

### 1.1 Create AWS Secrets Manager Secret

Store your Notion API token securely:

```bash
aws secretsmanager create-secret \
  --name "notion-law-collector-api-token" \
  --description "Notion API token for Law Data Collector" \
  --secret-string '{"notion_api_token": "secret_YOUR_NOTION_TOKEN_HERE"}'
```

**Important**: Replace `secret_YOUR_NOTION_TOKEN_HERE` with your actual Notion integration token.

### 1.2 Create IAM Role for Lambda Functions

Create an IAM role with the necessary permissions:

```bash
# Create trust policy
cat > lambda-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name notion-law-collector-lambda-role \
  --assume-role-policy-document file://lambda-trust-policy.json

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name notion-law-collector-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach Secrets Manager policy
cat > secrets-manager-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:notion-law-collector-api-token*"
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name notion-law-collector-secrets-policy \
  --policy-document file://secrets-manager-policy.json

aws iam attach-role-policy \
  --role-name notion-law-collector-lambda-role \
  --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/notion-law-collector-secrets-policy
```

### 1.3 Create GitHub Secrets

Add the following secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | AWS access key for deployment | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `LAMBDA_EXECUTION_ROLE_ARN` | ARN of the Lambda execution role | `arn:aws:iam::123456789012:role/notion-law-collector-lambda-role` |
| `NOTION_API_SECRET_ARN` | ARN of the Secrets Manager secret | `arn:aws:secretsmanager:us-east-1:123456789012:secret:notion-law-collector-api-token-AbCdEf` |

**To get the Secrets Manager ARN:**
```bash
aws secretsmanager describe-secret --secret-id notion-law-collector-api-token --query ARN --output text
```

**To get the IAM Role ARN:**
```bash
aws iam get-role --role-name notion-law-collector-lambda-role --query Role.Arn --output text
```

## Step 2: Automated Deployment with GitHub Actions

### 2.1 Trigger Deployment

The deployment will automatically trigger when you:

1. Push changes to the `main` branch that affect the `lambda/` directory
2. Manually trigger the workflow from GitHub Actions tab

### 2.2 Monitor Deployment

1. Go to your repository's **Actions** tab
2. Click on the latest **"Deploy AWS Lambda Functions"** workflow run
3. Monitor the progress through the following stages:
   - **Test**: Runs unit tests for Lambda functions
   - **Deploy**: Creates/updates Lambda functions in AWS
   - **Cleanup**: Removes temporary build artifacts

### 2.3 Deployment Verification

After successful deployment, you'll have three Lambda functions:

- `notion-law-collector-test-connection`
- `notion-law-collector-create-page`
- `notion-law-collector-query-database`

## Step 3: API Gateway Setup (Optional)

For production use, set up API Gateway to provide REST endpoints:

### 3.1 Create API Gateway

```bash
# Create REST API
aws apigateway create-rest-api \
  --name notion-law-collector-api \
  --description "API for Notion Law Data Collector"

# Note the API ID from the response
API_ID="your-api-id-here"
```

### 3.2 Configure Resources and Methods

```bash
# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[0].id' --output text)

# Create /test-connection resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part test-connection

# Configure GET method for test-connection
# (Repeat similar steps for create-page and query-database)
```

### 3.3 Enable CORS

Configure CORS for all endpoints to allow frontend access.

## Step 4: Frontend Configuration

### 4.1 Update API Endpoints

If using API Gateway, update the frontend to use your API Gateway URLs:

```javascript
// In script.js, update the API base URL
const API_BASE_URL = 'https://your-api-gateway-id.execute-api.us-east-1.amazonaws.com/prod';
```

### 4.2 Direct Lambda Invocation (Alternative)

For direct Lambda invocation (without API Gateway), you can use AWS SDK:

```javascript
// Example using AWS SDK for JavaScript
const lambda = new AWS.Lambda({region: 'us-east-1'});

const params = {
  FunctionName: 'notion-law-collector-test-connection',
  Payload: JSON.stringify({
    httpMethod: 'GET',
    queryStringParameters: {databaseId: 'your-database-id'}
  })
};

lambda.invoke(params, (err, data) => {
  if (err) console.error(err);
  else console.log(JSON.parse(data.Payload));
});
```

## Step 5: Testing

### 5.1 Test Lambda Functions

Test each function individually:

```bash
# Test connection function
aws lambda invoke \
  --function-name notion-law-collector-test-connection \
  --payload '{"httpMethod": "GET", "queryStringParameters": {"databaseId": "40c4cef5c8cd4cb4891a35c3710df6e9"}}' \
  response.json

cat response.json
```

### 5.2 Run Integration Tests

```bash
# Run the test suite
cd tests
python -m pytest test_lambda_functions.py -v
```

## Error Analysis and Troubleshooting

### Common "Unexpected token '<'" Error Causes

This error typically occurs when HTML is returned instead of JSON:

1. **CORS Issues**: 
   - **Solution**: Use the serverless backend instead of direct client calls
   - **Verification**: Check browser dev tools for CORS errors

2. **Incorrect API Endpoint**:
   - **Solution**: Verify the endpoint URL format
   - **Verification**: Ensure using `https://api.notion.com/v1/databases/{id}`

3. **Authentication Failures**:
   - **Solution**: Check Notion API token and integration permissions
   - **Verification**: Test with curl: `curl -H "Authorization: Bearer YOUR_TOKEN" https://api.notion.com/v1/databases/YOUR_DB_ID`

4. **API Version Mismatch**:
   - **Solution**: Ensure using `Notion-Version: 2025-09-03` header
   - **Verification**: Check API documentation for required headers

### Lambda-Specific Troubleshooting

#### 1. Function Not Found
```bash
# Check if function exists
aws lambda get-function --function-name notion-law-collector-test-connection
```

#### 2. Permission Errors
```bash
# Check IAM role has correct permissions
aws iam list-attached-role-policies --role-name notion-law-collector-lambda-role
```

#### 3. Secrets Manager Access Issues
```bash
# Test secret retrieval
aws secretsmanager get-secret-value --secret-id notion-law-collector-api-token
```

#### 4. CloudWatch Logs
```bash
# View function logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/notion-law-collector
```

### Network and Connectivity Issues

1. **Timeout Errors**:
   - Increase Lambda timeout (current: 30 seconds)
   - Check network connectivity from Lambda VPC if applicable

2. **Rate Limiting**:
   - Implement exponential backoff in retry logic
   - Monitor Notion API rate limits

3. **DNS Resolution**:
   - Ensure Lambda can resolve api.notion.com
   - Check VPC configuration if using custom VPC

## Security Best Practices

### 1. Secrets Management
- ✅ Store API tokens in AWS Secrets Manager
- ✅ Use IAM roles with least-privilege access
- ❌ Never hardcode secrets in code or environment variables

### 2. Network Security
- Consider using VPC endpoints for Secrets Manager
- Implement WAF rules for API Gateway if using public endpoints
- Use AWS Certificate Manager for SSL/TLS certificates

### 3. Monitoring and Logging
- Enable CloudWatch Logs for all Lambda functions
- Set up CloudWatch Alarms for error rates and latency
- Implement X-Ray tracing for detailed request monitoring

## Performance Optimization

### 1. Lambda Optimization
- Use appropriate memory allocation (current: 256MB)
- Implement connection pooling for external API calls
- Cache secrets and connections within Lambda execution context

### 2. API Gateway Optimization
- Enable caching for read-heavy operations
- Configure request/response transformations
- Implement throttling to protect backend services

## Cost Management

### 1. Lambda Costs
- Monitor invocation counts and duration
- Optimize memory allocation based on actual usage
- Use Provisioned Concurrency only if needed for consistent performance

### 2. Secrets Manager Costs
- Consolidate secrets where possible
- Monitor secret retrieval frequency
- Consider secret rotation schedules

## Monitoring and Maintenance

### 1. CloudWatch Metrics
Key metrics to monitor:
- Function Duration
- Error Rate
- Invocation Count
- Throttle Count

### 2. Alerts and Notifications
Set up alerts for:
- Function errors > 5%
- Duration > 20 seconds
- Throttle events
- Secrets Manager access failures

### 3. Regular Maintenance
- Update dependencies quarterly
- Review and rotate secrets annually
- Monitor AWS service updates and deprecations
- Test disaster recovery procedures

## Alternative Deployment Methods

### Manual Deployment
For one-time deployments or testing:

```bash
cd lambda
pip install -r requirements.txt -t ./package/
cp *.py ./package/
cd package
zip -r ../deployment.zip .
cd ..

aws lambda create-function \
  --function-name notion-law-collector-test-connection \
  --runtime python3.9 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/notion-law-collector-lambda-role \
  --handler test_connection.lambda_handler \
  --zip-file fileb://deployment.zip
```

### Terraform Deployment
Consider using Terraform for infrastructure as code:

```hcl
resource "aws_lambda_function" "test_connection" {
  filename         = "deployment.zip"
  function_name    = "notion-law-collector-test-connection"
  role            = aws_iam_role.lambda_role.arn
  handler         = "test_connection.lambda_handler"
  runtime         = "python3.9"
  timeout         = 30
  memory_size     = 256
  
  environment {
    variables = {
      NOTION_API_SECRET_ARN = aws_secretsmanager_secret.notion_token.arn
    }
  }
}
```

### AWS SAM Deployment
Use AWS Serverless Application Model for local testing:

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  TestConnectionFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: lambda/
      Handler: test_connection.lambda_handler
      Runtime: python3.9
      Environment:
        Variables:
          NOTION_API_SECRET_ARN: !Ref NotionApiSecret
```

## Support and Troubleshooting

### Getting Help

1. **GitHub Issues**: Report bugs and feature requests
2. **AWS Documentation**: Reference official AWS Lambda and Secrets Manager docs
3. **Notion API Documentation**: Check latest API changes and requirements
4. **CloudWatch Logs**: Review function execution logs for debugging

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|--------|----------|
| Function timeout | Network latency or large responses | Increase timeout or optimize code |
| Memory errors | Insufficient memory allocation | Increase memory size |
| Permission denied | IAM role lacks permissions | Update IAM policies |
| Secret not found | Incorrect ARN or permissions | Verify secret ARN and IAM permissions |
| CORS errors | Missing headers | Ensure proper CORS configuration |

For additional support, please open an issue in the GitHub repository with:
- Error messages and stack traces
- CloudWatch log excerpts
- Steps to reproduce the issue
- Your configuration (excluding sensitive data)