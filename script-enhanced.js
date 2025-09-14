/**
 * Enhanced script.js with support for both Vercel and AWS Lambda backends
 * Automatically detects and switches between deployment methods
 */

class NotionLawCollector {
    constructor() {
        this.databaseId = '';
        this.apiConfig = this.detectApiConfig();
        this.init();
    }

    /**
     * Detect which API backend to use based on deployment
     */
    detectApiConfig() {
        const hostname = window.location.hostname;
        
        // Configuration for different deployment methods
        const configs = {
            // GitHub Pages with Lambda (recommended for production)
            lambda: {
                baseUrl: '', // Will be set from environment or user input
                endpoints: {
                    testConnection: 'notion-law-collector-test-connection',
                    createPage: 'notion-law-collector-create-page',
                    queryDatabase: 'notion-law-collector-query-database'
                },
                type: 'lambda',
                region: 'us-east-1' // Default region
            },
            
            // Vercel deployment (existing method)
            vercel: {
                baseUrl: window.location.origin,
                endpoints: {
                    testConnection: '/api/testConnection',
                    createPage: '/api/createPage',
                    queryDatabase: '/api/queryDatabase'
                },
                type: 'vercel'
            },
            
            // Local development
            local: {
                baseUrl: 'http://localhost:3000',
                endpoints: {
                    testConnection: '/api/testConnection',
                    createPage: '/api/createPage',
                    queryDatabase: '/api/queryDatabase'
                },
                type: 'local'
            }
        };

        // Auto-detect based on hostname
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return configs.local;
        } else if (hostname.includes('vercel.app') || hostname.includes('railway.app') || hostname.includes('render.com')) {
            return configs.vercel;
        } else {
            // Default to Lambda for GitHub Pages and other deployments
            return configs.lambda;
        }
    }

    init() {
        this.loadConfig();
        this.bindEvents();
        this.loadRecentCases();
        this.setupApiConfiguration();
    }

    /**
     * Setup API configuration UI for Lambda deployment
     */
    setupApiConfiguration() {
        if (this.apiConfig.type === 'lambda') {
            this.showLambdaConfiguration();
        }
    }

    /**
     * Show Lambda configuration section
     */
    showLambdaConfiguration() {
        const existingConfig = document.getElementById('lambda-config');
        if (existingConfig) return;

        const configSection = document.createElement('div');
        configSection.id = 'lambda-config';
        configSection.className = 'config-section';
        configSection.innerHTML = `
            <h3>AWS Lambda Configuration</h3>
            <div class="form-group">
                <label for="lambdaRegion">AWS Region:</label>
                <select id="lambdaRegion">
                    <option value="us-east-1">US East (N. Virginia)</option>
                    <option value="us-west-2">US West (Oregon)</option>
                    <option value="eu-west-1">Europe (Ireland)</option>
                    <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                </select>
            </div>
            <div class="form-group">
                <label for="apiGatewayUrl">API Gateway URL (optional):</label>
                <input type="url" id="apiGatewayUrl" placeholder="https://your-api-id.execute-api.region.amazonaws.com/prod">
                <small>Leave empty to use direct Lambda invocation</small>
            </div>
            <button type="button" id="saveLambdaConfig" class="btn btn-secondary">Save Lambda Config</button>
        `;

        const dbConfigSection = document.querySelector('.config-section');
        dbConfigSection.parentNode.insertBefore(configSection, dbConfigSection);

        // Bind events for Lambda config
        document.getElementById('saveLambdaConfig').addEventListener('click', () => this.saveLambdaConfig());
        document.getElementById('lambdaRegion').addEventListener('change', () => this.updateLambdaRegion());
        
        // Load existing Lambda config
        this.loadLambdaConfig();
    }

    /**
     * Save Lambda configuration
     */
    saveLambdaConfig() {
        const region = document.getElementById('lambdaRegion').value;
        const apiGatewayUrl = document.getElementById('apiGatewayUrl').value.trim();

        this.apiConfig.region = region;
        
        if (apiGatewayUrl) {
            // Use API Gateway URLs
            this.apiConfig.baseUrl = apiGatewayUrl;
            this.apiConfig.endpoints = {
                testConnection: '/test-connection',
                createPage: '/create-page',
                queryDatabase: '/query-database'
            };
        } else {
            // Use direct Lambda invocation
            this.apiConfig.baseUrl = '';
        }

        // Save to localStorage
        localStorage.setItem('lambdaConfig', JSON.stringify({
            region: region,
            apiGatewayUrl: apiGatewayUrl
        }));

        this.showNotification('Lambda configuration saved successfully', 'success');
    }

    /**
     * Load Lambda configuration from localStorage
     */
    loadLambdaConfig() {
        const savedConfig = localStorage.getItem('lambdaConfig');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                document.getElementById('lambdaRegion').value = config.region || 'us-east-1';
                document.getElementById('apiGatewayUrl').value = config.apiGatewayUrl || '';
                
                // Update API config
                this.apiConfig.region = config.region;
                if (config.apiGatewayUrl) {
                    this.apiConfig.baseUrl = config.apiGatewayUrl;
                }
            } catch (e) {
                console.error('Error loading Lambda config:', e);
            }
        }
    }

    /**
     * Update Lambda region
     */
    updateLambdaRegion() {
        this.apiConfig.region = document.getElementById('lambdaRegion').value;
    }

    bindEvents() {
        document.getElementById('testConnection').addEventListener('click', () => this.testConnection());
        document.getElementById('caseForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('refreshCases').addEventListener('click', () => this.loadRecentCases());
        
        // Save config on change
        document.getElementById('databaseId').addEventListener('change', () => this.saveConfig());
    }

    loadConfig() {
        const dbId = localStorage.getItem('databaseId');
        
        if (dbId) {
            document.getElementById('databaseId').value = dbId;
            this.databaseId = dbId;
        }
    }

    saveConfig() {
        this.databaseId = document.getElementById('databaseId').value;
        localStorage.setItem('databaseId', this.databaseId);
    }

    /**
     * Make API request with support for different backends
     */
    async makeApiRequest(endpoint, options = {}) {
        const method = options.method || 'GET';
        const body = options.body || null;
        const params = options.params || {};

        if (this.apiConfig.type === 'lambda' && !this.apiConfig.baseUrl) {
            return this.invokeLambdaDirectly(endpoint, method, body, params);
        } else {
            return this.makeHttpRequest(endpoint, method, body, params);
        }
    }

    /**
     * Make HTTP request to Vercel/API Gateway
     */
    async makeHttpRequest(endpoint, method, body, params) {
        let url = `${this.apiConfig.baseUrl}${this.apiConfig.endpoints[endpoint]}`;
        
        // Add query parameters for GET requests
        if (method === 'GET' && Object.keys(params).length > 0) {
            const queryString = new URLSearchParams(params).toString();
            url += `?${queryString}`;
        }

        const requestOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (body && method !== 'GET') {
            requestOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Invoke Lambda function directly using AWS SDK
     */
    async invokeLambdaDirectly(endpoint, method, body, params) {
        // This requires AWS SDK to be loaded and configured
        if (typeof AWS === 'undefined') {
            throw new Error('AWS SDK not loaded. Please include AWS SDK or configure API Gateway.');
        }

        const lambda = new AWS.Lambda({
            region: this.apiConfig.region
        });

        const functionName = this.apiConfig.endpoints[endpoint];
        
        // Construct Lambda event payload
        const event = {
            httpMethod: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : null,
            queryStringParameters: Object.keys(params).length > 0 ? params : null
        };

        const lambdaParams = {
            FunctionName: functionName,
            Payload: JSON.stringify(event)
        };

        try {
            const result = await lambda.invoke(lambdaParams).promise();
            const response = JSON.parse(result.Payload);
            
            if (response.statusCode >= 400) {
                const errorBody = JSON.parse(response.body);
                throw new Error(errorBody.message || 'Lambda function error');
            }
            
            return JSON.parse(response.body);
        } catch (error) {
            console.error('Lambda invocation error:', error);
            throw error;
        }
    }

    async testConnection() {
        this.saveConfig();
        
        if (!this.databaseId) {
            this.showNotification('Please enter the database ID', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            const response = await this.makeApiRequest('testConnection', {
                method: 'GET',
                params: { databaseId: this.databaseId }
            });

            if (response.error) {
                throw new Error(response.message);
            }

            const data = response.data;
            
            // Update UI with connection success
            this.showNotification('✅ Connection successful!', 'success');
            
            // Display database information
            this.displayDatabaseInfo(data);
            
        } catch (error) {
            console.error('Connection test failed:', error);
            this.showNotification(`❌ Connection failed: ${error.message}`, 'error');
            this.showErrorAnalysis(error);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Display detailed database information
     */
    displayDatabaseInfo(data) {
        const existingInfo = document.getElementById('database-info');
        if (existingInfo) {
            existingInfo.remove();
        }

        const infoDiv = document.createElement('div');
        infoDiv.id = 'database-info';
        infoDiv.className = 'database-info success';
        
        let title = 'Database';
        if (data.title && Array.isArray(data.title)) {
            title = data.title.map(t => t.text?.content || t.plain_text || '').join('') || 'Database';
        }

        infoDiv.innerHTML = `
            <h4>📋 Database Information</h4>
            <p><strong>Name:</strong> ${title}</p>
            <p><strong>Database ID:</strong> ${data.id}</p>
            <p><strong>Properties:</strong> ${data.properties.join(', ')}</p>
            <p><strong>API Version:</strong> ${data.api_version || '2025-09-03'}</p>
            ${data.is_multi_source ? '<p><strong>Multi-Source:</strong> ✅ Yes</p>' : ''}
            <p><strong>Created:</strong> ${new Date(data.created_time).toLocaleDateString()}</p>
            <p><strong>Last Modified:</strong> ${new Date(data.last_edited_time).toLocaleDateString()}</p>
        `;

        const configSection = document.querySelector('.config-section');
        configSection.appendChild(infoDiv);
    }

    /**
     * Show error analysis for troubleshooting
     */
    showErrorAnalysis(error) {
        const errorMessage = error.message.toLowerCase();
        let analysis = '';

        if (errorMessage.includes('unexpected token') && errorMessage.includes('<!doctype')) {
            analysis = `
                <h4>🔍 Error Analysis: HTML Response Instead of JSON</h4>
                <p><strong>Cause:</strong> The server returned HTML instead of JSON data.</p>
                <h5>Possible Solutions:</h5>
                <ul>
                    <li><strong>CORS Issue:</strong> Use the serverless backend instead of direct browser calls</li>
                    <li><strong>Wrong Endpoint:</strong> Verify you're using the correct API URL</li>
                    <li><strong>Authentication:</strong> Check your Notion API token and integration permissions</li>
                    <li><strong>Network:</strong> Check if you can access the API from your network</li>
                </ul>
            `;
        } else if (errorMessage.includes('cors')) {
            analysis = `
                <h4>🔍 Error Analysis: CORS Policy Violation</h4>
                <p><strong>Cause:</strong> Cross-Origin Resource Sharing (CORS) policy blocked the request.</p>
                <h5>Solutions:</h5>
                <ul>
                    <li>Ensure you're using the deployed serverless backend, not local files</li>
                    <li>Configure API Gateway with proper CORS settings</li>
                    <li>Use the AWS Lambda backend which handles CORS automatically</li>
                </ul>
            `;
        } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            analysis = `
                <h4>🔍 Error Analysis: Authentication Error</h4>
                <p><strong>Cause:</strong> Invalid or missing Notion API token.</p>
                <h5>Solutions:</h5>
                <ul>
                    <li>Verify your Notion integration token is correct</li>
                    <li>Check that the integration has access to the database</li>
                    <li>Ensure the token is properly stored in AWS Secrets Manager (for Lambda)</li>
                </ul>
            `;
        } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            analysis = `
                <h4>🔍 Error Analysis: Database Not Found</h4>
                <p><strong>Cause:</strong> Database doesn't exist or integration lacks access.</p>
                <h5>Solutions:</h5>
                <ul>
                    <li>Verify the database ID is correct (32 hexadecimal characters)</li>
                    <li>Share the database with your Notion integration</li>
                    <li>Check that the database hasn't been deleted or moved</li>
                </ul>
            `;
        }

        if (analysis) {
            const existingAnalysis = document.getElementById('error-analysis');
            if (existingAnalysis) {
                existingAnalysis.remove();
            }

            const analysisDiv = document.createElement('div');
            analysisDiv.id = 'error-analysis';
            analysisDiv.className = 'error-analysis error';
            analysisDiv.innerHTML = analysis;

            const configSection = document.querySelector('.config-section');
            configSection.appendChild(analysisDiv);
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.databaseId) {
            this.showNotification('Please configure database ID first', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            const formData = this.collectFormData();
            const properties = this.formatPropertiesForNotion(formData);

            const response = await this.makeApiRequest('createPage', {
                method: 'POST',
                body: {
                    databaseId: this.databaseId,
                    properties: properties
                }
            });

            if (response.error) {
                throw new Error(response.message);
            }

            this.showNotification('✅ Case created successfully!', 'success');
            this.resetForm();
            this.loadRecentCases();
            
        } catch (error) {
            console.error('Error creating case:', error);
            this.showNotification(`❌ Error creating case: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadRecentCases() {
        if (!this.databaseId) return;

        try {
            const response = await this.makeApiRequest('queryDatabase', {
                method: 'POST',
                body: {
                    databaseId: this.databaseId,
                    sorts: [
                        {
                            property: 'created_time',
                            direction: 'descending'
                        }
                    ],
                    page_size: 5
                }
            });

            if (response.error) {
                throw new Error(response.message);
            }

            this.displayRecentCases(response.data.results);
            
        } catch (error) {
            console.error('Error loading recent cases:', error);
            // Don't show error notification for this, as it's not critical
        }
    }

    collectFormData() {
        const form = document.getElementById('caseForm');
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (value.trim()) {
                data[key] = value.trim();
            }
        }
        
        return data;
    }

    formatPropertiesForNotion(formData) {
        const properties = {};
        
        // Map form fields to Notion properties
        const fieldMapping = {
            caseTitle: { name: 'Title', type: 'title' },
            caseNumber: { name: 'Case Number', type: 'rich_text' },
            court: { name: 'Court', type: 'rich_text' },
            judge: { name: 'Judge', type: 'rich_text' },
            caseDate: { name: 'Date', type: 'date' },
            status: { name: 'Status', type: 'select' },
            parties: { name: 'Parties', type: 'rich_text' },
            caseType: { name: 'Type', type: 'select' },
            summary: { name: 'Summary', type: 'rich_text' },
            outcome: { name: 'Outcome', type: 'rich_text' },
            tags: { name: 'Tags', type: 'multi_select' },
            priority: { name: 'Priority', type: 'select' }
        };

        for (const [fieldName, value] of Object.entries(formData)) {
            const mapping = fieldMapping[fieldName];
            if (!mapping) continue;

            const { name, type } = mapping;

            switch (type) {
                case 'title':
                    properties[name] = {
                        title: [{ text: { content: value } }]
                    };
                    break;
                case 'rich_text':
                    properties[name] = {
                        rich_text: [{ text: { content: value } }]
                    };
                    break;
                case 'select':
                    properties[name] = {
                        select: { name: value }
                    };
                    break;
                case 'multi_select':
                    const tags = value.split(',').map(tag => ({ name: tag.trim() }));
                    properties[name] = {
                        multi_select: tags
                    };
                    break;
                case 'date':
                    properties[name] = {
                        date: { start: value }
                    };
                    break;
            }
        }

        return properties;
    }

    displayRecentCases(cases) {
        const recentCasesDiv = document.getElementById('recentCases');
        
        if (!cases || cases.length === 0) {
            recentCasesDiv.innerHTML = '<p>No recent cases found.</p>';
            return;
        }

        let html = '<h3>📋 Recent Cases</h3>';
        
        cases.forEach(caseItem => {
            const title = this.extractPropertyValue(caseItem.properties, 'Title') || 'Untitled Case';
            const caseNumber = this.extractPropertyValue(caseItem.properties, 'Case Number') || 'N/A';
            const status = this.extractPropertyValue(caseItem.properties, 'Status') || 'Unknown';
            const createdDate = new Date(caseItem.created_time).toLocaleDateString();

            html += `
                <div class="case-item">
                    <h4>${title}</h4>
                    <p><strong>Case Number:</strong> ${caseNumber}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${status.toLowerCase()}">${status}</span></p>
                    <p><strong>Created:</strong> ${createdDate}</p>
                    <a href="${caseItem.url}" target="_blank" class="btn btn-secondary">View in Notion</a>
                </div>
            `;
        });

        recentCasesDiv.innerHTML = html;
    }

    extractPropertyValue(properties, propertyName) {
        const property = properties[propertyName];
        if (!property) return null;

        switch (property.type) {
            case 'title':
                return property.title.map(t => t.plain_text).join('');
            case 'rich_text':
                return property.rich_text.map(rt => rt.plain_text).join('');
            case 'select':
                return property.select?.name;
            case 'multi_select':
                return property.multi_select.map(ms => ms.name).join(', ');
            case 'date':
                return property.date?.start;
            default:
                return JSON.stringify(property);
        }
    }

    resetForm() {
        document.getElementById('caseForm').reset();
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showLoading(show) {
        const loadingElements = document.querySelectorAll('.loading');
        loadingElements.forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });

        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = show;
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NotionLawCollector();
});

// Add CSS for new elements
const additionalStyles = `
    .config-section {
        margin-bottom: 2rem;
        padding: 1rem;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: #f9f9f9;
    }

    .database-info, .error-analysis {
        margin-top: 1rem;
        padding: 1rem;
        border-radius: 8px;
        border-left: 4px solid;
    }

    .database-info.success {
        background: #d4edda;
        border-color: #28a745;
    }

    .error-analysis.error {
        background: #f8d7da;
        border-color: #dc3545;
    }

    .case-item {
        background: white;
        margin: 1rem 0;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .status-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.875rem;
        font-weight: bold;
    }

    .status-active { background: #d4edda; color: #155724; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-closed { background: #f8d7da; color: #721c24; }
    .status-appeal { background: #d1ecf1; color: #0c5460; }

    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem;
        border-radius: 8px;
        color: white;
        z-index: 1000;
        max-width: 400px;
    }

    .notification.success { background: #28a745; }
    .notification.error { background: #dc3545; }
    .notification.warning { background: #ffc107; color: #212529; }

    .loading {
        display: none;
    }

    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    #lambda-config {
        background: #e3f2fd;
        border-color: #2196f3;
    }

    #lambda-config h3 {
        color: #1976d2;
        margin-top: 0;
    }

    .form-group {
        margin-bottom: 1rem;
    }

    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: bold;
    }

    .form-group select,
    .form-group input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .form-group small {
        display: block;
        margin-top: 0.25rem;
        color: #666;
        font-size: 0.875rem;
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);