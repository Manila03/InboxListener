// Popup Script for InboxListener Extension
class PopupController {
  constructor() {
    this.elements = {
      // Status elements
      authStatus: document.getElementById('authStatus'),
      authIndicator: document.getElementById('authIndicator'),
      monitoringStatus: document.getElementById('monitoringStatus'),
      monitoringIndicator: document.getElementById('monitoringIndicator'),
      lastCheckTime: document.getElementById('lastCheckTime'),
      
      // UI sections
      loadingSection: document.getElementById('loadingSection'),
      buttonSection: document.getElementById('buttonSection'),
      message: document.getElementById('message'),
      
      // Buttons
      authenticateBtn: document.getElementById('authenticateBtn'),
      startMonitoringBtn: document.getElementById('startMonitoringBtn'),
      stopMonitoringBtn: document.getElementById('stopMonitoringBtn'),
      refreshStatusBtn: document.getElementById('refreshStatusBtn'),
      signOutBtn: document.getElementById('signOutBtn')
    };

    this.currentStatus = null;
    this.init();
  }

  // Initialize popup
  async init() {
    console.log('Initializing popup...');
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load initial status
    await this.refreshStatus();
  }

  // Set up button event listeners
  setupEventListeners() {
    this.elements.authenticateBtn.addEventListener('click', () => this.handleAuthenticate());
    this.elements.startMonitoringBtn.addEventListener('click', () => this.handleStartMonitoring());
    this.elements.stopMonitoringBtn.addEventListener('click', () => this.handleStopMonitoring());
    this.elements.refreshStatusBtn.addEventListener('click', () => this.refreshStatus());
    this.elements.signOutBtn.addEventListener('click', () => this.handleSignOut());
  }

