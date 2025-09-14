/**
 * GitHub Actions + Issues Integration for Notion Law Data Collector
 * Zero-cost solution using GitHub services
 */

class NotionLawCollectorGitHub {
    constructor() {
        this.repositoryOwner = '';
        this.repositoryName = '';
        this.databaseId = '';
        this.init();
    }

    init() {
        this.loadConfig();
        this.bindEvents();
        this.setupStorageListeners();
    }

    /**
     * Load configuration from localStorage
     */
    loadConfig() {
        this.repositoryOwner = localStorage.getItem('repositoryOwner') || '';
        this.repositoryName = localStorage.getItem('repositoryName') || '';
        this.databaseId = localStorage.getItem('databaseId') || '';

        // Populate form fields with saved values
        const ownerInput = document.getElementById('repositoryOwner');
        const repoInput = document.getElementById('repositoryName');
        const dbInput = document.getElementById('databaseId');

        if (ownerInput) ownerInput.value = this.repositoryOwner;
        if (repoInput) repoInput.value = this.repositoryName;
        if (dbInput) dbInput.value = this.databaseId;
    }

    /**
     * Save configuration to localStorage
     */
    saveConfig() {
        localStorage.setItem('repositoryOwner', this.repositoryOwner);
        localStorage.setItem('repositoryName', this.repositoryName);
        localStorage.setItem('databaseId', this.databaseId);
    }

