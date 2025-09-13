"""
Unit tests for AWS Lambda functions
"""
import sys
import os
import json
import unittest
from unittest.mock import Mock, patch, MagicMock
import pytest

# Add lambda directory to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lambda'))

from utils import (
    SecretsManager, 
    NotionClient, 
    NotionAPIError,
    validate_database_id,
    create_error_response,
    create_success_response,
    handle_preflight,
    parse_event_body,
    get_query_parameter
)
import test_connection
import create_page
import query_database

class TestUtils(unittest.TestCase):
    """Test utility functions"""
    
    def test_validate_database_id_valid(self):
        """Test database ID validation with valid IDs"""
        valid_ids = [
            "40c4cef5c8cd4cb4891a35c3710df6e9",
            "40c4cef5-c8cd-4cb4-891a-35c3710df6e9",
            "40C4CEF5C8CD4CB4891A35C3710DF6E9"
        ]
        
        for db_id in valid_ids:
            result = validate_database_id(db_id)
            self.assertEqual(len(result), 32)
            self.assertTrue(all(c in '0123456789abcdef' for c in result))
    
    def test_validate_database_id_invalid(self):
        """Test database ID validation with invalid IDs"""
        invalid_ids = [
            "",
            "short",
            "40c4cef5c8cd4cb4891a35c3710df6e9x",  # 33 chars
            "40c4cef5c8cd4cb4891a35c3710df6e",   # 31 chars
            "gggggggggggggggggggggggggggggggg"   # invalid hex
        ]
        
        for db_id in invalid_ids:
            with self.assertRaises(ValueError):
                validate_database_id(db_id)
    
    def test_create_cors_response(self):
        """Test CORS response creation"""
        response = create_success_response({"test": "data"})
        
        self.assertEqual(response['statusCode'], 200)
        self.assertIn('Access-Control-Allow-Origin', response['headers'])
        self.assertEqual(response['headers']['Access-Control-Allow-Origin'], '*')
        
        body = json.loads(response['body'])
        self.assertFalse(body['error'])
        self.assertEqual(body['data']['test'], 'data')
    
    def test_handle_preflight(self):
        """Test CORS preflight handling"""
        options_event = {'httpMethod': 'OPTIONS'}
        response = handle_preflight(options_event)
        
        self.assertIsNotNone(response)
        self.assertEqual(response['statusCode'], 204)
        
        get_event = {'httpMethod': 'GET'}
        response = handle_preflight(get_event)
        self.assertIsNone(response)
    
    def test_parse_event_body(self):
        """Test event body parsing"""
        # Test with string body
        event = {'body': '{"test": "value"}'}
        result = parse_event_body(event)
        self.assertEqual(result['test'], 'value')
        
        # Test with dict body
        event = {'body': {"test": "value"}}
        result = parse_event_body(event)
        self.assertEqual(result['test'], 'value')
        
        # Test with invalid JSON
        event = {'body': 'invalid json'}
        with self.assertRaises(ValueError):
            parse_event_body(event)
    
    def test_get_query_parameter(self):
        """Test query parameter extraction"""
        event = {
            'queryStringParameters': {
                'param1': 'value1',
                'param2': 'value2'
            }
        }
        
        # Test required parameter exists
        result = get_query_parameter(event, 'param1')
        self.assertEqual(result, 'value1')
        
        # Test required parameter missing
        with self.assertRaises(ValueError):
            get_query_parameter(event, 'missing')
        
        # Test optional parameter missing
        result = get_query_parameter(event, 'missing', required=False)
        self.assertIsNone(result)

