import { createNotionClient, handlePreflight, sendError, sendSuccess, validateRequired } from './utils.js';

/**
 * Create a new page in Notion database
 * POST /api/createPage
 */
export default async function handler(req, res) {
  // Handle preflight requests
  if (handlePreflight(req, res)) {
    return;
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return sendError(res, new Error(`Method ${req.method} not allowed`), 405);
    }

    // Validate required fields
    const { databaseId, properties } = req.body;
    if (!databaseId || !properties) {
      return sendError(res, new Error('Missing required fields: databaseId, properties'), 400);
    }

    // Validate database ID format
    if (!/^[a-f0-9]{32}$/i.test(databaseId.replace(/-/g, ''))) {
      return sendError(res, new Error('Invalid database ID format'), 400);
    }

    // Validate that Title property exists
    if (!properties.Title) {
      return sendError(res, new Error('Title property is required'), 400);
    }

    // Create Notion client
    const notion = createNotionClient();
    
    // First, fetch the database to get data_source_id (required for 2025-09-03 API)
    const dbResponse = await notion.get(`/databases/${databaseId}`);
    const data_sources = dbResponse.data.data_sources;
    
    if (!data_sources || data_sources.length === 0) {
      return sendError(res, new Error('Database has no data sources available'), 400);
    }
    
    // Use the first data source (adapt if multiple sources needed)
    const data_source_id = data_sources[0].id;
    
    const pageData = {
      parent: {
        type: "data_source_id",
        data_source_id: data_source_id
      },
      properties: properties
    };

    const response = await notion.post('/pages', pageData);

    // Return success with created page info
    sendSuccess(res, {
      id: response.data.id,
      url: response.data.url,
      created_time: response.data.created_time,
      properties: response.data.properties
    }, 201);

  } catch (error) {
    console.error('Create Page Error:', {
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
      } else if (status === 400) {
        return sendError(res, new Error(notionError?.message || 'Invalid request data'), 400);
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
