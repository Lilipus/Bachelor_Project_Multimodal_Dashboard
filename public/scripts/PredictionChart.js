let historicalUberData = [];
let userPredictions = [];
let lastHistoricalDate = null;
let predictionChartView = null;
let fullHistoricalData = [];
let isShowingActualData = false;
let bollingerBandsData = [];

const UBER_CSV_URL = "https://raw.githubusercontent.com/Tozorro/Bachelor_datasets/main/UBER.csv";
const HISTORICAL_START_DATE = "2020-03-02";
const HISTORICAL_END_DATE = "2020-04-14";
const PREDICTION_BUFFER_DAYS = 30;
const BOLLINGER_PERIOD = 20;
const BOLLINGER_MULTIPLIER = 2;

function createStockDataPoint(headers, values) {
    const rowData = {};
    headers.forEach((header, i) => {
        rowData[header.trim()] = values[i] ? values[i].trim() : '';
    });

    const date = new Date(rowData.Date);
    const closePrice = parseFloat(rowData.Close);

    if (isNaN(date.getTime()) || isNaN(closePrice)) {
        return null;
    }
    return { Date: date, Close: closePrice };
}

function tagHistoricalData(stockData, startDate, endDate) {
    return stockData
        .filter(d => d.Date >= startDate && d.Date <= endDate)
        .map(d => ({ ...d, type: "historical" }));
}

async function loadHistoricalUberData() {
    try {
        console.log("Fetching CSV data");
        const csvData = await fetchCsvData();
        console.log("Parsing CSV data");
        const stockData = parseCsvToStockData(csvData);
        console.log(`Parsed ${stockData.length} data points`);
        
        const dateRange = createDateRange();
        
        storeFullDataset(stockData);
        filterHistoricalData(stockData, dateRange);
        console.log(`Filtered to ${historicalUberData.length} historical data points`);
        
        calculateBollingerBands();
        console.log(`Calculated ${bollingerBandsData.length} Bollinger band points`);
        
        setLastHistoricalDate();
        console.log(`Last historical date: ${lastHistoricalDate}`);

    } catch (error) {
        console.error("Failed to load historical UBER.csv data:", error);
        throw error;
    }
}

async function fetchCsvData() {
    const response = await fetch(UBER_CSV_URL);
    return await response.text();
}

function parseCsvToStockData(csvString) {
    const lines = csvString.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',');
    return lines.slice(1)
        .map(line => createStockDataPoint(headers, line.split(',')))
        .filter(d => d !== null);
}

function createDateRange() {
    return {
        start: new Date(HISTORICAL_START_DATE),
        end: new Date(HISTORICAL_END_DATE)
    };
}

function storeFullDataset(stockData) {
    fullHistoricalData = stockData.map(d => ({ ...d, type: "actual" }));
}

function filterHistoricalData(stockData, dateRange) {
    historicalUberData = tagHistoricalData(stockData, dateRange.start, dateRange.end);
    historicalUberData.sort((a, b) => a.Date.getTime() - b.Date.getTime());
}

function calculateBollingerBands() {
    const fullBollingerBands = createBollingerBands(fullHistoricalData);
    const dateRange = createDateRange();
    
    bollingerBandsData = fullBollingerBands.filter(band => 
        band.Date >= dateRange.start && band.Date <= dateRange.end
    );
}

function setLastHistoricalDate() {
    if (historicalUberData.length > 0) {
        lastHistoricalDate = historicalUberData[historicalUberData.length - 1].Date;
    } else {
        lastHistoricalDate = new Date(HISTORICAL_END_DATE);
    }
}

function getActualDataUpToLastPrediction() {
    if (!hasPredictions()) return [];

    const lastPredictionDate = getLastPredictionDate();
    const connectionPoint = createConnectionPoint();
    const filteredActualData = getFilteredActualData(lastPredictionDate);
    
    return [...connectionPoint, ...filteredActualData];
}

function hasPredictions() {
    return userPredictions.length > 0;
}

function getLastPredictionDate() {
    return userPredictions[userPredictions.length - 1].Date;
}

function createConnectionPoint() {
    const lastHistoricalPoint = historicalUberData[historicalUberData.length - 1];
    return [{ ...lastHistoricalPoint, type: "actual" }];
}

