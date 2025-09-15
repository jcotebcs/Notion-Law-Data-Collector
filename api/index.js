import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import API handlers
import testConnectionHandler from './testConnection.js';
import createPageHandler from './createPage.js';
import queryDatabaseHandler from './queryDatabase.js';
import notionHandler from './notion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    platform: 'multi-platform'
  });
});

// Unified API endpoint (preferred)
app.all('/api/notion', notionHandler);

// Legacy API Routes (for backward compatibility)
app.all('/api/testConnection', testConnectionHandler);
app.all('/api/createPage', createPageHandler);
app.all('/api/queryDatabase', queryDatabaseHandler);

// Serve the static frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Catch-all for frontend routing (SPA support)
app.get('*', (req, res) => {
  // Serve static files if they exist, otherwise serve index.html
  const filePath = path.join(__dirname, '..', req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, '..', 'index.html'));
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// Start server (only if not running in serverless environment)
if (process.env.NODE_ENV !== 'serverless' && !process.env.VERCEL && !process.env.NETLIFY) {
  app.listen(PORT, () => {
    console.log(`🚀 Notion Law Data Collector Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🌐 Application: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/notion`);
  });
}

export default app;