    /**
     * Set up event listeners for form fields to auto-save
     */
    setupStorageListeners() {
        const ownerInput = document.getElementById('repositoryOwner');
        const repoInput = document.getElementById('repositoryName');
        const dbInput = document.getElementById('databaseId');

        if (ownerInput) {
            ownerInput.addEventListener('input', (e) => {
                this.repositoryOwner = e.target.value;
                this.saveConfig();
            });
        }

        if (repoInput) {
            repoInput.addEventListener('input', (e) => {
                this.repositoryName = e.target.value;
                this.saveConfig();
            });
        }

        if (dbInput) {
            dbInput.addEventListener('input', (e) => {
                this.databaseId = e.target.value;
                this.saveConfig();
            });
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        const testButton = document.getElementById('testConnection');
        const caseForm = document.getElementById('caseForm');

        if (testButton) {
            testButton.addEventListener('click', () => this.testConfiguration());
        }

        if (caseForm) {
            caseForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }
    }

    /**
     * Test GitHub repository configuration
     */
    async testConfiguration() {
        const status = document.getElementById('connectionStatus');
        const button = document.getElementById('testConnection');

        if (!this.repositoryOwner || !this.repositoryName || !this.databaseId) {
            this.showStatus('Please fill in all configuration fields.', 'error');
            return;
        }

        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';

        try {
            // Test if repository exists and is accessible
            const repoUrl = `https://api.github.com/repos/${this.repositoryOwner}/${this.repositoryName}`;
            const response = await fetch(repoUrl);

            if (response.ok) {
                const repoData = await response.json();
                
                // Check if the repository has the process-legal-entry workflow
                const workflowUrl = `https://api.github.com/repos/${this.repositoryOwner}/${this.repositoryName}/actions/workflows`;
                const workflowResponse = await fetch(workflowUrl);
                
                if (workflowResponse.ok) {
                    const workflows = await workflowResponse.json();
                    const hasLegalEntryWorkflow = workflows.workflows.some(w => 
                        w.name === 'Process Legal Entry' || w.path.includes('process-legal-entry')
                    );

                    if (hasLegalEntryWorkflow) {
                        this.showStatus(
                            `✅ Configuration valid! Repository: ${repoData.full_name}, Database ID: ${this.databaseId.substring(0, 8)}...`,
                            'success'
                        );
                    } else {
                        this.showStatus(
                            `⚠️ Repository found but missing "Process Legal Entry" workflow. Please ensure the GitHub Actions workflow is set up.`,
                            'warning'
                        );
                    }
                } else {
                    this.showStatus(
                        `⚠️ Repository found but cannot access workflows. Make sure the repository has the required GitHub Actions workflow.`,
                        'warning'
                    );
                }
            } else if (response.status === 404) {
                this.showStatus(
                    '❌ Repository not found. Please check the owner and repository name.',
                    'error'
                );
            } else {
                this.showStatus(
                    '❌ Repository exists but may not be accessible. Check permissions.',
                    'error'
                );
            }
        } catch (error) {
            console.error('Configuration test error:', error);
            this.showStatus(
                '❌ Error testing configuration. Please check your inputs and try again.',
                'error'
            );
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-plug"></i> Test Configuration';
        }
    }

    /**
     * Handle form submission by creating a GitHub issue
     */
    async handleFormSubmit(event) {
        event.preventDefault();

        if (!this.repositoryOwner || !this.repositoryName || !this.databaseId) {
            this.showNotification('Please configure your repository settings first.', 'error');
            return;
        }

        this.showLoading(true);

        try {
            // Collect form data
            const formData = this.collectFormData();
            
            // Create GitHub issue with the form data
            await this.createGitHubIssue(formData);
            
            // Reset form and show success
            document.getElementById('caseForm').reset();
            this.showNotification('Legal case data submitted successfully! Check your repository issues for processing status.', 'success');
            
        } catch (error) {
            console.error('Submission error:', error);
            this.showNotification('Error submitting case data. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Collect form data from all inputs
     */
    collectFormData() {
        return {
            caseTitle: document.getElementById('caseTitle').value,
            caseNumber: document.getElementById('caseNumber').value,
            court: document.getElementById('court').value,
            judge: document.getElementById('judge').value,
            caseDate: document.getElementById('caseDate').value,
            status: document.getElementById('caseStatus').value,
            parties: document.getElementById('parties').value,
            caseType: document.getElementById('caseType').value,
            summary: document.getElementById('summary').value,
            outcome: document.getElementById('outcome').value,
            tags: document.getElementById('tags').value,
            priority: document.getElementById('priority').value,
            databaseId: this.databaseId
        };
    }

    /**
     * Create a GitHub issue with the legal case data
     */
    async createGitHubIssue(formData) {
        const issueTitle = `Legal Case Entry: ${formData.caseTitle || 'Untitled Case'}`;
        
        // Format the issue body with the form data
        const issueBody = this.formatIssueBody(formData);
        
        // Create the issue URL for GitHub's issue creation page
        const issueUrl = `https://github.com/${this.repositoryOwner}/${this.repositoryName}/issues/new?` +
            `title=${encodeURIComponent(issueTitle)}&` +
            `body=${encodeURIComponent(issueBody)}&` +
            `labels=legal-entry`;

        // Open the GitHub issue creation page in a new tab
        window.open(issueUrl, '_blank');
    }

    /**
     * Format the form data as an issue body
     */
    formatIssueBody(formData) {
        return `## Legal Case Data Entry

**Database ID**: ${formData.databaseId}

### Case Information
- **Case Title**: ${formData.caseTitle || 'N/A'}
- **Case Number**: ${formData.caseNumber || 'N/A'}
- **Court**: ${formData.court || 'N/A'}
- **Judge**: ${formData.judge || 'N/A'}
- **Date**: ${formData.caseDate || 'N/A'}
- **Status**: ${formData.status || 'N/A'}

### Case Details
- **Parties Involved**: ${formData.parties || 'N/A'}
- **Case Type**: ${formData.caseType || 'N/A'}
- **Priority**: ${formData.priority || 'N/A'}
- **Tags**: ${formData.tags || 'N/A'}

### Case Summary
${formData.summary || 'N/A'}

### Outcome/Ruling
${formData.outcome || 'N/A'}

---
*This issue was automatically generated by the Notion Law Data Collector. The GitHub Actions workflow will process this data and add it to your Notion database.*`;
    }

    /**
     * Show status message
     */
    showStatus(message, type) {
        const status = document.getElementById('connectionStatus');
        if (status) {
            status.innerHTML = `<div class="status-message ${type}">${message}</div>`;
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type) {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.className = `notification ${type} show`;
            notification.textContent = message;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 5000);
        }
    }

    /**
     * Show/hide loading overlay
     */
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NotionLawCollectorGitHub();
});

// Add some CSS for the status messages and cost info
const style = document.createElement('style');
style.textContent = `
    .status-message {
        margin-top: 10px;
        padding: 10px;
        border-radius: 4px;
        font-size: 14px;
    }
    
    .status-message.success {
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
    }
    
    .status-message.error {
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
    }
    
    .status-message.warning {
        background-color: #fff3cd;
        border: 1px solid #ffeaa7;
        color: #856404;
    }
    
    .cost-info {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 8px;
        margin-top: 20px;
    }
    
    .cost-info h3 {
        margin-top: 0;
        color: white;
    }
    
    .cost-info ul {
        margin: 10px 0;
    }
    
    .cost-info li {
        margin: 5px 0;
    }
`;
document.head.appendChild(style);