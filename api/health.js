import { handlePreflight, setCorsHeaders, validateNotionConfig } from './utils.js';

/**
 * Enhanced health check endpoint with diagnostics
 * GET /api/health
 */
export default async function handler(req, res) {
  // Handle preflight requests
  if (handlePreflight(req, res)) {
    return;
  }

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      setCorsHeaders(res);
      return res.status(405).json({
        error: true,
        message: `Method ${req.method} not allowed`,
        timestamp: new Date().toISOString()
      });
    }

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'unknown',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {}
    };

    // Check Node.js version
    health.checks.nodejs = {
      status: 'ok',
      version: process.version,
      platform: process.platform,
      arch: process.arch
    };

    // Check environment configuration
    health.checks.environment = {
      status: 'ok',
      nodeEnv: process.env.NODE_ENV || 'not-set',
      platform: process.env.VERCEL ? 'vercel' : 
                process.env.AWS_LAMBDA_FUNCTION_NAME ? 'aws-lambda' :
                process.env.FUNCTION_NAME ? 'gcp-functions' :
                process.env.RAILWAY_ENVIRONMENT ? 'railway' :
                process.env.RENDER ? 'render' : 'unknown'
    };

    // Check Notion API key configuration
    try {
      validateNotionConfig();
      health.checks.notion_config = {
        status: 'ok',
        message: 'NOTION_API_KEY is configured and has correct format'
      };
    } catch (error) {
      health.checks.notion_config = {
        status: 'error',
        message: error.message
      };
      health.status = 'degraded';
    }

    // Check dependencies
    try {
      // Test if we can load required modules
      await import('axios');
      await import('cors');
      
      health.checks.dependencies = {
        status: 'ok',
        message: 'All required dependencies are available'
      };
    } catch (error) {
      health.checks.dependencies = {
        status: 'error',
        message: `Dependency error: ${error.message}`
      };
      health.status = 'error';
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const maxMemory = 512 * 1024 * 1024; // 512MB default limit
    const memoryPercent = (memoryUsage.heapUsed / maxMemory) * 100;
    
    health.checks.memory = {
      status: memoryPercent > 80 ? 'warning' : 'ok',
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      usagePercent: `${Math.round(memoryPercent)}%`
    };

    if (memoryPercent > 80) {
      health.status = health.status === 'error' ? 'error' : 'warning';
    }

    // Add troubleshooting information if there are issues
    if (health.status !== 'ok') {
      health.troubleshooting = {
        common_issues: [
          'Check that NOTION_API_KEY environment variable is set correctly',
          'Verify the API key starts with "secret_"',
          'Ensure all required dependencies are installed',
          'Check memory usage and consider increasing limits'
        ],
        helpful_links: [
          'https://developers.notion.com/docs/authorization',
          'https://github.com/jcotebcs/Notion-Law-Data-Collector/blob/main/TROUBLESHOOTING.md'
        ]
      };
    }

    // Set appropriate status code based on health status
    const statusCode = health.status === 'ok' ? 200 : 
                      health.status === 'warning' ? 200 : 503;

    setCorsHeaders(res);
    res.status(statusCode).json(health);

  } catch (error) {
    console.error('Health check error:', error);
    
    setCorsHeaders(res);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: true,
      message: 'Health check failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}