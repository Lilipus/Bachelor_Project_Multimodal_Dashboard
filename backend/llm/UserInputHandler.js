function isValidInput(input) {
  return input !== undefined && input !== null;
}

function extractImageUrl(input) {
  return input.base64Image || input.image || input.image_url;
}

function hasImageContent(input) {
  return typeof input === "object" && extractImageUrl(input);
}

function hasTextContent(input) {
  return typeof input === "object" && input.text?.trim();
}

function buildImageMessage(imageUrl) {
  return { type: "image_url", image_url: { url: imageUrl } };
}

function buildTextMessage(text) {
  return { type: "text", text };
}

function createImageInputMessage(input) {
  const messageContent = [];
  const historyNote = [];

  const imageUrl = extractImageUrl(input);
  if (imageUrl) {
    messageContent.push(buildImageMessage(imageUrl));
    historyNote.push("[Image uploaded]");
  }

  if (hasTextContent(input)) {
    messageContent.push(buildTextMessage(input.text.trim()));
    historyNote.push(input.text.trim());
  }

  return { messageContent, historyNote: historyNote.join("\n\n") || "[No text content]" };
}

function processUserInput(userInput) {
  if (!isValidInput(userInput)) {
    return {
      messageContent: [buildTextMessage("No input received")],
      historyNote: "No input received"
    };
  }

  let messageContent = [];
  let historyNote = "";
  
  if (hasImageContent(userInput) || hasTextContent(userInput)) {
    const result = createImageInputMessage(userInput);
    messageContent = result.messageContent;
    historyNote = result.historyNote;
  } else if (typeof userInput === "object") {
    const jsonContent = JSON.stringify(userInput);
    messageContent.push(buildTextMessage(jsonContent));
    historyNote = jsonContent;
  } else {
    messageContent.push(buildTextMessage(userInput));
    historyNote = userInput;
  }

  return { messageContent, historyNote };
}

function createSuccessResponse(assistantReply, toolCalls = []) {
  return {
    assistantReply,
    toolCalls,
    messages: [assistantReply]
  };
}

module.exports = { 
  processUserInput, 
  createSuccessResponse 
};
