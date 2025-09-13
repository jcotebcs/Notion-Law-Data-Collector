import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import API handlers
import testConnectionHandler from './testConnection.js';
import createPageHandler from './createPage.js';
import queryDatabaseHandler from './queryDatabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.all('/api/testConnection', testConnectionHandler);
app.all('/api/createPage', createPageHandler);
app.all('/api/queryDatabase', queryDatabaseHandler);

// API error handler for unmatched routes - return JSON instead of HTML
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: true,
    message: `API endpoint ${req.path} not found`,
    statusCode: 404
  });
});

// Serve the static frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler for API routes to ensure JSON responses
app.use((error, req, res, next) => {
  // Only handle API routes, let other routes use default error handling
  if (req.path.startsWith('/api/')) {
    console.error('API Error:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Internal server error',
      statusCode: 500
    });
  } else {
    next(error);
  }
});

// Start server (only if not running in serverless environment)
if (process.env.NODE_ENV !== 'serverless') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

export default app;