// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

// Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD-eCZun9Chghk2z0rdPrEuIKkMojrM5g0",
  authDomain: "monitoring-ver-j.firebaseapp.com",
  databaseURL: "https://monitoring-ver-j-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monitoring-ver-j",
  storageBucket: "monitoring-ver-j.firebasestorage.app",
  messagingSenderId: "237639687534",
  appId: "1:237639687534:web:4e61c13e6537455c34757f"
};

// Initialize
let app, db;
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  console.log("✅ Firebase initialized");
} catch (error) {
  console.error("❌ Firebase error:", error);
  showError("Gagal memuat Firebase");
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
let currentAgg = "minute"; // Default: Per Menit
let realtimeChart;
let rekapChart;
let historiData = [];
let previousValues = { wind: 0, rain: 0, lux: 0 };
let isConnected = false;

// Initialize
document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  console.log("🚀 Initializing Energy Dashboard...");
  
  if (!db) {
    showError("Firebase tidak tersedia");
    return;
  }
  
  setupUI();
  startDataListeners();
  
  // Hide loading after 2 seconds max
  setTimeout(() => {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.classList.add("hidden");
    }
  }, 2000);
}

// UI Setup
function setupUI() {
  // Tab switching
  if (elements.tabRealtime) elements.tabRealtime.addEventListener("click", () => switchTab("realtime"));
  if (elements.tabRecap) elements.tabRecap.addEventListener("click", () => switchTab("recap"));
  
  // Sub tabs - DENGAN PER MENIT
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
  
  initCharts();
}

// Realtime Data Listener
function startDataListeners() {
  // Realtime
  const realtimeRef = ref(db, "/weather/keadaan_sekarang");
  onValue(realtimeRef, (snap) => {
    console.log("📡 Realtime data:", snap.val());
    
    const val = snap.val();
    if (!val) return;
    
    const timeStr = val.waktu || new Date().toLocaleString("id-ID");
    const wind = Number(val.anemometer || 0);
    const rain = Number(val.rain_gauge || 0);
    const lux = Number(val.sensor_cahaya || 0);
    
    updateRealtimeCards(wind, rain, lux, timeStr);
    updateKPI(wind, rain, lux);
    pushRealtimeChart(timeStr, wind, rain, lux);
    
    isConnected = true;
    updateStatus(`Live - Update: ${timeStr}`, "success");
    
  }, (error) => {
    console.error("❌ Realtime error:", error);
    updateStatus(`Error koneksi: ${error.message}`, "error");
    isConnected = false;
  });
  
  // History
  const histRef = ref(db, "/weather/histori");
  onValue(histRef, (snap) => {
    console.log("📚 History loaded:", snap.val());
    
    historiData = [];
    const val = snap.val();
    
    if (val) {
      Object.keys(val).forEach(key => {
        const row = val[key];
        if (row && row.waktu) {
          const date = parseToDate(row.waktu);
          if (date) {
            historiData.push({
              time: date,
              timeStr: row.waktu,
              wind: Number(row.anemometer || 0),
              rain: Number(row.rain_gauge || 0),
              lux: Number(row.sensor_cahaya || 0)
            });
          }
        }
      });
      historiData.sort((a, b) => a.time - b.time);
    }
    
    updateRekapView();
  });
}

// Update Realtime Cards
function updateRealtimeCards(wind, rain, lux, timeStr) {
  // Update cards
  if (elements.cardWind) elements.cardWind.textContent = wind.toFixed(2);
  if (elements.cardRain) elements.cardRain.textContent = rain.toFixed(2);
  if (elements.cardLux) elements.cardLux.textContent = lux.toFixed(0);
  if (elements.cardTime) elements.cardTime.textContent = timeStr;
  
  // Update trends
  updateTrend(elements.windTrend, wind, previousValues.wind);
  updateTrend(elements.rainTrend, rain, previousValues.rain);
  updateTrend(elements.luxTrend, lux, previousValues.lux);
  
  // Update progress
  updateProgress(elements.windProgress, Math.min(wind / 20 * 100, 100), wind >= 15);
  updateProgress(elements.rainProgress, Math.min(rain / 50 * 100, 100), rain >= 10);
  updateProgress(elements.luxProgress, Math.min(lux / 2000 * 100, 100), lux >= 1000);
  
  previousValues = { wind, rain, lux };
  
  // Update live indicator
  updateLiveIndicator(true);
}

