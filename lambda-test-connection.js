/**
 * AWS Lambda Function for Notion Test Connection (JavaScript)
 * ===========================================================
 * Tests connection to a Notion database and validates permissions.
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import axios from 'axios';

// Constants
const NOTION_VERSION = '2025-09-03';
const NOTION_BASE_URL = 'https://api.notion.com/v1';

// Initialize AWS clients
const secretsClient = new SecretsManagerClient({
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

/**
 * Get Notion API token from AWS Secrets Manager
 */
async function getNotionToken() {
    const secretArn = process.env.NOTION_API_SECRET_ARN;
    if (!secretArn) {
        throw new Error('NOTION_API_SECRET_ARN environment variable not set');
    }

    try {
        const command = new GetSecretValueCommand({ SecretId: secretArn });
        const response = await secretsClient.send(command);
        const secretData = JSON.parse(response.SecretString);
        return secretData.notion_api_token;
    } catch (error) {
        console.error('Failed to get Notion token:', error);
        throw error;
    }
}

/**
 * AWS Lambda handler function for testing Notion database connection
 */
export const handler = async (event) => {
    console.log('Test Connection - Processing event:', JSON.stringify(event, null, 2));

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

        // Only allow GET requests
        if (event.httpMethod !== 'GET') {
            return {
                statusCode: 405,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Method not allowed',
                    details: `${event.httpMethod} is not allowed for this endpoint`
                })
            };
        }

        // Get database ID from query parameters
        const queryParams = event.queryStringParameters || {};
        const databaseId = queryParams.databaseId;

        if (!databaseId) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Missing required parameter',
                    details: 'databaseId parameter is required'
                })
            };
        }

        // Validate database ID format (should be 32 characters)
        if (!/^[a-f0-9]{32}$/i.test(databaseId.replace(/-/g, ''))) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Invalid database ID format',
                    details: 'Database ID should be 32 hexadecimal characters'
                })
            };
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

        // Test connection to the database
        try {
            const response = await axios.get(`${NOTION_BASE_URL}/databases/${databaseId}`, {
                headers: {
                    'Authorization': `Bearer ${notionToken}`,
                    'Notion-Version': NOTION_VERSION,
                    'Content-Type': 'application/json'
                }
            });

            // Check if database has data sources (required for 2025-09-03 API)
            const dataSources = response.data.data_sources;
            if (!dataSources || dataSources.length === 0) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        error: 'Database has no data sources available',
                        details: 'This database cannot be queried with the current API version'
                    })
                };
            }

            // Return success with database info
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    id: response.data.id,
                    title: response.data.title,
                    properties: Object.keys(response.data.properties),
                    data_sources: dataSources,
                    primary_data_source_id: dataSources[0].id,
                    created_time: response.data.created_time,
                    last_edited_time: response.data.last_edited_time,
                    api_version: NOTION_VERSION,
                    status: 'connected'
                })
            };

        } catch (error) {
            console.error('Notion API request failed:', error.response?.data);
            
            if (error.response) {
                const status = error.response.status;
                const notionError = error.response.data;
                
                if (status === 401) {
                    return {
                        statusCode: 401,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            error: 'Invalid Notion API key',
                            details: 'The API key is invalid or has been revoked'
                        })
                    };
                } else if (status === 404) {
                    return {
                        statusCode: 404,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            error: 'Database not found or integration lacks access',
                            details: 'The database does not exist or the integration does not have access'
                        })
                    };
                } else {
                    return {
                        statusCode: status,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            error: 'Notion API error',
                            details: notionError.message || 'Unknown error from Notion API'
                        })
                    };
                }
            }
            
            throw error;
        }

    } catch (error) {
        console.error('Unexpected error in test-connection handler:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Internal server error',
                details: 'An unexpected error occurred while testing the connection'
            })
        };
    }
};