function getFilteredActualData(lastPredictionDate) {
    return fullHistoricalData
        .filter(d => d.Date > lastHistoricalDate && d.Date <= lastPredictionDate)
        .map(d => ({...d, type: "actual"}));
}

function createPredictionChartSpec(combinedData, chartStartDate, chartEndDate, minY, maxY) {
    if (!lastHistoricalDate) {
        return null;
    }
    
    const combinedDataWithBands = [...combinedData];
    
    bollingerBandsData.forEach(band => {
        combinedDataWithBands.push(
            { Date: band.Date, Close: band.upperBand, type: "upperBand" },
            { Date: band.Date, Close: band.lowerBand, type: "lowerBand" },
            { Date: band.Date, Close: band.middleBand, type: "middleBand" }
        );
    });

    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        "title": "Training prediction",
        "description": "Click to add prediction points. Double-click to clear predictions.",
        "data": { "values": combinedDataWithBands },
        "width": "container",
        "height": 400,
        "layer": [
            {
                "data": {
                    "values": bollingerBandsData.map(band => ({
                        Date: band.Date,
                        upperBand: band.upperBand,
                        lowerBand: band.lowerBand
                    }))
                },
                "mark": {
                    "type": "area",
                    "opacity": 0.1,
                    "color": "gray"
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"field": "lowerBand", "type": "quantitative"},
                    "y2": {"field": "upperBand", "type": "quantitative"}
                }
            },
            {
                "transform": [{"filter": "datum.type === 'upperBand'"}],
                "mark": {
                    "type": "line",
                    "color": "gray",
                    "strokeWidth": 1,
                    "strokeDash": [2, 2]
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"field": "Close", "type": "quantitative"},
                    "tooltip": [
                        {"field": "Date", "type": "temporal", "title": "Date", "format": "%Y-%m-%d"},
                        {"field": "Close", "type": "quantitative", "title": "Upper Band", "format": ".2f"}
                    ]
                }
            },
            {
                "transform": [{"filter": "datum.type === 'lowerBand'"}],
                "mark": {
                    "type": "line",
                    "color": "gray",
                    "strokeWidth": 1,
                    "strokeDash": [2, 2]
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"field": "Close", "type": "quantitative"},
                    "tooltip": [
                        {"field": "Date", "type": "temporal", "title": "Date", "format": "%Y-%m-%d"},
                        {"field": "Close", "type": "quantitative", "title": "Lower Band", "format": ".2f"}
                    ]
                }
            },
            {
                "transform": [{"filter": "datum.type === 'middleBand'"}],
                "mark": {
                    "type": "line",
                    "color": "orange",
                    "strokeWidth": 1.5,
                    "strokeDash": [5, 5]
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"field": "Close", "type": "quantitative"},
                    "tooltip": [
                        {"field": "Date", "type": "temporal", "title": "Date", "format": "%Y-%m-%d"},
                        {"field": "Close", "type": "quantitative", "title": "Middle Band (SMA)", "format": ".2f"}
                    ]
                }
            },
            {
                "mark": { "type": "rect", "opacity": 0 },
                "name": "background_rect",
                "encoding": {
                    "x": {
                        "field": "Date",
                        "type": "temporal",
                        "scale": {
                            "domain": [
                                chartStartDate.toISOString().slice(0, 10),
                                chartEndDate.toISOString().slice(0, 10)
                            ]
                        }
                    },
                    "y": {
                        "field": "Close",
                        "type": "quantitative",
                    }
                }
            },
            {
                "data": {
                    "values": (() => {
                        if (!lastHistoricalDate) return [];
                        
                        const gridLines = [];
                        const startDate = new Date(lastHistoricalDate);
                        const endDate = new Date(chartEndDate);
                        const currentDate = new Date(startDate);
                        
                        while (currentDate <= endDate) {
                            gridLines.push({
                                Date: new Date(currentDate),
                                type: "gridLine"
                            });
                            currentDate.setDate(currentDate.getDate() + 3);
                        }
                        return gridLines;
                    })()
                },
                "mark": {
                    "type": "rule",
                    "color": "#999999",
                    "strokeWidth": 0.8,
                    "strokeDash": [3, 3],
                    "opacity": 0.8
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"value": 0},
                    "y2": {"value": 400}
                }
            },
            {
                "mark": {
                    "type": "line",
                    "point": false
                },
                "encoding": {
                    "x": {
                        "field": "Date",
                        "type": "temporal",
                        "axis": { 
                            "title": "Date (Year 2020)",
                            "grid": false
                        }
                    },
                    "y": {
                        "field": "Close",
                        "type": "quantitative",
                        "axis": {
                            "title": "Closing Price (USD)",
                            "grid": false
                        },
                    },
                    "color": {
                        "field": "type",
                        "type": "nominal",
                        "scale": {
                            "domain": ["historical", "prediction", "actual"],
                            "range": ["#67a9cf", "#ef8a62", "#67a9cf"]
                        },
                        "legend": {
                            "title": "Data points",
                            "values": ["historical", "prediction"],
                            "labelExpr": "datum.value === 'historical' ? 'Real Data' : 'Prediction'",
                            "symbolType": "circle",
                            "symbolSize": 100,
                            "symbolFillColor": {"expr": "datum.value === 'historical' ? '#67a9cf' : '#ef8a62'"},
                            "symbolStrokeWidth": 0,
                            "orient": "top-right",
                            "offset": 10,
                            "padding": 10
                        }
                    },
                    "tooltip": [                        {"field": "Date", "type": "temporal", "title": "Date", "format": "%Y-%m-%d"},
                        {"field": "Close", "type": "quantitative", "title": "Price", "format": ".2f"},
                        {"field": "type", "type": "nominal", "title": "Type"}
                    ]
                }
            },
            {
                "transform": [{"filter": "datum.type === 'historical'"}],
                "params": [{
                    "name": "selected",
                    "value": [],
                    "select": {
                        "type": "point",
                        "toggle": true
                    }
                }],
                "mark": {
                    "type": "circle",
                    "cursor": "pointer",
                    "size": 40
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"field": "Close", "type": "quantitative"},
                    "color": {"value": "#67a9cf"},
                    "size": {
                        "condition": {
                            "param": "selected",
                            "empty": false,
                            "value": 200
                        },
                        "value": 40
                    },
                    "opacity": {
                        "condition": {
                            "param": "selected",
                            "value": 1
                        },
                        "value": 0.7
                    },
                    "tooltip": [
                        {"field": "Date", "type": "temporal", "title": "Date", "format": "%Y-%m-%d"},
                        {"field": "Close", "type": "quantitative", "title": "Price", "format": "$,.2f"},
                        {"field": "type", "type": "nominal", "title": "Type"}
                    ]
                }
            },
            {
                "transform": [{"filter": "datum.type === 'prediction'"}],
                "mark": {
                    "type": "circle",
                    "size": 60
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"field": "Close", "type": "quantitative"},
                    "color": {"value": "#ef8a62"}
                }
            },
            {
                "transform": [{"filter": "datum.type === 'actual'"}],
                "mark": {
                    "type": "line",
                    "color": "#67a9cf",
                    "strokeWidth": 2,
                    "interpolate": "linear"
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"field": "Close", "type": "quantitative"}
                }
            },
            {
                "transform": [{"filter": "datum.type === 'actual'"}],
                "mark": {
                    "type": "circle",
                    "size": 40
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"field": "Close", "type": "quantitative"},
                    "color": {"value": "#67a9cf"},
                    "tooltip": [
                        {"field": "Date", "type": "temporal", "title": "Actual Date", "format": "%Y-%m-%d"},
                        {"field": "Close", "type": "quantitative", "title": "Actual Price", "format": ".2f"}
                    ]
                }            },
            {
                "transform": [{"filter": "datum.type === 'historical' || datum.type === 'prediction' || datum.type === 'actual'"}],
                "params": [{
                    "name": "hover",
                    "select": {
                        "type": "point",
                        "fields": ["Date"],
                        "on": "mouseover",
                        "clear": "mouseout"
                    }
                }],
                "mark": {
                    "type": "rule",
                    "color": "rgba(0, 0, 0, 0.5)",
                    "strokeWidth": 1,
                    "strokeDash": [3, 3]
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"value": 0},
                    "y2": {"value": 400},
                    "opacity": {
                        "condition": {
                            "param": "hover",
                            "empty": false,
                            "value": 0.8
                        },
                        "value": 0
                    },
                    "tooltip": [
                        {"field": "Date", "type": "temporal", "title": "Date", "format": "%Y-%m-%d"},
                        {"field": "Close", "type": "quantitative", "title": "Price", "format": "$,.2f"},
                        {"field": "type", "type": "nominal", "title": "Type"}
                    ]
                }
            },
            {
                "transform": [{"filter": "datum.type === 'historical' || datum.type === 'prediction' || datum.type === 'actual'"}],
                "mark": {
                    "type": "circle",
                    "size": 120,
                    "stroke": "white",
                    "strokeWidth": 3,
                    "fill": "transparent"
                },
                "encoding": {
                    "x": {"field": "Date", "type": "temporal"},
                    "y": {"field": "Close", "type": "quantitative"},
                    "stroke": {
                        "field": "type",
                        "type": "nominal",
                        "scale": {
                            "domain": ["historical", "prediction", "actual"],
                            "range": ["#67a9cf", "#ef8a62", "#67a9cf"]
                        },
                        "legend": null
                    },
                    "opacity": {
                        "condition": {
                            "param": "hover",
                            "empty": false,
                            "value": 1
                        },
                        "value": 0
                    }
                }
            }
        ],
        "encoding": {
            "x": {
                "field": "Date",
                "type": "temporal",
                "scale": {
                    "domain": [
                        chartStartDate.toISOString().slice(0, 10),
                        chartEndDate.toISOString().slice(0, 10)
                    ]
                },
                "axis": {
                    "format": "%b %d",
                    "tickCount": "week",
                }
            },
            "y": {
                "field": "Close",
                "type": "quantitative",
                "scale": {
                    "zero": false,
                    "domain": [minY, maxY]
                },
            }
        },
        "config": {
            "background": null,
            "view": {
                "stroke": "transparent",
                "continuousWidth": 400,
                "continuousHeight": 350,
                "padding": {
                    "top": 40,
                    "bottom": 40,
                    "right": 120,
                    "left": 80,
                },
                "title": { "anchor": "middle" }
            }
        }
    };
}

