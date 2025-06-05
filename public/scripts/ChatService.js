import config from './ApiClient.js';

export class ChatService {
  constructor() {
    this.conversationEndpoint = '/api/v1/conversations';
    this.imageUploadEndpoint = '/api/v1/images';
    this.messageListeners = [];
    this.toolListeners = new Map();
    this.audioListeners = [];
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    await config.initialize();
    this.conversationEndpoint = config.getApiUrl('/conversations');
    this.imageUploadEndpoint = config.getApiUrl('/images');
    this.isInitialized = true;
  }

  addMessageListener(callback) {
    this.messageListeners.push(callback);
  }

  addToolListener(toolName, callback) {
    this.toolListeners.set(toolName, callback);
  }

  addAudioListener(callback) {
    this.audioListeners.push(callback);
  }
  
  async sendTextMessage(content) {
    await this.initialize();
    return this.sendChatMessage({ text: content });
  }

  async sendVoiceMessage(audioData) {
    await this.initialize();
    const response = await this.postVoiceRequest(audioData);
    this.handleResponseAudio(response);
    this.handleServerResponse(response);
    return response;
  }

  async sendImageMessage(imageData, text = '') {
    await this.initialize();
    return this.sendChatMessage({ text, base64Image: imageData });
  }
  async uploadImage(imageData, stockSymbol) {
    await this.initialize();
    return this.postImageUpload(imageData, stockSymbol);
  }
  async sendChatMessage({ text, base64Image, stockSymbol }) {
    const messageContent = this.createMessageContent(text, base64Image);
    const requestPayload = this.createRequestPayload(messageContent, stockSymbol);
    const response = await this.postChatRequest(requestPayload);
    this.handleResponseAudio(response);
    this.handleServerResponse(response);
    return response;
  }

  createMessageContent(text, base64Image) {
    const content = [];
    
    if (base64Image) {
      content.push({
        type: "image_url",
        image_url: { url: base64Image }
      });
    }

    if (text?.trim()) {
      content.push({
        type: "text",
        text: text.trim()
      });
    }

    return content;
  }  createRequestPayload(messageContent, stockSymbol) {
    return {
      messages: [{ role: "user", content: messageContent }],
      stock: stockSymbol
    };
  }

  async postChatRequest(payload) {
    const response = await fetch(this.conversationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }

  async postVoiceRequest(audioData) {
    const response = await fetch(this.conversationEndpoint, { 
      method: 'POST', 
      body: audioData 
    });
    return response.json();
  }
  async postImageUpload(imageData, stockSymbol) {
    const response = await fetch(this.imageUploadEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, stock: stockSymbol })
    });
    return response.json();
  }
  handleResponseAudio(response) {
    if (!response.audioUrl) return;
    
    this.audioListeners.forEach(callback => callback(response.audioUrl));
  }

  handleServerResponse(response) {
    this.executeToolCalls(response.toolCalls || []);
    this.broadcastMessages(response.messages || []);
  }

  executeToolCalls(toolCalls) {
    for (const call of toolCalls) {
      const callback = this.toolListeners.get(call.name);
      if (!callback) continue;
      
      callback(call.arguments);
    }
  }

  broadcastMessages(messages) {
    for (const message of messages) {
      this.messageListeners.forEach(callback => callback(message));
    }
  }
}

export const chat = new ChatService();

// Backward compatibility aliases
chat.sendText = chat.sendTextMessage.bind(chat);
chat.sendVoice = chat.sendVoiceMessage.bind(chat);
chat.sendImage = chat.sendImageMessage.bind(chat);

// Event listener shortcuts
chat.onMessage = chat.addMessageListener.bind(chat);
chat.onTool = chat.addToolListener.bind(chat);
chat.onAudio = chat.addAudioListener.bind(chat);
