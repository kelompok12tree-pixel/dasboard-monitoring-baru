// Firebase SDK - Tanpa external dependencies selain Chart.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getDatabase, ref, onValue, connectDatabaseEmulator } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

// Konfigurasi Firebase - Pastikan sesuai project-mu
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
let app, db;
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  console.log("✅ Firebase initialized successfully");
} catch (error) {
  console.error("❌ Firebase init error:", error);
  showError("Gagal inisialisasi Firebase: " + error.message);
}

// DOM Elements
const elements = {
  // Tabs
  tabRealtime: document.getElementById("tab-realtime-mobile"),
  tabRecap: document.getElementById("tab-recap-mobile"),
  sectionRealtime: document.getElementById("section-realtime"),
  sectionRecap: document.getElementById("section-recap"),
  
  // Status
  statusBanner: document.getElementById("status-banner"),
  lastUpdate: document.getElementById("last-update"),
  liveIndicator: document.getElementById("live-indicator"),
  
  // Cards
  cardWind: document.getElementById("card-wind"),
  cardRain: document.getElementById("card-rain"),
  cardLux: document.getElementById("card-lux"),
  cardTime: document.getElementById("card-time"),
  
  // KPI
  windPotential: document.getElementById("wind-potential"),
  solarPotential: document.getElementById("solar-potential"),
  hydroPotential: document.getElementById("hydro-potential"),
  
  // Progress
  windProgress: document.getElementById("wind-progress"),
  rainProgress: document.getElementById("rain-progress"),
  luxProgress: document.getElementById("lux-progress"),
  
  // Trends
  windTrend: document.getElementById("wind-trend"),
  rainTrend: document.getElementById("rain-trend"),
  luxTrend: document.getElementById("lux-trend"),
  
  // Rekap
  subTabs: document.querySelectorAll(".tab-btn.sub"),
  rekapInfo: document.getElementById("rekap-info"),
  rekapTbody: document.getElementById("rekap-tbody"),
  btnDownload: document.getElementById("btn-download"),
  
  // Loading
  loadingOverlay: document.getElementById("loading-overlay")
};

// State
let currentAgg = "hour";
let realtimeChart = null;
let rekapChart = null;
let historiData = [];
let previousValues = { wind: 0, rain: 0, lux: 0 };
let isConnected = false;
let connectionAttempts = 0;
const maxAttempts = 5;

// Initialize
document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  console.log("🚀 Starting dashboard initialization...");
  
  // Check if Firebase loaded
  if (!db) {
    showError("Firebase SDK gagal dimuat");
    return;
  }
  
  // Setup UI
  setupUI();
  
  // Start connection
  attemptConnection();
  
  console.log("✅ UI setup complete");
}

// UI Setup
function setupUI() {
  // Tab switching
  if (elements.tabRealtime) elements.tabRealtime.addEventListener("click", () => switchTab("realtime"));
  if (elements.tabRecap) elements.tabRecap.addEventListener("click", () => switchTab("recap"));
  
  // Sub tabs
  elements.subTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      elements.subTabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentAgg = btn.dataset.agg;
      updateRekapView();
    });
  });
  
  // Download
  if (elements.btnDownload) {
    elements.btnDownload.addEventListener("click", downloadCSV);
  }
  
  // Hide loading with timeout
  setTimeout(() => {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.classList.add("hidden");
    }
  }, 3000);
}

// Connection Management
function attemptConnection() {
  if (connectionAttempts >= maxAttempts) {
    showError("Koneksi Firebase gagal setelah " + maxAttempts + " percobaan");
    return;
  }
  
  connectionAttempts++;
  console.log(`🔄 Connection attempt ${connectionAttempts}/${maxAttempts}`);
  
  // Start listeners with error handling
  startRealtimeListener();
  startHistoryListener();
  
  // Retry if not connected after 10s
  setTimeout(() => {
    if (!isConnected) {
      console.warn("⚠️ Initial connection failed, retrying...");
      attemptConnection();
    }
  }, 10000);
}