// Update KPI
function updateKPI(wind, rain, lux) {
  const windKwh = (wind * 0.15).toFixed(1);
  const solarKwh = (lux / 1000 * 0.2).toFixed(1);
  const hydroKwh = (rain * 0.3).toFixed(1);
  
  if (elements.windPotential) elements.windPotential.textContent = windKwh + " kWh/hari";
  if (elements.solarPotential) elements.solarPotential.textContent = solarKwh + " kWh/hari";
  if (elements.hydroPotential) elements.hydroPotential.textContent = hydroKwh + " kWh/hari";
}

// Status Update
function updateStatus(message, type = "info") {
  if (!elements.statusBanner) return;
  
  const icons = {
    success: "✅",
    error: "❌", 
    warning: "⚠️"
  };
  
  const icon = icons[type] || "⏳";
  elements.statusBanner.innerHTML = `<span class="status-icon">${icon}</span> ${message}`;
  
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b"
  };
  
  elements.statusBanner.style.background = colors[type] || "#3b82f6";
}

// Live Indicator
function updateLiveIndicator(connected) {
  if (!elements.liveIndicator) return;
  
  const span = elements.liveIndicator.querySelector("span:last-child");
  if (span) span.textContent = connected ? "Live" : "Offline";
  
  const indicator = elements.liveIndicator;
  indicator.style.background = connected ? "#10b981" : "#ef4444";
  indicator.style.color = connected ? "white" : "#ef4444";
}

// Trend Update
function updateTrend(trendEl, current, previous) {
  if (!trendEl || previous === 0) {
    trendEl.textContent = "—";
    return;
  }
  
  const change = ((current - previous) / previous * 100).toFixed(1);
  const isPositive = change >= 0;
  
  trendEl.className = "trend " + (isPositive ? "positive" : "negative");
  trendEl.innerHTML = (isPositive ? "↗️" : "↘️") + " " + (isPositive ? '+' : '') + change + "%";
}

// Progress Bar
function updateProgress(progressEl, percentage, isOptimal) {
  if (!progressEl) return;
  
  progressEl.style.width = Math.min(percentage, 100) + "%";
  
  const colors = isOptimal ? "#10b981" : "#f59e0b";
  progressEl.style.background = `linear-gradient(90deg, ${colors}, ${colors}80)`;
}

// Switch Tab
function switchTab(tab) {
  // Desktop (jika ada)
  const tabRealtime = document.getElementById("tab-realtime-mobile");
  const tabRecap = document.getElementById("tab-recap-mobile");
  
  if (tabRealtime) tabRealtime.classList.toggle("active", tab === "realtime");
  if (tabRecap) tabRecap.classList.toggle("active", tab === "recap");
  
  // Sections
  if (elements.sectionRealtime) elements.sectionRealtime.classList.toggle("active", tab === "realtime");
  if (elements.sectionRecap) elements.sectionRecap.classList.toggle("active", tab === "recap");
  
  // Resize charts
  if (tab === "realtime" && realtimeChart) {
    setTimeout(() => realtimeChart.resize(), 100);
  }
  if (tab === "recap" && rekapChart) {
    setTimeout(() => rekapChart.resize(), 100);
  }
}

// Chart Initialization
function initCharts() {
  initRealtimeChart();
  initRekapChart();
}

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
          borderWidth: 3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: "Hujan (mm)",
          data: [],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          tension: 0.4,
          borderWidth: 3,
          fill: true,
          yAxisID: "y-rain"
        },
        {
          label: "Cahaya (lux/100)",
          data: [],
          borderColor: "#d4af37",
          backgroundColor: "rgba(212, 175, 55, 0.1)",
          tension: 0.4,
          borderWidth: 3,
          fill: true,
          yAxisID: "y-lux"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: "#e5e7eb", maxRotation: 45 },
          grid: { color: "rgba(255,255,255,0.1)" }
        },
        y: {
          ticks: { color: "#e5e7eb" },
          grid: { color: "rgba(255,255,255,0.1)" }
        },
        "y-rain": {
          type: "linear",
          display: false,
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#f59e0b" }
        },
        "y-lux": {
          type: "linear",
          display: false,
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#d4af37" }
        }
      },
      plugins: {
        legend: {
          labels: { 
            color: "#e5e7eb",
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleColor: "#e5e7eb",
          bodyColor: "#e5e7eb",
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

function initRekapChart() {
  const canvas = document.getElementById("chart-rekap");
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  
  rekapChart = new Chart(ctx, {
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
          fill: true
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
          label: "Cahaya (lux)",
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
          ticks: { color: "#e5e7eb", maxRotation: 45 },
          grid: { color: "rgba(255,255,255,0.1)" }
        },
        y: {
          ticks: { color: "#e5e7eb" },
          grid: { color: "rgba(255
