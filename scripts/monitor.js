#!/usr/bin/env node

/**
 * Monitoring script for Notion Law Data Collector
 * Can be used in cron jobs or monitoring systems
 */

import https from 'https';
import http from 'http';

const DEFAULT_ENDPOINTS = [
  'https://your-app.vercel.app',
  'https://your-function.cloudfunctions.net',
  'https://your-lambda.amazonaws.com'
];

class HealthMonitor {
  constructor(endpoints = [], options = {}) {
    this.endpoints = endpoints.length > 0 ? endpoints : DEFAULT_ENDPOINTS;
    this.timeout = options.timeout || 30000;
    this.alertThreshold = options.alertThreshold || 3; // consecutive failures
    this.failureCount = new Map();
  }

  async checkEndpoint(endpoint) {
    return new Promise((resolve) => {
      const url = new URL(`${endpoint}/api/health`);
      const client = url.protocol === 'https:' ? https : http;
      
      const startTime = Date.now();
      
      const req = client.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'HealthMonitor/1.0.0',
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          try {
            const health = JSON.parse(data);
            resolve({
              endpoint,
              status: res.statusCode === 200 ? 'ok' : 'error',
              statusCode: res.statusCode,
              responseTime,
              health,
              error: null
            });
          } catch (error) {
            resolve({
              endpoint,
              status: 'error',
              statusCode: res.statusCode,
              responseTime,
              health: null,
              error: 'Invalid JSON response'
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          endpoint,
          status: 'error',
          statusCode: null,
          responseTime: Date.now() - startTime,
          health: null,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          endpoint,
          status: 'timeout',
          statusCode: null,
          responseTime: this.timeout,
          health: null,
          error: 'Request timeout'
        });
      });
    });
  }

  async checkAll() {
    const results = await Promise.all(
      this.endpoints.map(endpoint => this.checkEndpoint(endpoint))
    );

    const summary = {
      timestamp: new Date().toISOString(),
      overall: 'ok',
      endpoints: results,
      metrics: {
        total: results.length,
        healthy: 0,
        degraded: 0,
        failed: 0,
        avgResponseTime: 0
      },
      alerts: []
    };

    let totalResponseTime = 0;
    let responseCount = 0;

    for (const result of results) {
      // Update failure count
      const currentFailures = this.failureCount.get(result.endpoint) || 0;
      
      if (result.status === 'ok') {
        this.failureCount.set(result.endpoint, 0);
        summary.metrics.healthy++;
      } else {
        this.failureCount.set(result.endpoint, currentFailures + 1);
        
        if (result.health?.status === 'degraded') {
          summary.metrics.degraded++;
          if (summary.overall === 'ok') summary.overall = 'degraded';
        } else {
          summary.metrics.failed++;
          summary.overall = 'error';
        }

        // Check for alert threshold
        const failures = this.failureCount.get(result.endpoint);
        if (failures >= this.alertThreshold) {
          summary.alerts.push({
            type: 'consecutive_failures',
            endpoint: result.endpoint,
            count: failures,
            threshold: this.alertThreshold,
            message: `Endpoint has failed ${failures} consecutive times`
          });
        }
      }

      // Calculate response time metrics
      if (result.responseTime) {
        totalResponseTime += result.responseTime;
        responseCount++;
      }

      // Check for slow response times
      if (result.responseTime > 10000) { // 10 seconds
        summary.alerts.push({
          type: 'slow_response',
          endpoint: result.endpoint,
          responseTime: result.responseTime,
          message: `Slow response time: ${result.responseTime}ms`
        });
      }

      // Check health status issues
      if (result.health && result.health.checks) {
        for (const [check, details] of Object.entries(result.health.checks)) {
          if (details.status === 'error') {
            summary.alerts.push({
              type: 'health_check_failed',
              endpoint: result.endpoint,
              check,
              message: details.message || `Health check '${check}' failed`
            });
          }
        }
      }
    }

    summary.metrics.avgResponseTime = responseCount > 0 ? 
      Math.round(totalResponseTime / responseCount) : 0;

    return summary;
  }

  formatReport(summary) {
    const status = summary.overall.toUpperCase();
    const icon = status === 'OK' ? '✅' : status === 'DEGRADED' ? '⚠️' : '❌';
    
    let report = `${icon} Health Check Report - ${status}\n`;
    report += `Timestamp: ${summary.timestamp}\n`;
    report += `Overall Status: ${summary.overall}\n`;
    report += `Average Response Time: ${summary.metrics.avgResponseTime}ms\n\n`;

    report += `Metrics:\n`;
    report += `- Total Endpoints: ${summary.metrics.total}\n`;
    report += `- Healthy: ${summary.metrics.healthy}\n`;
    report += `- Degraded: ${summary.metrics.degraded}\n`;
    report += `- Failed: ${summary.metrics.failed}\n\n`;

    if (summary.alerts.length > 0) {
      report += `Alerts (${summary.alerts.length}):\n`;
      for (const alert of summary.alerts) {
        report += `- ${alert.type}: ${alert.message}\n`;
      }
      report += '\n';
    }

    report += 'Endpoint Details:\n';
    for (const endpoint of summary.endpoints) {
      const statusIcon = endpoint.status === 'ok' ? '✅' : '❌';
      report += `${statusIcon} ${endpoint.endpoint}\n`;
      report += `   Status: ${endpoint.status}\n`;
      if (endpoint.statusCode) report += `   HTTP: ${endpoint.statusCode}\n`;
      if (endpoint.responseTime) report += `   Response Time: ${endpoint.responseTime}ms\n`;
      if (endpoint.error) report += `   Error: ${endpoint.error}\n`;
      if (endpoint.health) {
        report += `   Health: ${endpoint.health.status}\n`;
        if (endpoint.health.checks) {
          for (const [check, details] of Object.entries(endpoint.health.checks)) {
            if (details.status !== 'ok') {
              report += `   - ${check}: ${details.status} (${details.message})\n`;
            }
          }
        }
      }
      report += '\n';
    }

    return report;
  }

  async sendAlert(summary, alertConfig) {
    if (!alertConfig || summary.alerts.length === 0) return;

    // Webhook alert
    if (alertConfig.webhook) {
      try {
        const payload = {
          text: this.formatReport(summary),
          summary,
          timestamp: new Date().toISOString()
        };

        const url = new URL(alertConfig.webhook);
        const client = url.protocol === 'https:' ? https : http;
        
        const data = JSON.stringify(payload);
        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
          }
        };

        const req = client.request(url, options);
        req.write(data);
        req.end();
        
        console.log('Alert sent to webhook');
      } catch (error) {
        console.error('Failed to send webhook alert:', error.message);
      }
    }

    // Email alert (requires additional setup)
    if (alertConfig.email) {
      console.log('Email alerts require additional configuration');
      // Implement email sending here
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  const endpoints = [];

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--endpoint' && args[i + 1]) {
      endpoints.push(args[i + 1]);
      i++;
    } else if (arg === '--timeout' && args[i + 1]) {
      options.timeout = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--alert-threshold' && args[i + 1]) {
      options.alertThreshold = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--help') {
      console.log(`
Usage: node monitor.js [options]

Options:
  --endpoint URL      Add endpoint to monitor (can be used multiple times)
  --timeout MS        Request timeout in milliseconds (default: 30000)
  --alert-threshold N Number of consecutive failures before alert (default: 3)
  --help             Show this help message

Examples:
  node monitor.js --endpoint https://your-app.vercel.app
  node monitor.js --endpoint https://app1.com --endpoint https://app2.com --timeout 10000
  
Environment variables:
  MONITOR_WEBHOOK     Webhook URL for alerts
  MONITOR_ENDPOINTS   Comma-separated list of endpoints
`);
      process.exit(0);
    }
  }

  // Add endpoints from environment variable
  if (process.env.MONITOR_ENDPOINTS) {
    endpoints.push(...process.env.MONITOR_ENDPOINTS.split(','));
  }

  const monitor = new HealthMonitor(endpoints, options);
  
  monitor.checkAll().then(summary => {
    console.log(monitor.formatReport(summary));
    
    // Send alerts if configured
    const alertConfig = {};
    if (process.env.MONITOR_WEBHOOK) {
      alertConfig.webhook = process.env.MONITOR_WEBHOOK;
    }
    
    if (Object.keys(alertConfig).length > 0) {
      monitor.sendAlert(summary, alertConfig);
    }
    
    // Exit with appropriate code
    process.exit(summary.overall === 'ok' ? 0 : 1);
  }).catch(error => {
    console.error('Monitor failed:', error);
    process.exit(1);
  });
}

export default HealthMonitor;