class TestSecretsManager(unittest.TestCase):
    """Test AWS Secrets Manager integration"""
    
    @patch.dict(os.environ, {'NOTION_API_SECRET_ARN': 'test-arn'})
    @patch('boto3.client')
    def test_get_notion_token_success(self, mock_boto3_client):
        """Test successful token retrieval"""
        mock_client = Mock()
        mock_boto3_client.return_value = mock_client
        
        # Mock successful secret retrieval
        mock_client.get_secret_value.return_value = {
            'SecretString': '{"notion_api_token": "secret_test_token"}'
        }
        
        secrets_manager = SecretsManager()
        token = secrets_manager.get_notion_token()
        
        self.assertEqual(token, "secret_test_token")
        mock_client.get_secret_value.assert_called_once_with(SecretId='test-arn')
    
    @patch.dict(os.environ, {'AWS_DEFAULT_REGION': 'us-east-1'}, clear=True)
    def test_get_notion_token_no_arn(self):
        """Test token retrieval without ARN environment variable"""
        with self.assertRaises(ValueError) as cm:
            secrets_manager = SecretsManager()
            secrets_manager.get_notion_token()
        
        self.assertIn("NOTION_API_SECRET_ARN", str(cm.exception))
    
    @patch.dict(os.environ, {'NOTION_API_SECRET_ARN': 'test-arn'})
    @patch('boto3.client')
    def test_get_notion_token_invalid_json(self, mock_boto3_client):
        """Test token retrieval with invalid JSON"""
        mock_client = Mock()
        mock_boto3_client.return_value = mock_client
        
        # Mock invalid JSON response
        mock_client.get_secret_value.return_value = {
            'SecretString': 'invalid json'
        }
        
        secrets_manager = SecretsManager()
        with self.assertRaises(ValueError) as cm:
            secrets_manager.get_notion_token()
        
        self.assertIn("Invalid secret format", str(cm.exception))

class TestNotionClient(unittest.TestCase):
    """Test Notion API client"""
    
    @patch('test_connection.SecretsManager')
    @patch('requests.Session')
    def test_notion_client_initialization(self, mock_session, mock_secrets_manager):
        """Test Notion client initialization"""
        mock_secrets = Mock()
        mock_secrets.get_notion_token.return_value = "secret_test_token"
        mock_secrets_manager.return_value = mock_secrets
        
        mock_session_instance = Mock()
        mock_session.return_value = mock_session_instance
        
        client = NotionClient(mock_secrets)
        
        # Verify headers are set correctly
        expected_headers = {
            'Authorization': 'Bearer secret_test_token',
            'Notion-Version': '2025-09-03',
            'Content-Type': 'application/json',
            'User-Agent': 'NotionLawDataCollector/1.0'
        }
        
        mock_session_instance.headers.update.assert_called_once_with(expected_headers)

class TestTestConnectionLambda(unittest.TestCase):
    """Test test_connection Lambda function"""
    
    @patch('test_connection.SecretsManager')
    @patch('test_connection.NotionClient')
    def test_test_connection_success(self, mock_notion_client, mock_secrets_manager):
        """Test successful database connection test"""
        # Setup mocks
        mock_secrets = Mock()
        mock_secrets_manager.return_value = mock_secrets
        
        mock_client = Mock()
        mock_notion_client.return_value = mock_client
        
        # Mock successful database response
        mock_client.get_database.return_value = {
            'id': '40c4cef5c8cd4cb4891a35c3710df6e9',
            'title': [{'text': {'content': 'Test Database'}}],
            'properties': {
                'Title': {'type': 'title'},
                'Status': {'type': 'select'}
            },
            'created_time': '2025-01-01T00:00:00.000Z',
            'last_edited_time': '2025-01-01T00:00:00.000Z'
        }
        
        # Test event
        event = {
            'httpMethod': 'GET',
            'queryStringParameters': {
                'databaseId': '40c4cef5c8cd4cb4891a35c3710df6e9'
            }
        }
        
        response = test_connection.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertFalse(body['error'])
        self.assertIn('data', body)
        self.assertEqual(body['data']['id'], '40c4cef5c8cd4cb4891a35c3710df6e9')
    
    def test_test_connection_invalid_method(self):
        """Test with invalid HTTP method"""
        event = {
            'httpMethod': 'POST',
            'queryStringParameters': {
                'databaseId': '40c4cef5c8cd4cb4891a35c3710df6e9'
            }
        }
        
        response = test_connection.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 405)
        body = json.loads(response['body'])
        self.assertTrue(body['error'])
    
    def test_test_connection_missing_database_id(self):
        """Test with missing database ID"""
        event = {
            'httpMethod': 'GET',
            'queryStringParameters': {}
        }
        
        response = test_connection.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertTrue(body['error'])
        self.assertIn('databaseId', body['message'])
    
    def test_test_connection_options_preflight(self):
        """Test CORS preflight handling"""
        event = {'httpMethod': 'OPTIONS'}
        
        response = test_connection.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 204)

