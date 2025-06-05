const STOCK_COLORS = {
  "Uber": "#1b9e77",
  "Tesla": "#d95f02", 
  "Google": "#7570b3",
  "Netflix": "#e7298a",
  "Disney": "#66a61e",
  "Facebook": "#66a61e",
  "Apple": "#e6ab02"
};

const DEFAULT_STOCK_COLOR = "#1f77b4";
const DEFAULT_DATE_RANGE = {
  start: new Date('2021-01-01'),
  end: new Date('2021-02-01')
};
const MONTH_WINDOW_CONSTRAINTS = {
  minDays: 25,
  maxDays: 35,
  optimalDays: 30
};

function getStockColor(stockName) {
  return STOCK_COLORS[stockName] || DEFAULT_STOCK_COLOR;
}

function renderMainChart(stockDataUrl, stockName) {
  if (!stockDataUrl || !stockName) {
    console.warn('Stock data URL and name are required for chart rendering');
    return;
  }

  const chartSpec = createMainChartSpec(stockDataUrl, stockName);
  renderVegaChart(chartSpec);
}

function renderVegaChart(chartSpec) {
  vegaEmbed('#mainVl', chartSpec, getChartRenderOptions())
    .then(result => initializeMainChart(result))
    .catch(error => console.warn('Chart rendering failed:', error));
}

function getChartRenderOptions() {
  return { 
    actions: false, 
    renderer: "svg" 
  };
}

function createMainChartSpec(stockDataUrl, stockName) {
  const stockColor = getStockColor(stockName);
  
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    title: { text: stockName, anchor: "middle" },
    data: {
      url: stockDataUrl,
      format: {
        type: "csv",
        parse: {
          Date: "date",
          Open: "number",
          Close: "number",
          Low: "number",
          High: "number"
        }
      }
    },
    transform: [
      {
        filter: "toDate(datum.Date) >= toDate('2019-12-01') && toDate(datum.Date) <= toDate('2021-01-31')"
      }
    ],
    vconcat: [
      {
        title: { 
          text: "Time Period Filtering", 
          anchor: "start",
          dx: 33
        },
        height: 125,
        width: "container",
        transform: [],
        selection: {
          monthWindow: {
            type: "interval",
            resolve: "global",
            translate: true,
            zoom: false,
            clear: false,
            init: {
              x: [
                DEFAULT_DATE_RANGE.start.getTime(),
                DEFAULT_DATE_RANGE.end.getTime()
              ]
            }
          }
        },
        mark: { type: "line", color: stockColor },
        encoding: {
          x: { 
            field: "Date", 
            type: "temporal",
            title: "Date"
          },
          y: { 
            field: "Close", 
            type: "quantitative", 
            title: "Price",
            scale: {"zero": false}
          }
        }
      },
      {
        title: { 
          text: "Line graph", 
          anchor: "start",
          dx: 33
        },
        height: 150,
        width: "container",
        mark: { type: "line", color: stockColor },
        transform: [],
        encoding: {
          x: {
            field: "Date",
            type: "temporal",
            scale: { domain: { selection: "monthWindow" } },
            title: "Date"
          },
          y: {
            field: "Close",
            type: "quantitative",
            title: "Price",
            scale: {"zero": false, "nice": true}
          }
        }
      },
      {
        title: { 
          text: "Candlestick chart",
          anchor: "start",
          dx: 33 
        },
        height: 100,
        width: "container",
        transform: [],
        encoding: {
          x: {
            field: "Date",
            type: "temporal",
            scale: { domain: { selection: "monthWindow" } },
            title: "Date"
          },
          y: {
            type: "quantitative",
            scale: {"zero": false, "nice": true},
            axis: {title: "Price"}
          },
          color: {
            condition: {
              test: "datum.Open < datum.Close",
              value: "#33a02c"
            },
            value: "#1f78b4"
          }
        },
        layer: [
          {
            mark: "rule",
            encoding: {
              y: { field: "Low" },   
              y2: { field: "High" }  
            }
          },
          {
            mark: "bar",
            encoding: {
              y: { field: "Open" },   
              y2: { field: "Close" }  
            }
          }
        ]
      }
    ],
    resolve: {
      scale: {
        x: "independent",
        y: "independent"
      }
    },
    config: {
      background: null,
      selection: {
        interval: {
          fill: "lightblue",
          fillOpacity: 0.3,
          stroke: "blue",
          strokeWidth: 2
        }
      },
      view: { 
        padding: {
          top: 20,
          bottom: 20,
          left: 20,
          right: 20
        }
      }
    }
  };
}

