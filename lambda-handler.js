/**
 * AWS Lambda Function for Notion API Proxy (JavaScript)
 * ====================================================
 * This serverless function acts as a secure proxy for Notion API requests,
 * addressing the "Unexpected token '<'" error by providing proper authentication,
 * error handling, and CORS support for client-side applications.
 * 
 * Key Features:
 * - Secure token management via AWS Secrets Manager
 * - Dynamic data_source_id retrieval and caching
 * - Comprehensive error handling and logging
 * - CORS support for cross-origin requests
 * - API version enforcement (2025-09-03)
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import axios from 'axios';

// Constants
const NOTION_VERSION = '2025-09-03';
const NOTION_BASE_URL = 'https://api.notion.com/v1';
const DATABASE_ID = '40c4cef5c8cd4cb4891a35c3710df6e9';

// In-memory cache for data_source_id (persists during Lambda container lifetime)
const dataSourceCache = new Map();

// Initialize AWS clients
const secretsClient = new SecretsManagerClient({
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

/**
 * Retrieve secret from AWS Secrets Manager
 */
async function getSecret(secretArn) {
    try {
        const command = new GetSecretValueCommand({ SecretId: secretArn });
        const response = await secretsClient.send(command);
        return response.SecretString;
    } catch (error) {
        console.error(`Failed to retrieve secret ${secretArn}:`, error);
        throw error;
    }
}

/**
 * Get Notion API token from AWS Secrets Manager
 */
async function getNotionToken() {
    const secretArn = process.env.NOTION_API_SECRET_ARN;
    if (!secretArn) {
        throw new Error('NOTION_API_SECRET_ARN environment variable not set');
    }

    try {
        const secretString = await getSecret(secretArn);
        const secretData = JSON.parse(secretString);
        return secretData.notion_api_token;
    } catch (error) {
        console.error('Failed to get Notion token:', error);
        throw error;
    }
}

/**
 * Get data_source_id for a database (required for API v2025-09-03)
 */
async function getDataSourceId(notionToken, databaseId) {
    // Check cache first
    if (dataSourceCache.has(databaseId)) {
        return dataSourceCache.get(databaseId);
    }

    try {
        const response = await axios.get(`${NOTION_BASE_URL}/databases/${databaseId}`, {
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': NOTION_VERSION,
                'Content-Type': 'application/json'
            }
        });

        const dataSources = response.data.data_sources;
        if (!dataSources || dataSources.length === 0) {
            throw new Error('No data sources available for this database');
        }

        const dataSourceId = dataSources[0].id;
        
        // Cache the result
        dataSourceCache.set(databaseId, dataSourceId);
        
        return dataSourceId;
    } catch (error) {
        console.error(`Failed to get data_source_id for database ${databaseId}:`, error);
        throw error;
    }
}

/**
 * Make a request to the Notion API
 */
async function makeNotionRequest(method, endpoint, notionToken, body = null) {
    const url = `${NOTION_BASE_URL}/${endpoint}`;
    
    const config = {
        method: method.toUpperCase(),
        url,
        headers: {
            'Authorization': `Bearer ${notionToken}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
        }
    };

    if (body && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PATCH')) {
        config.data = body;
    }

    try {
        const response = await axios(config);
        return {
            status_code: response.status,
            data: response.data
        };
    } catch (error) {
        console.error(`Notion API request failed: ${method} ${url}`, error.response?.data);
        
        if (error.response) {
            return {
                status_code: error.response.status,
                data: error.response.data
            };
        }
        
        throw error;
    }
}

/**
 * AWS Lambda handler function
 */
export const handler = async (event) => {
    console.log('Processing event:', JSON.stringify(event, null, 2));

    // CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Content-Type': 'application/json'
    };

    try {
        // Handle preflight requests
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'CORS preflight' })
            };
        }

        // Extract request details
        const method = event.httpMethod || 'GET';
        const path = event.path || '';
        const queryParams = event.queryStringParameters || {};
        const bodyStr = event.body;

        console.log(`Processing ${method} request to ${path}`);

        // Parse request body if present
        let body = null;
        if (bodyStr) {
            try {
                body = JSON.parse(bodyStr);
            } catch (error) {
                console.error('Invalid JSON in request body:', error);
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        error: 'Invalid JSON in request body',
                        details: error.message
                    })
                };
            }
        }

        // Get Notion API token
        let notionToken;
        try {
            notionToken = await getNotionToken();
        } catch (error) {
            console.error('Failed to get Notion token:', error);
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Authentication configuration error',
                    details: 'Failed to retrieve API credentials'
                })
            };
        }

        // Handle database query requests
        if (path.includes('databases') && path.includes(DATABASE_ID)) {
            // Get data_source_id if needed
            const dataSourceId = await getDataSourceId(notionToken, DATABASE_ID);

            // Construct endpoint
            let endpoint = path.replace('/lambda-proxy', '').replace(/^\//, '');

            // Add query parameters if present
            if (Object.keys(queryParams).length > 0) {
                const queryString = Object.entries(queryParams)
                    .map(([key, value]) => `${key}=${value}`)
                    .join('&');
                
                endpoint += endpoint.includes('?') ? `&${queryString}` : `?${queryString}`;
            }

            // Make the request
            const result = await makeNotionRequest(method, endpoint, notionToken, body);

            // Add metadata to response
            if (result.data && typeof result.data === 'object') {
                result.data._metadata = {
                    database_id: DATABASE_ID,
                    data_source_id: dataSourceId,
                    api_version: NOTION_VERSION,
                    proxy_version: '1.0.0'
                };
            }

            return {
                statusCode: result.status_code,
                headers: corsHeaders,
                body: JSON.stringify(result.data)
            };
        } else {
            // Invalid endpoint
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Endpoint not found',
                    details: `Path ${path} is not supported by this proxy`
                })
            };
        }

    } catch (error) {
        console.error('Unexpected error in lambda_handler:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Internal server error',
                details: 'An unexpected error occurred while processing the request'
            })
        };
    }
};