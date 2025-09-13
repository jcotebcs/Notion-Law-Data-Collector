"""
AWS Lambda function for testing Notion database connection
Handles GET requests to test database connectivity and permissions
"""
import logging
from typing import Dict, Any
from utils import (
    SecretsManager, 
    NotionClient, 
    NotionAPIError,
    validate_database_id,
    create_error_response,
    create_success_response,
    handle_preflight,
    get_query_parameter
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for testing Notion database connection
    
    Expected event structure:
    {
        "httpMethod": "GET",
        "queryStringParameters": {
            "databaseId": "40c4cef5c8cd4cb4891a35c3710df6e9"
        }
    }
    """
    try:
        # Handle preflight CORS requests
        preflight_response = handle_preflight(event)
        if preflight_response:
            return preflight_response
        
        # Validate HTTP method
        http_method = event.get('httpMethod', '').upper()
        if http_method != 'GET':
            return create_error_response(f"Method {http_method} not allowed", 405)
        
        # Extract and validate database ID
        database_id = get_query_parameter(event, 'databaseId', required=True)
        clean_database_id = validate_database_id(database_id)
        
        logger.info(f"Testing connection for database: {clean_database_id}")
        
        # Initialize AWS services and Notion client
        secrets_manager = SecretsManager()
        notion_client = NotionClient(secrets_manager)
        
        # Test connection by retrieving database information
        database_info = notion_client.get_database(clean_database_id)
        
        # Extract relevant information for response
        response_data = {
            'id': database_info.get('id'),
            'title': database_info.get('title', []),
            'properties': list(database_info.get('properties', {}).keys()),
            'created_time': database_info.get('created_time'),
            'last_edited_time': database_info.get('last_edited_time'),
            'api_version': '2025-09-03'
        }
        
        # Check for data sources (multi-source database feature in 2025-09-03)
        data_sources = database_info.get('data_sources', [])
        if data_sources:
            response_data['data_sources'] = [
                {
                    'id': ds.get('id'),
                    'type': ds.get('type')
                } for ds in data_sources
            ]
            response_data['is_multi_source'] = True
        else:
            response_data['is_multi_source'] = False
        
        logger.info(f"Successfully connected to database {clean_database_id}")
        return create_success_response(response_data)
        
    except ValueError as e:
        # Handle validation errors (missing parameters, invalid format, etc.)
        return create_error_response(str(e), 400)
        
    except NotionAPIError as e:
        # Handle Notion API specific errors
        if e.status_code == 401:
            return create_error_response("Invalid Notion API token or insufficient permissions", 401)
        elif e.status_code == 404:
            return create_error_response("Database not found or integration lacks access", 404)
        elif e.status_code == 429:
            return create_error_response("Rate limit exceeded. Please try again later.", 429)
        else:
            return create_error_response(f"Notion API error: {e.message}", e.status_code)
    
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error in test_connection: {e}", exc_info=True)
        return create_error_response("Internal server error", 500)

# For testing purposes, allow direct invocation
if __name__ == "__main__":
    # Test event for local testing
    test_event = {
        "httpMethod": "GET",
        "queryStringParameters": {
            "databaseId": "40c4cef5c8cd4cb4891a35c3710df6e9"
        }
    }
    
    result = lambda_handler(test_event, None)
    print(f"Test result: {result}")