
# Rapid_API-Generator

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

## 🌐 Web Interface

Visit the **[Live Web Generator](https://jcotebcs.github.io/Rapid_API-Generator)** to instantly generate API client code:

### Features
- **🎯 Simple Form Interface**: Enter API URL, select HTTP method, customize headers
- **🔧 Multi-Language Support**: Generate both Python and Node.js client code
- **📋 Copy & Download**: Easily copy code to clipboard or download as files
- **🛡️ Security Best Practices**: Built-in environment variable management
- **✨ Modern UI**: Clean, responsive design with tabbed code output
- **🚀 Real-time Generation**: Instant code generation with live preview

### How to Use
1. Enter your API endpoint URL
2. Select HTTP method (GET, POST, PUT, DELETE, PATCH)
3. Customize API name and RapidAPI host (optional)
4. Add additional headers in JSON format (optional)
5. Click "Generate API Code"
6. Copy or download the generated Python/Node.js code
7. Use the provided .env template for secure API key management

## 🚀 Quick Start

### Prerequisites

- Python 3.7+ (for Python example)
- Node.js 14+ (for Node.js example)
- A RapidAPI account and API key

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jcotebcs/Rapid_API-Generator.git
   cd Rapid_API-Generator
   ```

2. **Create your environment file**
   ```bash
   cp .env.example .env
   ```

3. **Add your RapidAPI key to the `.env` file**
   ```env
   RAPIDAPI_KEY=your_actual_rapidapi_key_here
   ```

   ⚠️ **Important**: Never commit your `.env` file to version control! It's already added to `.gitignore` for your security.

## 🐍 Python Example

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Run the Python Example
```bash
python rapidapi_example.py
```

The Python example uses:
- `requests` library for HTTP requests
- `python-dotenv` for loading environment variables from `.env` file

## 🟢 Node.js Example

### Install Dependencies
```bash
npm install
```

### Run the Node.js Example
```bash
npm start
# or
node rapidapi_example.js
```

The Node.js example uses:
- `axios` library for HTTP requests
- `dotenv` for loading environment variables from `.env` file

## 📁 Project Structure

```
Rapid_API-Generator/
├── .env.example                    # Template for environment variables
├── .gitignore                     # Git ignore rules (includes .env)
├── requirements.txt               # Python dependencies (includes AWS SDK)
├── package.json                   # Node.js dependencies
├── rapidapi_example.py            # Python example script
├── rapidapi_example.js            # Node.js example script
├── Dockerfile.node                # Docker configuration for Node.js
├── Dockerfile.python              # Docker configuration for Python
├── lambda_function.py             # 🆕 AWS Lambda function for Notion API proxy
├── test_lambda_function.py        # 🆕 Comprehensive unit tests for Lambda
├── NOTION_API_TROUBLESHOOTING.md  # 🆕 Detailed error analysis and solutions
├── SECURITY_GUIDE.md              # 🆕 Security best practices documentation
├── .github/
│   └── workflows/
│       ├── deploy.yml             # Original CI/CD pipeline
│       └── notion-lambda-deploy.yml # 🆕 Notion Lambda deployment pipeline
└── README.md                      # This file
```

## 🚀 Deployment

### Docker Deployment

Both examples can be containerized using Docker for consistent deployment across environments.

#### Building Docker Images

```bash
# Build Node.js image
npm run docker:build:node

# Build Python image  
npm run docker:build:python

# Build both images
npm run docker:build
```

#### Running with Docker

```bash
# Ensure you have a .env file with your RAPIDAPI_KEY
cp .env.example .env
# Edit .env with your actual API key

# Run Node.js example
npm run docker:run:node

# Run Python example
npm run docker:run:python
```

### Manual Docker Commands

```bash
# Build images manually
docker build -f Dockerfile.node -t rapid-api-generator-node:latest .
docker build -f Dockerfile.python -t rapid-api-generator-python:latest .

# Run containers manually
docker run --rm --env-file .env rapid-api-generator-node:latest
docker run --rm --env-file .env rapid-api-generator-python:latest
```

### CI/CD Pipeline

The project includes two GitHub Actions workflows:

1. **Original Pipeline** (`.github/workflows/deploy.yml`):
   - **Lints and tests** both Node.js and Python code on every push and pull request
   - **Builds Docker images** to ensure containerization works correctly
   - **Deploys to GitHub Pages** on successful builds to the main branch

2. **🆕 Notion Lambda Pipeline** (`.github/workflows/notion-lambda-deploy.yml`):
   - **Comprehensive testing** of Lambda function with unit tests
   - **Secure AWS deployment** with IAM role creation and management
   - **Secrets Manager integration** for secure token storage
   - **Automated Lambda deployment** with function URL configuration
   - **Integration testing** to verify end-to-end functionality

Both pipelines run automatically and ensure code quality and deployment readiness.

### Environment Variables for Production

For production deployments, ensure you set the following environment variables:

#### Original RapidAPI Integration:
- `RAPIDAPI_KEY`: Your production RapidAPI key
- `NODE_ENV`: Set to `production` for optimized performance
- `RAPIDAPI_HOST`: Override if using a different API host

#### 🆕 Notion API Integration:
- `AWS_ACCESS_KEY_ID`: AWS access key for deployment (GitHub Secret)
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for deployment (GitHub Secret)
- `NOTION_API_SECRET_ARN`: Automatically set by deployment pipeline
- `AWS_DEFAULT_REGION`: AWS region for Lambda deployment (default: us-east-1)

### Security Considerations for Deployment

#### Original RapidAPI Integration:
- Never expose your `.env` file in production
- Use separate API keys for development, staging, and production
- Consider using container orchestration (Kubernetes, Docker Swarm) for scalability
- Implement proper logging and monitoring in production environments

#### 🆕 Notion API Integration:
- **AWS Secrets Manager**: Secure token storage with encryption at rest and in transit
- **IAM Least Privilege**: Minimal permissions for Lambda execution and GitHub Actions
- **CORS Configuration**: Properly configured for production domains
- **Input Validation**: Comprehensive request validation and sanitization
- **Error Handling**: Secure error responses without information leakage
- **Audit Logging**: CloudWatch integration for monitoring and compliance

## 🔧 Customization

Both example scripts are templates that demonstrate secure API key management. To use them with actual RapidAPI endpoints:

1. Replace the `url` variable with your specific RapidAPI endpoint
2. Update the `X-RapidAPI-Host` header with the correct host for your API
3. Modify the request parameters as needed for your specific API

## 🔒 Security Best Practices

- ✅ Store API keys in environment variables (`.env` file)
- ✅ Add `.env` to `.gitignore` to prevent accidental commits
- ✅ Use `.env.example` as a template for other developers
- ✅ Never hardcode API keys in your source code
- ✅ Use different API keys for development, staging, and production

## 📚 Learn More

- [RapidAPI Documentation](https://docs.rapidapi.com/)
- [Python Requests Documentation](https://requests.readthedocs.io/)
- [Axios Documentation](https://axios-http.com/)
- [Python-dotenv Documentation](https://pypi.org/project/python-dotenv/)
- [Node.js dotenv Documentation](https://www.npmjs.com/package/dotenv)

## 🤝 Contributing

Feel free to submit issues and pull requests to improve these examples!
