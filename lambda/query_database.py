"""
AWS Lambda function for querying Notion database
Handles POST requests to retrieve existing pages/cases
"""
import logging
from typing import Dict, Any, Optional
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

def validate_query_parameters(query_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and format query parameters for Notion API 2025-09-03
    """
    validated_params = {}
    
    # Handle sorting
    if 'sorts' in query_params:
        sorts = query_params['sorts']
        if not isinstance(sorts, list):
            raise ValueError("Sorts must be a list")
        validated_params['sorts'] = sorts
    
    # Handle page size
    if 'page_size' in query_params:
        page_size = query_params['page_size']
        if not isinstance(page_size, int) or page_size < 1 or page_size > 100:
            raise ValueError("Page size must be an integer between 1 and 100")
        validated_params['page_size'] = page_size
    
    # Handle start cursor for pagination
    if 'start_cursor' in query_params:
        validated_params['start_cursor'] = query_params['start_cursor']
    
    # Handle filter
    if 'filter' in query_params:
        filter_obj = query_params['filter']
        if not isinstance(filter_obj, dict):
            raise ValueError("Filter must be an object")
        validated_params['filter'] = filter_obj
    
    return validated_params

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for querying Notion database
    
    Expected event structure:
    {
        "httpMethod": "POST",
        "body": "{
            \"databaseId\": \"40c4cef5c8cd4cb4891a35c3710df6e9\",
            \"sorts\": [
                {
                    \"property\": \"created_time\",
                    \"direction\": \"descending\"
                }
            ],
            \"page_size\": 5,
            \"filter\": {
                \"property\": \"Status\",
                \"select\": {
                    \"equals\": \"Active\"
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
        
        # Extract and validate database ID
        database_id = body.get('databaseId')
        if not database_id:
            return create_error_response("Missing required field: databaseId", 400)
        
        clean_database_id = validate_database_id(database_id)
        
        # Validate query parameters
        query_params = {k: v for k, v in body.items() if k != 'databaseId'}
        validated_query_params = validate_query_parameters(query_params)
        
        logger.info(f"Querying database: {clean_database_id} with params: {validated_query_params}")
        
        # Initialize AWS services and Notion client
        secrets_manager = SecretsManager()
        notion_client = NotionClient(secrets_manager)
        
        # Check if this is a multi-source database and get data_source_id if needed
        data_source_id = notion_client.get_data_source_id(clean_database_id)
        
        # Add data_source_id to query params if available (for multi-source databases in 2025-09-03)
        if data_source_id:
            validated_query_params['data_source_id'] = data_source_id
            logger.info(f"Using data_source_id: {data_source_id}")
        
        # Query the database
        query_result = notion_client.query_database(clean_database_id, **validated_query_params)
        
        # Process results to extract relevant information
        processed_results = []
        for page in query_result.get('results', []):
            processed_page = {
                'id': page.get('id'),
                'created_time': page.get('created_time'),
                'last_edited_time': page.get('last_edited_time'),
                'url': page.get('url'),
                'properties': {}
            }
            
            # Extract property values
            properties = page.get('properties', {})
            for prop_name, prop_data in properties.items():
                prop_type = prop_data.get('type')
                
                # Extract value based on property type
                if prop_type == 'title':
                    title_list = prop_data.get('title', [])
                    processed_page['properties'][prop_name] = ''.join([t.get('plain_text', '') for t in title_list])
                elif prop_type == 'rich_text':
                    rich_text_list = prop_data.get('rich_text', [])
                    processed_page['properties'][prop_name] = ''.join([rt.get('plain_text', '') for rt in rich_text_list])
                elif prop_type == 'select':
                    select_obj = prop_data.get('select')
                    processed_page['properties'][prop_name] = select_obj.get('name') if select_obj else None
                elif prop_type == 'multi_select':
                    multi_select_list = prop_data.get('multi_select', [])
                    processed_page['properties'][prop_name] = [ms.get('name') for ms in multi_select_list]
                elif prop_type == 'date':
                    date_obj = prop_data.get('date')
                    processed_page['properties'][prop_name] = date_obj.get('start') if date_obj else None
                elif prop_type == 'number':
                    processed_page['properties'][prop_name] = prop_data.get('number')
                elif prop_type == 'checkbox':
                    processed_page['properties'][prop_name] = prop_data.get('checkbox')
                else:
                    # For other types, include the raw data
                    processed_page['properties'][prop_name] = prop_data
            
            processed_results.append(processed_page)
        
        # Prepare response data
        response_data = {
            'results': processed_results,
            'next_cursor': query_result.get('next_cursor'),
            'has_more': query_result.get('has_more', False),
            'total_count': len(processed_results),
            'api_version': '2025-09-03'
        }
        
        if data_source_id:
            response_data['data_source_id'] = data_source_id
        
        logger.info(f"Successfully queried database {clean_database_id}, found {len(processed_results)} results")
        return create_success_response(response_data)
        
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
            return create_error_response(f"Invalid query parameters: {e.message}", 400)
        elif e.status_code == 429:
            return create_error_response("Rate limit exceeded. Please try again later.", 429)
        else:
            return create_error_response(f"Notion API error: {e.message}", e.status_code)
    
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error in query_database: {e}", exc_info=True)
        return create_error_response("Internal server error", 500)

# For testing purposes, allow direct invocation
if __name__ == "__main__":
    # Test event for local testing
    test_event = {
        "httpMethod": "POST",
        "body": '{"databaseId": "40c4cef5c8cd4cb4891a35c3710df6e9", "sorts": [{"property": "created_time", "direction": "descending"}], "page_size": 5}'
    }
    
    result = lambda_handler(test_event, None)
    print(f"Test result: {result}")