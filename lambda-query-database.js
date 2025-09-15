/**
 * AWS Lambda Function for Notion Query Database (JavaScript)
 * ==========================================================
 * Queries a Notion database using the data_source API (v2025-09-03).
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import axios from 'axios';

// Constants
const NOTION_VERSION = '2025-09-03';
const NOTION_BASE_URL = 'https://api.notion.com/v1';

// In-memory cache for data_source_id (persists during Lambda container lifetime)
const dataSourceCache = new Map();

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
 * AWS Lambda handler function for querying Notion database
 */
export const handler = async (event) => {
    console.log('Query Database - Processing event:', JSON.stringify(event, null, 2));

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

        // Only allow POST requests
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Method not allowed',
                    details: `${event.httpMethod} is not allowed for this endpoint`
                })
            };
        }

        // Parse request body
        let body;
        if (!event.body) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Missing request body',
                    details: 'Request body is required for this endpoint'
                })
            };
        }

        try {
            body = JSON.parse(event.body);
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

        // Validate required fields
        const { databaseId } = body;
        if (!databaseId) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Missing required field',
                    details: 'databaseId is required'
                })
            };
        }

        // Validate database ID format
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

        // Extract query parameters with defaults
        const queryData = {
            sorts: body.sorts || [
                {
                    timestamp: 'created_time',
                    direction: 'descending'
                }
            ],
            page_size: body.page_size || 5
        };

        // Add optional parameters if present
        if (body.filter) {
            queryData.filter = body.filter;
        }
        if (body.start_cursor) {
            queryData.start_cursor = body.start_cursor;
        }

        console.log(`Querying database: ${databaseId} with params:`, queryData);

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

        // Get data_source_id (required for 2025-09-03 API)
        let dataSourceId;
        try {
            dataSourceId = await getDataSourceId(notionToken, databaseId);
        } catch (error) {
            console.error('Failed to get data source ID:', error);
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Database access error',
                    details: 'Could not access database or database has no data sources'
                })
            };
        }

        // Query the data source using data_source_id
        try {
            const response = await axios.post(`${NOTION_BASE_URL}/data_sources/${dataSourceId}/query`, queryData, {
                headers: {
                    'Authorization': `Bearer ${notionToken}`,
                    'Notion-Version': NOTION_VERSION,
                    'Content-Type': 'application/json'
                }
            });

            // Process results to extract clean property values
            const processedResults = [];
            for (const page of response.data.results || []) {
                const processedPage = {
                    id: page.id,
                    created_time: page.created_time,
                    last_edited_time: page.last_edited_time,
                    url: page.url,
                    properties: {}
                };

                // Process properties to extract readable values
                for (const [propName, propData] of Object.entries(page.properties || {})) {
                    const propType = propData.type;
                    
                    if (propType === 'title') {
                        const titleList = propData.title || [];
                        processedPage.properties[propName] = titleList.map(t => t.plain_text || '').join('');
                    } else if (propType === 'rich_text') {
                        const richTextList = propData.rich_text || [];
                        processedPage.properties[propName] = richTextList.map(rt => rt.plain_text || '').join('');
                    } else if (propType === 'select') {
                        const selectObj = propData.select;
                        processedPage.properties[propName] = selectObj ? selectObj.name : null;
                    } else if (propType === 'multi_select') {
                        const multiSelectList = propData.multi_select || [];
                        processedPage.properties[propName] = multiSelectList.map(ms => ms.name);
                    } else if (propType === 'date') {
                        const dateObj = propData.date;
                        processedPage.properties[propName] = dateObj ? dateObj.start : null;
                    } else if (propType === 'number') {
                        processedPage.properties[propName] = propData.number;
                    } else if (propType === 'checkbox') {
                        processedPage.properties[propName] = propData.checkbox;
                    } else {
                        // For other types, include the raw data
                        processedPage.properties[propName] = propData;
                    }
                }
                
                processedResults.push(processedPage);
            }

            // Return success with query results
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    results: processedResults,
                    next_cursor: response.data.next_cursor,
                    has_more: response.data.has_more || false,
                    total_count: processedResults.length,
                    type: response.data.type,
                    page_or_database: response.data.page_or_database,
                    _metadata: {
                        database_id: databaseId,
                        data_source_id: dataSourceId,
                        api_version: NOTION_VERSION
                    }
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
                } else if (status === 400) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            error: 'Invalid query parameters',
                            details: notionError.message || 'The query parameters are invalid'
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
        console.error('Unexpected error in query-database handler:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Internal server error',
                details: 'An unexpected error occurred while querying the database'
            })
        };
    }
};