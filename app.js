// Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

// Config
const config = {
  apiKey: "AIzaSyD-eCZun9Chghk2z0rdPrEuIKkMojrM5g0",
  authDomain: "monitoring-ver-j.firebaseapp.com",
  databaseURL: "https://monitoring-ver-j-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monitoring-ver-j",
  storageBucket: "monitoring-ver-j.firebasestorage.app",
  messagingSenderId: "237639687534",
  appId: "1:237639687534:web:4e61c13e6537455c34757f"
};

// Initialize
let db;
try {
  const app = initializeApp(config);
  db = getDatabase(app);
  console.log("Firebase ready");
} catch (e) {
  console.error("Firebase failed:", e);
}

// DOM
const el = {
  realtime: { section: document.getElementById("section-realtime"), chart: null },
  recap: { section: document.getElementById("section-recap"), chart: null },
  status: document.getElementById("status-banner"),
  lastUpdate: document.getElementById("last-update"),
  live: document.getElementById("live-indicator"),
  
  cards: {
    wind: document.getElementById("card-wind"),
    rain: document.getElementById("card-rain"),
    lux: document.getElementById("card-lux"),
    time: document.getElementById("card-time")
  },
  kpi: {
    wind: document.getElementById("wind-potential"),
    solar: document.getElementById("solar-potential"),
    hydro: document.getElementById("hydro-potential")
  },
  progress: {
    wind: document.getElementById("wind-progress"),
    rain: document.getElementById("rain-progress"),
    lux: document.getElementById("lux-progress")
  },
  recapInfo: document.getElementById("rekap-info"),
  recapTable: document.getElementById("rekap-table"),
  downloadBtn: document.getElementById("download-btn")
};

// State
let currentAgg = "minute";
let historyData = [];
let realtimeData = [];
let charts = {};

// Init
document.addEventListener("DOMContentLoaded", () => {
  setupEvents();
  initCharts();
  startListeners();
  hideLoading();
});

function setupEvents() {
  // Tabs
  document.getElementById("tab-realtime").onclick = () => switchTab("realtime");
  document.getElementById("tab-recap").onclick = () => switchTab("recap");
  
  // Agg buttons
  document.querySelectorAll(".agg-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".agg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentAgg = btn.dataset.agg;
      updateRecapView();
    };
  });
  
  // Download
  el.downloadBtn.onclick = downloadCSV;
}

function switchTab(active) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
  
  if (active === "realtime") {
    el.realtime.section.classList.add("active");
    document.getElementById("tab-realtime").classList.add("active");
  } else {
    el.recap.section.classList.add("active");
    document.getElementById("tab-recap").classList.add("active");
  }
  
  if (charts.realtime && active === "realtime") charts.realtime.resize();
  if (charts.recap && active === "recap") charts.recap.resize();
}

function initCharts() {
  // Realtime chart
  const realtimeCtx = document.getElementById("chart-realtime").getContext("2d");
  charts.realtime = new Chart(realtimeCtx, {
    type: "line",
    data: { labels: [], datasets: [
      { label: "Angin", data: [], borderColor: "#10b981", fill: true },
      { label: "Hujan", data: [], borderColor: "#f59e0b", fill: true, yAxisID: "y1" },
      { label: "Cahaya", data: [], borderColor: "#d4af37", fill: true, yAxisID: "y2" }
    ]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.1)" } },
        y: { position: "left", grid: { color: "rgba(255,255,255,0.1)" } },
        y1: { position: "right", grid: { drawOnChartArea: false } },
        y2: { position: "right", grid: { drawOnChartArea: false } }
      },
      plugins: { legend: { labels: { color: "#f1f5f9" } } }
    }
  });

  // Recap chart
  const recapCtx = document.getElementById("chart-rekap").getContext("2d");
  charts.recap = new Chart(recapCtx, {
    type: "bar",
    data: { labels: [], datasets: [
      { label: "Angin", data: [], backgroundColor: "#10b981" },
      { label: "Hujan", data: [], backgroundColor: "#f59e0b" },
      { label: "Cahaya", data: [], backgroundColor: "#d4af37" }
    ]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { 
        x: { ticks: { color: "#f1f5f9" } },
        y: { ticks: { color: "#f1f5f9" }, grid: { color: "rgba(255,255,255,0.1)" } }
      },
      plugins: { legend: { labels: { color: "#f1f5f9" } } }
    }
  });
}

