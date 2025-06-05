function determinePerformance(currentPrice, targetPrice) {
  if (currentPrice >= targetPrice) return 'above';
  if (currentPrice < targetPrice * 0.95) return 'below';
  return 'neutral';
}

function calculateStockMetrics(stockData) {
  if (!stockData || stockData.length === 0) {
    return {
      currentPrice: 0,
      change: 0,
      changePercent: 0,
      target: 0,
      performance: 'neutral'
    };
  }

  const latestPrice = stockData[stockData.length - 1].Close;
  const previousPrice = stockData.length > 1 ? stockData[stockData.length - 2].Close : latestPrice;
  const priceChange = latestPrice - previousPrice;
  const changePercentage = previousPrice !== 0 ? (priceChange / previousPrice) * 100 : 0;
  
  const averagePrice = stockData.reduce((sum, data) => sum + data.Close, 0) / stockData.length;
  const targetPrice = averagePrice * 1.05;
  
  const performance = determinePerformance(latestPrice, targetPrice);
  
  return {
    currentPrice: latestPrice,
    change: priceChange,
    changePercent: changePercentage,
    target: targetPrice,
    performance
  };
}

function transformStockDataForChart(stockData, currentPrice, changePercent) {
  return stockData.slice(-30).map(data => ({
    date: data.Date,
    price: data.Close,
    currentPrice,
    changeLabel: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`
  }));
}

function createVegaLiteSpec(chartData, stockName, priceChange) {
  return {
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    "config": {
      "autosize": { "type": "fit-x" },
      "view": { "stroke": "transparent" },
      "font": "Segoe UI",
      "axis": {
        "domain": false,
        "labelColor": "#605E5C",
        "labelFontSize": 12,
        "labelPadding": 5,
        "ticks": false,
        "tickCount": 5,
        "titleFontSize": 14,
        "titleFontWeight": "bold",
        "titleColor": "#605E5C",
        "gridDash": [1, 5],
        "gridColor": null
      }
    },
    "data": { "values": chartData },
    "width": "container",
    "height": 100,
    "layer": [
      // Price line layer
      {
        "mark": {
          "type": "line",
          "interpolate": "natural",
          "tooltip": true
        },
        "encoding": {
          "color": { "value": "gray" },
          "x": {
            "field": "date",
            "type": "temporal",
            "axis": null
          },
          "y": {
            "field": "price",
            "type": "quantitative",
            "axis": null
          }
        }
      },
      
      // Latest price point layer
      {
        "mark": {
          "type": "circle",
          "tooltip": true
        },
        "encoding": {
          "color": { "value": "green" },
          "size": { "value": 50 },
          "x": {
            "aggregate": "max",
            "field": "date",
            "type": "temporal"
          },
          "y": {
            "aggregate": { "argmax": "date" },
            "field": "price",
            "type": "quantitative"
          }
        }
      },
      
      // Min price point layer
      {
        "mark": {
          "type": "circle",
          "tooltip": true
        },
        "encoding": {
          "color": { "value": "teal" },
          "size": { "value": 50 },
          "x": {
            "aggregate": { "argmin": "price" },
            "field": "date",
            "type": "temporal"
          },
          "y": {
            "aggregate": "min",
            "field": "price",
            "type": "quantitative"
          }
        }
      },
      
      // Max price point layer
      {
        "mark": {
          "type": "circle",
          "tooltip": true
        },
        "encoding": {
          "color": { "value": "black" },
          "size": { "value": 50 },
          "x": {
            "aggregate": { "argmax": "price" },
            "field": "date",
            "type": "temporal"
          },
          "y": {
            "aggregate": "max",
            "field": "price",
            "type": "quantitative"
          }
        }
      },
      
      // Stock name label
      {
        "mark": {
          "type": "text",
          "dx": 20,
          "fontSize": 12,
          "fontWeight": "bold",
          "align": "left",
          "baseline": "bottom"
        },
        "encoding": {
          "x": {
            "aggregate": "max",
            "field": "date",
            "type": "temporal"
          },
          "y": {
            "aggregate": "max",
            "field": "price",
            "type": "quantitative"
          },
          "text": { "datum": stockName }
        }
      },
      
      // Current price label
      {
        "mark": {
          "type": "text",
          "dx": 20,
          "dy": 20,
          "fontSize": 16,
          "fontWeight": "bold",
          "align": "left",
          "baseline": "bottom"
        },
        "encoding": {
          "x": {
            "aggregate": "max",
            "field": "date",
            "type": "temporal"
          },
          "y": {
            "aggregate": "max",
            "field": "price",
            "type": "quantitative"
          },
          "text": {
            "field": "currentPrice",
            "format": "$,.2f"
          },
          "color": { "value": priceChange >= 0 ? "green" : "red" }
        }
      },
      
      // Change percentage label
      {
        "mark": {
          "type": "text",
          "dx": 20,
          "dy": 35,
          "fontSize": 12,
          "align": "left",
          "baseline": "top"
        },
        "encoding": {
          "x": {
            "aggregate": "max",
            "field": "date",
            "type": "temporal"
          },
          "y": {
            "aggregate": "max",
            "field": "price",
            "type": "quantitative"
          },
          "text": { "field": "changeLabel" },
          "color": { "value": priceChange >= 0 ? "green" : "red" }
        }
      }
    ]
  };
}

function showPlaceholder(container) {
  container.innerHTML = '<div style="text-align: center; color: #666; font-size: 12px; line-height: 1.4;">Select a stock<br>to view KPI</div>';
}

function showStockNotFound(container) {
  container.innerHTML = '<div style="text-align: center; color: #666; font-size: 12px;">Stock not found</div>';
}

function showError(container) {
  container.innerHTML = '<div style="text-align: center; color: #dc3545; font-size: 12px;">Error loading KPI</div>';
}

function getStockList() {
  return window.stocks || [
    { label: "Uber", url: "https://raw.githubusercontent.com/Tozorro/Bachelor_datasets/refs/heads/main/UBER.csv" },
    { label: "Google", url: "https://raw.githubusercontent.com/Tozorro/Bachelor_datasets/main/GOOGL.csv" },
    { label: "Apple", url: "https://raw.githubusercontent.com/Tozorro/Bachelor_datasets/main/AAPL.csv" },
    { label: "Tesla", url: "https://raw.githubusercontent.com/Tozorro/Bachelor_datasets/main/TSLA.csv" },
    { label: "Netflix", url: "https://raw.githubusercontent.com/Atzorro/Bachelor_datasets/refs/heads/main/NFLX.csv" },
    { label: "Facebook", url: "https://raw.githubusercontent.com/Tozorro/Bachelor_datasets/refs/heads/main/FB.csv" },
    { label: "Disney", url: "https://raw.githubusercontent.com/Tozorro/Bachelor_datasets/refs/heads/main/DIS.csv" }
  ];
}

async function fetchStockData(stockLabel) {
  const stocks = getStockList();
  const stock = stocks.find(s => s.label === stockLabel);
  if (!stock) return null;
  
  const response = await fetch(stock.url);
  const csvText = await response.text();
  return parseCsvData(csvText);
}

function parseCsvData(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  const data = [];
  
  const dateIndex = headers.findIndex(h => h.toLowerCase().trim() === 'date');
  const closeIndex = headers.findIndex(h => h.toLowerCase().trim() === 'close');
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length > Math.max(dateIndex, closeIndex)) {
      const date = new Date(cols[dateIndex]);
      const closePrice = parseFloat(cols[closeIndex]);
      
      if (!isNaN(date.getTime()) && !isNaN(closePrice)) {
        data.push({ Date: date, Close: closePrice });
      }
    }
  }
  
  return data;
}

function filterDataByDateRange(data, startDate, endDate) {
  if (startDate && endDate) {
    return data.filter(d => d.Date >= startDate && d.Date <= endDate);
  }
  return data.slice(-30);
}

async function renderChart(container, chartSpec) {
  try {
    console.log("StockKPIChart: Starting to render chart");
    if (!container) {
      console.error("StockKPIChart: Container is null or undefined");
      return;
    }
    
    container.innerHTML = '';
    
    // Make sure chartSpec is valid
    if (!chartSpec) {
      console.error("StockKPIChart: Chart specification is null or undefined");
      return;
    }
    
    await vegaEmbed(container, chartSpec, {
      actions: false,
      renderer: "svg",
      tooltip: false
    });
    
    console.log("StockKPIChart: Chart rendered successfully");
  } catch (error) {
    console.error("StockKPIChart: Error rendering chart:", error);
    console.error("Error details:", error.stack);
  }
}

async function renderKPICard(stockLabel = null, startDate = null, endDate = null) {
  const kpiContainer = document.getElementById('kpi-chart');
  
  if (!stockLabel || !window.selectedStock) {
    showPlaceholder(kpiContainer);
    return;
  }
  
  try {
    const stockData = await fetchStockData(stockLabel);
    if (!stockData) {
      showStockNotFound(kpiContainer);
      return;
    }
    
    const filteredData = filterDataByDateRange(stockData, startDate, endDate);
    const metrics = calculateStockMetrics(filteredData);
    const chartData = transformStockDataForChart(filteredData, metrics.currentPrice, metrics.changePercent);
    const chartSpec = createVegaLiteSpec(chartData, stockLabel, metrics.change);
    
    await renderChart(kpiContainer, chartSpec);
    
  } catch (error) {
    showError(kpiContainer);
  }
}

function updateKPIForSelectedStock() {
  if (window.selectedStock) {
    renderKPICard(window.selectedStock);
  }
}

function updateKPIForDateRange(startDate, endDate) {
  if (window.selectedStock) {
    renderKPICard(window.selectedStock, startDate, endDate);
  }
}

window.updateKPIForDateRange = updateKPIForDateRange;
window.updateKPIForSelectedStock = updateKPIForSelectedStock;

document.addEventListener('DOMContentLoaded', function() {
  renderKPICard();
});
