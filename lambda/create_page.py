"""
AWS Lambda function for creating new pages in Notion database
Handles POST requests to create case entries
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
    parse_event_body
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def validate_page_properties(properties: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and format page properties for Notion API 2025-09-03
    """
    if not properties:
        raise ValueError("Properties are required")
    
    # Ensure Title property exists
    if 'Title' not in properties:
        raise ValueError("Title property is required")
    
    # Validate Title property format
    title_prop = properties['Title']
    if not isinstance(title_prop, dict) or 'title' not in title_prop:
        raise ValueError("Title property must have 'title' field")
    
    return properties

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for creating new pages in Notion database
    
    Expected event structure:
    {
        "httpMethod": "POST",
        "body": "{
            \"databaseId\": \"40c4cef5c8cd4cb4891a35c3710df6e9\",
            \"properties\": {
                \"Title\": {
                    \"title\": [{\"text\": {\"content\": \"Case Title\"}}]
                },
                \"Case Number\": {
                    \"rich_text\": [{\"text\": {\"content\": \"CASE-2025-001\"}}]
                }
            }
        }"
    }
    """
    try:
        # Handle preflight CORS requests
        preflight_response = handle_preflight(event)
        if preflight_response:
            return preflight_response
        
        # Validate HTTP method
        http_method = event.get('httpMethod', '').upper()
        if http_method != 'POST':
            return create_error_response(f"Method {http_method} not allowed", 405)
        
        # Parse request body
        body = parse_event_body(event)
        
        # Extract and validate required fields
        database_id = body.get('databaseId')
        properties = body.get('properties')
        
        if not database_id:
            return create_error_response("Missing required field: databaseId", 400)
        
        if not properties:
            return create_error_response("Missing required field: properties", 400)
        
        # Validate database ID format
        clean_database_id = validate_database_id(database_id)
        
        # Validate properties
        validated_properties = validate_page_properties(properties)
        
        logger.info(f"Creating page in database: {clean_database_id}")
        
        # Initialize AWS services and Notion client
        secrets_manager = SecretsManager()
        notion_client = NotionClient(secrets_manager)
        
        # Check if this is a multi-source database and get data_source_id if needed
        data_source_id = notion_client.get_data_source_id(clean_database_id)
        
        # Prepare page data for Notion API
        page_data = {
            'parent': {
                'database_id': clean_database_id
            },
            'properties': validated_properties
        }
        
        # Add data_source_id if available (for multi-source databases in 2025-09-03)
        if data_source_id:
            page_data['parent']['data_source_id'] = data_source_id
            logger.info(f"Using data_source_id: {data_source_id}")
        
        # Create the page
        created_page = notion_client.create_page(page_data)
        
        # Extract relevant information for response
        response_data = {
            'id': created_page.get('id'),
            'url': created_page.get('url'),
            'created_time': created_page.get('created_time'),
            'properties': created_page.get('properties', {}),
            'api_version': '2025-09-03'
        }
        
        if data_source_id:
            response_data['data_source_id'] = data_source_id
        
        logger.info(f"Successfully created page: {response_data['id']}")
        return create_success_response(response_data, 201)
        
    except ValueError as e:
        # Handle validation errors
        return create_error_response(str(e), 400)
        
    except NotionAPIError as e:
        # Handle Notion API specific errors
        if e.status_code == 401:
            return create_error_response("Invalid Notion API token or insufficient permissions", 401)
        elif e.status_code == 404:
            return create_error_response("Database not found or integration lacks access", 404)
        elif e.status_code == 400:
            return create_error_response(f"Invalid request data: {e.message}", 400)
        elif e.status_code == 429:
            return create_error_response("Rate limit exceeded. Please try again later.", 429)
        else:
            return create_error_response(f"Notion API error: {e.message}", e.status_code)
    
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error in create_page: {e}", exc_info=True)
        return create_error_response("Internal server error", 500)

# For testing purposes, allow direct invocation
if __name__ == "__main__":
    # Test event for local testing
    test_event = {
        "httpMethod": "POST",
        "body": '{"databaseId": "40c4cef5c8cd4cb4891a35c3710df6e9", "properties": {"Title": {"title": [{"text": {"content": "Test Case"}}]}}}'
    }
    
    result = lambda_handler(test_event, None)
    print(f"Test result: {result}")