function startListeners() {
  // Realtime
  const realtimeRef = ref(db, "/weather/keadaan_sekarang");
  onValue(realtimeRef, snap => {
    const data = snap.val();
    if (!data) return;
    
    const time = data.waktu || new Date().toLocaleString();
    const wind = parseFloat(data.anemometer) || 0;
    const rain = parseFloat(data.rain_gauge) || 0;
    const lux = parseFloat(data.sensor_cahaya) || 0;
    
    updateRealtime(wind, rain, lux, time);
    addRealtimePoint(time, wind, rain, lux);
    
    el.lastUpdate.textContent = time;
    el.live.querySelector("span:last-child").textContent = "Live";
    
  }, error => {
    console.error("Realtime error:", error);
    el.status.innerHTML = "⛔ Error: " + error.message;
  });

  // History
  const historyRef = ref(db, "/weather/histori");
  onValue(historyRef, snap => {
    historyData = [];
    const data = snap.val();
    
    if (data) {
      Object.keys(data).forEach(key => {
        const row = data[key];
        if (row.waktu) {
          historyData.push({
            time: new Date(row.waktu),
            wind: parseFloat(row.anemometer) || 0,
            rain: parseFloat(row.rain_gauge) || 0,
            lux: parseFloat(row.sensor_cahaya) || 0
          });
        }
      });
    }
    
    updateRecapView();
  });
}

function updateRealtime(wind, rain, lux, time) {
  // Cards
  el.cards.wind.textContent = wind.toFixed(2);
  el.cards.rain.textContent = rain.toFixed(2);
  el.cards.lux.textContent = lux.toFixed(0);
  el.cards.time.textContent = time;
  
  // Progress
  el.progress.wind.style.width = Math.min(wind / 20 * 100, 100) + "%";
  el.progress.rain.style.width = Math.min(rain / 50 * 100, 100) + "%";
  el.progress.lux.style.width = Math.min(lux / 2000 * 100, 100) + "%";
  
  // KPI
  el.kpi.wind.textContent = (wind * 0.15).toFixed(1) + " kWh";
  el.kpi.solar.textContent = (lux / 1000 * 0.2).toFixed(1) + " kWh";
  el.kpi.hydro.textContent = (rain * 0.3).toFixed(1) + " kWh";
  
  el.status.innerHTML = '<span class="success">✅ Live</span> - Terakhir: ' + time;
}

function addRealtimePoint(time, wind, rain, lux) {
  if (!charts.realtime) return;
  
  charts.realtime.data.labels.push(time);
  charts.realtime.data.datasets[0].data.push(wind);
  charts.realtime.data.datasets[1].data.push(rain);
  charts.realtime.data.datasets[2].data.push(lux / 100);
  
  if (charts.realtime.data.labels.length > 24) {
    charts.realtime.data.labels.shift();
    charts.realtime.data.datasets.forEach(d => d.data.shift());
  }
  
  charts.realtime.update("none");
}

function updateRecapView() {
  const aggData = aggregateData(historyData, currentAgg);
  
  el.recapInfo.textContent = `Data: ${aggData.length} titik (${currentAgg})`;
  
  // Chart
  if (charts.recap) {
    charts.recap.data.labels = aggData.map(d => d.time.toLocaleString());
    charts.recap.data.datasets[0].data = aggData.map(d => d.wind);
    charts.recap.data.datasets[1].data = aggData.map(d => d.rain);
    charts.recap.data.datasets[2].data = aggData.map(d => d.lux);
    charts.recap.update();
  }
  
  // Table
  const tbody = el.recapTable;
  tbody.innerHTML = "";
  
  aggData.slice(-10).reverse().forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.time.toLocaleString()}</td>
      <td>${row.wind.toFixed(2)}</td>
      <td>${row.rain.toFixed(2)}</td>
      <td>${row.lux.toFixed(0)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function aggregateData(data, mode) {
  const map = new Map();
  
  data.forEach(item => {
    let key;
    const d = item.time;
    
    if (mode === "minute") {
      key = d.toISOString().slice(0, 16);
    } else if (mode === "hour") {
      key = d.toISOString().slice(0, 13);
    } else if (mode === "day") {
      key = d.toISOString().slice(0, 10);
    } else {
      key = d.toISOString().slice(0, 7);
    }
    
    if (!map.has(key)) {
      map.set(key, { time: new Date(key), wind: 0, rain: 0, lux: 0, count: 0 });
    }
    
    const bucket = map.get(key);
    bucket.wind += item.wind;
    bucket.rain += item.rain;
    bucket.lux += item.lux;
    bucket.count++;
  });
  
  return Array.from(map.values()).map(b => ({
    time: b.time,
    wind: b.wind / b.count,
    rain: b.rain / b.count,
    lux: b.lux / b.count
  })).sort((a, b) => a.time - b.time);
}

function downloadCSV() {
  const aggData = aggregateData(historyData, currentAgg);
  let csv = "Waktu,Angin,Hujan,Cahaya\n";
  
  aggData.forEach(row => {
    csv += `"${row.time.toLocaleString()}",${row.wind.toFixed(2)},${row.rain.toFixed(2)},${row.lux.toFixed(0)}\n`;
  });
  
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `data_${currentAgg}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function hideLoading() {
  document.getElementById("loading").style.display = "none";
}

// Init
setupEvents();
initCharts();
startListeners();

console.log("Dashboard loaded");