async function addPredictionPoint(event) {
    const view = this;
    view.run();
    
    const scales = getChartScales(view);
    if (!scales) return;
    
    const coordinates = getClickCoordinates(event, view);
    if (!coordinates) return;
    
    const dataValues = convertToDataValues(coordinates, scales);
    const predictionDate = createPredictionDate(dataValues.date);
    
    if (isValidPredictionDate(predictionDate)) {
        userPredictions.push({
            Date: predictionDate,
            Close: dataValues.price,
            type: "prediction"
        });
        userPredictions.sort((a, b) => a.Date.getTime() - b.Date.getTime());
        await renderPredictionChart();
    }
}

function getChartScales(view) {
    const xScale = view.scale('x');
    const yScale = view.scale('y');
    return xScale && yScale ? { x: xScale, y: yScale } : null;
}

function getClickCoordinates(event, view) {
    const group = view._el.querySelector('.mark-group.role-scope');
    if (!group) return null;

    const svgElement = view._el.querySelector('svg');
    const svgRect = svgElement.getBoundingClientRect();
    const plotRect = group.getBoundingClientRect();

    if (!isClickInValidArea(event, plotRect)) return null;

    const paddingLeft = plotRect.left - svgRect.left;
    const paddingTop = plotRect.top - svgRect.top;

    return {
        x: event.x - svgRect.left - paddingLeft,
        y: event.y - svgRect.top - paddingTop
    };
}

