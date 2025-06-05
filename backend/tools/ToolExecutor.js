let toolExecutionCallback = null;

function generateToolResponse(toolName, toolArguments) {
  const responses = {
    select_stock: `I've selected ${toolArguments.stock} stock for you.`,
    open_training_area: "I've opened the training area for you.",
    exit_training_area: "I've returned you to the main area.",
    toggle_actual_data: "I've toggled the actual data display.",
    delete_data_points: "I've deleted the data points for you.",
    take_screenshot: "I've triggered the screenshot selection tool for you."
  };

  return responses[toolName] || `I've executed the ${toolName} action.`;
}

async function executeToolCall(toolName, toolArguments) {
  if (toolExecutionCallback) {
    await toolExecutionCallback(toolName, toolArguments);
  }
}

function registerToolCallback(callback) {
  toolExecutionCallback = callback;
}

module.exports = { 
  generateToolResponse, 
  executeToolCall, 
  registerToolCallback 
};