class TestCreatePageLambda(unittest.TestCase):
    """Test create_page Lambda function"""
    
    @patch('create_page.SecretsManager')
    @patch('create_page.NotionClient')
    def test_create_page_success(self, mock_notion_client, mock_secrets_manager):
        """Test successful page creation"""
        # Setup mocks
        mock_secrets = Mock()
        mock_secrets_manager.return_value = mock_secrets
        
        mock_client = Mock()
        mock_notion_client.return_value = mock_client
        
        # Mock successful page creation
        mock_client.create_page.return_value = {
            'id': 'page-id-123',
            'url': 'https://notion.so/page-id-123',
            'created_time': '2025-01-01T00:00:00.000Z',
            'properties': {}
        }
        mock_client.get_data_source_id.return_value = None
        
        # Test event
        event = {
            'httpMethod': 'POST',
            'body': json.dumps({
                'databaseId': '40c4cef5c8cd4cb4891a35c3710df6e9',
                'properties': {
                    'Title': {
                        'title': [{'text': {'content': 'Test Case'}}]
                    }
                }
            })
        }
        
        response = create_page.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 201)
        body = json.loads(response['body'])
        self.assertFalse(body['error'])
        self.assertIn('data', body)
        self.assertEqual(body['data']['id'], 'page-id-123')
    
    def test_create_page_missing_title(self):
        """Test page creation without required Title property"""
        event = {
            'httpMethod': 'POST',
            'body': json.dumps({
                'databaseId': '40c4cef5c8cd4cb4891a35c3710df6e9',
                'properties': {
                    'Status': {'select': {'name': 'Active'}}
                }
            })
        }
        
        response = create_page.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertTrue(body['error'])
        self.assertIn('Title', body['message'])

class TestQueryDatabaseLambda(unittest.TestCase):
    """Test query_database Lambda function"""
    
    @patch('query_database.SecretsManager')
    @patch('query_database.NotionClient')
    def test_query_database_success(self, mock_notion_client, mock_secrets_manager):
        """Test successful database query"""
        # Setup mocks
        mock_secrets = Mock()
        mock_secrets_manager.return_value = mock_secrets
        
        mock_client = Mock()
        mock_notion_client.return_value = mock_client
        
        # Mock successful query response
        mock_client.query_database.return_value = {
            'results': [{
                'id': 'page-1',
                'created_time': '2025-01-01T00:00:00.000Z',
                'last_edited_time': '2025-01-01T00:00:00.000Z',
                'url': 'https://notion.so/page-1',
                'properties': {
                    'Title': {
                        'type': 'title',
                        'title': [{'plain_text': 'Test Case 1'}]
                    }
                }
            }],
            'next_cursor': None,
            'has_more': False
        }
        mock_client.get_data_source_id.return_value = None
        
        # Test event
        event = {
            'httpMethod': 'POST',
            'body': json.dumps({
                'databaseId': '40c4cef5c8cd4cb4891a35c3710df6e9',
                'page_size': 5
            })
        }
        
        response = query_database.lambda_handler(event, None)
        
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertFalse(body['error'])
        self.assertIn('data', body)
        self.assertEqual(len(body['data']['results']), 1)

if __name__ == '__main__':
    # Run the tests
    unittest.main(verbosity=2)