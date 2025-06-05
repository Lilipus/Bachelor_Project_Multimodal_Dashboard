function createStockMiniChartSpec(stockDataUrl) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: {
      url: stockDataUrl,
      format: {
        type: "csv",
        parse: {
          Date: "date",
          Close: "number"
        }
      }
    },
    transform: [
      {
        filter: "datum.Date >= datetime(2022, 0, 1) && datum.Close != null"
      }
    ],
    width: 100,
    height: 30,
    mark: {
      type: "line",
      color: "#67a9cf",
      strokeWidth: 1.5,
      interpolate: "linear",
      point: false
    },
    encoding: {
      x: { 
        field: "Date", 
        type: "temporal", 
        axis: null
      },
      y: { 
        field: "Close", 
        type: "quantitative", 
        axis: null,
        scale: { zero: false }
      }
    },
    config: {
      background: null,
      view: { 
        stroke: "transparent"
      },
      axis: { 
        grid: false,
        ticks: false,
        labels: false
      }
    }
  };
}

function getOptimizedRenderOptions() {
  return {
    actions: false,
    renderer: "canvas",
    tooltip: false,
    hover: false
  };
}

function renderStockMiniChart(elementId, stockDataUrl) {
  if (!elementId || !stockDataUrl) return;
  
  const chartSpec = createStockMiniChartSpec(stockDataUrl);
  const renderOptions = getOptimizedRenderOptions();
  
  vegaEmbed(`#${elementId}`, chartSpec, renderOptions);
}