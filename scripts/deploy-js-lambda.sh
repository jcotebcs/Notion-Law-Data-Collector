#!/bin/bash

# Deploy JavaScript AWS Lambda Functions Script
# This script packages and deploys the JavaScript Lambda functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DEFAULT_REGION="us-east-1"
DEFAULT_FUNCTION_PREFIX="notion-law-collector"
DEFAULT_RUNTIME="nodejs18.x"
DEFAULT_MEMORY_SIZE="256"
DEFAULT_TIMEOUT="30"

echo -e "${BLUE}🚀 JavaScript Lambda Functions Deployment${NC}"
echo "=============================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Prompt for configuration
echo ""
echo "Please provide the following configuration:"

read -p "AWS Region (default: ${DEFAULT_REGION}): " REGION
REGION=${REGION:-$DEFAULT_REGION}

read -p "Function prefix (default: ${DEFAULT_FUNCTION_PREFIX}): " FUNCTION_PREFIX
FUNCTION_PREFIX=${FUNCTION_PREFIX:-$DEFAULT_FUNCTION_PREFIX}

read -p "IAM Role ARN (for Lambda execution): " ROLE_ARN
if [[ -z "$ROLE_ARN" ]]; then
    echo -e "${RED}❌ IAM Role ARN is required${NC}"
    exit 1
fi

read -p "Notion API Secret ARN (in Secrets Manager): " SECRET_ARN
if [[ -z "$SECRET_ARN" ]]; then
    echo -e "${RED}❌ Notion API Secret ARN is required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📝 Configuration Summary:${NC}"
echo "  Region: ${REGION}"
echo "  Function Prefix: ${FUNCTION_PREFIX}"
echo "  Runtime: ${DEFAULT_RUNTIME}"
echo "  Memory: ${DEFAULT_MEMORY_SIZE}MB"
echo "  Timeout: ${DEFAULT_TIMEOUT}s"
echo "  Role ARN: ${ROLE_ARN}"
echo "  Secret ARN: ${SECRET_ARN}"
echo ""

read -p "Continue with deployment? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}🔧 Starting deployment...${NC}"

# Create clean package directory
echo -e "${YELLOW}Step 1: Preparing package directory...${NC}"
rm -rf lambda-js-package
mkdir lambda-js-package

# Copy Lambda-specific package.json
cp lambda-package.json lambda-js-package/package.json

# Install dependencies in package directory
echo -e "${YELLOW}Step 2: Installing dependencies...${NC}"
cd lambda-js-package
npm install --production --no-optional
cd ..

# Function definitions
declare -A FUNCTIONS=(
    ["test-connection"]="lambda-test-connection.js"
    ["create-page"]="lambda-create-page.js"
    ["query-database"]="lambda-query-database.js"
)

# Deploy each function
for func_name in "${!FUNCTIONS[@]}"; do
    handler_file="${FUNCTIONS[$func_name]}"
    function_name="${FUNCTION_PREFIX}-${func_name}"
    
    echo ""
    echo -e "${YELLOW}Step 3.${func_name}: Deploying ${function_name}...${NC}"
    
    # Copy handler file to package directory
    cp "$handler_file" lambda-js-package/
    
    # Create deployment package
    cd lambda-js-package
    zip -r "../${function_name}.zip" . -x "*.git*" "*.DS_Store*"
    cd ..
    
    echo "Package created: ${function_name}.zip"
    echo "Package size: $(du -h ${function_name}.zip | cut -f1)"
    
    # Check if function exists
    FUNCTION_EXISTS=$(aws lambda get-function --function-name "$function_name" --region "$REGION" --query 'Configuration.FunctionName' --output text 2>/dev/null || echo "NOTFOUND")
    
    if [ "$FUNCTION_EXISTS" = "NOTFOUND" ]; then
        echo "Creating new Lambda function: $function_name"
        
        aws lambda create-function \
            --function-name "$function_name" \
            --runtime "$DEFAULT_RUNTIME" \
            --role "$ROLE_ARN" \
            --handler "${handler_file%.js}.handler" \
            --zip-file "fileb://${function_name}.zip" \
            --timeout "$DEFAULT_TIMEOUT" \
            --memory-size "$DEFAULT_MEMORY_SIZE" \
            --environment "Variables={NOTION_API_SECRET_ARN=$SECRET_ARN}" \
            --description "JavaScript Lambda handler for Notion Law Data Collector - ${func_name}" \
            --region "$REGION"
        
        echo -e "${GREEN}✅ Function created successfully${NC}"
    else
        echo "Updating existing Lambda function: $function_name"
        
        # Update function code
        aws lambda update-function-code \
            --function-name "$function_name" \
            --zip-file "fileb://${function_name}.zip" \
            --region "$REGION"
        
        # Update function configuration
        aws lambda update-function-configuration \
            --function-name "$function_name" \
            --runtime "$DEFAULT_RUNTIME" \
            --role "$ROLE_ARN" \
            --handler "${handler_file%.js}.handler" \
            --timeout "$DEFAULT_TIMEOUT" \
            --memory-size "$DEFAULT_MEMORY_SIZE" \
            --environment "Variables={NOTION_API_SECRET_ARN=$SECRET_ARN}" \
            --region "$REGION"
        
        echo -e "${GREEN}✅ Function updated successfully${NC}"
    fi
    
    # Create/update function URL if it doesn't exist
    FUNCTION_URL=$(aws lambda get-function-url-config --function-name "$function_name" --region "$REGION" --query FunctionUrl --output text 2>/dev/null || echo "NOTFOUND")
    
    if [ "$FUNCTION_URL" = "NOTFOUND" ]; then
        echo "Creating function URL..."
        FUNCTION_URL=$(aws lambda create-function-url-config \
            --function-name "$function_name" \
            --cors AuthType=NONE,AllowCredentials=false,AllowHeaders=["*"],AllowMethods=["*"],AllowOrigins=["*"],MaxAge=3600 \
            --auth-type NONE \
            --region "$REGION" \
            --query FunctionUrl --output text)
        echo "Function URL created: $FUNCTION_URL"
    else
        echo "Function URL already exists: $FUNCTION_URL"
    fi
    
    # Remove handler file from package directory
    rm "lambda-js-package/${handler_file}"
    
    echo -e "${GREEN}✅ ${function_name} deployment completed${NC}"
done

# Clean up
echo ""
echo -e "${YELLOW}Step 4: Cleaning up...${NC}"
rm -rf lambda-js-package
rm -f "${FUNCTION_PREFIX}"-*.zip

echo ""
echo -e "${GREEN}🎉 All JavaScript Lambda functions deployed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
for func_name in "${!FUNCTIONS[@]}"; do
    function_name="${FUNCTION_PREFIX}-${func_name}"
    FUNCTION_URL=$(aws lambda get-function-url-config --function-name "$function_name" --region "$REGION" --query FunctionUrl --output text 2>/dev/null || echo "Not configured")
    echo "  ${function_name}: ${FUNCTION_URL}"
done
echo ""
echo -e "${YELLOW}💡 Next Steps:${NC}"
echo "1. Test the deployed functions using the test script:"
echo "   ./scripts/test-lambda-functions.sh"
echo ""
echo "2. Monitor function logs in CloudWatch:"
for func_name in "${!FUNCTIONS[@]}"; do
    function_name="${FUNCTION_PREFIX}-${func_name}"
    echo "   aws logs describe-log-groups --log-group-name-prefix /aws/lambda/${function_name} --region ${REGION}"
done
echo ""
echo "3. Update your frontend application to use the function URLs"