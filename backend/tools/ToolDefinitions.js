const STOCK_OPTIONS = ["Uber", "Google", "Apple", "Tesla", "Netflix", "Facebook", "Disney"];

function createToolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "select_stock",
        description: "Highlight a stock in the dashboard by name.",
        parameters: {
          type: "object",
          properties: { stock: { type: "string", enum: STOCK_OPTIONS } },
          required: ["stock"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "open_training_area",
        description: "Switch the dashboard to the training area.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "exit_training_area",
        description: "Switch the dashboard back to the main area.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "toggle_actual_data",
        description: "Toggles the actual data for the prediction stock.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "delete_data_points",
        description: "Deletes self-made data points on the prediction stock.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "take_screenshot",
        description: "Uses the speech function to call the lasso-effect for selecting the place to be screenshot.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    }
  ];
}

module.exports = { createToolDefinitions, STOCK_OPTIONS };
