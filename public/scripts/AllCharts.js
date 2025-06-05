/**
 * Builds Vega-Lite specification for multi-stock overview chart
 * Highlights selected stock and dims others for better visual focus
 */
function buildAllChartsSpec(data, selectedStock) {
  const stockColors = {
    "Uber": "#1b9e77",
    "Tesla": "#d95f02", 
    "Google": "#7570b3",
    "Netflix": "#e7298a",
    "Disney": "#66a61e",
    "Facebook": "#e6ab02",
    "Apple": "#a6761d"
  };

  const colorEncoding = selectedStock
    ? {
        condition: {
          test: `datum.symbol === '${selectedStock}'`,
          field: "symbol",
          type: "nominal",
          title: "Company",
          scale: {
            domain: Object.keys(stockColors),
            range: Object.values(stockColors)
          }
        },
        value: "#d3d3d3"
      }
    : {
        field: "symbol",
        type: "nominal",
        title: "Company",
        scale: {
          domain: Object.keys(stockColors),
          range: Object.values(stockColors)
        }
      };
  return {
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    title: { text: "Overview of All Stocks", anchor: "middle" },
    data: { values: data },
    transform: [
      {
        filter: "toDate(datum.date) >= toDate('2019-12-01') && toDate(datum.date) <= toDate('2021-01-31')"
      }
    ],
    autosize: { "type": "fit-x" },
    height: 200,
    width: "container",
    layer: [
      {
        mark: { type: "line" },
        encoding: {
          x: { 
            field: "date", 
            type: "temporal",
            axis: {
              title: "Date",
              labelAngle: 0,
              format: "%b %Y",
              tickCount: 6,
              labelOverlap: false
            }
          },
          y: { 
            field: "price", 
            type: "quantitative",
            axis: {
              title: "Price",
              tickCount: 6,
              format: ".0f"
            }
          },
          tooltip: [
            { field: "date", type: "temporal", title: "Date" },
            { field: "price", type: "quantitative", title: "Price" },
            { field: "symbol", type: "nominal", title: "Symbol" }          
          ],
          color: colorEncoding
        },
        params: [
          {
            name: "paintbrush",
            select: {
              type: "point",
              on: "over",
              nearest: true,
              encodings: ["y"]
            }
          }
        ]
      }
    ],
    config: {
      background: null,
      view: { 
        continuousWidth: 200,
        continuousHeight: 200,
        stroke: null
      }
    }
  };
}


/**
 * Fetches and combines stock data from CSV files
 * Extracts date and closing price for all stocks
 */
async function fetchAndCombineStocks(stocks) {
  const allData = [];

  for (const stock of stocks) {
    const response = await fetch(stock.url);
    const text = await response.text();

    const [headerLine, ...lines] = text.trim().split("\n");
    const headers = headerLine.split(",");

    const dateIndex = headers.findIndex(h => h.toLowerCase() === "date");
    const closeIndex = headers.findIndex(h => h.toLowerCase() === "close");

    for (const line of lines) {
      const cols = line.split(",");
      if (cols.length <= Math.max(dateIndex, closeIndex)) continue;

      allData.push({
        symbol: stock.label,
        date: cols[dateIndex],
        price: parseFloat(cols[closeIndex])
      });
    }
  }

  return allData;
}

/**
 * Renders overview chart with tap/click-to-select functionality
 * Preserves brush selection when switching between stocks
 */
function renderAllChartsOverview(selectedStock) {
  fetchAndCombineStocks(window.stocks).then(allChartsData => {
    const allChartsSpec = buildAllChartsSpec(allChartsData, selectedStock);
    
    vegaEmbed('#combinedVl', allChartsSpec, {actions: false, renderer: "svg"}).then(result => {
      window.combinedChartView = result.view;
      
      try {
        result.view.addEventListener('click', function(event, item) {
          if (item && item.datum && item.datum.symbol) {
            let currentSelection = null;
            
            try {
              const mainGraphElement = document.getElementById("mainVl");
              if (mainGraphElement && window.setBrushSelection) {
                currentSelection = {
                  startDate: new Date('2021-01-01'),
                  endDate: new Date('2021-02-01')
                };
              }
            } catch (error) {
              console.warn('Could not capture current selection:', error);
            }
            
            const stock = getStockByLabel(item.datum.symbol);
            if (stock) {
              renderMainChart(stock.url, stock.title);
              selectedStock = stock.label;
              window.selectedStock = stock.label;
              
              if (window.updateKPIForSelectedStock) {
                window.updateKPIForSelectedStock();
              }
              
              const allStockItems = document.querySelectorAll('.stock-item-selection');
              allStockItems.forEach(item => item.classList.remove('selected'));
              const li = document.getElementById(stock.label);
              if (li) li.classList.add("selected");
              
              if (currentSelection) {
                setTimeout(() => {
                  if (window.setBrushSelection) {
                    window.setBrushSelection(currentSelection.startDate, currentSelection.endDate);
                  }
                }, 500);
              }
            }
          }
        });
      } catch (error) {
        console.warn('Could not add AllCharts event listeners:', error);
      }
    })
    .catch(console.warn);
  })
  .catch(console.warn);
}

/**
 * Stock lookup by label
 */
function getStockByLabel(label) {
  return window.stocks.find(stock => stock.label.toLowerCase() === label.toLowerCase());
}