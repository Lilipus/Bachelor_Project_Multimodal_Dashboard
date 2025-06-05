const fs = require("fs");
const path = require("path");

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, "../../config/systemPrompt.txt"), "utf-8");
const HISTORY_LIMIT = 8;

let conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }];

function sanitizeMessage(message) {
  if (typeof message.content !== "string" && !Array.isArray(message.content)) {
    message.content = JSON.stringify(message.content);
  }
  return message;
}

function addMessage(role, content) {
  conversationHistory.push({ role, content });
}

function createLLMPayload(messageContent) {
  const recentHistory = conversationHistory.slice(-HISTORY_LIMIT);
  const systemPrompt = conversationHistory[0];
  const conversationWithoutSystem = recentHistory.filter(msg => msg.role !== "system");
  
  return [
    systemPrompt,
    ...conversationWithoutSystem,
    { role: "user", content: messageContent }
  ];
}

function sanitizeHistory() {
  conversationHistory = conversationHistory.map(sanitizeMessage);
}

module.exports = { 
  addMessage, 
  createLLMPayload, 
  sanitizeHistory
};
