// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD-eCZun9Chghk2z0rdPrEuIKkMojrM5g0",
  authDomain: "monitoring-ver-j.firebaseapp.com",
  databaseURL: "https://monitoring-ver-j-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monitoring-ver-j",
  storageBucket: "monitoring-ver-j.firebasestorage.app",
  messagingSenderId: "237639687534",
  appId: "1:237639687534:web:4e61c13e6537455c34757f"
};

// Initialize Firebase
let app, db, isFirebaseReady = false;
try {
  app = firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  isFirebaseReady = true;
  console.log("✅ Firebase initialized");
} catch (error) {
  console.error("❌ Firebase error:", error);
  document.getElementById("status-banner").textContent = "❌ Firebase tidak tersedia";
}

// DOM Elements
const el = {
  // Navigation
  realtimeTab: document.getElementById("tab-realtime"),
  historyTab: document.getElementById("tab-history"),
  realtimeSection: document.getElementById("section-realtime"),
  historySection: document.getElementById("section-history"),
  
  // Status
  statusBanner: document.getElementById("status-banner"),
  lastUpdate: document.getElementById("last-update"),
  liveIndicator: document.getElementById("live-indicator"),
  
  // Metrics
  windValue: document.getElementById("wind-value"),
  rainValue: document.getElementById("rain-value"),
  lightValue: document.getElementById("light-value"),
  timestampValue: document.getElementById("timestamp-value"),
  
  // KPI
  windKpi: document.getElementById("wind-kpi"),
  solarKpi: document.getElementById("solar-kpi"),
  hydroKpi: document.getElementById("hydro-kpi"),
  
  // Trends
  windTrend: document.getElementById("wind-trend"),
  rainTrend: document.getElementById("rain-trend"),
  lightTrend: document.getElementById("light-trend"),
  
  // History
  dateStart: document.getElementById("date-start"),
  dateEnd: document.getElementById("date-end"),
  filterBtn: document.getElementById("filter-date"),
  aggBtns: document.querySelectorAll(".agg-btn"),
  historyInfo: document.getElementById("history-info"),
  historyTbody: document.getElementById("history-tbody"),
  csvBtn: document.getElementById("btn-csv"),
  pdfBtn: document.getElementById("btn-pdf"),
  screenshotBtn: document.getElementById("btn-screenshot"),
  
  // Charts
  realtimeChart: null,
  historyChart: null
};

// State
let currentAgg = "minute";
let allData = [];
let filteredData = [];
let previousValues = { wind: 0, rain: 0, light: 0 };
let isConnected = false;
let chartPoints = [];
let historyPoints = [];

// Initialization
document.addEventListener("DOMContentLoaded", initDashboard);

function initDashboard() {
  console.log("🚀 Initializing dashboard...");
  
  // Setup UI events
  setupEventListeners();
  
  // Initialize charts
  initCharts();
  
  // Start data listeners
  if (isFirebaseReady) {
    startRealtimeListener();
    startHistoryListener();
  }
  
  // Auto-hide loading after 3 seconds
  setTimeout(() => {
    if (document.getElementById("loading-overlay")) {
      document.getElementById("loading-overlay").classList.add("hidden");
    }
  }, 3000);
}

// Event Listeners
function setupEventListeners() {
  // Navigation tabs
  el.realtimeTab?.addEventListener("click", () => switchSection("realtime"));
  el.historyTab?.addEventListener("click", () => switchSection("history"));
  
  // Date filter
  el.filterBtn?.addEventListener("click", applyDateFilter);
  
  // Aggregation buttons
  el.aggBtns?.forEach(btn => {
    btn.addEventListener("click", () => {
      el.aggBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentAgg = btn.dataset.agg;
      updateHistoryView();
    });
  });
  
  // Export buttons
  el.csvBtn?.addEventListener("click", exportCSV);
  el.pdfBtn?.addEventListener("click", exportPDF);
  el.screenshotBtn?.addEventListener("click", takeScreenshot);
}

// Section Switching
function switchSection(section) {
  const realtimeSection = document.getElementById("section-realtime");
  const historySection = document.getElementById("section-history");
  
  el.realtimeTab.classList.toggle("active", section === "realtime");
  el.historyTab.classList.toggle("active", section === "history");
  
  realtimeSection.classList.toggle("active", section === "realtime");
  historySection.classList.toggle("active", section === "history");
  
  if (section === "realtime" && el.realtimeChart) {
    el.realtimeChart.resize();
  }
  
  if (section === "history" && el.historyChart) {
    el.historyChart.resize();
  }
}

