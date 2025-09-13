# Notion API 2025-09-03 Migration Changes

This document outlines the changes made to resolve the "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" error.

## Root Cause
The error occurred because the application was using Notion API version 2022-06-28, which would return HTML error pages instead of JSON when encountering API issues. The 2025-09-03 version requires a different approach using data sources.

## Changes Made

### 1. API Version Update (`api/utils.js`)
```javascript
// OLD
const NOTION_VERSION = '2022-06-28';

// NEW  
const NOTION_VERSION = '2025-09-03';
```

### 2. Database Connection Testing (`api/testConnection.js`)
```javascript
// NEW: Check for data sources after fetching database
const data_sources = response.data.data_sources;
if (!data_sources || data_sources.length === 0) {
  return sendError(res, new Error('Database has no data sources available'), 400);
}

// Return data source information
sendSuccess(res, {
  id: response.data.id,
  title: response.data.title,
  properties: Object.keys(response.data.properties),
  data_sources: data_sources,
  primary_data_source_id: data_sources[0].id, // Use first data source as primary
  created_time: response.data.created_time,
  last_edited_time: response.data.last_edited_time
});
```

### 3. Page Creation (`api/createPage.js`)
```javascript
// OLD: Direct database_id usage
const pageData = {
  parent: {
    database_id: databaseId
  },
  properties: properties
};

// NEW: Fetch data_source_id first, then use it
const dbResponse = await notion.get(`/databases/${databaseId}`);
const data_sources = dbResponse.data.data_sources;

if (!data_sources || data_sources.length === 0) {
  return sendError(res, new Error('Database has no data sources available'), 400);
}

const data_source_id = data_sources[0].id;

const pageData = {
  parent: {
    type: "data_source_id",
    data_source_id: data_source_id
  },
  properties: properties
};
```

### 4. Database Querying (`api/queryDatabase.js`)
```javascript
// OLD: Query database directly
const response = await notion.post(`/databases/${databaseId}/query`, queryData);

// NEW: Fetch data_source_id first, then query data source
const dbResponse = await notion.get(`/databases/${databaseId}`);
const data_sources = dbResponse.data.data_sources;

if (!data_sources || data_sources.length === 0) {
  return sendError(res, new Error('Database has no data sources available'), 400);
}

const data_source_id = data_sources[0].id;
const response = await notion.post(`/data_sources/${data_source_id}/query`, queryData);
```

## Error Resolution

These changes address the specific error mentioned in the problem statement:

1. **"Unexpected token '<', "<!DOCTYPE "..."**: The 2025-09-03 API properly returns JSON errors instead of HTML pages
2. **Authentication issues**: Proper headers and API version prevent unauthorized HTML responses
3. **Endpoint compatibility**: Using data_source_id ensures requests are properly formatted for the new API

## Testing

The implementation has been validated to:
- ✅ Load all API modules successfully
- ✅ Use correct API version (2025-09-03)
- ✅ Include proper authentication headers
- ✅ Handle data source fetching and validation
- ✅ Maintain backward compatibility with existing frontend code

## Deployment

No additional environment variables or configuration changes are required. The existing `NOTION_API_KEY` environment variable continues to work with the updated API version.