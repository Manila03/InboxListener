// Microsoft Graph Authentication Module
class GraphAuth {
  constructor() {
    // Replace with your actual Azure AD app configuration
    this.clientId = 'YOUR_AZURE_CLIENT_ID';
    this.redirectUri = chrome.identity.getRedirectURL();
    this.scopes = ['https://graph.microsoft.com/Mail.Read', 'https://graph.microsoft.com/User.Read'];
    this.authority = 'https://login.microsoftonline.com/common';
    
    console.log('GraphAuth initialized with redirect URI:', this.redirectUri);
  }

  // Generate OAuth URL for authentication
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      response_mode: 'query',
      state: this.generateRandomState()
    });

    return `${this.authority}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  // Generate random state for CSRF protection
  generateRandomState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Launch OAuth flow
  async authenticate() {
    try {
      console.log('Starting authentication flow...');
      
      const authUrl = this.getAuthUrl();
      console.log('Auth URL:', authUrl);

      return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        }, (responseUrl) => {
          if (chrome.runtime.lastError) {
            console.error('Authentication error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }

          if (!responseUrl) {
            reject(new Error('No response URL received'));
            return;
          }

          console.log('Response URL:', responseUrl);
          
          // Extract authorization code from response URL
          const url = new URL(responseUrl);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            reject(new Error(`Authentication failed: ${error}`));
            return;
          }

          if (!code) {
            reject(new Error('No authorization code received'));
            return;
          }

          // Exchange code for token
          this.exchangeCodeForToken(code)
            .then(tokenResponse => {
              console.log('Token exchange successful');
              resolve(tokenResponse);
            })
            .catch(tokenError => {
              console.error('Token exchange failed:', tokenError);
              reject(tokenError);
            });
        });
      });
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code) {
    const tokenEndpoint = `${this.authority}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      code: code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
      scope: this.scopes.join(' ')
    });

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
      }

      const tokenData = await response.json();
      
      // Store token securely
      await this.storeToken(tokenData);
      
      return tokenData;
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  // Store token in Chrome storage
  async storeToken(tokenData) {
    const tokenInfo = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      expires_at: Date.now() + (tokenData.expires_in * 1000)
    };

    return new Promise((resolve, reject) => {
      chrome.storage.secure.set({ 'graph_token': tokenInfo }, () => {
        if (chrome.runtime.lastError) {
          // Fallback to regular storage if secure storage is not available
          chrome.storage.local.set({ 'graph_token': tokenInfo }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              console.log('Token stored successfully (local storage)');
              resolve();
            }
          });
        } else {
          console.log('Token stored successfully (secure storage)');
          resolve();
        }
      });
    });
  }

  // Get stored token
  async getStoredToken() {
    return new Promise((resolve, reject) => {
      // Try secure storage first
      chrome.storage.secure.get(['graph_token'], (result) => {
        if (chrome.runtime.lastError || !result.graph_token) {
          // Fallback to local storage
          chrome.storage.local.get(['graph_token'], (localResult) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(localResult.graph_token);
            }
          });
        } else {
          resolve(result.graph_token);
        }
      });
    });
  }

  // Check if token is valid and not expired
  async isTokenValid() {
    try {
      const tokenInfo = await this.getStoredToken();
      
      if (!tokenInfo) {
        return false;
      }

      // Check if token is expired (with 5-minute buffer)
      const isExpired = Date.now() >= (tokenInfo.expires_at - 300000);
      
      return !isExpired;
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }

  // Get valid access token (refresh if needed)
  async getValidToken() {
    try {
      const tokenInfo = await this.getStoredToken();
      
      if (!tokenInfo) {
        throw new Error('No token found. Please authenticate.');
      }

      // Check if token is expired
      const isExpired = Date.now() >= (tokenInfo.expires_at - 300000);
      
      if (isExpired && tokenInfo.refresh_token) {
        console.log('Token expired, refreshing...');
        return await this.refreshToken(tokenInfo.refresh_token);
      }

      return tokenInfo.access_token;
    } catch (error) {
      console.error('Error getting valid token:', error);
      throw error;
    }
  }

  // Refresh access token using refresh token
  async refreshToken(refreshToken) {
    const tokenEndpoint = `${this.authority}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: this.scopes.join(' ')
    });

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error}`);
      }

      const tokenData = await response.json();
      
      // Store new token
      await this.storeToken(tokenData);
      
      return tokenData.access_token;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  // Sign out (clear stored token)
  async signOut() {
    return new Promise((resolve, reject) => {
      chrome.storage.secure.remove(['graph_token'], () => {
        chrome.storage.local.remove(['graph_token'], () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            console.log('User signed out successfully');
            resolve();
          }
        });
      });
    });
  }
}

export { GraphAuth };