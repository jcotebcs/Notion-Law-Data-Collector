import { createNotionClient, handlePreflight, sendError, sendSuccess, validateRequired } from './utils.js';

/**
 * Test connection to Notion database
 * GET /api/testConnection?databaseId=xxx
 */
export default async function handler(req, res) {
  // Handle preflight requests
  if (handlePreflight(req, res)) {
    return;
  }

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return sendError(res, new Error(`Method ${req.method} not allowed`), 405);
    }

    // Validate required parameters
    const { databaseId } = req.query;
    if (!databaseId) {
      return sendError(res, new Error('Missing required parameter: databaseId'), 400);
    }

    // Validate database ID format (should be 32 characters)
    if (!/^[a-f0-9]{32}$/i.test(databaseId.replace(/-/g, ''))) {
      return sendError(res, new Error('Invalid database ID format'), 400);
    }

    // Create Notion client and make request
    const notion = createNotionClient();
    const response = await notion.get(`/databases/${databaseId}`);

    // Check if database has data sources (required for 2025-09-03 API)
    const data_sources = response.data.data_sources;
    if (!data_sources || data_sources.length === 0) {
      return sendError(res, new Error('Database has no data sources available'), 400);
    }

    // Return success with database info including data sources
    sendSuccess(res, {
      id: response.data.id,
      title: response.data.title,
      properties: Object.keys(response.data.properties),
      data_sources: data_sources,
      primary_data_source_id: data_sources[0].id, // Use first data source as primary
      created_time: response.data.created_time,
      last_edited_time: response.data.last_edited_time
    });

  } catch (error) {
    console.error('Test Connection Error:', {
      message: error.message,
      status: error.response?.status,
      isHtmlResponse: error.isHtmlResponse,
      headers: error.response?.headers?.['content-type']
    });
    
    // Handle HTML responses specifically
    if (error.isHtmlResponse) {
      return sendError(res, error, error.response?.status || 500);
    }
    
    // Handle Notion API errors specifically
    if (error.response) {
      const status = error.response.status;
      const notionError = error.response.data;
      
      if (status === 401) {
        return sendError(res, new Error('Invalid Notion API key or insufficient permissions'), 401);
      } else if (status === 404) {
        return sendError(res, new Error('Database not found or integration lacks access'), 404);
      } else if (status >= 500) {
        return sendError(res, new Error('Notion API server error - please try again later'), status);
      } else {
        return sendError(res, new Error(notionError?.message || 'Notion API error'), status);
      }
    }
    
    // Handle network and other errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return sendError(res, new Error('Request timeout - Notion API is not responding'), 408);
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return sendError(res, new Error('Cannot connect to Notion API - please check your internet connection'), 503);
    }
    
    // Handle other errors
    sendError(res, error);
  }
}