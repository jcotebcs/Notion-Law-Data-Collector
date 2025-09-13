#!/bin/bash

# Test AWS Lambda Functions Script
# This script helps test the deployed Lambda functions

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

echo -e "${BLUE}🧪 Notion Law Data Collector - Lambda Function Tests${NC}"
echo "===================================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI is installed and configured${NC}"

# Prompt for configuration
read -p "AWS Region (default: ${DEFAULT_REGION}): " REGION
REGION=${REGION:-$DEFAULT_REGION}

read -p "Function prefix (default: ${DEFAULT_FUNCTION_PREFIX}): " FUNCTION_PREFIX
FUNCTION_PREFIX=${FUNCTION_PREFIX:-$DEFAULT_FUNCTION_PREFIX}

read -p "Test Database ID (32 hex chars): " DATABASE_ID

if [[ ! $DATABASE_ID =~ ^[a-f0-9]{32}$ ]]; then
    echo -e "${RED}❌ Invalid database ID format. Please provide 32 hexadecimal characters.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔧 Testing Lambda functions...${NC}"

# Test 1: test-connection function
echo -e "${YELLOW}Test 1: Testing connection function...${NC}"

FUNCTION_NAME="${FUNCTION_PREFIX}-test-connection"
TEST_PAYLOAD=$(cat << EOF
{
  "httpMethod": "GET",
  "queryStringParameters": {
    "databaseId": "${DATABASE_ID}"
  }
}
EOF
)

echo "Invoking function: ${FUNCTION_NAME}"
aws lambda invoke \
  --function-name "${FUNCTION_NAME}" \
  --payload "${TEST_PAYLOAD}" \
  --region "${REGION}" \
  /tmp/test-connection-response.json

echo "Response:"
cat /tmp/test-connection-response.json | python3 -m json.tool

# Check if response is successful
if grep -q '"statusCode": 200' /tmp/test-connection-response.json; then
    echo -e "${GREEN}✅ Test Connection: PASSED${NC}"
else
    echo -e "${RED}❌ Test Connection: FAILED${NC}"
fi

echo ""

# Test 2: create-page function
echo -e "${YELLOW}Test 2: Testing create page function...${NC}"

FUNCTION_NAME="${FUNCTION_PREFIX}-create-page"
TEST_PAYLOAD=$(cat << EOF
{
  "httpMethod": "POST",
  "body": "{\"databaseId\": \"${DATABASE_ID}\", \"properties\": {\"Title\": {\"title\": [{\"text\": {\"content\": \"Test Case from Lambda - $(date)\"}}]}}}"
}
EOF
)

echo "Invoking function: ${FUNCTION_NAME}"
aws lambda invoke \
  --function-name "${FUNCTION_NAME}" \
  --payload "${TEST_PAYLOAD}" \
  --region "${REGION}" \
  /tmp/create-page-response.json

echo "Response:"
cat /tmp/create-page-response.json | python3 -m json.tool

# Check if response is successful
if grep -q '"statusCode": 201' /tmp/create-page-response.json; then
    echo -e "${GREEN}✅ Create Page: PASSED${NC}"
else
    echo -e "${RED}❌ Create Page: FAILED${NC}"
fi

echo ""

# Test 3: query-database function
echo -e "${YELLOW}Test 3: Testing query database function...${NC}"

FUNCTION_NAME="${FUNCTION_PREFIX}-query-database"
TEST_PAYLOAD=$(cat << EOF
{
  "httpMethod": "POST",
  "body": "{\"databaseId\": \"${DATABASE_ID}\", \"sorts\": [{\"property\": \"created_time\", \"direction\": \"descending\"}], \"page_size\": 3}"
}
EOF
)

echo "Invoking function: ${FUNCTION_NAME}"
aws lambda invoke \
  --function-name "${FUNCTION_NAME}" \
  --payload "${TEST_PAYLOAD}" \
  --region "${REGION}" \
  /tmp/query-database-response.json

echo "Response:"
cat /tmp/query-database-response.json | python3 -m json.tool

# Check if response is successful
if grep -q '"statusCode": 200' /tmp/query-database-response.json; then
    echo -e "${GREEN}✅ Query Database: PASSED${NC}"
else
    echo -e "${RED}❌ Query Database: FAILED${NC}"
fi

echo ""

# Test 4: CORS preflight requests
echo -e "${YELLOW}Test 4: Testing CORS preflight handling...${NC}"

FUNCTION_NAME="${FUNCTION_PREFIX}-test-connection"
TEST_PAYLOAD=$(cat << EOF
{
  "httpMethod": "OPTIONS"
}
EOF
)

echo "Testing OPTIONS request on: ${FUNCTION_NAME}"
aws lambda invoke \
  --function-name "${FUNCTION_NAME}" \
  --payload "${TEST_PAYLOAD}" \
  --region "${REGION}" \
  /tmp/cors-response.json

echo "Response:"
cat /tmp/cors-response.json | python3 -m json.tool

# Check if response is successful
if grep -q '"statusCode": 204' /tmp/cors-response.json; then
    echo -e "${GREEN}✅ CORS Preflight: PASSED${NC}"
else
    echo -e "${RED}❌ CORS Preflight: FAILED${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}📊 Test Summary:${NC}"
echo "================="

echo -n "Test Connection: "
if grep -q '"statusCode": 200' /tmp/test-connection-response.json; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

echo -n "Create Page: "
if grep -q '"statusCode": 201' /tmp/create-page-response.json; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

echo -n "Query Database: "
if grep -q '"statusCode": 200' /tmp/query-database-response.json; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

echo -n "CORS Preflight: "
if grep -q '"statusCode": 204' /tmp/cors-response.json; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

echo ""

# Performance metrics
echo -e "${BLUE}⚡ Performance Metrics:${NC}"
echo "======================="

for func in test-connection create-page query-database; do
    FUNCTION_NAME="${FUNCTION_PREFIX}-${func}"
    echo -n "${func}: "
    
    # Get function configuration
    aws lambda get-function-configuration \
      --function-name "${FUNCTION_NAME}" \
      --region "${REGION}" \
      --query '[MemorySize, Timeout, LastModified]' \
      --output text | while read memory timeout modified; do
        echo "${memory}MB memory, ${timeout}s timeout, modified: ${modified}"
    done
done

# CloudWatch logs information
echo ""
echo -e "${BLUE}📋 CloudWatch Logs:${NC}"
echo "==================="
echo "To view function logs:"
for func in test-connection create-page query-database; do
    FUNCTION_NAME="${FUNCTION_PREFIX}-${func}"
    echo "  aws logs describe-log-groups --log-group-name-prefix /aws/lambda/${FUNCTION_NAME} --region ${REGION}"
done

# Clean up temporary files
rm -f /tmp/test-connection-response.json /tmp/create-page-response.json /tmp/query-database-response.json /tmp/cors-response.json

echo ""
echo -e "${GREEN}🎉 Testing completed!${NC}"

# Additional recommendations
echo ""
echo -e "${YELLOW}💡 Recommendations:${NC}"
echo "==================="
echo "1. Monitor CloudWatch Logs for any errors or warnings"
echo "2. Set up CloudWatch Alarms for error rates and duration"
echo "3. Test with actual frontend application"
echo "4. Verify API Gateway configuration if using REST API"
echo "5. Test rate limiting behavior with multiple concurrent requests"