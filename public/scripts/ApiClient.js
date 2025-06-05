// ApiClient.js - API client for server communication
// Manages server connection settings and constructs API endpoint URLs

class ApiClient {
  constructor() {
    this.serverBaseUrl = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Try to fetch VS Code settings.json
      const response = await fetch('/.vscode/settings.json');
      if (response.ok) {
        const text = await response.text();
        // Remove comments for JSON parsing
        const cleanJson = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const settings = JSON.parse(cleanJson);
          // Extract server URL from proxy settings
        if (settings['liveServer.settings.proxy']?.proxyUri) {
          const proxyUri = settings['liveServer.settings.proxy'].proxyUri;
          // Extract base URL from proxy URI (remove /api suffix)
          this.serverBaseUrl = proxyUri.replace('/api', '');
        }
      }    } catch (error) {
      console.warn('[ApiClient] Could not load VS Code settings:', error.message);
    }    // Fallback to default if settings couldn't be loaded

    if (!this.serverBaseUrl) {
      // Change this IPV4HERE with your server's base URL, so if you run this locally, it will connect to your local server
      // If you want to run this locally, change the URL to your local server's address. 
      // Without this, the client won't know where to send requests for the APIs (i.e audio, images, etc.)
      // Even for the LLM, it needs to know where to send requests.
      this.serverBaseUrl = 'http://IPV4HERE:3000';
    }

    this.initialized = true;
  }

  getServerUrl(path = '') {
    if (!this.initialized) {
      throw new Error('ApiClient not initialized. Call await config.initialize() first.');
    }
    return `${this.serverBaseUrl}${path}`;
  }

  getApiUrl(endpoint = '') {
    return this.getServerUrl(`/api/v1${endpoint}`);
  }

  getAudioUrl(filename = '') {
    return this.getServerUrl(`/api/v1/audio/${filename}`);
  }
}

// Singleton instance yeehaw, they call him John Wicklient - you know, like John Wick but for API clients
// He'll be back, and so will the API client. Sheesh someone stop me before I make another pun - L
const config = new ApiClient();

export default config;