function isClickInValidArea(event, plotRect) {
    return event.clientX >= plotRect.left && event.clientX <= plotRect.right &&
           event.clientY >= plotRect.top && event.clientY <= plotRect.bottom;
}

function convertToDataValues(coordinates, scales) {
    return {
        date: scales.x.invert(coordinates.x),
        price: scales.y.invert(coordinates.y)
    };
}

function createPredictionDate(clickedDate) {
    const predictionDate = new Date(clickedDate);
    predictionDate.setHours(0, 0, 0, 0);
    return predictionDate;
}

function isValidPredictionDate(predictionDate) {
    return lastHistoricalDate && predictionDate > lastHistoricalDate;
}

async function clearAllPredictions() {
    userPredictions = [];
    await renderPredictionChart();
}

function calculateChartDomainDates() {
    const chartStartDate = getChartStartDate();
    const chartEndDate = calculateChartEndDate();
    return { startDate: chartStartDate, endDate: chartEndDate };
}

function getChartStartDate() {
    return historicalUberData.length > 0 ? 
        historicalUberData[0].Date : new Date(HISTORICAL_START_DATE);
}

function calculateChartEndDate() {
    let chartEndDate = new Date(lastHistoricalDate);
    chartEndDate.setDate(chartEndDate.getDate() + PREDICTION_BUFFER_DAYS);

    if (hasPredictionsData()) {
        const latestPredictionDate = getLatestPredictionDate();
        if (latestPredictionDate > chartEndDate) {
            chartEndDate = new Date(latestPredictionDate);
            chartEndDate.setDate(chartEndDate.getDate() + 5);
        }
    }
    return chartEndDate;
}

