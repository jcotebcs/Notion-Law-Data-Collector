A web-based tool for generating secure API client code instantly from any API endpoint. Features both a modern web interface and command-line examples for Python and Node.js.
A web-based tool for generating secure API client code instantly from any API endpoint. Features both a modern web interface and command-line examples for Python and Node.js.


## 🚀 NEW: Notion API Lambda Integration

**Solve the "Unexpected token '<'" error with secure serverless Notion API access!**

This repository now includes a comprehensive solution for integrating with the Notion API using AWS Lambda as a secure proxy. The solution addresses common CORS and authentication issues when connecting to Notion from client-side applications.

### ✨ Key Features of Notion Integration

- **🔒 Secure Authentication**: AWS Secrets Manager for token storage
- **🌐 CORS-Enabled Proxy**: Serverless Lambda function for secure client-side access
- **⚡ Auto-Deployment**: Complete GitHub Actions CI/CD pipeline
- **🛡️ Security Best Practices**: Comprehensive IAM roles and permissions
- **📊 Error Analysis**: Detailed troubleshooting guide for common issues
- **🔄 Dynamic Data Source Handling**: Automatic data_source_id retrieval and caching

### 📋 Notion API Quick Start

1. **Deploy the Lambda Function**:
   ```bash
   # Set up your AWS credentials as GitHub Secrets:
   # AWS_ACCESS_KEY_ID
   # AWS_SECRET_ACCESS_KEY

   # Push to main branch to trigger automatic deployment
   git push origin main
   ```

2. **Configure Notion Token**:
   ```bash
   # After deployment, update the Notion token in AWS Secrets Manager
   aws secretsmanager update-secret \
     --secret-id notion-api-token \
     --secret-string "secret_your_actual_notion_token_here"
   ```

3. **Use in Your Application**:
   ```javascript
   // Replace LAMBDA_URL with your deployed function URL
   const response = await fetch('LAMBDA_URL/databases/40c4cef5c8cd4cb4891a35c3710df6e9/query', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       page_size: 10
     })
   });

   const data = await response.json();
   console.log(data);
   ```

### 📚 Notion API Documentation

- **[Troubleshooting Guide](./NOTION_API_TROUBLESHOOTING.md)**: Comprehensive error analysis and solutions
- **[Security Guide](./SECURITY_GUIDE.md)**: Best practices for secure implementation
- **[Lambda Function](./lambda_function.py)**: The core serverless proxy implementation
- **[GitHub Actions Workflow](./github/workflows/notion-lambda-deploy.yml)**: Automated deployment pipeline

## 🌐 Web Interface	## 🌐 Web Interface