// Firebase Listeners
function startRealtimeListener() {
  const realtimeRef = db.ref("/weather/keadaan_sekarang");
  
  realtimeRef.on("value", (snap) => {
    const data = snap.val();
    console.log("📡 Realtime data received:", data);
    
    if (!data) {
      updateStatus("No data available", "warning");
      return;
    }
    
    const timestamp = data.waktu || new Date().toLocaleString("id-ID");
    const wind = Number(data.anemometer || 0);
    const rain = Number(data.rain_gauge || 0);
    const light = Number(data.sensor_cahaya || 0);
    
    // Update UI
    updateRealtimeMetrics(wind, rain, light, timestamp);
    addChartPoint("realtime", timestamp, wind, rain, light);
    
    // Update status
    isConnected = true;
    updateStatus(`✅ Connected - Last update: ${timestamp}`, "success");
    updateLiveIndicator(true);
    
    // Store for trend calculation
    previousValues = { wind, rain, light };
    
  }, (error) => {
    console.error("❌ Realtime listener error:", error);
    updateStatus(`❌ Error: ${error.message}`, "error");
    updateLiveIndicator(false);
  });
}

function startHistoryListener() {
  const historyRef = db.ref("/weather/histori");
  
  historyRef.on("value", (snap) => {
    console.log("📚 History data loaded");
    
    allData = [];
    const rawData = snap.val();
    
    if (rawData) {
      Object.keys(rawData).forEach(key => {
        const record = rawData[key];
        if (record && record.waktu) {
          const date = parseDate(record.waktu);
          if (date) {
            allData.push({
              timestamp: date,
              timeStr: record.waktu,
              wind: Number(record.anemometer || 0),
              rain: Number(record.rain_gauge || 0),
              light: Number(record.sensor_cahaya || 0)
            });
          }
        }
      });
      
      allData.sort((a, b) => a.timestamp - b.timestamp);
      filteredData = [...allData];
    }
    
    updateHistoryView();
    
  }, (error) => {
    console.error("❌ History listener error:", error);
    el.historyInfo.textContent = `Error loading history: ${error.message}`;
  });
}

// Update Real-time Metrics
function updateRealtimeMetrics(wind, rain, light, timestamp) {
  // Metrics
  if (el.windValue) el.windValue.textContent = wind.toFixed(2);
  if (el.rainValue) el.rainValue.textContent = rain.toFixed(2);
  if (el.lightValue) el.lightValue.textContent = light.toFixed(0);
  if (el.timestampValue) el.timestampValue.textContent = timestamp;
  
  // KPI Calculation
  const windPotential = calculateWindPotential(wind);
  const solarPotential = calculateSolarPotential(light);
  const hydroPotential = calculateHydroPotential(rain);
  
  if (el.windKpi) el.windKpi.textContent = windPotential.toFixed(2) + " kWh/hari";
  if (el.solarKpi) el.solarKpi.textContent = solarPotential.toFixed(2) + " kWh/hari";
  if (el.hydroKpi) el.hydroKpi.textContent = hydroPotential.toFixed(2) + " kWh/hari";
  
  // Trends
  updateTrendDisplay(el.windTrend, wind, previousValues.wind, "wind");
  updateTrendDisplay(el.rainTrend, rain, previousValues.rain, "rain");
  updateTrendDisplay(el.lightTrend, light, previousValues.light, "light");
}