function hasPredictionsData() {
    return userPredictions.length > 0;
}

function getLatestPredictionDate() {
    return userPredictions[userPredictions.length - 1].Date;
}

async function renderPredictionChart() {
    await ensureDataLoaded();
    
    const combinedData = prepareCombinedData();
    const yAxisDomain = calculateYAxisDomain(combinedData);
    const domainDates = calculateChartDomainDates();
    
    await renderPredictionVizChart(combinedData, domainDates, yAxisDomain);
}

async function ensureDataLoaded() {
    if (historicalUberData.length === 0) {
        await loadHistoricalUberData();
    }
}

function prepareCombinedData() {
    let combinedData = [...historicalUberData, ...userPredictions];

    if (shouldIncludeActualData()) {
        const actualData = getActualDataUpToLastPrediction();
        combinedData.push(...actualData);
    }

    combinedData.sort((a, b) => a.Date.getTime() - b.Date.getTime());
    
    return addBridgePoint(combinedData);
}

function shouldIncludeActualData() {
    return isShowingActualData && userPredictions.length > 0;
}

function addBridgePoint(combinedData) {
    if (!shouldAddBridgePoint(combinedData)) return combinedData;
    
    const lastHistoricalPoint = historicalUberData[historicalUberData.length - 1];
    combinedData.push({
        Date: new Date(lastHistoricalPoint.Date),
        Close: lastHistoricalPoint.Close,
        type: "prediction"
    });
    
    return combinedData;
}

function shouldAddBridgePoint(combinedData) {
    if (!lastHistoricalDate || historicalUberData.length === 0) return false;
    
    const lastHistoricalPoint = historicalUberData[historicalUberData.length - 1];
    return !combinedData.some(d =>
        d.Date.getTime() === lastHistoricalPoint.Date.getTime() && d.type === "prediction"
    );
}

function calculateYAxisDomain(combinedData) {
    if (combinedData.length === 0) return { minY: 10, maxY: 40 };
    
    const allPrices = getAllPricesForDomain(combinedData);
    const baseRange = calculateBaseRange(allPrices);
    
    return applyYAxisPadding(baseRange);
}

function getAllPricesForDomain(combinedData) {
    const dataPrices = combinedData.map(d => d.Close);
    const bollingerPrices = extractBollingerPrices();
    return [...dataPrices, ...bollingerPrices];
}

function extractBollingerPrices() {
    const bollingerPrices = [];
    bollingerBandsData.forEach(band => {
        bollingerPrices.push(band.upperBand, band.lowerBand, band.middleBand);
    });
    return bollingerPrices;
}

function calculateBaseRange(allPrices) {
    return {
        min: Math.min(...allPrices),
        max: Math.max(...allPrices)
    };
}
// this function solved the issue with the y-axis padding, because it was too tight.
function applyYAxisPadding(baseRange) {
    const yPadding = (baseRange.max - baseRange.min) * 0.15;
    return {
        minY: Math.max(0, baseRange.min - yPadding),
        maxY: baseRange.max + yPadding
    };
}

