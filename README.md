# InboxListener Chrome Extension

A Chrome Extension that monitors your Outlook inbox for new emails and logs "Hello World" to the console when new messages arrive.

## Features

- 🔐 **Microsoft Graph OAuth Authentication** - Secure authentication with your Outlook account
- 📧 **Real-time Email Monitoring** - Continuously monitors your inbox for new emails
- 🚀 **Background Service Worker** - Runs in the background using Chrome Extension Manifest V3
- 🎯 **Simple Console Logging** - Logs "Hello World" to Chrome DevTools console when new emails arrive
- 📊 **Status Management** - Easy-to-use popup interface to control the extension

## How It Works

1. **Authentication**: The extension uses Microsoft Graph API with OAuth 2.0 to authenticate with your Outlook account
2. **Background Monitoring**: A service worker runs continuously in the background, checking your inbox every 30 seconds
3. **New Email Detection**: When new emails are detected, the extension logs "Hello World" to the console
4. **Token Management**: Automatically handles token refresh and secure token storage

## Project Structure

```
InboxListener/
├── manifest.json          # Chrome Extension manifest
├── background.js          # Main service worker
├── auth.js               # Microsoft Graph authentication module
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
└── README.md             # This file
```

## Prerequisites

- Google Chrome browser
- Microsoft 365 or Outlook.com account
- Azure Active Directory application (instructions below)

## Setup Instructions

### Step 1: Register Application in Azure AD