// Realtime Listener
function startRealtimeListener() {
  if (!db) return;
  
  console.log("🔗 Starting realtime listener...");
  
  const realtimeRef = ref(db, "/weather/keadaan_sekarang");
  
  const unsubscribe = onValue(realtimeRef, (snap) => {
    console.log("📡 Realtime data received:", snap.val());
    
    const val = snap.val();
    if (!val) {
      console.warn("⚠️ No realtime data");
      updateStatus("Tidak ada data realtime", "warning");
      return;
    }
    
    const now = new Date();
    const timeStr = val.waktu || now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const wind = Number(val.anemometer || 0);
    const rain = Number(val.rain_gauge || 0);
    const lux = Number(val.sensor_cahaya || 0);
    
    // Update UI
    updateRealtimeUI(wind, rain, lux, timeStr);
    updateKPI(wind, rain, lux);
    
    // Chart
    if (realtimeChart) {
      pushRealtimeData(timeStr, wind, rain, lux);
    }
    
    // Mark connected
    isConnected = true;
    updateStatus(`Tersambung - Terakhir: ${timeStr}`, "success");
    updateLiveIndicator(true);
    
    connectionAttempts = 0; // Reset attempts
    
  }, (error) => {
    console.error("❌ Realtime listener error:", error);
    isConnected = false;
    updateStatus(`Error: ${error.message}`, "error");
    updateLiveIndicator(false);
    
    // Retry after error
    setTimeout(startRealtimeListener, 5000);
  });
  
  // Store unsubscribe for cleanup
  window.realtimeUnsubscribe = unsubscribe;
}

// History Listener
function startHistoryListener() {
  if (!db) return;
  
  console.log("📚 Starting history listener...");
  
  const historyRef = ref(db, "/weather/histori");
  
  const unsubscribe = onValue(historyRef, (snap) => {
    console.log("📖 History data received:", snap.val());
    
    const val = snap.val();
    historiData = [];
    
    if (val) {
      Object.keys(val).forEach(key => {
        const row = val[key];
        if (row && row.waktu) {
          const timestamp = parseDate(row.waktu);
          if (timestamp) {
            historiData.push({
              time: timestamp,
              timeStr: row.waktu,
              wind: Number(row.anemometer || 0),
              rain: Number(row.rain_gauge || 0),
              lux: Number(row.sensor_cahaya || 0)
            });
          }
        }
      });
      historiData.sort((a, b) => a.time - b.time);
      console.log(`📊 Loaded ${historiData.length} history points`);
    }
    
    updateRekapView();
    
  }, (error) => {
    console.error("❌ History listener error:", error);
    updateRekapInfo("Gagal memuat histori: " + error.message);
  });
  
  window.historyUnsubscribe = unsubscribe;
}

// Tab Switching
function switchTab(activeTab) {
  // Update tabs
  if (elements.tabRealtime) elements.tabRealtime.classList.toggle("active", activeTab === "realtime");
  if (elements.tabRecap) elements.tabRecap.classList.toggle("active", activeTab === "recap");
  if (elements.tabRealtimeMobile) elements.tabRealtimeMobile.classList.toggle("active", activeTab === "realtime");
  if (elements.tabRecapMobile) elements.tabRecapMobile.classList.toggle("active", activeTab === "recap");
  
  // Update sections
  if (elements.sectionRealtime) elements.sectionRealtime.classList.toggle("active", activeTab === "realtime");
  if (elements.sectionRecap) elements.sectionRecap.classList.toggle("active", activeTab === "recap");
  
  // Resize charts
  if (activeTab === "realtime" && realtimeChart) {
    setTimeout(() => realtimeChart.resize(), 100);
  }
  if (activeTab === "recap" && rekapChart) {
    setTimeout(() => rekapChart.resize(), 100);
  }
}

// Update Realtime UI
function updateRealtimeUI(wind, rain, lux, timeStr) {
  // Cards
  if (elements.cardWind) elements.cardWind.textContent = wind.toFixed(2);
  if (elements.cardRain) elements.cardRain.textContent = rain.toFixed(2);
  if (elements.cardLux) elements.cardLux.textContent = lux.toFixed(0);
  if (elements.cardTime) elements.cardTime.textContent = timeStr;
  
  // Trends (simple comparison)
  updateTrendDisplay(elements.windTrend, wind, previousValues.wind);
  updateTrendDisplay(elements.rainTrend, rain, previousValues.rain);
  updateTrendDisplay(elements.luxTrend, lux, previousValues.lux);
  
  // Progress bars
  updateProgressBar(elements.windProgress, Math.min(wind / 20 * 100, 100));
  updateProgressBar(elements.rainProgress, Math.min(rain / 50 * 100, 100));
  updateProgressBar(elements.luxProgress, Math.min(lux / 2000 * 100, 100));
  
  // Update previous values
  previousValues = { wind, rain, lux };
}

// KPI Update
function updateKPI(wind, rain, lux) {
  // Simplified energy calculations
  const windKwh = Math.max(0, (wind * 0.15)).toFixed(1);
  const solarKwh = Math.max(0, (lux / 1000 * 0.2)).toFixed(1);
  const hydroKwh = Math.max(0, (rain * 0.3)).toFixed(1);
  
  if (elements.windPotential) elements.windPotential.textContent = windKwh + " kWh/hari";
  if (elements.solarPotential) elements.solarPotential.textContent = solarKwh + " kWh/hari";
  if (elements.hydroPotential) elements.hydroPotential.textContent = hydroKwh + " kWh/hari";
}

