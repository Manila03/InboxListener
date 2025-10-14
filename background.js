// InboxListener Background Service Worker
import { GraphAuth } from './auth.js';

class InboxListener {
  constructor() {
    this.auth = new GraphAuth();
    this.isMonitoring = false;
    this.pollInterval = null;
    this.lastEmailCheck = null;
    this.checkIntervalMs = 30000; // Check every 30 seconds
    
    console.log('InboxListener service worker initialized');
  }

  // Initialize the extension
  async initialize() {
    try {
      console.log('Initializing InboxListener...');
      
      // Check if user is already authenticated
      const isAuthenticated = await this.auth.isTokenValid();
      
      if (isAuthenticated) {
        console.log('User already authenticated, starting email monitoring...');
        await this.startMonitoring();
      } else {
        console.log('User not authenticated. Authentication required.');
      }
      
      // Set up extension event listeners
      this.setupEventListeners();
      
    } catch (error) {
      console.error('Failed to initialize InboxListener:', error);
    }
  }

  // Set up Chrome extension event listeners
  setupEventListeners() {
    // Handle messages from popup or other parts of the extension
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('Extension startup detected');
      this.initialize();
    });

    // Handle extension install
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('Extension installed/updated:', details);
      if (details.reason === 'install') {
        console.log('First time install - authentication required');
      }
    });
  }

  // Handle messages from popup or other extension components
  async handleMessage(request, sender, sendResponse) {
    try {
      console.log('Received message:', request);

      switch (request.action) {
        case 'authenticate':
          await this.authenticate();
          sendResponse({ success: true, message: 'Authentication successful' });
          break;

        case 'startMonitoring':
          await this.startMonitoring();
          sendResponse({ success: true, message: 'Email monitoring started' });
          break;

        case 'stopMonitoring':
          this.stopMonitoring();
          sendResponse({ success: true, message: 'Email monitoring stopped' });
          break;

        case 'getStatus':
          const status = await this.getStatus();
          sendResponse({ success: true, data: status });
          break;

        case 'signOut':
          await this.signOut();
          sendResponse({ success: true, message: 'Signed out successfully' });
          break;

        default:
          sendResponse({ success: false, message: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, message: error.message });
    }
  }

  // Authenticate with Microsoft Graph
  async authenticate() {
    try {
      console.log('Starting authentication process...');
      
      const tokenResponse = await this.auth.authenticate();
      console.log('Authentication successful');
      
      // Start monitoring after successful authentication
      await this.startMonitoring();
      
      return tokenResponse;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  // Start email monitoring
  async startMonitoring() {
    try {
      if (this.isMonitoring) {
        console.log('Email monitoring is already running');
        return;
      }

      // Verify authentication before starting
      const isAuthenticated = await this.auth.isTokenValid();
      if (!isAuthenticated) {
        throw new Error('Authentication required before starting monitoring');
      }

      console.log('Starting email monitoring...');
      this.isMonitoring = true;

      // Get initial email count to establish baseline
      await this.initializeEmailBaseline();

      // Start polling for new emails
      this.pollInterval = setInterval(async () => {
        try {
          await this.checkForNewEmails();
        } catch (error) {
          console.error('Error during email check:', error);
          
          // If authentication error, stop monitoring
          if (error.message.includes('authentication') || error.message.includes('token')) {
            console.log('Authentication error detected, stopping monitoring');
            this.stopMonitoring();
          }
        }
      }, this.checkIntervalMs);

      console.log(`Email monitoring started (checking every ${this.checkIntervalMs/1000} seconds)`);

    } catch (error) {
      console.error('Failed to start email monitoring:', error);
      this.isMonitoring = false;
      throw error;
    }
  }

  // Stop email monitoring
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('Email monitoring is not running');
      return;
    }

    console.log('Stopping email monitoring...');
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('Email monitoring stopped');
  }

  // Initialize email baseline (get current inbox count)
  async initializeEmailBaseline() {
    try {
      console.log('Initializing email baseline...');
      
      const accessToken = await this.auth.getValidToken();
      const response = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$count=true&$top=1&$select=id,receivedDateTime', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get inbox messages: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store the most recent email's timestamp as our baseline
      if (data.value && data.value.length > 0) {
        this.lastEmailCheck = new Date(data.value[0].receivedDateTime);
        console.log('Email baseline established:', this.lastEmailCheck);
      } else {
        // No emails in inbox, use current time as baseline
        this.lastEmailCheck = new Date();
        console.log('No emails found, using current time as baseline:', this.lastEmailCheck);
      }

    } catch (error) {
      console.error('Failed to initialize email baseline:', error);
      // Use current time as fallback
      this.lastEmailCheck = new Date();
      throw error;
    }
  }

  // Check for new emails since last check
  async checkForNewEmails() {
    try {
      console.log('Checking for new emails...');
      
      const accessToken = await this.auth.getValidToken();
      
      // Build filter to get emails newer than our last check
      const filterTime = this.lastEmailCheck.toISOString();
      const filter = `receivedDateTime gt ${filterTime}`;
      
      const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=${encodeURIComponent(filter)}&$select=id,subject,receivedDateTime,from&$orderby=receivedDateTime desc&$top=10`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to check for new emails: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.value && data.value.length > 0) {
        console.log(`Found ${data.value.length} new email(s)!`);
        
        // Process each new email
        for (const email of data.value) {
          await this.processNewEmail(email);
        }
        
        // Update our last check timestamp to the most recent email
        const mostRecentEmail = data.value[0];
        this.lastEmailCheck = new Date(mostRecentEmail.receivedDateTime);
        console.log('Updated last email check time:', this.lastEmailCheck);
        
      } else {
        console.log('No new emails found');
      }

    } catch (error) {
      console.error('Error checking for new emails:', error);
      throw error;
    }
  }

  // Process a new email (this is where we log "Hello World")
  async processNewEmail(email) {
    try {
      console.log('Processing new email:', {
        id: email.id,
        subject: email.subject,
        from: email.from?.emailAddress?.address || 'Unknown sender',
        receivedDateTime: email.receivedDateTime
      });

      // This is the main requirement: log "Hello World" when new email arrives
      console.log('Hello World');
      
      // Optional: You can add additional processing here
      console.log(`New email received: "${email.subject}" from ${email.from?.emailAddress?.address || 'Unknown'}`);

    } catch (error) {
      console.error('Error processing new email:', error);
    }
  }

  // Get current status of the monitoring service
  async getStatus() {
    try {
      const isAuthenticated = await this.auth.isTokenValid();
      
      return {
        isAuthenticated: isAuthenticated,
        isMonitoring: this.isMonitoring,
        lastEmailCheck: this.lastEmailCheck,
        checkInterval: this.checkIntervalMs
      };
    } catch (error) {
      console.error('Error getting status:', error);
      return {
        isAuthenticated: false,
        isMonitoring: false,
        lastEmailCheck: null,
        checkInterval: this.checkIntervalMs,
        error: error.message
      };
    }
  }

  // Sign out and stop monitoring
  async signOut() {
    try {
      console.log('Signing out...');
      
      // Stop monitoring first
      this.stopMonitoring();
      
      // Clear authentication
      await this.auth.signOut();
      
      // Reset state
      this.lastEmailCheck = null;
      
      console.log('Successfully signed out');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }
}

// Initialize the InboxListener when the service worker starts
const inboxListener = new InboxListener();

// Start initialization when the service worker loads
inboxListener.initialize().catch(error => {
  console.error('Failed to initialize InboxListener service worker:', error);
});

// Export for potential use by other modules
export { InboxListener };