1. **Go to Azure Portal**
   - Visit [Azure Portal](https://portal.azure.com/)
   - Sign in with your Microsoft account

2. **Register a New Application**
   - Navigate to "Azure Active Directory" > "App registrations"
   - Click "New registration"
   - Fill in the details:
     - **Name**: `InboxListener Chrome Extension`
     - **Supported account types**: `Accounts in any organizational directory and personal Microsoft accounts`
     - **Redirect URI**: Select "Public client/native (mobile & desktop)" and enter:
       ```
       https://{YOUR-EXTENSION-ID}.chromiumapp.org/
       ```
       (You'll get the extension ID after installing the extension in Chrome)

3. **Configure API Permissions**
   - Go to "API permissions" section
   - Click "Add a permission"
   - Select "Microsoft Graph" > "Delegated permissions"
   - Add these permissions:
     - `Mail.Read` (to read email messages)
     - `User.Read` (to read user profile)
   - Click "Grant admin consent" if you have admin privileges

4. **Note the Client ID**
   - Go to the "Overview" section
   - Copy the "Application (client) ID"
   - You'll need this for the extension configuration

### Step 2: Install and Configure the Extension

1. **Update Extension Configuration**
   
   Open the `manifest.json` file and replace `YOUR_AZURE_CLIENT_ID` with your actual client ID:
   
   ```json
   "oauth2": {
     "client_id": "your-actual-client-id-here",
     "scopes": [
       "https://graph.microsoft.com/Mail.Read",
       "https://graph.microsoft.com/User.Read"
     ]
   }
   ```

   Also update the `auth.js` file:
   
   ```javascript
   this.clientId = 'your-actual-client-id-here';
   ```

2. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `InboxListener` folder
   - Note the Extension ID that appears in the extension card

3. **Update Azure AD Redirect URI**
   - Go back to Azure Portal > Your App Registration > Authentication
   - Update the redirect URI to use your actual extension ID:
     ```
     https://{YOUR-ACTUAL-EXTENSION-ID}.chromiumapp.org/
     ```

### Step 3: Test the Extension

1. **Click the Extension Icon**
   - Look for the InboxListener icon in your Chrome toolbar
   - Click it to open the popup interface

2. **Authenticate**
   - Click "🔑 Sign in to Outlook"
   - Complete the Microsoft OAuth flow in the popup window
   - Grant the requested permissions

3. **Start Monitoring**
   - The extension should automatically start monitoring after authentication
   - You can also manually click "▶️ Start Monitoring"

4. **Test Email Detection**
   - Send yourself a test email
   - Wait up to 30 seconds (the polling interval)
   - Open Chrome DevTools (F12) > Console tab
   - You should see "Hello World" logged when the new email is detected

## Usage

### Extension Popup Controls

- **🔑 Sign in to Outlook**: Authenticate with your Microsoft account
- **▶️ Start Monitoring**: Begin monitoring your inbox for new emails
- **⏹️ Stop Monitoring**: Stop the email monitoring process
- **🔄 Refresh Status**: Update the status display
- **🚪 Sign Out**: Sign out and stop monitoring

### Status Indicators

- **Authentication**: Shows whether you're signed in to your Outlook account
- **Monitoring**: Shows whether the email monitoring is active
- **Last Check**: Shows the timestamp of the last email check

## Configuration Options

You can modify these settings in `background.js`:

```javascript
// Email check interval (milliseconds)
this.checkIntervalMs = 30000; // Check every 30 seconds (default)

// You can change this to check more or less frequently:
// this.checkIntervalMs = 60000;  // 1 minute
// this.checkIntervalMs = 10000;  // 10 seconds (not recommended for rate limiting)
```

## Troubleshooting

### Common Issues

1. **"Authentication failed" Error**
   - Verify your Client ID is correct in both `manifest.json` and `auth.js`
   - Ensure the redirect URI in Azure AD matches your extension ID
   - Check that API permissions are granted

2. **"No response URL received" Error**
   - This usually indicates a redirect URI mismatch
   - Double-check the extension ID and update Azure AD accordingly

3. **"Token exchange failed" Error**
   - Verify your Azure AD app configuration
   - Ensure the app is configured for public client authentication

4. **Extension Not Monitoring**
   - Check the Chrome DevTools console for error messages
   - Verify you're authenticated and monitoring is started
   - Ensure you have the necessary permissions (`Mail.Read`)

5. **"Hello World" Not Appearing**
   - Open Chrome DevTools (F12) and check the Console tab
   - Make sure monitoring is active (check popup status)
   - Send yourself a test email and wait for the polling interval

### Debug Mode

To enable detailed logging, you can modify the console.log statements in the code or open the Chrome DevTools for the extension:

1. Go to `chrome://extensions/`
2. Find InboxListener extension
3. Click "service worker" link under "Inspect views"
4. This opens DevTools for the background script

## Security Considerations

- **Token Storage**: Access tokens are stored securely using Chrome's storage API
- **Permissions**: The extension only requests the minimum necessary permissions
- **OAuth Flow**: Uses standard Microsoft OAuth 2.0 with PKCE for security
- **No Data Collection**: The extension doesn't collect or transmit any personal data

## API Rate Limits

Microsoft Graph API has rate limits. The extension is configured to:
- Check emails every 30 seconds (2 requests per minute)
- This is well within Microsoft's rate limits for most scenarios
- If you experience rate limiting, consider increasing the `checkIntervalMs` value

## Privacy Policy

This extension:
- Only accesses your email metadata (sender, subject, timestamp) to detect new messages
- Does not read email content beyond basic metadata
- Does not store or transmit any email data
- Stores authentication tokens locally in your browser
- Does not communicate with any servers other than Microsoft Graph API

## Support and Development

### File Structure Details

- **manifest.json**: Chrome Extension configuration file
- **background.js**: Main service worker that handles email monitoring
- **auth.js**: Microsoft Graph authentication helper
- **popup.html**: Extension popup interface
- **popup.js**: Popup interface functionality

### Extending the Extension

To modify what happens when a new email is detected, edit the `processNewEmail` method in `background.js`:

```javascript
async processNewEmail(email) {
  // Current implementation
  console.log('Hello World');
  
  // You could add additional functionality here:
  // - Show browser notifications
  // - Play a sound
  // - Store email data
  // - Send data to another service
}
```

## License

This project is provided as-is for educational and development purposes. Please ensure compliance with Microsoft Graph API terms of service and your organization's policies when using this extension.

## Version History

- **v1.0.0**: Initial release with basic email monitoring and "Hello World" logging

---

*For additional support or questions, please refer to the Microsoft Graph API documentation or Chrome Extension development guides.*
