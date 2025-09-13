#!/bin/bash

# AWS Lambda Setup Helper Script
# This script helps automate the AWS setup process for the Notion Law Data Collector

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DEFAULT_REGION="us-east-1"
DEFAULT_SECRET_NAME="notion-law-collector-api-token"
DEFAULT_ROLE_NAME="notion-law-collector-lambda-role"
DEFAULT_POLICY_NAME="notion-law-collector-secrets-policy"

echo -e "${BLUE}🚀 Notion Law Data Collector - AWS Lambda Setup${NC}"
echo "=================================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI is installed and configured${NC}"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${BLUE}📋 AWS Account ID: ${ACCOUNT_ID}${NC}"

# Prompt for configuration
echo ""
echo "Please provide the following configuration:"

read -p "AWS Region (default: ${DEFAULT_REGION}): " REGION
REGION=${REGION:-$DEFAULT_REGION}

read -p "Secret name (default: ${DEFAULT_SECRET_NAME}): " SECRET_NAME
SECRET_NAME=${SECRET_NAME:-$DEFAULT_SECRET_NAME}

read -p "IAM Role name (default: ${DEFAULT_ROLE_NAME}): " ROLE_NAME
ROLE_NAME=${ROLE_NAME:-$DEFAULT_ROLE_NAME}

read -p "IAM Policy name (default: ${DEFAULT_POLICY_NAME}): " POLICY_NAME
POLICY_NAME=${POLICY_NAME:-$DEFAULT_POLICY_NAME}

echo ""
read -s -p "Notion API Token (starts with 'secret_'): " NOTION_TOKEN
echo ""

if [[ ! $NOTION_TOKEN =~ ^secret_ ]]; then
    echo -e "${RED}❌ Invalid Notion token format. It should start with 'secret_'${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📝 Configuration Summary:${NC}"
echo "  Region: ${REGION}"
echo "  Secret Name: ${SECRET_NAME}"
echo "  Role Name: ${ROLE_NAME}"
echo "  Policy Name: ${POLICY_NAME}"
echo ""

read -p "Continue with setup? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}🔧 Starting AWS setup...${NC}"

# Step 1: Create Secrets Manager secret
echo -e "${YELLOW}Step 1: Creating Secrets Manager secret...${NC}"

SECRET_VALUE="{\"notion_api_token\": \"${NOTION_TOKEN}\"}"

if aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region "${REGION}" &> /dev/null; then
    echo "Secret already exists. Updating..."
    aws secretsmanager update-secret \
        --secret-id "${SECRET_NAME}" \
        --secret-string "${SECRET_VALUE}" \
        --region "${REGION}"
else
    echo "Creating new secret..."
    aws secretsmanager create-secret \
        --name "${SECRET_NAME}" \
        --description "Notion API token for Law Data Collector" \
        --secret-string "${SECRET_VALUE}" \
        --region "${REGION}"
fi

SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region "${REGION}" --query ARN --output text)
echo -e "${GREEN}✅ Secret created/updated: ${SECRET_ARN}${NC}"

# Step 2: Create IAM trust policy
echo -e "${YELLOW}Step 2: Creating IAM role and policies...${NC}"

cat > /tmp/lambda-trust-policy.json << EOF
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

# Create IAM role
if aws iam get-role --role-name "${ROLE_NAME}" &> /dev/null; then
    echo "IAM role already exists."
else
    echo "Creating IAM role..."
    aws iam create-role \
        --role-name "${ROLE_NAME}" \
        --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
        --description "Execution role for Notion Law Data Collector Lambda functions"
fi

# Attach basic Lambda execution policy
aws iam attach-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create Secrets Manager policy
cat > /tmp/secrets-manager-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "${SECRET_ARN}"
    }
  ]
}
EOF

# Create and attach Secrets Manager policy
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

if aws iam get-policy --policy-arn "${POLICY_ARN}" &> /dev/null; then
    echo "Secrets Manager policy already exists."
    # Update policy if needed
    aws iam create-policy-version \
        --policy-arn "${POLICY_ARN}" \
        --policy-document file:///tmp/secrets-manager-policy.json \
        --set-as-default
else
    echo "Creating Secrets Manager policy..."
    aws iam create-policy \
        --policy-name "${POLICY_NAME}" \
        --policy-document file:///tmp/secrets-manager-policy.json \
        --description "Allow access to Notion API token in Secrets Manager"
fi

aws iam attach-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-arn "${POLICY_ARN}"

ROLE_ARN=$(aws iam get-role --role-name "${ROLE_NAME}" --query Role.Arn --output text)
echo -e "${GREEN}✅ IAM role created/updated: ${ROLE_ARN}${NC}"

# Clean up temporary files
rm -f /tmp/lambda-trust-policy.json /tmp/secrets-manager-policy.json

echo ""
echo -e "${GREEN}🎉 AWS setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Configuration Summary:${NC}"
echo "  Secret ARN: ${SECRET_ARN}"
echo "  Role ARN: ${ROLE_ARN}"
echo "  Region: ${REGION}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Add the following secrets to your GitHub repository:"
echo "   - AWS_ACCESS_KEY_ID: Your AWS access key"
echo "   - AWS_SECRET_ACCESS_KEY: Your AWS secret access key"
echo "   - LAMBDA_EXECUTION_ROLE_ARN: ${ROLE_ARN}"
echo "   - NOTION_API_SECRET_ARN: ${SECRET_ARN}"
echo ""
echo "2. Push changes to the main branch to trigger deployment"
echo ""
echo "3. Monitor the GitHub Actions workflow for deployment status"
echo ""
echo -e "${BLUE}🔗 Useful Commands:${NC}"
echo "  Test secret access:"
echo "    aws secretsmanager get-secret-value --secret-id ${SECRET_NAME} --region ${REGION}"
echo ""
echo "  View role details:"
echo "    aws iam get-role --role-name ${ROLE_NAME}"
echo ""
echo "  List Lambda functions:"
echo "    aws lambda list-functions --region ${REGION}"

# Save configuration for later use
cat > .aws-setup-config << EOF
# AWS Setup Configuration
# Generated on $(date)
REGION=${REGION}
SECRET_NAME=${SECRET_NAME}
SECRET_ARN=${SECRET_ARN}
ROLE_NAME=${ROLE_NAME}
ROLE_ARN=${ROLE_ARN}
POLICY_NAME=${POLICY_NAME}
ACCOUNT_ID=${ACCOUNT_ID}
EOF

echo ""
echo -e "${GREEN}💾 Configuration saved to .aws-setup-config${NC}"