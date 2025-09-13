"""
Utility functions for AWS Lambda Notion API integration
"""
import json
import logging
import os
import boto3
import requests
from typing import Dict, Any, Optional
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Constants
NOTION_API_VERSION = "2025-09-03"
NOTION_BASE_URL = "https://api.notion.com/v1"

class NotionAPIError(Exception):
    """Custom exception for Notion API errors"""
    def __init__(self, message: str, status_code: int = 500, notion_error: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.notion_error = notion_error
        super().__init__(self.message)

class SecretsManager:
    """AWS Secrets Manager client wrapper"""
    
    def __init__(self):
        self.client = boto3.client('secretsmanager')
        self._token_cache = None
    
    def get_notion_token(self) -> str:
        """Retrieve Notion API token from AWS Secrets Manager with caching"""
        if self._token_cache:
            return self._token_cache
            
        secret_arn = os.environ.get('NOTION_API_SECRET_ARN')
        if not secret_arn:
            raise ValueError("NOTION_API_SECRET_ARN environment variable not set")
        
        try:
            response = self.client.get_secret_value(SecretId=secret_arn)
            secret_data = json.loads(response['SecretString'])
            
            # Expect the secret to be stored as {"notion_api_token": "secret_..."}
            token = secret_data.get('notion_api_token')
            if not token:
                raise ValueError("notion_api_token not found in secret")
            
            # Cache the token for subsequent calls within the same Lambda execution
            self._token_cache = token
            return token
            
        except ClientError as e:
            logger.error(f"Failed to retrieve secret: {e}")
            raise ValueError(f"Failed to retrieve Notion API token: {e}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in secret: {e}")
            raise ValueError(f"Invalid secret format: {e}")

class NotionClient:
    """Notion API client with proper error handling"""
    
    def __init__(self, secrets_manager: SecretsManager):
        self.secrets_manager = secrets_manager
        self.session = requests.Session()
        self._setup_session()
    
    def _setup_session(self):
        """Configure the requests session with proper headers"""
        token = self.secrets_manager.get_notion_token()
        
        self.session.headers.update({
            'Authorization': f'Bearer {token}',
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json',
            'User-Agent': 'NotionLawDataCollector/1.0'
        })
        self.session.timeout = 30
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[Any, Any]:
        """Make a request to Notion API with proper error handling"""
        url = f"{NOTION_BASE_URL}{endpoint}"
        
        try:
            logger.info(f"Making {method} request to {endpoint}")
            response = self.session.request(method, url, **kwargs)
            
            # Log request details (excluding sensitive data)
            logger.info(f"Request: {method} {endpoint} - Status: {response.status_code}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            # Handle Notion API errors
            try:
                error_data = response.json()
                notion_error = error_data.get('code', 'unknown_error')
                message = error_data.get('message', str(e))
            except (ValueError, AttributeError):
                notion_error = 'http_error'
                message = str(e)
            
            logger.error(f"Notion API error: {response.status_code} - {message}")
            raise NotionAPIError(message, response.status_code, error_data)
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {e}")
            raise NotionAPIError(f"Network error: {e}", 503)
    
    def get_database(self, database_id: str) -> Dict[Any, Any]:
        """Retrieve database information"""
        return self._make_request('GET', f'/databases/{database_id}')
    
    def query_database(self, database_id: str, **query_params) -> Dict[Any, Any]:
        """Query database with optional parameters"""
        return self._make_request('POST', f'/databases/{database_id}/query', json=query_params)
    
    def create_page(self, page_data: Dict[Any, Any]) -> Dict[Any, Any]:
        """Create a new page in Notion"""
        return self._make_request('POST', '/pages', json=page_data)
    
    def get_data_source_id(self, database_id: str) -> Optional[str]:
        """
        Dynamically fetch data_source_id for multi-source databases (API 2025-09-03)
        This handles the new multi-source database feature in Notion API
        """
        try:
            database_info = self.get_database(database_id)
            
            # Check if this is a multi-source database
            data_sources = database_info.get('data_sources', [])
            if data_sources:
                # Return the first data source ID for simplicity
                # In production, you might want to implement logic to select the appropriate source
                return data_sources[0].get('id')
            
            return None
        except NotionAPIError:
            # If we can't retrieve data source info, continue without it
            logger.warning(f"Could not retrieve data_source_id for database {database_id}")
            return None

def validate_database_id(database_id: str) -> str:
    """Validate and normalize database ID format"""
    if not database_id:
        raise ValueError("Database ID is required")
    
    # Remove hyphens and validate format
    clean_id = database_id.replace('-', '').lower()
    
    if len(clean_id) != 32 or not all(c in '0123456789abcdef' for c in clean_id):
        raise ValueError("Invalid database ID format. Must be 32 hexadecimal characters.")
    
    return clean_id

def create_cors_response(status_code: int, body: Dict[Any, Any]) -> Dict[str, Any]:
    """Create a properly formatted Lambda response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body, ensure_ascii=False)
    }

def create_error_response(message: str, status_code: int = 500, details: Optional[Dict] = None) -> Dict[str, Any]:
    """Create a standardized error response"""
    error_body = {
        'error': True,
        'message': message
    }
    
    if details and os.environ.get('NODE_ENV') == 'development':
        error_body['details'] = details
    
    logger.error(f"Error response: {status_code} - {message}")
    return create_cors_response(status_code, error_body)

def create_success_response(data: Dict[Any, Any], status_code: int = 200) -> Dict[str, Any]:
    """Create a standardized success response"""
    success_body = {
        'error': False,
        'data': data
    }
    
    return create_cors_response(status_code, success_body)

def handle_preflight(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Handle CORS preflight OPTIONS requests"""
    if event.get('httpMethod') == 'OPTIONS':
        return create_cors_response(204, {})
    return None

def parse_event_body(event: Dict[str, Any]) -> Dict[Any, Any]:
    """Parse and validate Lambda event body"""
    body = event.get('body', '{}')
    
    if isinstance(body, str):
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON in request body")
    
    return body if isinstance(body, dict) else {}

def get_query_parameter(event: Dict[str, Any], param_name: str, required: bool = True) -> Optional[str]:
    """Extract query parameter from Lambda event"""
    query_params = event.get('queryStringParameters') or {}
    value = query_params.get(param_name)
    
    if required and not value:
        raise ValueError(f"Missing required query parameter: {param_name}")
    
    return value