// Update History View
function updateHistoryView() {
  if (!filteredData.length) {
    el.historyInfo.textContent = "No historical data available";
    el.historyTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No data</td></tr>';
    return;
  }
  
  const aggregated = aggregateData(filteredData, currentAgg);
  
  el.historyInfo.textContent = `Showing ${aggregated.length} data points (${currentAgg})`;
  
  // Update table
  el.historyTbody.innerHTML = "";
  aggregated.slice(-20).reverse().forEach(record => {
    const potential = calculateTotalPotential(record.wind, record.rain, record.light);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${record.timeStr}</td>
      <td>${record.wind.toFixed(2)}</td>
      <td>${record.rain.toFixed(2)}</td>
      <td>${record.light.toFixed(0)}</td>
      <td>${potential.toFixed(2)}</td>
    `;
    el.historyTbody.appendChild(tr);
  });
  
  // Update chart
  updateHistoryChart(aggregated);
}

// Aggregation Functions
function aggregateData(data, mode) {
  const map = new Map();
  
  data.forEach(item => {
    let key, timeStr;
    const d = item.timestamp;
    
    switch (mode) {
      case "minute":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        timeStr = key;
        break;
      case "hour":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
        timeStr = key;
        break;
      case "day":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        timeStr = key;
        break;
      case "month":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        timeStr = key;
        break;
      default:
        key = item.timestamp.getTime();
        timeStr = item.timeStr;
    }
    
    if (!map.has(key)) {
      map.set(key, {
        timeStr,
        wind: 0,
        rain: 0,
        light: 0,
        count: 0
      });
    }
    
    const bucket = map.get(key);
    bucket.wind += item.wind;
    bucket.rain += item.rain;
    bucket.light += item.light;
    bucket.count++;
  });
  
  const result = Array.from(map.values()).map(bucket => ({
    timeStr: bucket.timeStr,
    wind: bucket.wind / bucket.count,
    rain: bucket.rain / bucket.count,
    light: bucket.light / bucket.count
  }));
  
  return result.sort((a, b) => new Date(a.timeStr) - new Date(b.timeStr));
}

// Chart Functions
function initCharts() {
  initRealtimeChart();
  initHistoryChart();
}

function initRealtimeChart() {
  const canvas = document.getElementById("chart-realtime");
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  
  el.realtimeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Angin (km/h)",
          data: [],
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          borderWidth: 3,
          fill: true,
          pointRadius: 4
        },
        {
          label: "Hujan (mm)",
          data: [],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          tension: 0.4,
          borderWidth: 3,
          fill: true,
          yAxisID: "y1"
        },
        {
          label: "Cahaya (lux/100)",
          data: [],
          borderColor: "#d4af37",
          backgroundColor: "rgba(212, 175, 55, 0.1)",
          tension: 0.4,
          borderWidth: 3,
          fill: true,
          yAxisID: "y2"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: "#f1f5f9" },
          grid: { color: "rgba(255,255,255,0.1)" }
        },
        y: {
          ticks: { color: "#f1f5f9" },
          grid: { color: "rgba(255,255,255,0.1)" }
        },
        y1: {
          type: "linear",
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#f59e0b" }
        },
        y2: {
          type: "linear",
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#d4af37" }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#f1f5f9",
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          titleColor: "#f1f5f9",
          bodyColor: "#f1f5f9",
          borderColor: "#10b981",
          cornerRadius: 8
        }
      },
      animation: {
        duration: 800,
        easing: "easeOutQuart"
      }
    }
  });
}

function initHistoryChart() {
  const canvas = document.getElementById("chart-history");
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  
  el.historyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Angin (km/h)",
          data: [],
          backgroundColor: "rgba(16, 185, 129, 0.6)",
          borderColor: "#10b981",
          borderWidth: 2
        },
        {
          label: "Hujan (mm)",
          data: [],
          backgroundColor: "rgba(245, 158, 11, 0.6)",
          borderColor: "#f59e0b",
          borderWidth: 2
        },
        {
          label: "Cahaya (lux)",
          data: [],
          backgroundColor: "rgba(212, 175, 55, 0.6)",
          borderColor: "#d4af37",
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: "#f1f5f9", maxRotation: 45 },
          grid: { color: "rgba(255,255,255,0.1)" }
        },
        y: {
          ticks: { color: "#f1f5f9" },
          grid: { color: "rgba(255,255,255,0.1)" }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#f1f5f9",
            padding: 20
          }
        }
      },
      animation: {
        duration: 1000,
        easing: "easeOutQuart"
      }
    }
  });
}

// Add Chart Point
function addChartPoint(chartType, label, wind, rain, light) {
  if (chartType === "realtime" && el.realtimeChart) {
    const maxPoints = 24;
    
    el.realtimeChart.data.labels.push(label);
    el.realtimeChart.data.datasets[0].data.push(wind);
    el.realtimeChart.data.datasets[1].data.push(rain);
    el.realtimeChart.data.datasets[2].data.push(light / 100);
    
    if (el.realtimeChart.data.labels.length > maxPoints) {
      el.realtimeChart.data.labels.shift();
      el.realtimeChart.data.datasets.forEach(ds => ds.data.shift());
    }
    
    el.realtimeChart.update("none");
  }
  
  if (chartType === "history" && el.historyChart) {
    const maxPoints = 20;
    
    el.historyChart.data.labels.push(label);
    el.historyChart.data.datasets[0].data.push(wind);
    el.realtimeChart.data.datasets[1].data.push(rain);
    el.realtimeChart.data.datasets[2].data.push(light);
    
    if (el.historyChart.data.labels.length > maxPoints) {
      el.historyChart.data.labels.shift();
      el.historyChart.data.datasets.forEach(ds => ds.data.shift());
    }
    
    el.historyChart.update("active", { duration: 500 });
  }
}

// Update History Chart
function updateHistoryChart(aggregated) {
  if (!aggregated.length || !el.historyChart) return;
  
  const labels = aggregated.map(d => d.timeStr).slice(-15);
  const windData = aggregated.map(d => d.wind).slice(-15);
  const rainData = aggregated.map(d => d.rain).slice(-15);
  const lightData = aggregated.map(d => d.light).slice(-15);
  
  el.historyChart.data.labels = labels;
  el.historyChart.data.datasets[0].data = windData;
  el.historyChart.data.datasets[1].data = rainData;
  el.historyChart.data.datasets[2].data = lightData;
  
  el.historyChart.update("active", { duration: 800 });
}

// Utility Functions
function parseDate(str) {
  try {
    const [date, time] = str.split(" ");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute, second] = time.split(":").map(Number);
    return new Date(year, month - 1, day, hour, minute, second);
  } catch (e) {
    console.warn("Invalid date format:", str);
    return new Date(str);
  }
}

function calculateWindPotential(wind) {
  return Math.max(0, wind * 0.15);
}

function calculateSolarPotential(light) {
  return Math.max(0, (light / 1000) * 0.2);
}

function calculateHydroPotential(rain) {
  return Math.max(0, rain * 0.3);
}

function calculateTotalPotential(wind, rain, light) {
  return calculateWindPotential(wind) + calculateSolarPotential(light) + calculateHydroPotential(rain);
}

function updateTrendDisplay(element, current, previous, type) {
  if (!element || previous === 0) {
    element.textContent = "—";
    return;
  }
  
  const change = ((current - previous) / previous * 100).toFixed(1);
  const isPositive = change >= 0;
  
  element.innerHTML = `<span class="${isPositive ? 'trend-up' : 'trend-down'}">${isPositive ? '↗️' : '↘️'} ${isPositive ? '+' : ''}${change}%</span>`;
  element.style.color = isPositive ? "#10b981" : "#ef4444";
}

function updateStatus(message, type = "info") {
  if (!el.statusBanner) return;
  
  const icon = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "⏳";
  el.statusBanner.innerHTML = `<span class="status-icon">${icon}</span> ${message}`;
}

function updateLiveIndicator(connected) {
  if (!el.liveIndicator) return;
  
  const text = connected ? "Live" : "Offline";
  const color = connected ? "#10b981" : "#ef4444";
  
  el.liveIndicator.querySelector("span:last-child").textContent = text;
  el.liveIndicator.style.backgroundColor = color;
}

function applyDateFilter() {
  const startDate = new Date(el.dateStart.value);
  const endDate = new Date(el.dateEnd.value);
  
  filteredData = allData.filter(item => {
    const itemDate = item.timestamp;
    return itemDate >= startDate && itemDate <= endDate;
  });
  
  updateHistoryView();
}

// Export Functions
function exportCSV() {
  if (!filteredData.length) {
    alert("Tidak ada data untuk diekspor");
    return;
  }
  
  const aggregated = aggregateData(filteredData, currentAgg);
  let csv = "Waktu,Angin,Hujan,Cahaya,Potensi\n";
  
  aggregated.forEach(item => {
    const potential = calculateTotalPotential(item.wind, item.rain, item.light);
    csv += `"${item.timeStr}",${item.wind.toFixed(2)},${item.rain.toFixed(2)},${item.light.toFixed(0)},${potential.toFixed(2)}\n`;
  });
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `energi_historis_${currentAgg}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF() {
  alert("Fitur PDF dalam pengembangan - Gunakan CSV untuk sekarang");
  exportCSV();
}

function takeScreenshot() {
  html2canvas(document.body).then(canvas => {
    const link = document.createElement("a");
    link.download = `dashboard_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL();
    link.click();
  });
}

// Date Picker Setup
function setupDatePicker() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  if (el.dateStart) {
    el.dateStart.valueAsDate = yesterday;
  }
  if (el.dateEnd) {
    el.dateEnd.valueAsDate = today;
  }
}

// Initialize
setupDatePicker();
updateHistoryView();
