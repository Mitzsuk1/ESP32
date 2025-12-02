// ===== REAL-TIME CHART (Primary Power Chart) =====
const ctx = document.getElementById("powerChart").getContext("2d");
const powerChart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "Power (W)",
            data: [],
            borderWidth: 2,
            borderColor: "#4caf50", // Use a theme color
            tension: 0.3,
        }]
    },
    options: {
        scales: {
            y: { 
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: 'white' }
            },
            x: {
                grid: { display: false },
                ticks: { color: 'white' }
            }
        },
        plugins: {
            legend: { labels: { color: 'white' } }
        }
    }
});

// ===== LIVE DATA HANDLING VARIABLES =====

// API endpoint for ESP32 - Assuming it returns data structure like: { "main": {...}, "pzem1": {...} }
const API_URL = "update.json"; 

// Object to hold references to the dynamically created device charts
const deviceCharts = {}; 

// ===== FUNCTIONS =====

/**
 * Updates the main dashboard cards (Voltage, Current, Power, Status).
 * NOTE: This assumes the data object contains top-level properties like data.voltage.
 * You might need to adjust this based on the actual JSON structure from your ESP32.
 */
function updateMainUI(mainData) {
    document.getElementById("voltage").innerText = mainData.voltage + " V";
    document.getElementById("current").innerText = mainData.current + " A";
    document.getElementById("power").innerText = mainData.power + " W";

    const statusEl = document.getElementById("status");
    statusEl.innerText = mainData.status;

    // Correctly apply CSS class based on status (e.g., 'Normal' -> 'status normal')
    statusEl.className = "status " + mainData.status.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Updates the primary, large power chart.
 */
function updatePrimaryChart(power) {
    const chart = powerChart.data.datasets[0].data;
    const labels = powerChart.data.labels;
    const time = new Date().toLocaleTimeString();
    const MAX_POINTS = 20;

    chart.push(power);
    labels.push(time);

    if (labels.length > MAX_POINTS) {
        chart.shift();
        labels.shift();
    }

    powerChart.update('none'); // 'none' skips animation for faster real-time updates
}

/**
 * Logs a new event line to the log box.
 */
function logEvent(data) {
    const logBox = document.getElementById("logBox");
    // Only log essential data for the main overview
    const line = `[${new Date().toLocaleTimeString()}] V:${data.voltage} A:${data.current} W:${data.power} Status:${data.status}`;
    
    // Add the new line to the top
    logBox.innerHTML = `<p>${line}</p>` + logBox.innerHTML; 
}

/**
 * Renders the HTML structure for each device card in the device-grid.
 */
function renderDevices(data) {
    const container = document.getElementById("pzem-container");
    let html = ""; 

    Object.keys(data).forEach(device => {
        const d = data[device];

        html += `
            <div class="device-card">
                <h3>${device.toUpperCase()}</h3>
                <p><strong>Voltage:</strong> ${d.voltage} V</p>
                <p><strong>Current:</strong> ${d.current} A</p>
                <p><strong>Power:</strong> ${d.power} W</p>
                <canvas id="chart_${device}" height="100"></canvas>
            </div>
        `;
    });
    
    // Use innerHTML once for performance
    container.innerHTML = html; 
}

/**
 * Updates the small chart within each device card.
 */
function updateDeviceCharts(data) {
    const MAX_POINTS = 20;

    Object.keys(data).forEach(device => {
        const ctx = document.getElementById("chart_" + device);

        // Initialize the chart if it doesn't exist
        if (!deviceCharts[device]) {
            deviceCharts[device] = new Chart(ctx, {
                type: "line",
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        borderWidth: 1,
                        pointRadius: 0, // No points for cleaner small charts
                        borderColor: '#ffbb33', 
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    // Minimal chart options
                    scales: {
                        y: { display: false },
                        x: { display: false }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    }
                }
            });
        }

        const chart = deviceCharts[device];

        // Update data arrays
        chart.data.labels.push("");
        chart.data.datasets[0].data.push(data[device].power);

        // Shift data to maintain a fixed number of points
        if (chart.data.labels.length > MAX_POINTS) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        chart.update('none');
    });
}

/**
 * Merged and corrected function to fetch data and update ALL parts of the UI.
 */
async function fetchData() {
    try {
        // The '?t=' parameter prevents browser caching
        const response = await fetch(API_URL + "?t=" + Date.now());
        const rawData = await response.json();

        // 1. Update dynamic device grid (assumes rawData is an object of devices)
        // Example: { "main": {V,A,W,S}, "pzem1": {V,A,W,S}, ... }
        renderDevices(rawData);
        updateDeviceCharts(rawData);

        // 2. Update main UI elements (assuming the "main" device is the primary display)
        const mainDeviceData = rawData.main || Object.values(rawData)[0];
        
        if (mainDeviceData) {
            updateMainUI(mainDeviceData);
            updatePrimaryChart(mainDeviceData.power);
            logEvent(mainDeviceData);
        }

    } catch (err) {
        // You would typically log errors to the logBox or console
        console.error("Error fetching data:", err); 
    }
}

// Start the real-time data fetch loop
setInterval(fetchData, 1000);