// Status Updates
function updateStatus(message, type = "info") {
  if (!elements.statusBanner) return;
  
  const icon = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "⏳";
  elements.statusBanner.innerHTML = `<span class="status-icon">${icon}</span> ${message}`;
  
  // Color coding
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6"
  };
  
  elements.statusBanner.style.background = colors[type] || colors.info;
}

function updateLiveIndicator(connected) {
  if (!elements.liveIndicator) return;
  
  const text = connected ? "Live" : "Offline";
  const color = connected ? "#10b981" : "#ef4444";
  
  elements.liveIndicator.querySelector("span:last-child").textContent = text;
  elements.liveIndicator.style.background = color;
}

function updateLastUpdate(timeStr) {
  if (elements.lastUpdate) {
    elements.lastUpdate.textContent = timeStr;
  }
}

// Trend Display
function updateTrendDisplay(element, current, previous) {
  if (!element || previous === 0) {
    element.textContent = "—";
    return;
  }
  
  const change = ((current - previous) / previous * 100).toFixed(1);
  const isIncrease = change >= 0;
  const symbol = isIncrease ? "↗️" : "↘️";
  
  element.innerHTML = `${symbol} ${isIncrease ? '+' : ''}${change}%`;
  element.style.color = isIncrease ? "#10b981" : "#ef4444";
}

// Progress Bar
function updateProgressBar(element, percentage) {
  if (!element) return;
  element.style.width = `${Math.min(percentage, 100)}%`;
}

