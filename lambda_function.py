#!/usr/bin/env python3
"""
AWS Lambda Function for Notion API Proxy
===========================================

This serverless function acts as a secure proxy for Notion API requests,
addressing the "Unexpected token '<'" error by providing proper authentication,
error handling, and CORS support for client-side applications.

Key Features:
- Secure token management via AWS Secrets Manager
- Dynamic data_source_id retrieval and caching
- Comprehensive error handling and logging
- CORS support for cross-origin requests
- API version enforcement (2025-09-03)
"""

import json
import logging
import os
import boto3
from typing import Dict, Any, Optional
import urllib3

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients (with region handling for testing)
try:
    # Try to get region from environment or use default
    region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    secrets_client = boto3.client("secretsmanager", region_name=region)
except Exception:
    # For testing environments without AWS credentials
    secrets_client = None

http = urllib3.PoolManager()

# Constants
NOTION_VERSION = "2025-09-03"
NOTION_BASE_URL = "https://api.notion.com/v1"
DATABASE_ID = "40c4cef5c8cd4cb4891a35c3710df6e9"

# In-memory cache for data_source_id (persists during Lambda container lifetime)
data_source_cache = {}


def get_secret(secret_arn: str) -> str:
    """
    Retrieve secret from AWS Secrets Manager.

    Args:
        secret_arn: ARN of the secret in AWS Secrets Manager

    Returns:
        Secret value as string

    Raises:
        Exception: If secret retrieval fails
    """
    global secrets_client

    if not secrets_client:
        # Initialize client if not already done (for testing)
        region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
        secrets_client = boto3.client("secretsmanager", region_name=region)

    try:
        response = secrets_client.get_secret_value(SecretId=secret_arn)
        return response["SecretString"]
    except Exception as e:
        logger.error(f"Failed to retrieve secret {secret_arn}: {str(e)}")
        raise


def get_notion_token() -> str:
    """
    Get Notion API token from AWS Secrets Manager.

    Returns:
        Notion API token

    Raises:
        Exception: If token retrieval fails
    """
    secret_arn = os.environ.get("NOTION_API_SECRET_ARN")
    if not secret_arn:
        raise ValueError("NOTION_API_SECRET_ARN environment variable not set")

    return get_secret(secret_arn)


