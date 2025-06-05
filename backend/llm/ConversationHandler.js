const { OpenAI } = require("openai");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../config/.env") });

const { processUserInput, createSuccessResponse } = require("./UserInputHandler");
const { addMessage, createLLMPayload, sanitizeHistory } = require("../storage/handlers/ConversationMemory");
const { createToolDefinitions } = require("../tools/ToolDefinitions");
const { executeToolCall, generateToolResponse } = require("../tools/ToolExecutor");

async function processConversation(userInput) {
  const { messageContent, historyNote } = processUserInput(userInput);
  
  addMessage("user", historyNote);

  if (userInput?.stock) {
    addMessage("user", `For context: this screenshot is of stock "${userInput.stock}".`);
  }

  sanitizeHistory();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const llmPayload = createLLMPayload(messageContent);
  const availableTools = createToolDefinitions();

  // CHECK HERE, default is gpt-4o-mini, but you can change it to any model you want

  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    messages: llmPayload,
    tools: availableTools,
    tool_choice: "auto"
  });

  const responseMessage = response.choices[0].message;

  if (responseMessage.tool_calls?.length) {
    const toolCall = responseMessage.tool_calls[0];
    const toolName = toolCall.function.name;
    const toolArguments = JSON.parse(toolCall.function.arguments || "{}");
    
    await executeToolCall(toolName, toolArguments);
    
    const naturalResponse = generateToolResponse(toolName, toolArguments);
    addMessage("assistant", naturalResponse);
    
    return createSuccessResponse(naturalResponse, [{ name: toolName, arguments: toolArguments }]);
  }

  const assistantReply = responseMessage.content || "";
  addMessage("assistant", assistantReply);
  
  return createSuccessResponse(assistantReply);
}

module.exports = { processConversation };