// Rekap View
function updateRekapView() {
  if (!elements.rekapInfo || !elements.rekapTbody) return;
  
  if (!historiData.length) {
    elements.rekapInfo.textContent = "Belum ada data historis";
    elements.rekapTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">Tidak ada data</td></tr>';
    return;
  }
  
  // Aggregate data
  const aggregated = aggregateData(historiData, currentAgg);
  
  elements.rekapInfo.textContent = `Data: ${aggregated.length} titik (${currentAgg})`;
  
  // Table
  elements.rekapTbody.innerHTML = "";
  aggregated.slice(-10).reverse().forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.timeStr}</td>
      <td>${row.wind.toFixed(2)}</td>
      <td>${row.rain.toFixed(2)}</td>
      <td>${row.lux.toFixed(0)}</td>
    `;
    elements.rekapTbody.appendChild(tr);
  });
  
  // Chart
  updateRekapChart(aggregated);
}

// Aggregate Data
function aggregateData(data, mode) {
  const map = new Map();
  
  data.forEach(item => {
    let key;
    const d = item.time;
    
    switch (mode) {
      case "hour":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
        break;
      case "day":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        break;
      case "month":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = item.timeStr;
    }
    
    if (!map.has(key)) {
      map.set(key, { 
        timeStr: key, 
        wind: 0, 
        rain: 0, 
        lux: 0, 
        count: 0 
      });
    }
    
    const bucket = map.get(key);
    bucket.wind += item.wind;
    bucket.rain += item.rain;
    bucket.lux += item.lux;
    bucket.count++;
  });
  
  const result = Array.from(map.values()).map(bucket => ({
    timeStr: bucket.timeStr,
    wind: bucket.wind / bucket.count,
    rain: bucket.rain / bucket.count,
    lux: bucket.lux / bucket.count
  }));
  
  return result.sort((a, b) => new Date(a.timeStr) - new Date(b.timeStr));
}

// Update Rekap Chart
function updateRekapChart(data) {
  if (!data.length) return;
  
  const labels = data.map(d => d.timeStr).slice(-20);
  const windData = data.map(d => d.wind).slice(-20);
  const rainData = data.map(d => d.rain).slice(-20);
  const luxData = data.map(d => d.lux / 100).slice(-20); // Scaled
  
  const canvas = document.getElementById("chart-rekap");
  if (!canvas) return;
  
  if (rekapChart) rekapChart.destroy();
  
  const ctx = canvas.getContext("2d");
  rekapChart = new Chart(ctx, {
    type: currentAgg === "month" ? "bar" : "line",
    data: {
      labels,
      datasets: [
        {
          label: "Angin (km/h)",
          data: windData,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          tension: 0.4,
          fill: true
        },
        {
          label: "Hujan (mm)",
          data: rainData,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.2)",
          tension: 0.4,
          fill: true,
          yAxisID: "y1"
        },
        {
          label: "Cahaya (lux/100)",
          data: luxData,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          tension: 0.4,
          fill: true,
          yAxisID: "y2"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "white", padding: 20 }
        }
      },
      scales: {
        x: { 
          ticks: { color: "rgba(255,255,255,0.7)", maxRotation: 45 },
          grid: { color: "rgba(255,255,255,0.1)" }
        },
        y: {
          type: "linear",
          position: "left",
          ticks: { color: "rgba(255,255,255,0.7)" },
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
          ticks: { color: "#3b82f6" }
        }
      },
      animation: {
        duration: 800,
        easing: "easeOutQuart"
      }
    }
  });
}

// Realtime Chart
function initRealtimeChart() {
  const canvas = document.getElementById("chart-realtime");
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  
  realtimeChart = new Chart(ctx, {
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
          borderWidth: 2,
          fill: true,
          pointRadius: 3
        },
        {
          label: "Hujan (mm)",
          data: [],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          tension: 0.4,
          borderWidth: 2,
          fill: true,
          yAxisID: "y1",
          pointRadius: 3
        },
        {
          label: "Cahaya (lux/100)",
          data: [],
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
          borderWidth: 2,
          fill: true,
          yAxisID: "y2",
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { 
            color: "white", 
            padding: 20,
            usePointStyle: true 
          }
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleColor: "white",
          bodyColor: "white",
          borderColor: "#10b981",
          cornerRadius: 6
        }
      },
      scales: {
        x: {
          ticks: { color: "rgba(255,255,255,0.7)", maxRotation: 45 },
          grid: { color: "rgba(255,255,255,0.1)" }
        },
        y: {
          type: "linear",
          position: "left",
          ticks: { color: "rgba(255,255,255,0.7)" },
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
          ticks: { color: "#3b82f6" }
        }
      },
      animation: {
        duration: 500,
        easing: "easeOutQuart"
      }
    }
  });
  
  console.log("📈 Realtime chart initialized");
}

// Push Realtime Data
function pushRealtimeData(label, wind, rain, lux) {
  if (!realtimeChart) return;
  
  const maxPoints = 24;
  const scaledLux = lux / 100;
  
  realtimeChart.data.labels.push(label);
  realtimeChart.data.datasets[0].data.push(wind);
  realtimeChart.data.datasets[1].data.push(rain);
  realtimeChart.data.datasets[2].data.push(scaledLux);
  
  // Keep last 24 points
  if (realtimeChart.data.labels.length > maxPoints) {
    realtimeChart.data.labels.shift();
    realtimeChart.data.datasets.forEach(dataset => dataset.data.shift());
  }
  
  realtimeChart.update("none");
}

// Download CSV
function downloadCSV() {
  if (!historiData.length) {
    alert("Tidak ada data untuk diekspor");
    return;
  }
  
  let csv = "Waktu,Angin(km/h),Hujan(mm),Cahaya(lux),Potensi(kWh)\n";
  
  const aggregated = aggregateData(historiData, currentAgg);
  aggregated.forEach(row => {
    const potential = (row.wind * 0.15 + row.rain * 0.3 + (row.lux / 1000 * 0.2)).toFixed(2);
    csv += `"${row.timeStr}",${row.wind.toFixed(2)},${row.rain.toFixed(2)},${row.lux.toFixed(0)},${potential}\n`;
  });
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `energi_rekap_${currentAgg}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Error Handling
function showError(message) {
  if (elements.statusBanner) {
    elements.statusBanner.innerHTML = `<span class="status-icon">❌</span> ${message}`;
    elements.statusBanner.style.background = "#ef4444";
  }
  console.error("💥 Dashboard Error:", message);
  
  // Show overlay error
  if (elements.loadingOverlay) {
    elements.loadingOverlay.innerHTML = `
      <div class="loading-content">
        <span class="spinner">❌</span>
        <p>${message}</p>
        <button onclick="location.reload()" style="background:var(--accent);color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Coba Lagi</button>
      </div>
    `;
  }
}

// Date Parser
function parseDate(str) {
  try {
    const [datePart, timePart] = str.split(" ");
    if (!datePart || !timePart) return null;
    
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second] = timePart.split(":").map(Number);
    
    return new Date(year, month - 1, day, hour, minute, second);
  } catch (e) {
    console.warn("Invalid date format:", str);
    return null;
  }
}

// Initialize Charts
function initCharts() {
  initRealtimeChart();
  console.log("✅ Charts ready");
}

// Window cleanup
window.addEventListener("beforeunload", () => {
  if (window.realtimeUnsubscribe) window.realtimeUnsubscribe();
  if (window.historyUnsubscribe) window.historyUnsubscribe();
});