def get_data_source_id(notion_token: str, database_id: str) -> Optional[str]:
    """
    Dynamically retrieve data_source_id for the given database.
    Implements caching to avoid repeated API calls.

    Args:
        notion_token: Notion API token
        database_id: Database ID to get data_source_id for

    Returns:
        data_source_id if found, None otherwise
    """
    # Check cache first
    if database_id in data_source_cache:
        logger.info(f"Using cached data_source_id for database {database_id}")
        return data_source_cache[database_id]

    # Fetch from Notion API
    try:
        url = f"{NOTION_BASE_URL}/databases/{database_id}"
        headers = {
            "Authorization": f"Bearer {notion_token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }

        response = http.request("GET", url, headers=headers)

        if response.status == 200:
            data = json.loads(response.data.decode("utf-8"))
            # Extract data_source_id from response
            # (adjust based on actual API response structure)
            data_source_id = data.get("data_source_id")

            if data_source_id:
                # Cache the result
                data_source_cache[database_id] = data_source_id
                logger.info(f"Retrieved and cached data_source_id: {data_source_id}")
                return data_source_id
            else:
                logger.warning(f"No data_source_id found for database {database_id}")
                return None
        else:
            logger.error(
                f"Failed to retrieve database info: {response.status} - {response.data}"
            )
            return None

    except Exception as e:
        logger.error(f"Error retrieving data_source_id: {str(e)}")
        return None


def make_notion_request(
    method: str, endpoint: str, notion_token: str, body: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Make authenticated request to Notion API.

    Args:
        method: HTTP method (GET, POST, PATCH, etc.)
        endpoint: API endpoint (without base URL)
        notion_token: Notion API token
        body: Request body for POST/PATCH requests

    Returns:
        Dict containing status_code, headers, and data
    """
    url = f"{NOTION_BASE_URL}/{endpoint.lstrip('/')}"

    headers = {
        "Authorization": f"Bearer {notion_token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }

    logger.info(f"Making {method} request to {url}")

    try:
        if body:
            encoded_data = json.dumps(body).encode("utf-8")
            response = http.request(method, url, headers=headers, body=encoded_data)
        else:
            response = http.request(method, url, headers=headers)

        # Parse response
        try:
            response_data = json.loads(response.data.decode("utf-8"))
        except json.JSONDecodeError:
            response_data = {"raw_response": response.data.decode("utf-8")}

        result = {
            "status_code": response.status,
            "headers": dict(response.headers),
            "data": response_data,
        }

        logger.info(f"Response status: {response.status}")
        return result

    except Exception as e:
        logger.error(f"Request failed: {str(e)}")
        return {
            "status_code": 500,
            "headers": {},
            "data": {"error": "Internal server error", "details": str(e)},
        }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler function.

    Expected event structure:
    {
        "httpMethod": "GET|POST|PATCH|DELETE",
        "path": "/databases/{database_id}/query",
        "queryStringParameters": {...},
        "headers": {...},
        "body": "{...}" (for POST/PATCH)
    }

    Returns:
        API Gateway response format
    """

    # CORS headers for all responses
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Content-Type": "application/json",
    }

    try:
        # Handle preflight requests
        if event.get("httpMethod") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": cors_headers,
                "body": json.dumps({"message": "CORS preflight"}),
            }

        # Extract request details
        method = event.get("httpMethod", "GET")
        path = event.get("path", "")
        query_params = event.get("queryStringParameters") or {}
        body_str = event.get("body")

        logger.info(f"Processing {method} request to {path}")

        # Parse request body if present
        body = None
        if body_str:
            try:
                body = json.loads(body_str)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in request body: {str(e)}")
                return {
                    "statusCode": 400,
                    "headers": cors_headers,
                    "body": json.dumps(
                        {"error": "Invalid JSON in request body", "details": str(e)}
                    ),
                }

        # Get Notion API token
        try:
            notion_token = get_notion_token()
        except Exception as e:
            logger.error(f"Failed to get Notion token: {str(e)}")
            return {
                "statusCode": 500,
                "headers": cors_headers,
                "body": json.dumps(
                    {
                        "error": "Authentication configuration error",
                        "details": "Failed to retrieve API credentials",
                    }
                ),
            }

        # Handle database query requests
        if "databases" in path and DATABASE_ID in path:
            # Get data_source_id if needed
            data_source_id = get_data_source_id(notion_token, DATABASE_ID)

            # Construct endpoint
            endpoint = path.replace("/lambda-proxy", "").lstrip("/")

            # Add query parameters if present
            if query_params:
                query_string = "&".join([f"{k}={v}" for k, v in query_params.items()])
                if "?" in endpoint:
                    endpoint += f"&{query_string}"
                else:
                    endpoint += f"?{query_string}"

            # Make the request
            result = make_notion_request(method, endpoint, notion_token, body)

            # Add metadata to response
            if "data" in result and isinstance(result["data"], dict):
                result["data"]["_metadata"] = {
                    "database_id": DATABASE_ID,
                    "data_source_id": data_source_id,
                    "api_version": NOTION_VERSION,
                    "proxy_version": "1.0.0",
                }

            return {
                "statusCode": result["status_code"],
                "headers": cors_headers,
                "body": json.dumps(result["data"]),
            }

        else:
            # Invalid endpoint
            return {
                "statusCode": 404,
                "headers": cors_headers,
                "body": json.dumps(
                    {
                        "error": "Endpoint not found",
                        "details": f"Path {path} is not supported by this proxy",
                    }
                ),
            }

    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {str(e)}")
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": "Internal server error", "details": str(e)}),
        }


# For local testing
if __name__ == "__main__":
    # Test event
    test_event = {
        "httpMethod": "GET",
        "path": f"/databases/{DATABASE_ID}/query",
        "queryStringParameters": None,
        "headers": {},
        "body": None,
    }

    print("Local test - set NOTION_API_SECRET_ARN environment variable")
    print(json.dumps(lambda_handler(test_event, None), indent=2))