async function renderPredictionVizChart(combinedData, domainDates, yAxisDomain) {
    console.log("Rendering prediction chart");
    const spec = createPredictionChartSpec(
        combinedData, 
        domainDates.startDate, 
        domainDates.endDate, 
        yAxisDomain.minY, 
        yAxisDomain.maxY
    );

    if (!spec) {
        console.warn("Chart specification is null, skipping render");
        return;
    }

    clearExistingChart();
    await embedChart(spec);
    console.log("Chart embedded successfully");
}

function clearExistingChart() {
    const predictionStockDiv = document.getElementById('predictionStock');
    if (predictionStockDiv) {
        predictionStockDiv.innerHTML = '';
    }
}

async function embedChart(spec) {
    try {
        console.log("Starting to embed chart with vegaEmbed...");
        // Make sure we have the element before trying to embed.
        const element = document.getElementById('predictionStock');
        if (!element) {
            console.error("Cannot find #predictionStock element");
            return;
        }
        
        // Use the direct element reference instead of the selector
        const result = await vegaEmbed(element, spec, createEmbedOptions());
        console.log("Chart embedded successfully, setting up interactions");
        setupChartInteractions(result);
    } catch (error) {
        console.error("Error embedding Vega-Lite chart:", error);
        console.error("Error details:", error.stack);
    }
}

function createEmbedOptions() {
    return {
        actions: false,
        renderer: "svg",
        tooltip: {
            theme: 'light',
            offsetX: 10,
            offsetY: 10
        }
    };
}

function setupChartInteractions(result) {
    // Make sure result and result.view are valid, please. Otherwise, we cannot proceed, because we need the view to add event listeners.
    if (!result || !result.view) {
        console.error("Cannot setup chart interactions: invalid result or view");
        return;
    }
    
    console.log("Setting up chart interactions");
    predictionChartView = result.view;
    window.predictionChartView = result.view; // Expose to window for external access
    
    try {
        // Add click and double-click event listeners, event listeners are fun.
        addEventListeners(result.view);
        
        // TEMPORARILY DISABLED - Causing "Cannot read property 'add' of undefined" error, for some reason this fixed it and god bless. It does not work, because the view is not ready yet.
        // addSignalListeners(result.view);
        
        console.log("Chart interactions setup complete");
    } catch (error) {
        console.error("Error setting up chart interactions:", error);
    }
}

function addEventListeners(view) {
    view.addEventListener('click', addPredictionPoint);
    view.addEventListener('dblclick', clearAllPredictions);
}

function addSignalListeners(view) {
    try {
        console.log("Setting up signal listeners for view:", view);
        
        // Check if the view object and the method exist before using them
        if (view && typeof view.addSignalListener === 'function') {
            console.log("Adding signal listeners for 'selected' and 'hover'");
            view.addSignalListener('selected', handleSelectionChange);
            view.addSignalListener('hover', handleHoverChange);
        } else {
            console.warn("View object doesn't have addSignalListener method");
            
            // alternatively, we can try accessing signals through the view's underlying runtime
            if (view && view.signal && typeof view.signal === 'function') {
                console.log("Using view.signal() approach instead");
                
                // Set up watch for signals if available
                if (typeof view.addSignalListener !== 'function' && 
                    typeof view.changeset === 'function') {
                    console.log("Setting up manual signal watches");
                }
            }
        }
    } catch (error) {
        console.warn("Signal listeners not available:", error);
        console.warn("Error details:", error.stack);
        // Fallback: parameters should work through the click/hover events already configured
    }
}

function handleSelectionChange(name, value) {
    const selectedPoint = findSelectedPoint(value);
    updateSelectedPointInfo(selectedPoint);
}

function findSelectedPoint(selectionValue) {
    if (!selectionValue || !Array.isArray(selectionValue) || selectionValue.length === 0) {
        return null;
    }
    
    const selectedPoint = selectionValue[0];
    if (!selectedPoint || !selectedPoint.Date) {
        return null;
    }
    
    const selectedDate = new Date(selectedPoint.Date);
    if (isNaN(selectedDate.getTime())) {
        return null;
    }
    
    return historicalUberData.find(d => 
        d.Date.getTime() === selectedDate.getTime()
    );
}

