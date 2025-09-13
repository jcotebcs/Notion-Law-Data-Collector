#!/usr/bin/env python3
"""
Unit Tests for Notion API Lambda Function
=========================================

This module contains comprehensive unit tests for the AWS Lambda function
that serves as a proxy for Notion API requests.
"""

import json
import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(__file__))

import lambda_function


class TestNotionLambdaProxy:
    """Test class for Notion Lambda proxy function."""
    
    def setup_method(self):
        """Set up test fixtures before each test method."""
        # Clear cache before each test
        lambda_function.data_source_cache.clear()
        
        # Mock environment variables
        self.mock_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:notion-api-token-abcdef"
        self.mock_notion_token = "secret_test_token_123"
        self.mock_database_id = "40c4cef5c8cd4cb4891a35c3710df6e9"
    
    @patch.dict(os.environ, {'NOTION_API_SECRET_ARN': 'arn:aws:secretsmanager:us-east-1:123456789012:secret:notion-api-token-abcdef'})
    @patch('lambda_function.secrets_client')
    def test_get_secret_success(self, mock_secrets_client):
        """Test successful secret retrieval from AWS Secrets Manager."""
        # Mock the response
        mock_secrets_client.get_secret_value.return_value = {
            'SecretString': self.mock_notion_token
        }
        
        # Test the function
        result = lambda_function.get_secret(self.mock_secret_arn)
        
        # Assertions
        assert result == self.mock_notion_token
        mock_secrets_client.get_secret_value.assert_called_once_with(SecretId=self.mock_secret_arn)
    
    @patch('lambda_function.secrets_client')
    def test_get_secret_failure(self, mock_secrets_client):
        """Test secret retrieval failure handling."""
        # Mock the exception
        mock_secrets_client.get_secret_value.side_effect = Exception("Access denied")
        
        # Test the function
        with pytest.raises(Exception, match="Access denied"):
            lambda_function.get_secret(self.mock_secret_arn)
    
    @patch.dict(os.environ, {'NOTION_API_SECRET_ARN': 'arn:aws:secretsmanager:us-east-1:123456789012:secret:notion-api-token-abcdef'})
    @patch('lambda_function.get_secret')
    def test_get_notion_token_success(self, mock_get_secret):
        """Test successful Notion token retrieval."""
        mock_get_secret.return_value = self.mock_notion_token
        
        result = lambda_function.get_notion_token()
        
        assert result == self.mock_notion_token
        mock_get_secret.assert_called_once_with(self.mock_secret_arn)
    
    def test_get_notion_token_missing_env_var(self):
        """Test Notion token retrieval with missing environment variable."""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="NOTION_API_SECRET_ARN environment variable not set"):
                lambda_function.get_notion_token()
    
    @patch('lambda_function.http')
    def test_get_data_source_id_success(self, mock_http):
        """Test successful data_source_id retrieval."""
        # Mock response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = json.dumps({
            "data_source_id": "test_data_source_123",
            "id": self.mock_database_id
        }).encode('utf-8')
        mock_http.request.return_value = mock_response
        
        # Test the function
        result = lambda_function.get_data_source_id(self.mock_notion_token, self.mock_database_id)
        
        # Assertions
        assert result == "test_data_source_123"
        assert lambda_function.data_source_cache[self.mock_database_id] == "test_data_source_123"
    
    @patch('lambda_function.http')
    def test_get_data_source_id_cached(self, mock_http):
        """Test data_source_id retrieval from cache."""
        # Pre-populate cache
        lambda_function.data_source_cache[self.mock_database_id] = "cached_data_source_123"
        
        # Test the function
        result = lambda_function.get_data_source_id(self.mock_notion_token, self.mock_database_id)
        
        # Assertions
        assert result == "cached_data_source_123"
        # Should not make HTTP request when cached
        mock_http.request.assert_not_called()
    
    @patch('lambda_function.http')
    def test_get_data_source_id_api_error(self, mock_http):
        """Test data_source_id retrieval with API error."""
        # Mock error response
        mock_response = Mock()
        mock_response.status = 401
        mock_response.data = b'{"error": "Unauthorized"}'
        mock_http.request.return_value = mock_response
        
        # Test the function
        result = lambda_function.get_data_source_id(self.mock_notion_token, self.mock_database_id)
        
        # Assertions
        assert result is None
    
    @patch('lambda_function.http')
    def test_make_notion_request_get_success(self, mock_http):
        """Test successful GET request to Notion API."""
        # Mock response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.headers = {'Content-Type': 'application/json'}
        mock_response.data = json.dumps({"results": []}).encode('utf-8')
        mock_http.request.return_value = mock_response
        
        # Test the function
        result = lambda_function.make_notion_request(
            'GET', 
            '/databases/test/query', 
            self.mock_notion_token
        )
        
        # Assertions
        assert result['status_code'] == 200
        assert result['data'] == {"results": []}
        assert 'Content-Type' in result['headers']
    
    @patch('lambda_function.http')
    def test_make_notion_request_post_with_body(self, mock_http):
        """Test POST request with body to Notion API."""
        # Mock response
        mock_response = Mock()
        mock_response.status = 201
        mock_response.headers = {'Content-Type': 'application/json'}
        mock_response.data = json.dumps({"id": "new_page_123"}).encode('utf-8')
        mock_http.request.return_value = mock_response
        
        # Test data
        test_body = {"properties": {"Name": {"title": [{"text": {"content": "Test"}}]}}}
        
        # Test the function
        result = lambda_function.make_notion_request(
            'POST', 
            '/pages', 
            self.mock_notion_token,
            test_body
        )
        
        # Assertions
        assert result['status_code'] == 201
        assert result['data'] == {"id": "new_page_123"}
    
    @patch('lambda_function.http')
    def test_make_notion_request_network_error(self, mock_http):
        """Test network error handling in make_notion_request."""
        # Mock network error
        mock_http.request.side_effect = Exception("Network error")
        
        # Test the function
        result = lambda_function.make_notion_request(
            'GET', 
            '/databases/test/query', 
            self.mock_notion_token
        )
        
        # Assertions
        assert result['status_code'] == 500
        assert 'error' in result['data']
        assert 'Network error' in result['data']['details']
    
    @patch('lambda_function.get_notion_token')
    @patch('lambda_function.get_data_source_id')
    @patch('lambda_function.make_notion_request')
    def test_lambda_handler_get_database_success(self, mock_make_request, mock_get_data_source, mock_get_token):
        """Test successful database query through Lambda handler."""
        # Mock dependencies
        mock_get_token.return_value = self.mock_notion_token
        mock_get_data_source.return_value = "test_data_source_123"
        mock_make_request.return_value = {
            'status_code': 200,
            'headers': {'Content-Type': 'application/json'},
            'data': {"results": []}
        }
        
        # Test event
        event = {
            'httpMethod': 'GET',
            'path': f'/databases/{self.mock_database_id}/query',
            'queryStringParameters': None,
            'headers': {},
            'body': None
        }
        
        # Test the function
        result = lambda_function.lambda_handler(event, None)
        
        # Assertions
        assert result['statusCode'] == 200
        assert 'Access-Control-Allow-Origin' in result['headers']
        
        response_body = json.loads(result['body'])
        assert 'results' in response_body
        assert '_metadata' in response_body
        assert response_body['_metadata']['database_id'] == self.mock_database_id
    
    def test_lambda_handler_options_request(self):
        """Test CORS preflight OPTIONS request handling."""
        # Test event
        event = {
            'httpMethod': 'OPTIONS',
            'path': '/databases/test/query',
            'queryStringParameters': None,
            'headers': {},
            'body': None
        }
        
        # Test the function
        result = lambda_function.lambda_handler(event, None)
        
        # Assertions
        assert result['statusCode'] == 200
        assert result['headers']['Access-Control-Allow-Origin'] == '*'
        assert 'Access-Control-Allow-Methods' in result['headers']
        assert 'GET,POST,PATCH,DELETE,OPTIONS' in result['headers']['Access-Control-Allow-Methods']
    
    @patch('lambda_function.get_notion_token')
    def test_lambda_handler_auth_error(self, mock_get_token):
        """Test Lambda handler with authentication error."""
        # Mock authentication failure
        mock_get_token.side_effect = Exception("Failed to get token")
        
        # Test event
        event = {
            'httpMethod': 'GET',
            'path': f'/databases/{self.mock_database_id}/query',
            'queryStringParameters': None,
            'headers': {},
            'body': None
        }
        
        # Test the function
        result = lambda_function.lambda_handler(event, None)
        
        # Assertions
        assert result['statusCode'] == 500
        response_body = json.loads(result['body'])
        assert 'Authentication configuration error' in response_body['error']
    
    def test_lambda_handler_invalid_json_body(self):
        """Test Lambda handler with invalid JSON in request body."""
        # Test event with invalid JSON
        event = {
            'httpMethod': 'POST',
            'path': f'/databases/{self.mock_database_id}',
            'queryStringParameters': None,
            'headers': {},
            'body': '{"invalid": json}'
        }
        
        # Test the function
        result = lambda_function.lambda_handler(event, None)
        
        # Assertions
        assert result['statusCode'] == 400
        response_body = json.loads(result['body'])
        assert 'Invalid JSON in request body' in response_body['error']
    
    @patch('lambda_function.get_notion_token')
    def test_lambda_handler_invalid_endpoint(self, mock_get_token):
        """Test Lambda handler with unsupported endpoint."""
        # Mock authentication to pass
        mock_get_token.return_value = self.mock_notion_token
        
        # Test event with invalid path
        event = {
            'httpMethod': 'GET',
            'path': '/invalid/endpoint',
            'queryStringParameters': None,
            'headers': {},
            'body': None
        }
        
        # Test the function
        result = lambda_function.lambda_handler(event, None)
        
        # Assertions
        assert result['statusCode'] == 404
        response_body = json.loads(result['body'])
        assert 'Endpoint not found' in response_body['error']
    
    @patch('lambda_function.get_notion_token')
    @patch('lambda_function.get_data_source_id')
    @patch('lambda_function.make_notion_request')
    def test_lambda_handler_with_query_parameters(self, mock_make_request, mock_get_data_source, mock_get_token):
        """Test Lambda handler with query parameters."""
        # Mock dependencies
        mock_get_token.return_value = self.mock_notion_token
        mock_get_data_source.return_value = "test_data_source_123"
        mock_make_request.return_value = {
            'status_code': 200,
            'headers': {'Content-Type': 'application/json'},
            'data': {"results": []}
        }
        
        # Test event with query parameters
        event = {
            'httpMethod': 'GET',
            'path': f'/databases/{self.mock_database_id}/query',
            'queryStringParameters': {'page_size': '50', 'start_cursor': 'abc123'},
            'headers': {},
            'body': None
        }
        
        # Test the function
        result = lambda_function.lambda_handler(event, None)
        
        # Assertions
        assert result['statusCode'] == 200
        # Check that make_notion_request was called with query parameters
        mock_make_request.assert_called_once()
        called_args = mock_make_request.call_args
        endpoint = called_args[0][1]  # Second argument is the endpoint
        assert 'page_size=50' in endpoint
        assert 'start_cursor=abc123' in endpoint


# Test configuration for pytest
def test_lambda_constants():
    """Test that Lambda function constants are properly set."""
    assert lambda_function.NOTION_VERSION == "2025-09-03"
    assert lambda_function.NOTION_BASE_URL == "https://api.notion.com/v1"
    assert lambda_function.DATABASE_ID == "40c4cef5c8cd4cb4891a35c3710df6e9"


if __name__ == "__main__":
    # Run tests if executed directly
    pytest.main([__file__, "-v"])