  // Send message to background script
  async sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
      const message = { action, ...data };
      
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response ? response.message : 'Unknown error'));
        }
      });
    });
  }

  // Refresh status from background script
  async refreshStatus() {
    try {
      console.log('Refreshing status...');
      
      this.showLoading(true);
      this.hideMessage();

      const response = await this.sendMessage('getStatus');
      this.currentStatus = response.data;
      
      this.updateStatusDisplay();
      this.updateButtonVisibility();
      
    } catch (error) {
      console.error('Failed to refresh status:', error);
      this.showMessage('Failed to get status: ' + error.message, 'error');
      
      // Show default error state
      this.updateStatusDisplay({
        isAuthenticated: false,
        isMonitoring: false,
        lastEmailCheck: null,
        error: error.message
      });
      this.updateButtonVisibility();
      
    } finally {
      this.showLoading(false);
    }
  }

  // Update status display
  updateStatusDisplay(status = this.currentStatus) {
    if (!status) return;

    // Update authentication status
    if (status.isAuthenticated) {
      this.elements.authStatus.textContent = 'Signed In';
      this.elements.authIndicator.className = 'status-indicator active';
    } else {
      this.elements.authStatus.textContent = 'Not Signed In';
      this.elements.authIndicator.className = 'status-indicator inactive';
    }

    // Update monitoring status
    if (status.isMonitoring) {
      this.elements.monitoringStatus.textContent = 'Active';
      this.elements.monitoringIndicator.className = 'status-indicator active';
    } else {
      this.elements.monitoringStatus.textContent = 'Stopped';
      this.elements.monitoringIndicator.className = 'status-indicator inactive';
    }

    // Update last check time
    if (status.lastEmailCheck) {
      const lastCheck = new Date(status.lastEmailCheck);
      this.elements.lastCheckTime.textContent = this.formatTime(lastCheck);
    } else {
      this.elements.lastCheckTime.textContent = 'Never';
    }

    // Show error if present
    if (status.error) {
      this.showMessage('Error: ' + status.error, 'error');
    }
  }

  // Update button visibility based on status
  updateButtonVisibility(status = this.currentStatus) {
    if (!status) return;

    const {
      authenticateBtn,
      startMonitoringBtn,
      stopMonitoringBtn,
      refreshStatusBtn,
      signOutBtn
    } = this.elements;

    // Show/hide authenticate button
    if (status.isAuthenticated) {
      authenticateBtn.style.display = 'none';
      signOutBtn.style.display = 'block';
    } else {
      authenticateBtn.style.display = 'block';
      signOutBtn.style.display = 'none';
    }

    // Show/hide monitoring buttons
    if (status.isAuthenticated) {
      if (status.isMonitoring) {
        startMonitoringBtn.style.display = 'none';
        stopMonitoringBtn.style.display = 'block';
      } else {
        startMonitoringBtn.style.display = 'block';
        stopMonitoringBtn.style.display = 'none';
      }
    } else {
      startMonitoringBtn.style.display = 'none';
      stopMonitoringBtn.style.display = 'none';
    }

    // Always show refresh button
    refreshStatusBtn.style.display = 'block';
  }

  // Handle authenticate button click
  async handleAuthenticate() {
    try {
      console.log('Starting authentication...');
      
      this.setButtonsEnabled(false);
      this.showMessage('Starting authentication...', 'info');

      await this.sendMessage('authenticate');
      
      this.showMessage('Authentication successful!', 'success');
      await this.refreshStatus();
      
    } catch (error) {
      console.error('Authentication failed:', error);
      this.showMessage('Authentication failed: ' + error.message, 'error');
      
    } finally {
      this.setButtonsEnabled(true);
    }
  }

  // Handle start monitoring button click
  async handleStartMonitoring() {
    try {
      console.log('Starting monitoring...');
      
      this.setButtonsEnabled(false);
      this.showMessage('Starting email monitoring...', 'info');

      await this.sendMessage('startMonitoring');
      
      this.showMessage('Email monitoring started!', 'success');
      await this.refreshStatus();
      
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      this.showMessage('Failed to start monitoring: ' + error.message, 'error');
      
    } finally {
      this.setButtonsEnabled(true);
    }
  }

  // Handle stop monitoring button click
  async handleStopMonitoring() {
    try {
      console.log('Stopping monitoring...');
      
      this.setButtonsEnabled(false);
      this.showMessage('Stopping email monitoring...', 'info');

      await this.sendMessage('stopMonitoring');
      
      this.showMessage('Email monitoring stopped.', 'success');
      await this.refreshStatus();
      
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
      this.showMessage('Failed to stop monitoring: ' + error.message, 'error');
      
    } finally {
      this.setButtonsEnabled(true);
    }
  }

  // Handle sign out button click
  async handleSignOut() {
    try {
      if (!confirm('Are you sure you want to sign out? This will stop email monitoring.')) {
        return;
      }

      console.log('Signing out...');
      
      this.setButtonsEnabled(false);
      this.showMessage('Signing out...', 'info');

      await this.sendMessage('signOut');
      
      this.showMessage('Signed out successfully.', 'success');
      await this.refreshStatus();
      
    } catch (error) {
      console.error('Failed to sign out:', error);
      this.showMessage('Failed to sign out: ' + error.message, 'error');
      
    } finally {
      this.setButtonsEnabled(true);
    }
  }

  // Show/hide loading indicator
  showLoading(show) {
    this.elements.loadingSection.style.display = show ? 'block' : 'none';
    this.elements.buttonSection.style.display = show ? 'none' : 'block';
  }

  // Show message to user
  showMessage(text, type = 'info') {
    const messageEl = this.elements.message;
    
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';

    // Auto-hide success/info messages after 3 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        this.hideMessage();
      }, 3000);
    }
  }

  // Hide message
  hideMessage() {
    this.elements.message.style.display = 'none';
  }

  // Enable/disable buttons
  setButtonsEnabled(enabled) {
    const buttons = [
      this.elements.authenticateBtn,
      this.elements.startMonitoringBtn,
      this.elements.stopMonitoringBtn,
      this.elements.refreshStatusBtn,
      this.elements.signOutBtn
    ];

    buttons.forEach(button => {
      button.disabled = !enabled;
    });
  }

  // Format time for display
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} min ago`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    // More than 24 hours
    return date.toLocaleString();
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded, initializing...');
  new PopupController();
});

// Handle popup unload
window.addEventListener('beforeunload', () => {
  console.log('Popup closing...');
});