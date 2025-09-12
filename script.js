
class NotionLawCollector {
    constructor() {
        this.notionToken = '';
        this.databaseId = '';
        this.init();
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
        document.getElementById('notionToken').addEventListener('change', () => this.saveConfig());
        document.getElementById('databaseId').addEventListener('change', () => this.saveConfig());
    }

    loadConfig() {
        const token = localStorage.getItem('notionToken');
        const dbId = localStorage.getItem('databaseId');
        
        if (token) {
            document.getElementById('notionToken').value = token;
            this.notionToken = token;
        }
        
        if (dbId) {
            document.getElementById('databaseId').value = dbId;
            this.databaseId = dbId;
        }
    }

    saveConfig() {
        this.notionToken = document.getElementById('notionToken').value;
        this.databaseId = document.getElementById('databaseId').value;
        
        localStorage.setItem('notionToken', this.notionToken);
        localStorage.setItem('databaseId', this.databaseId);
    }

    async testConnection() {
        this.saveConfig();
        
        if (!this.notionToken || !this.databaseId) {
            this.showNotification('Please enter both token and database ID', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            const response = await fetch(`https://api.notion.com/v1/databases/${this.databaseId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.notionToken}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showConnectionStatus('Connection successful! Database: ' + data.title[0]?.plain_text || 'Untitled', 'success');
                this.showNotification('Connection successful!', 'success');
                document.getElementById('refreshCases').style.display = 'inline-flex';
                this.loadRecentCases();
            } else {
                const error = await response.json();
                this.showConnectionStatus('Connection failed: ' + (error.message || 'Unknown error'), 'error');
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
        
        if (!this.notionToken || !this.databaseId) {
            this.showNotification('Please configure Notion connection first', 'error');
            return;
        }

        this.showLoading(true);
        
        try {
            const formData = this.getFormData();
            const response = await this.createNotionPage(formData);
            
            if (response.ok) {
                this.showNotification('Case saved successfully!', 'success');
                this.clearForm();
                this.loadRecentCases();
            } else {
                const error = await response.json();
                this.showNotification('Failed to save case: ' + (error.message || 'Unknown error'), 'error');
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

        return fetch(`https://api.notion.com/v1/pages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: {
                    database_id: this.databaseId
                },
                properties: properties
            })
        });
    }

    async loadRecentCases() {
        if (!this.notionToken || !this.databaseId) {
            return;
        }

        try {
            const response = await fetch(`https://api.notion.com/v1/databases/${this.databaseId}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.notionToken}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sorts: [
                        {
                            timestamp: 'created_time',
                            direction: 'descending'
                        }
                    ],
                    page_size: 5
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.displayRecentCases(data.results);
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
