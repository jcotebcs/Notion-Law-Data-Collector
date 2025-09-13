
class NotionLawCollector {
    constructor() {
        this.databaseId = '';
        this.init();
    }

    /**
     * Safely parses JSON response and logs raw response for debugging
     * This helps identify HTML error pages being returned instead of JSON
     */
    async safeJsonParse(response) {
        try {
            // Get raw response text first
            const text = await response.text();
            
            // Log raw response in development for debugging
            const isDevEnv =
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname === '[::1]' ||
                window.location.hostname.endsWith('.local') ||
                (window.ENV && window.ENV === 'development');
            if (isDevEnv) {
                console.log('Raw API Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: text.substring(0, 500) // First 500 chars for debugging
                });
            }
            
            // Check if response looks like HTML (common issue)
            if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
                console.error('⚠️  Received HTML response instead of JSON');
                throw new Error('Server returned HTML error page instead of JSON. This may indicate a server configuration issue.');
            }
            
            // Try to parse as JSON
            return JSON.parse(text);
            
        } catch (error) {
            if (error instanceof SyntaxError) {
                console.error('Failed to parse JSON response:', error);
                throw new Error('Invalid JSON response from server. Please check server logs.');
            }
            throw error;
        }
    }

    init() {
        this.loadConfig();
        this.bindEvents();
        this.loadRecentCases();
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

    async testConnection() {
        this.saveConfig();
        
        if (!this.databaseId) {
            this.showNotification('Please enter the database ID', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            const response = await fetch(`/api/testConnection?databaseId=${encodeURIComponent(this.databaseId)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await this.safeJsonParse(response);
            
            if (response.ok && !result.error) {
                const data = result.data;
                this.showConnectionStatus('Connection successful! Database: ' + (data.title[0]?.plain_text || 'Untitled'), 'success');
                this.showNotification('Connection successful!', 'success');
                document.getElementById('refreshCases').style.display = 'inline-flex';
                this.loadRecentCases();
            } else {
                this.showConnectionStatus('Connection failed: ' + (result.message || 'Unknown error'), 'error');
                this.showNotification('Connection failed', 'error');
            }
        } catch (error) {
            this.showConnectionStatus('Connection failed: ' + error.message, 'error');
            this.showNotification('Connection failed', 'error');
        }
        
        this.showLoading(false);
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.databaseId) {
            this.showNotification('Please configure database connection first', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            const formData = this.getFormData();
            const response = await this.createNotionPage(formData);
            const result = await this.safeJsonParse(response);
            
            if (response.ok && !result.error) {
                this.showNotification('Case saved successfully!', 'success');
                this.clearForm();
                this.loadRecentCases();
            } else {
                this.showNotification('Failed to save case: ' + (result.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            this.showNotification('Error: ' + error.message, 'error');
        }
        
        this.showLoading(false);
    }

    getFormData() {
        return {
            title: document.getElementById('caseTitle').value,
            caseNumber: document.getElementById('caseNumber').value,
            court: document.getElementById('court').value,
            judge: document.getElementById('judge').value,
            date: document.getElementById('caseDate').value,
            status: document.getElementById('caseStatus').value,
            parties: document.getElementById('parties').value,
            type: document.getElementById('caseType').value,
            summary: document.getElementById('summary').value,
            outcome: document.getElementById('outcome').value,
            tags: document.getElementById('tags').value,
            priority: document.getElementById('priority').value
        };
    }

    async createNotionPage(data) {
        const properties = {
            'Title': {
                title: [
                    {
                        text: {
                            content: data.title || 'Untitled Case'
                        }
                    }
                ]
            }
        };

        // Add other properties if they exist and have values
        if (data.caseNumber) {
            properties['Case Number'] = {
                rich_text: [
                    {
                        text: {
                            content: data.caseNumber
                        }
                    }
                ]
            };
        }

        if (data.court) {
            properties['Court'] = {
                rich_text: [
                    {
                        text: {
                            content: data.court
                        }
                    }
                ]
            };
        }

        if (data.judge) {
            properties['Judge'] = {
                rich_text: [
                    {
                        text: {
                            content: data.judge
                        }
                    }
                ]
            };
        }

        if (data.date) {
            properties['Date'] = {
                date: {
                    start: data.date
                }
            };
        }

        if (data.status) {
            properties['Status'] = {
                select: {
                    name: data.status
                }
            };
        }

        if (data.parties) {
            properties['Parties'] = {
                rich_text: [
                    {
                        text: {
                            content: data.parties
                        }
                    }
                ]
            };
        }

        if (data.type) {
            properties['Type'] = {
                select: {
                    name: data.type
                }
            };
        }

        if (data.summary) {
            properties['Summary'] = {
                rich_text: [
                    {
                        text: {
                            content: data.summary
                        }
                    }
                ]
            };
        }

        if (data.outcome) {
            properties['Outcome'] = {
                rich_text: [
                    {
                        text: {
                            content: data.outcome
                        }
                    }
                ]
            };
        }

        if (data.tags) {
            const tagArray = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            if (tagArray.length > 0) {
                properties['Tags'] = {
                    multi_select: tagArray.map(tag => ({ name: tag }))
                };
            }
        }

        if (data.priority) {
            properties['Priority'] = {
                select: {
                    name: data.priority
                }
            };
        }

        return fetch('/api/createPage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                databaseId: this.databaseId,
                properties: properties
            })
        });
    }

    async loadRecentCases() {
        if (!this.databaseId) {
            return;
        }

        try {
            const response = await fetch('/api/queryDatabase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    databaseId: this.databaseId,
                    sorts: [
                        {
                            timestamp: 'created_time',
                            direction: 'descending'
                        }
                    ],
                    page_size: 5
                })
            });

            const result = await this.safeJsonParse(response);
            
            if (response.ok && !result.error) {
                this.displayRecentCases(result.data.results);
            }
        } catch (error) {
            console.error('Error loading recent cases:', error);
        }
    }

    displayRecentCases(cases) {
        const container = document.getElementById('recentCases');
        
        if (cases.length === 0) {
            container.innerHTML = '<p>No cases found. Add your first case above!</p>';
            return;
        }

        const casesHtml = cases.map(case_ => {
            const title = case_.properties.Title?.title?.[0]?.plain_text || 'Untitled';
            const caseNumber = case_.properties['Case Number']?.rich_text?.[0]?.plain_text || '';
            const status = case_.properties.Status?.select?.name || '';
            const type = case_.properties.Type?.select?.name || '';
            const date = case_.properties.Date?.date?.start || '';
            const court = case_.properties.Court?.rich_text?.[0]?.plain_text || '';

            return `
                <div class="case-item">
                    <h4>${title}</h4>
                    ${caseNumber ? `<p><strong>Case Number:</strong> ${caseNumber}</p>` : ''}
                    ${court ? `<p><strong>Court:</strong> ${court}</p>` : ''}
                    <div class="case-meta">
                        ${status ? `<span>Status: ${status}</span>` : ''}
                        ${type ? `<span>Type: ${type}</span>` : ''}
                        ${date ? `<span>Date: ${new Date(date).toLocaleDateString()}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div class="recent-cases">${casesHtml}</div>`;
    }

    clearForm() {
        document.getElementById('caseForm').reset();
    }

    showConnectionStatus(message, type) {
        const status = document.getElementById('connectionStatus');
        status.textContent = message;
        status.className = type;
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new NotionLawCollector();
});
