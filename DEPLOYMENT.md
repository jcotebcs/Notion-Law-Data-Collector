# Serverless Deployment Guide

This guide walks you through deploying the Notion Law Data Collector using GitHub Actions to various serverless platforms.

## Prerequisites

1. **GitHub Repository**: Fork or clone this repository
2. **Notion Integration**: Create a Notion integration and get your API key
3. **Cloud Provider Account**: Choose one or more deployment targets

## Deployment Options

### 1. Vercel (Recommended for Beginners)

Vercel provides the easiest deployment experience with automatic builds and deployments.

#### Setup Steps

1. **Create Vercel Account**:
   - Visit [vercel.com](https://vercel.com)
   - Sign up with GitHub account

2. **Get Vercel Tokens**:
   ```bash
   # Install Vercel CLI
   npm install -g vercel

   # Login and get tokens
   vercel login
   vercel whoami
   ```

3. **Configure GitHub Secrets**:
   Go to your GitHub repository → Settings → Secrets and variables → Actions
   
   Add these secrets:
   ```
   VERCEL_TOKEN=your_vercel_token
   VERCEL_ORG_ID=your_org_id
   VERCEL_PROJECT_ID=your_project_id
   NOTION_API_KEY=secret_your_notion_key
   ```

4. **Deploy**:
   Push to main branch or manually trigger the workflow in GitHub Actions.

#### Configuration Files

**vercel.json** (already included):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/*.js",
      "use": "@vercel/node"
    },
    {
      "src": "*.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "functions": {
    "api/*.js": {
      "maxDuration": 30
    }
  }
}
```

### 2. AWS Lambda

AWS Lambda provides scalable serverless compute with pay-per-request pricing.

#### Setup Steps

1. **Create AWS Account**:
   - Visit [aws.amazon.com](https://aws.amazon.com)
   - Create account and set up billing

2. **Create IAM User**:
   ```bash
   # Create IAM user with programmatic access
   aws iam create-user --user-name github-actions-deployer
   
   # Attach necessary policies
   aws iam attach-user-policy \
     --user-name github-actions-deployer \
     --policy-arn arn:aws:iam::aws:policy/AWSLambda_FullAccess
   
   # Create access key
   aws iam create-access-key --user-name github-actions-deployer
   ```

3. **Create Execution Role**:
   ```bash
   # Create execution role for Lambda
   aws iam create-role \
     --role-name lambda-execution-role \
     --assume-role-policy-document '{
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Principal": {"Service": "lambda.amazonaws.com"},
           "Action": "sts:AssumeRole"
         }
       ]
     }'
   
   # Attach basic execution policy
   aws iam attach-role-policy \
     --role-name lambda-execution-role \
     --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
   ```

4. **Configure GitHub Secrets**:
   ```
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_ACCOUNT_ID=your_12_digit_account_id
   NOTION_API_KEY=secret_your_notion_key
   ```

5. **Deploy**:
   Push to main branch to trigger the AWS Lambda deployment workflow.

#### Advanced Configuration

**Custom SAM Template** (optional):
```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  NotionLawCollectorFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: .
      Handler: lambda.handler
      Runtime: nodejs18.x
      Timeout: 30
      MemorySize: 512
      Environment:
        Variables:
          NOTION_API_KEY: !Ref NotionApiKey
          NODE_ENV: production
      Events:
        Api:
          Type: Api
          Properties:
            Path: /{proxy+}
            Method: ANY

Parameters:
  NotionApiKey:
    Type: String
    NoEcho: true
```

### 3. Google Cloud Functions

Google Cloud Functions provides serverless compute integrated with Google Cloud ecosystem.

#### Setup Steps

1. **Create Google Cloud Project**:
   - Visit [console.cloud.google.com](https://console.cloud.google.com)
   - Create new project
   - Enable Cloud Functions API

2. **Create Service Account**:
   ```bash
   # Create service account
   gcloud iam service-accounts create github-deployer \
     --display-name="GitHub Actions Deployer"
   
   # Grant necessary roles
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/cloudfunctions.admin"
   
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountUser"
   
   # Create and download service account key
   gcloud iam service-accounts keys create service-account-key.json \
     --iam-account=github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

3. **Configure GitHub Secrets**:
   ```
   GCP_SERVICE_ACCOUNT_KEY=contents_of_service_account_key_json
   GCP_PROJECT_ID=your_project_id
   NOTION_API_KEY=secret_your_notion_key
   ```

4. **Deploy**:
   Push to main branch to trigger the Google Cloud Functions deployment workflow.

## Environment Variables

All deployment methods require these environment variables:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NOTION_API_KEY` | Your Notion integration token | Yes | `secret_abc123...` |
| `NODE_ENV` | Environment mode | No | `production` |

### Setting Environment Variables

**Vercel**:
```bash
vercel env add NOTION_API_KEY
vercel env add NODE_ENV
```

**AWS Lambda**:
```bash
aws lambda update-function-configuration \
  --function-name notion-law-data-collector \
  --environment Variables="{NOTION_API_KEY=secret_...,NODE_ENV=production}"
```

**Google Cloud Functions**:
```bash
gcloud functions deploy notion-law-data-collector \
  --set-env-vars NOTION_API_KEY=secret_...,NODE_ENV=production
```

## Workflow Configuration

### Customizing Deployment Workflows

The GitHub Actions workflows are located in `.github/workflows/`:

- `deploy-vercel.yml` - Vercel deployment
- `deploy-aws-lambda.yml` - AWS Lambda deployment
- `deploy-gcp.yml` - Google Cloud Functions deployment

#### Common Customizations

**Change deployment branch**:
```yaml
on:
  push:
    branches: [ main, staging, production ]  # Add your branches
```

**Add environment-specific deployments**:
```yaml
jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/staging'
    # ... staging deployment steps
    
  deploy-production:
    if: github.ref == 'refs/heads/main'
    # ... production deployment steps
```

**Add manual deployment trigger**:
```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
```

### Enabling Workflows

1. **Fork the repository** to your GitHub account
2. **Enable GitHub Actions** in your repository settings
3. **Add required secrets** (see platform-specific sections above)
4. **Push to main branch** or manually trigger workflows

### Monitoring Deployments

**GitHub Actions Dashboard**:
- Go to your repository → Actions tab
- View workflow runs and logs
- Check deployment status and errors

**Platform-Specific Monitoring**:

**Vercel**:
- Dashboard: [vercel.com/dashboard](https://vercel.com/dashboard)
- Real-time logs and analytics

**AWS Lambda**:
```bash
# View function logs
aws logs tail /aws/lambda/notion-law-data-collector --follow

# Get function info
aws lambda get-function --function-name notion-law-data-collector
```

**Google Cloud Functions**:
```bash
# View function logs
gcloud functions logs read notion-law-data-collector --limit=50

# Get function info
gcloud functions describe notion-law-data-collector
```

## Testing Deployments

### Automated Testing

All workflows include automated testing:

1. **Unit Tests**: Test utility functions and error handling
2. **Integration Tests**: Test API endpoints
3. **Security Scans**: Check for vulnerabilities
4. **Deployment Tests**: Verify deployed function works

### Manual Testing

After deployment, test these endpoints:

```bash
# Replace YOUR_DEPLOYMENT_URL with actual URL

# Health check
curl "https://YOUR_DEPLOYMENT_URL/health"

# API test (should return error without valid database ID)
curl "https://YOUR_DEPLOYMENT_URL/api/testConnection?databaseId=invalid"

# Full test with valid database ID
curl "https://YOUR_DEPLOYMENT_URL/api/testConnection?databaseId=YOUR_DB_ID"
```

## Troubleshooting Deployments

### Common Issues

**Secret Not Found**:
- Verify secret names match exactly
- Check secret values are correct
- Ensure secrets are accessible to the workflow

**Permission Denied**:
- Check IAM roles and permissions
- Verify service account has necessary access
- Review cloud provider documentation

**Deployment Timeout**:
- Increase timeout values in workflow
- Check for network connectivity issues
- Review function memory and CPU limits

**Function Not Working**:
- Check function logs for errors
- Verify environment variables are set
- Test individual components

### Getting Help

1. **Check Workflow Logs**: GitHub Actions tab shows detailed logs
2. **Review Platform Docs**: Each cloud provider has extensive documentation
3. **Test Locally**: Reproduce issues in local development
4. **Check Issues**: Look for similar problems in repository issues

### Useful Debugging Commands

```bash
# Test GitHub Actions locally (using act)
npm install -g @github/act
act -n  # Dry run
act     # Run workflows locally

# Validate workflow syntax
yamllint .github/workflows/*.yml

# Test function locally
npm start
curl "http://localhost:3000/health"
```

## Security Considerations

### Secrets Management

- **Never commit secrets** to the repository
- **Use environment variables** for all sensitive data
- **Rotate secrets regularly** and update in all environments
- **Monitor secret usage** and access logs

### Access Control

- **Limit IAM permissions** to minimum required
- **Use separate accounts** for different environments
- **Enable audit logging** for all cloud resources
- **Review access regularly** and remove unused permissions

### Network Security

- **Use HTTPS only** for all communications
- **Implement CORS** properly for browser access
- **Add rate limiting** to prevent abuse
- **Monitor unusual traffic** patterns

## Cost Optimization

### Vercel
- **Free tier**: 100GB bandwidth, 1000 serverless function invocations
- **Pro tier**: $20/month for additional resources
- **Monitor usage**: Check dashboard for limits

### AWS Lambda
- **Free tier**: 1M requests + 400K GB-seconds per month
- **Pricing**: $0.20 per 1M requests + compute time
- **Optimize**: Reduce memory allocation and execution time

### Google Cloud Functions
- **Free tier**: 2M requests + 400K GB-seconds per month
- **Pricing**: $0.40 per 1M requests + compute time
- **Optimize**: Use appropriate memory and timeout settings

### Cost Monitoring

```bash
# AWS cost estimation
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost

# GCP cost monitoring
gcloud billing accounts list
gcloud billing projects describe YOUR_PROJECT_ID
```

## Next Steps

After successful deployment:

1. **Set up monitoring** and alerting
2. **Configure custom domain** (optional)
3. **Add SSL certificates** if needed
4. **Implement CI/CD** for multiple environments
5. **Scale based on usage** patterns

For additional help, refer to the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) guide.