function handleHoverChange(name, value) {
    if (!value || !Array.isArray(value) || value.length === 0) {
        return;
    }
    
    const hoveredPoint = value[0];
    if (!hoveredPoint || !hoveredPoint.Date) {
        return;
    }
    
    const hoveredDate = new Date(hoveredPoint.Date);
    if (isNaN(hoveredDate.getTime())) {
        return;
    }
    
    const foundPoint = findHoveredPoint(hoveredDate);
    if (foundPoint) {
        // Custom hover behavior can be added here if needed
    }
}

function findHoveredPoint(hoveredDate) {
    const combinedData = prepareCombinedData();
    return combinedData.find(d => 
        d.Date.getTime() === hoveredDate.getTime()
    );
}

async function initializePredictionChart() {
    try {
        console.log("Initializing prediction chart");
        await loadHistoricalUberData();
        console.log("Data loaded successfully, rendering chart");
        await renderPredictionChart();
        console.log("Prediction chart initialized successfully");
    } catch (error) {
        console.error("Failed to initialize prediction chart:", error);
        throw error;
    }
}

async function clearAllPredictionPoints() {
    userPredictions = [];
    if (historicalUberData.length > 0) {
        await renderPredictionChart();
    }
}

async function toggleActualDataDisplay() {
    isShowingActualData = !isShowingActualData;
    updateToggleButton();
    
    if (shouldRerenderChart()) {
        await renderPredictionChart();
    }
}

function updateToggleButton() {
    const button = document.getElementById('showActualData');
    if (!button) return;
    
    const icon = '<i class="fa-solid fa-chart-line"></i>';
    const buttonText = isShowingActualData ? ' Hide data points' : ' View unknown data points';
    
    button.innerHTML = icon + buttonText;
    button.classList.toggle('active', isShowingActualData);
}

function shouldRerenderChart() {
    return userPredictions.length > 0;
}

function updateSelectedPointInfo(point) {
    const tooltip = document.getElementById('selectedPointTooltip');
    if (!tooltip) return;

    if (point) {
        displayPointInfo(tooltip, point);
    } else {
        hidePointInfo(tooltip);
    }
}

function displayPointInfo(tooltip, point) {
    tooltip.innerHTML = createPointInfoHTML(point);
    tooltip.classList.add('visible');
}

function createPointInfoHTML(point) {
    return `
        <strong>Selected Point</strong><br>
        Date: ${point.Date.toLocaleDateString()}<br>
        Price: $${point.Close.toFixed(2)}
    `;
}

function hidePointInfo(tooltip) {
    tooltip.classList.remove('visible');
}

function createBollingerBands(data, period = BOLLINGER_PERIOD, multiplier = BOLLINGER_MULTIPLIER) {
    const bands = [];
    
    for (let i = 0; i < data.length; i++) {
        const periodData = getPeriodData(data, i, period);
        const sma = calculateSimpleMovingAverage(periodData);
        const stdDev = calculateStandardDeviation(periodData, sma);
        
        bands.push(createBollingerBand(data[i].Date, sma, stdDev, multiplier));
    }
    
    return bands;
}

function getPeriodData(data, currentIndex, period) {
    const startIndex = Math.max(0, currentIndex - period + 1);
    return data.slice(startIndex, currentIndex + 1);
}

function calculateSimpleMovingAverage(periodData) {
    return periodData.reduce((sum, d) => sum + d.Close, 0) / periodData.length;
}

function calculateStandardDeviation(periodData, sma) {
    const variance = periodData.reduce((sum, d) => sum + Math.pow(d.Close - sma, 2), 0) / periodData.length;
    return Math.sqrt(variance);
}

function createBollingerBand(date, sma, stdDev, multiplier) {
    return {
        Date: date,
        upperBand: sma + (multiplier * stdDev),
        lowerBand: sma - (multiplier * stdDev),
        middleBand: sma,
        type: "bollinger"
    };
}

// Expose public functions
window.PredictionChart = initializePredictionChart;
window.clearAllPredictionPoints = clearAllPredictionPoints;
window.toggleActualData = toggleActualDataDisplay;