function initializeMainChart(chartResult) {
  if (!chartResult?.view) {
    console.warn('Chart view not available for initialization');
    return;
  }

  setInitialDateSelection(chartResult.view);
  setupSelectionListener(chartResult.view);
  setupGlobalBrushHandler(chartResult.view);
}

function setInitialDateSelection(chartView) {
  setTimeout(() => {
    try {
      chartView.signal('monthWindow', { 
        x: [
          DEFAULT_DATE_RANGE.start.getTime(), 
          DEFAULT_DATE_RANGE.end.getTime()
        ] 
      }).run();
    } catch (error) {
      console.warn('Could not set initial selection:', error);
    }
  }, 100);
}

function setupSelectionListener(chartView) {
  try {
    chartView.addSignalListener('monthWindow', (name, value) => {
      handleSelectionChange(chartView, value);
    });
  } catch (error) {
    console.warn('Could not add signal listener:', error);
  }
}

function handleSelectionChange(chartView, selectionValue) {
  if (isSelectionEmpty(selectionValue)) {
    restoreDefaultSelection(chartView);
    return;
  }

  if (isValidSelection(selectionValue)) {
    const dateRange = getDateRangeFromSelection(selectionValue);
    
    if (shouldAdjustDateRange(dateRange)) {
      adjustDateRangeToOptimal(chartView, dateRange.start);
    } else {
      updateKPIDisplay(dateRange.start, dateRange.end);
    }
  }
}

function isSelectionEmpty(selectionValue) {
  return !selectionValue || !selectionValue.x || selectionValue.x.length === 0;
}

function isValidSelection(selectionValue) {
  return selectionValue && selectionValue.x && selectionValue.x.length === 2;
}

function restoreDefaultSelection(chartView) {
  setTimeout(() => {
    chartView.signal('monthWindow', { 
      x: [
        DEFAULT_DATE_RANGE.start.getTime(),
        DEFAULT_DATE_RANGE.end.getTime()
      ] 
    }).run();
  }, 10);
}

function getDateRangeFromSelection(selectionValue) {
  return {
    start: new Date(selectionValue.x[0]),
    end: new Date(selectionValue.x[1])
  };
}

function shouldAdjustDateRange(dateRange) {
  const daysDifference = calculateDaysDifference(dateRange.start, dateRange.end);
  return daysDifference < MONTH_WINDOW_CONSTRAINTS.minDays || 
         daysDifference > MONTH_WINDOW_CONSTRAINTS.maxDays;
}

function calculateDaysDifference(startDate, endDate) {
  const timeDifference = Math.abs(endDate - startDate);
  return Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
}

function adjustDateRangeToOptimal(chartView, startDate) {
  const optimalEndDate = new Date(startDate);
  optimalEndDate.setDate(optimalEndDate.getDate() + MONTH_WINDOW_CONSTRAINTS.optimalDays);
  
  setTimeout(() => {
    chartView.signal('monthWindow', { 
      x: [startDate.getTime(), optimalEndDate.getTime()] 
    }).run();
  }, 10);
}

function updateKPIDisplay(startDate, endDate) {
  if (window.updateKPIForDateRange) {
    window.updateKPIForDateRange(startDate, endDate);
  }
}

function setupGlobalBrushHandler(chartView) {
  window.setBrushSelection = function(startDate, endDate) {
    setBrushSelection(chartView, startDate, endDate);
  };
}

function setBrushSelection(chartView, startDate, endDate) {
  if (!chartView) {
    console.warn("Chart view not yet initialized.");
    return;
  }

  try {
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    
    chartView.signal('monthWindow', { x: [startTime, endTime] }).run();
    updateKPIDisplay(new Date(startTime), new Date(endTime));
  } catch (error) {
    console.warn('Could not set brush selection:', error);
  }
}