Visit the **[Live Web Generator](https://jcotebcs.github.io/Rapid_API-Generator)** to instantly generate API client code:	Visit the **[Live Web Generator](https://jcotebcs.github.io/Rapid_API-Generator)** to instantly generate API client code:
@@ -89,18 +148,23 @@ The Node.js example uses:


```	```
Rapid_API-Generator/	Rapid_API-Generator/
├── .env.example          # Template for environment variables	├── .env.example                    # Template for environment variables
├── .gitignore           # Git ignore rules (includes .env)	├── .gitignore                     # Git ignore rules (includes .env)
├── requirements.txt     # Python dependencies	├── requirements.txt               # Python dependencies (includes AWS SDK)
├── package.json         # Node.js dependencies	├── package.json                   # Node.js dependencies
├── rapidapi_example.py  # Python example script	├── rapidapi_example.py            # Python example script
├── rapidapi_example.js  # Node.js example script	├── rapidapi_example.js            # Node.js example script
├── Dockerfile.node      # Docker configuration for Node.js	├── Dockerfile.node                # Docker configuration for Node.js
├── Dockerfile.python    # Docker configuration for Python	├── Dockerfile.python              # Docker configuration for Python
├── lambda_function.py             # 🆕 AWS Lambda function for Notion API proxy
├── test_lambda_function.py        # 🆕 Comprehensive unit tests for Lambda
├── NOTION_API_TROUBLESHOOTING.md  # 🆕 Detailed error analysis and solutions
├── SECURITY_GUIDE.md              # 🆕 Security best practices documentation
├── .github/	├── .github/
│   └── workflows/	│   └── workflows/
│       └── deploy.yml   # CI/CD pipeline configuration	│       ├── deploy.yml             # Original CI/CD pipeline
└── README.md           # This file	│       └── notion-lambda-deploy.yml # 🆕 Notion Lambda deployment pipeline
└── README.md                      # This file
```	```


## 🚀 Deployment	## 🚀 Deployment
@@ -150,29 +214,53 @@ docker run --rm --env-file .env rapid-api-generator-python:latest


### CI/CD Pipeline	### CI/CD Pipeline


The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:	The project includes two GitHub Actions workflows:

1. **Original Pipeline** (`.github/workflows/deploy.yml`):
   - **Lints and tests** both Node.js and Python code on every push and pull request
   - **Builds Docker images** to ensure containerization works correctly
   - **Deploys to GitHub Pages** on successful builds to the main branch


- **Lints and tests** both Node.js and Python code on every push and pull request	2. **🆕 Notion Lambda Pipeline** (`.github/workflows/notion-lambda-deploy.yml`):
- **Builds Docker images** to ensure containerization works correctly	   - **Comprehensive testing** of Lambda function with unit tests
- **Deploys to GitHub Pages** on successful builds to the main branch	   - **Secure AWS deployment** with IAM role creation and management
   - **Secrets Manager integration** for secure token storage
   - **Automated Lambda deployment** with function URL configuration
   - **Integration testing** to verify end-to-end functionality


The pipeline runs automatically and ensures code quality and deployment readiness.	Both pipelines run automatically and ensure code quality and deployment readiness.


### Environment Variables for Production	### Environment Variables for Production


For production deployments, ensure you set the following environment variables:	For production deployments, ensure you set the following environment variables:


#### Original RapidAPI Integration:
- `RAPIDAPI_KEY`: Your production RapidAPI key	- `RAPIDAPI_KEY`: Your production RapidAPI key
- `NODE_ENV`: Set to `production` for optimized performance	- `NODE_ENV`: Set to `production` for optimized performance
- `RAPIDAPI_HOST`: Override if using a different API host	- `RAPIDAPI_HOST`: Override if using a different API host


#### 🆕 Notion API Integration:
- `AWS_ACCESS_KEY_ID`: AWS access key for deployment (GitHub Secret)
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for deployment (GitHub Secret)
- `NOTION_API_SECRET_ARN`: Automatically set by deployment pipeline
- `AWS_DEFAULT_REGION`: AWS region for Lambda deployment (default: us-east-1)

### Security Considerations for Deployment	### Security Considerations for Deployment


#### Original RapidAPI Integration:
- Never expose your `.env` file in production	- Never expose your `.env` file in production
- Use separate API keys for development, staging, and production	- Use separate API keys for development, staging, and production
- Consider using container orchestration (Kubernetes, Docker Swarm) for scalability	- Consider using container orchestration (Kubernetes, Docker Swarm) for scalability
- Implement proper logging and monitoring in production environments	- Implement proper logging and monitoring in production environments


#### 🆕 Notion API Integration:
- **AWS Secrets Manager**: Secure token storage with encryption at rest and in transit
- **IAM Least Privilege**: Minimal permissions for Lambda execution and GitHub Actions
- **CORS Configuration**: Properly configured for production domains
- **Input Validation**: Comprehensive request validation and sanitization
- **Error Handling**: Secure error responses without information leakage
- **Audit Logging**: CloudWatch integration for monitoring and compliance

## 🔧 Customization	## 🔧 Customization


Both example scripts are templates that demonstrate secure API key management. To use them with actual RapidAPI endpoints:	Both example scripts are templates that demonstrate secure API key management. To use them with actual RapidAPI endpoints:
