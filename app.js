import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyD-eCZun9Chghk2z0rdPrEuIKkMojrM5g0",
  authDomain: "monitoring-ver-j.firebaseapp.com",
  databaseURL: "https://monitoring-ver-j-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monitoring-ver-j",
  storageBucket: "monitoring-ver-j.firebasestorage.app",
  messagingSenderId: "237639687534",
  appId: "1:237639687534:web:4e61c13e6537455c34757f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM Elements
const tabRealtime = document.getElementById("tab-realtime");
const tabRecap = document.getElementById("tab-recap");
const tabRealtimeMobile = document.getElementById("tab-realtime-mobile");
const tabRecapMobile = document.getElementById("tab-recap-mobile");
const sectionRealtime = document.getElementById("section-realtime");
const sectionRecap = document.getElementById("section-recap");
const statusBanner = document.getElementById("status-banner");
const lastUpdate = document.getElementById("last-update");

// Sensor Cards
const cardWind = document.getElementById("card-wind");
const cardRain = document.getElementById("card-rain");
const cardLux = document.getElementById("card-lux");
const cardTime = document.getElementById("card-time");

// KPI Cards
const windPotential = document.getElementById("wind-potential");
const solarPotential = document.getElementById("solar-potential");
const hydroPotential = document.getElementById("hydro-potential");

// Progress Bars
const windProgress = document.getElementById("wind-progress");
const rainProgress = document.getElementById("rain-progress");
const luxProgress = document.getElementById("lux-progress");

// Trend Indicators
const windTrend = document.getElementById("wind-trend");
const rainTrend = document.getElementById("rain-trend");
const luxTrend = document.getElementById("lux-trend");

// Rekap Elements
const subTabButtons = document.querySelectorAll(".tab-btn.sub");
const rekapInfo = document.getElementById("rekap-info");
const rekapTbody = document.getElementById("rekap-tbody");
const btnDownloadCSV = document.getElementById("btn-download-csv");
const btnDownloadPDF = document.getElementById("btn-download-pdf");
const btnScreenshot = document.getElementById("btn-screenshot");
const dateStart = document.getElementById("date-start");
const dateEnd = document.getElementById("date-end");
const applyDate = document.getElementById("apply-date");
const zoomIn = document.getElementById("zoom-in");
const zoomOut = document.getElementById("zoom-out");

// Loading Overlay
const loadingOverlay = document.getElementById("loading-overlay");

let currentAgg = "minute";
let realtimeChart;
let rekapChart;
let historiData = [];
let previousValues = { wind: 0, rain: 0, lux: 0 };
let chartZoom = 1;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  hideLoading();
  initCharts();
  setupEventListeners();
  updateDateRange();
  startDataListeners();
});

// Hide Loading Overlay
function hideLoading() {
  loadingOverlay.classList.add("hidden");
  setTimeout(() => loadingOverlay.style.display = "none", 300);
}

// Navigation
function setupEventListeners() {
  // Desktop Tabs
  tabRealtime.addEventListener("click", () => switchTab("realtime"));
  tabRecap.addEventListener("click", () => switchTab("recap"));
  
  // Mobile Tabs
  tabRealtimeMobile.addEventListener("click", () => switchTab("realtime"));
  tabRecapMobile.addEventListener("click", () => switchTab("recap"));
  
  // Sub Tabs
  subTabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      subTabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentAgg = btn.dataset.agg;
      updateRekapView();
    });
  });
  
  // Date Filter
  applyDate.addEventListener("click", filterByDate);
  
  // Chart Controls
  zoomIn.addEventListener("click", () => zoomChart(1.2));
  zoomOut.addEventListener("click", () => zoomChart(0.8));
  
  // Export Buttons
  btnDownloadCSV.addEventListener("click", () => downloadCSV());
  btnDownloadPDF.addEventListener("click", () => downloadPDF());
  btnScreenshot.addEventListener("click", takeScreenshot);
}

function switchTab(tab) {
  // Desktop
  tabRealtime.classList.toggle("active", tab === "realtime");
  tabRecap.classList.toggle("active", tab === "recap");
  sectionRealtime.classList.toggle("active", tab === "realtime");
  sectionRecap.classList.toggle("active", tab === "recap");
  
  // Mobile
  tabRealtimeMobile.classList.toggle("active", tab === "realtime");
  tabRecapMobile.classList.toggle("active", tab === "recap");
  
  if (tab === "realtime" && realtimeChart) {
    realtimeChart.resize();
  }
  
  if (tab === "recap" && rekapChart) {
    rekapChart.resize();
  }
}

// Firebase Listeners
function startDataListeners() {
  // Realtime Data
  const realtimeRef = ref(db, "/weather/keadaan_sekarang");
  onValue(realtimeRef, snap => {
    const val = snap.val();
    if (!val) return;
    
    const now = new Date();
    const timeStr = val.waktu || now.toLocaleString("id-ID");
    const wind = Number(val.anemometer || 0);
    const rain = Number(val.rain_gauge || 0);
    const lux = Number(val.sensor_cahaya || 0);
    
    updateRealtimeCards(wind, rain, lux, timeStr, now);
    updateKPICards(wind, rain, lux);
    pushRealtimeChart(timeStr, wind, rain, lux);
    
    updateLastUpdate(timeStr);
  });
  
  // Historical Data
  const histRef = ref(db, "/weather/histori");
  onValue(histRef, snap => {
    const val = snap.val();
    historiData = [];
    if (val) {
      Object.keys(val).forEach(k => {
        const row = val[k];
        if (!row || !row.waktu) return;
        
        const d = parseToDate(row.waktu);
        if (!d) return;
        
        historiData.push({
          time: d,
          timeStr: row.waktu,
          wind: Number(row.anemometer || 0),
          rain: Number(row.rain_gauge || 0),
          lux: Number(row.sensor_cahaya || 0)
        });
      });
      historiData.sort((a, b) => a.time - b.time);
    }
    updateRekapView();
  });
}

// Update Realtime Cards
function updateRealtimeCards(wind, rain, lux, timeStr, now) {
  // Wind Card
  cardWind.textContent = wind.toFixed(2);
  updateTrend(windTrend, wind, previousValues.wind, wind >= 15 ? "success" : "warning");
  updateProgress(windProgress, Math.min(wind / 25 * 100, 100), wind >= 15 ? "success" : "warning");
  
  // Rain Card
  cardRain.textContent = rain.toFixed(2);
  updateTrend(rainTrend, rain, previousValues.rain, rain >= 10 ? "success" : "default");
  updateProgress(rainProgress, Math.min(rain / 50 * 100, 100), rain >= 10 ? "warning" : "default");
  
  // Light Card
  cardLux.textContent = lux.toFixed(1);
  updateTrend(luxTrend, lux, previousValues.lux, lux >= 1000 ? "success" : "default");
  updateProgress(luxProgress, Math.min(lux / 5000 * 100, 100), lux >= 1000 ? "success" : "default");
  
  // Time Card
  cardTime.textContent = timeStr;
  
  // Update Previous Values
  previousValues = { wind, rain, lux };
  
  statusBanner.innerHTML = `
    <i class="fas fa-check-circle success-icon"></i>
    Data tersambung! Potensi energi optimal untuk ${getEnergyRecommendation(wind, rain, lux)}
  `;
}

// Update KPI Cards (Potensi Energi)
function updateKPICards(wind, rain, lux) {
  // Wind Potential (sederhana rumus)
  const windPotentialKwh = Math.max(0, (wind * 0.5) + (rain * 0.2) + (lux / 1000 * 0.3));
  windPotential.textContent = `${windPotentialKwh.toFixed(1)} kWh/hari`;
  
  // Solar Potential
  const solarPotentialKwh = (lux / 1000) * 0.15;
  solarPotential.textContent = `${solarPotentialKwh.toFixed(1)} kWh/hari`;
  
  // Hydro Potential
  const hydroPotentialKwh = rain * 0.3;
  hydroPotential.textContent = `${hydroPotentialKwh.toFixed(1)} kWh/hari`;
}

// Utility Functions
function updateTrend(element, current, previous, type) {
  if (previous === 0) {
    element.innerHTML = `<i class="fas fa-minus"></i> <span>—</span>`;
    return;
  }
  
  const change = ((current - previous) / previous * 100).toFixed(1);
  const icon = change >= 0 ? "fa-arrow-up" : "fa-arrow-down";
  const colorClass = change >= 0 ? "trend-up" : "trend-down";
  
  element.innerHTML = `
    <i class="fas ${icon} ${colorClass}"></i>
    <span class="${colorClass}">${change >= 0 ? '+' : ''}${change}%</span>
  `;
}

function updateProgress(element, percentage, type) {
  const color = type === "success" ? "#10b981" : type === "warning" ? "#f59e0b" : "#6b7280";
  element.style.width = `${percentage}%`;
  element.style.background = `linear-gradient(90deg, ${color}, ${color}80)`;
}

function getEnergyRecommendation(wind, rain, lux) {
  if (wind >= 15 && lux >= 1000) {
    return "angin & surya optimal";
  } else if (rain >= 10) {
    return "hidro potensial";
  } else if (wind >= 8 || lux >= 500) {
    return "kondisi sedang";
  } else {
    return "tunggu kondisi optimal";
  }
}

function updateLastUpdate(timeStr) {
  lastUpdate.textContent = timeStr;
}

// Date Range
function updateDateRange() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  dateStart.value = yesterday.toISOString().split('T')[0];
  dateEnd.value = today.toISOString().split('T')[0];
}

function filterByDate() {
  const start = new Date(dateStart.value);
  const end = new Date(dateEnd.value);
  
  const filtered = historiData.filter(item => 
    item.time >= start && item.time <= end
  );
  
  // Update rekap dengan data filtered
  updateRekapView(filtered);
}

// Chart Functions
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
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true
        },
        {
          label: "Hujan (mm)",
          data: [],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          yAxisID: "y-rain"
        },
        {
          label: "Cahaya (lux/100)",
          data: [],
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          yAxisID: "y-lux"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          labels: {
            color: var(--text),
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 24, 113, 0.95)',
          titleColor: var(--text),
          bodyColor: var(--text),
          borderColor: var(--accent),
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            title: function(context) {
              return `Waktu: ${context[0].label}`;
            },
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.datasetIndex === 1) {
                label += context.parsed.y.toFixed(2) + ' mm';
              } else if (context.datasetIndex === 2) {
                label += (context.parsed.y * 100).toFixed(0) + ' lux';
              } else {
                label += context.parsed.y.toFixed(2) + ' km/h';
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: var(--text-muted),
            maxRotation: 45,
            font: { size: 11 }
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: var(--text-muted),
            callback: value => value.toFixed(1)
          }
        },
        'y-rain': {
          type: 'linear',
          display: false,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { 
            color: '#f59e0b',
            callback: value => value.toFixed(1)
          },
          max: 50
        },
        'y-lux': {
          type: 'linear',
          display: false,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { 
            color: '#3b82f6',
            callback: value => (value * 100).toFixed(0)
          },
          max: 50
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
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
          label: "Potensi Angin (kWh)",
          data: [],
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          borderWidth: 3,
          fill: true
        },
        {
          label: "Potensi Hidro (kWh)",
          data: [],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          tension: 0.4,
          borderWidth: 3,
          fill: true
        },
        {
          label: "Potensi Surya (kWh)",
          data: [],
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
          borderWidth: 3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: var(--text),
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 24, 113, 0.95)',
          titleColor: var(--text),
          bodyColor: var(--text),
          borderColor: var(--accent),
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} kWh`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: var(--text-muted) }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: var(--text-muted) }
        }
      },
      animation: {
        duration: 1200,
        easing: 'easeInOutQuart'
      }
    }
  });
}

function pushRealtimeChart(label, wind, rain, lux) {
  if (!realtimeChart) return;
  
  const maxPoints = 24;
  const windData = wind;
  const rainData = rain;
  const luxData = lux / 100; // Scale untuk chart
  
  realtimeChart.data.labels.push(label);
  realtimeChart.data.datasets[0].data.push(windData);
  realtimeChart.data.datasets[1].data.push(rainData);
  realtimeChart.data.datasets[2].data.push(luxData);
  
  // Maintain 24 points
  if (realtimeChart.data.labels.length > maxPoints) {
    realtimeChart.data.labels.shift();
    realtimeChart.data.datasets.forEach(ds => ds.data.shift());
  }
  
  realtimeChart.update('active', { duration: 500 });
}

function updateRekapView(filteredData = historiData) {
  if (!rekapInfo || !rekapTbody) return;
  
  if (!filteredData.length) {
    rekapInfo.innerHTML = 'Belum ada data histori. <i class="fas fa-info-circle"></i>';
    rekapTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">Tidak ada data untuk periode ini</td></tr>';
    if (rekapChart) rekapChart.destroy();
    return;
  }
  
  const { buckets, labelName } = aggregateData(filteredData, currentAgg);
  rekapInfo.innerHTML = `
    <i class="fas fa-chart-line"></i>
    Mode: ${labelName} | Total ${buckets.length} data point
  `;
  
  // Update Table
  rekapTbody.innerHTML = "";
  buckets.slice(-20).reverse().forEach((row, index) => {
    const potential = calculatePotential(row.wind, row.rain, row.lux);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><i class="fas fa-clock"></i> ${row.label}</td>
      <td><span class="data-badge wind">${row.wind.toFixed(2)}</span></td>
      <td><span class="data-badge rain">${row.rain.toFixed(2)}</span></td>
      <td><span class="data-badge light">${row.lux.toFixed(1)}</span></td>
      <td><span class="data-badge energy">${potential.toFixed(2)} kWh</span></td>
    `;
    rekapTbody.appendChild(tr);
  });
  
  // Update Chart
  const labels = buckets.map(b => b.label).slice(-20);
  const windData = buckets.map(b => calculateWindPotential(b.wind)).slice(-20);
  const hydroData = buckets.map(b => calculateHydroPotential(b.rain)).slice(-20);
  const solarData = buckets.map(b => calculateSolarPotential(b.lux)).slice(-20);
  
  if (rekapChart) rekapChart.destroy();
  const canvas = document.getElementById("chart-rekap");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const type = currentAgg === "month" ? "bar" : "line";
  
  rekapChart = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [
        {
          label: "Potensi Angin (kWh)",
          data: windData,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          tension: 0.4,
          borderWidth: 3,
          fill: type === "line"
        },
        {
          label: "Potensi Hidro (kWh)",
          data: hydroData,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.2)",
          tension: 0.4,
          borderWidth: 3,
          fill: type === "line"
        },
        {
          label: "Potensi Surya (kWh)",
          data: solarData,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          tension: 0.4,
          borderWidth: 3,
          fill: type === "line"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: var(--text), padding: 20 }
        }
      },
      scales: {
        x: { 
          ticks: { color: var(--text-muted), maxRotation: 45 } 
        },
        y: {
          ticks: { color: var(--text-muted) },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      }
    }
  });
}

// Aggregation & Calculation
function aggregateData(data, mode) {
  const map = new Map();
  
  data.forEach(item => {
    const d = item.time;
    let key, label;
    
    if (mode === "minute") {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      label = key;
    } else if (mode === "hour") {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:00`;
      label = key;
    } else if (mode === "day") {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      label = key;
    } else {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      label = key;
    }
    
    if (!map.has(key)) {
      map.set(key, { label, count: 0, windSum: 0, rainSum: 0, luxSum: 0 });
    }
    
    const bucket = map.get(key);
    bucket.count++;
    bucket.windSum += item.wind;
    bucket.rainSum += item.rain;
    bucket.luxSum += item.lux;
  });
  
  const buckets = Array.from(map.values()).map(b => ({
    label: b.label,
    wind: b.windSum / b.count,
    rain: b.rainSum / b.count,
    lux: b.luxSum / b.count
  }));
  
  buckets.sort((a, b) => new Date(a.label) - new Date(b.label));
  
  let labelName = mode.charAt(0).toUpperCase() + mode.slice(1);
  return { buckets, labelName };
}

function calculatePotential(wind, rain, lux) {
  return calculateWindPotential(wind) + calculateHydroPotential(rain) + calculateSolarPotential(lux);
}

function calculateWindPotential(wind) {
  return Math.max(0, wind * 0.15); // Simplified formula
}

function calculateHydroPotential(rain) {
  return Math.max(0, rain * 0.25);
}

function calculateSolarPotential(lux) {
  return Math.max(0, (lux / 1000) * 0.2);
}

function pad2(n) {
  return n.toString().padStart(2, "0");
}

function parseToDate(str) {
  const [datePart, timePart] = str.split(" ");
  if (!datePart || !timePart) return null;
  
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  
  return new Date(year, month - 1, day, hour, minute, second);
}

// Zoom Chart (Simple Implementation)
function zoomChart(factor) {
  chartZoom *= factor;
  chartZoom = Math.max(0.5, Math.min(chartZoom, 3));
  
  if (realtimeChart) {
    realtimeChart.options.scales.x.min = chartZoom > 1 ? 0 : undefined;
    realtimeChart.options.scales.x.max = chartZoom > 1 ? 24 * (1/chartZoom) : undefined;
    realtimeChart.update();
  }
  
  if (rekapChart) {
    rekapChart.options.scales.x.min = chartZoom > 1 ? 0 : undefined;
    rekapChart.options.scales.x.max = chartZoom > 1 ? buckets.length * (1/chartZoom) : undefined;
    rekapChart.update();
  }
}

// Export Functions
function downloadCSV() {
  if (!historiData.length) return alert("Tidak ada data untuk diekspor");
  
  const { buckets } = aggregateData(historiData, currentAgg);
  let csv = "Waktu,Angin(km/h),Hujan(mm),Cahaya(lux),Potensi(kWh)\n";
  
  buckets.forEach(b => {
    const potential = calculatePotential(b.wind, b.rain, b.lux);
    csv += `"${b.label}",${b.wind.toFixed(2)},${b.rain.toFixed(2)},${b.lux.toFixed(1)},${potential.toFixed(2)}\n`;
  });
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `energi_terbarukan_rekap_${currentAgg}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Feedback
  showToast("CSV berhasil diunduh!");
}

function downloadPDF() {
  // Simplified PDF - menggunakan html2canvas + jsPDF
  showToast("Fitur PDF dalam pengembangan. Gunakan screenshot untuk sekarang.");
  takeScreenshot();
}

function takeScreenshot() {
  // Gunakan html2canvas untuk screenshot
  if (typeof html2canvas === 'undefined') {
    showToast("Screenshot berhasil! (Manual Ctrl+P)");
    window.print();
    return;
  }
  
  html2canvas(document.querySelector(".container")).then(canvas => {
    const link = document.createElement("a");
    link.download = `dashboard_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL();
    link.click();
    showToast("Screenshot berhasil diunduh!");
  });
}

// Toast Notification
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="fas fa-check"></i> ${message}`;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--success);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    z-index: 10000;
    animation: slideInRight 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// CSS Animations (Inline untuk toast)
const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  .toast i { margin-right: 8px; }
`;
document.head.appendChild(style);

// Filter by Date
function filterByDate() {
  const start = new Date(dateStart.value + "T00:00:00");
  const end = new Date(dateEnd.value + "T23:59:59");
  
  const filtered = historiData.filter(item => 
    item.time >= start && item.time <= end
  );
  
  updateRekapView(filtered);
}
