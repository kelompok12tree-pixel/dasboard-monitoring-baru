// Firebase SDK - Fixed Import Issue
const { initializeApp } = window.firebase || { initializeApp: null };
const { getDatabase, ref, onValue } = window.firebase?.database || { getDatabase: null, ref: null, onValue: null };

// Wait for Firebase to load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 App starting...');
  
  // Wait for Firebase SDK
  const firebaseCheck = setInterval(() => {
    if (window.firebase && window.firebase.database) {
      clearInterval(firebaseCheck);
      initFirebase();
    }
  }, 100);
});

function initFirebase() {
  console.log('🔗 Initializing Firebase...');
  
  const config = {
    apiKey: "AIzaSyD-eCZun9Chghk2z0rdPrEuIKkMojrM5g0",
    authDomain: "monitoring-ver-j.firebaseapp.com",
    databaseURL: "https://monitoring-ver-j-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "monitoring-ver-j",
    storageBucket: "monitoring-ver-j.firebasestorage.app",
    messagingSenderId: "237639687534",
    appId: "1:237639687534:web:4e61c13e6537455c34757f"
  };
  
  try {
    const app = initializeApp(config);
    const db = getDatabase(app);
    
    console.log('✅ Firebase connected');
    setupDashboard(db);
    
  } catch (error) {
    console.error('❌ Firebase error:', error);
    showError('Koneksi Firebase gagal');
  }
}

// Setup Dashboard
function setupDashboard(db) {
  // DOM Elements
  const dom = {
    loading: document.getElementById('loading-overlay'),
    status: document.getElementById('status-banner'),
    live: document.getElementById('live-indicator'),
    lastUpdate: document.getElementById('last-update'),
    
    // Realtime
    wind: document.getElementById('card-wind'),
    rain: document.getElementById('card-rain'),
    lux: document.getElementById('card-lux'),
    time: document.getElementById('card-time'),
    
    // KPI
    windKpi: document.getElementById('wind-potential'),
    solarKpi: document.getElementById('solar-potential'),
    hydroKpi: document.getElementById('hydro-potential'),
    
    // Progress
    windProgress: document.getElementById('wind-progress'),
    rainProgress: document.getElementById('rain-progress'),
    luxProgress: document.getElementById('lux-progress'),
    
    // Trends
    windTrend: document.getElementById('wind-trend'),
    rainTrend: document.getElementById('rain-trend'),
    luxTrend: document.getElementById('lux-trend'),
    
    // Tabs
    realtimeTab: document.getElementById('tab-realtime-mobile'),
    recapTab: document.getElementById('tab-recap-mobile'),
    realtimeSection: document.getElementById('section-realtime'),
    recapSection: document.getElementById('section-recap'),
    
    // Rekap
    recapInfo: document.getElementById('rekap-info'),
    recapTbody: document.getElementById('rekap-tbody'),
    subTabs: document.querySelectorAll('.tab-btn.sub'),
    downloadBtn: document.getElementById('btn-download'),
    
    // Charts
    realtimeChart: null,
    recapChart: null
  };
  
  // State
  let currentAgg = 'minute';
  let historyData = [];
  let previousValues = { wind: 0, rain: 0, lux: 0 };
  let isConnected = false;
  
  // UI Setup
  if (dom.realtimeTab) dom.realtimeTab.addEventListener('click', () => switchTab('realtime'));
  if (dom.recapTab) dom.recapTab.addEventListener('click', () => switchTab('recap'));
  
  dom.subTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.subTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentAgg = tab.dataset.agg;
      updateRecapView();
    });
  });
  
  if (dom.downloadBtn) dom.downloadBtn.addEventListener('click', downloadCSV);
  
  // Charts
  initCharts();
  
  // Data listeners
  startRealtimeListener(db);
  startHistoryListener(db);
  
  // Hide loading
  setTimeout(() => {
    if (dom.loading) dom.loading.classList.add('hidden');
  }, 2000);
  
  function switchTab(tab) {
    dom.realtimeTab?.classList.toggle('active', tab === 'realtime');
    dom.recapTab?.classList.toggle('active', tab === 'recap');
    
    dom.realtimeSection?.classList.toggle('active', tab === 'realtime');
    dom.recapSection?.classList.toggle('active', tab === 'recap');
    
    if (tab === 'realtime' && dom.realtimeChart) {
      setTimeout(() => dom.realtimeChart.resize(), 100);
    }
    if (tab === 'recap' && dom.recapChart) {
      setTimeout(() => dom.recapChart.resize(), 100);
    }
  }
  
  function startRealtimeListener(db) {
    const realtimeRef = ref(db, '/weather/keadaan_sekarang');
    
    onValue(realtimeRef, (snap) => {
      const val = snap.val();
      console.log('📡 Realtime data:', val);
      
      if (!val) return;
      
      const timeStr = val.waktu || new Date().toLocaleString('id-ID');
      const wind = Number(val.anemometer || 0);
      const rain = Number(val.rain_gauge || 0);
      const lux = Number(val.sensor_cahaya || 0);
      
      updateRealtimeCards(wind, rain, lux, timeStr);
      updateKPI(wind, rain, lux);
      
      if (dom.realtimeChart) {
        pushRealtimeData(timeStr, wind, rain, lux);
      }
      
      isConnected = true;
      updateStatus('✅ Tersambung - Terakhir: ' + timeStr, 'success');
      
    }, (error) => {
      console.error('❌ Realtime error:', error);
      updateStatus('❌ Koneksi error: ' + error.message, 'error');
      isConnected = false;
      updateLiveIndicator(false);
    });
  }
  
  function startHistoryListener(db) {
    const historyRef = ref(db, '/weather/histori');
    
    onValue(historyRef, (snap) => {
      console.log('📚 History data loaded');
      
      historyData = [];
      const val = snap.val();
      
      if (val) {
        Object.keys(val).forEach(key => {
          const row = val[key];
          if (row && row.waktu) {
            const date = parseToDate(row.waktu);
            if (date) {
              historyData.push({
                time: date,
                timeStr: row.waktu,
                wind: Number(row.anemometer || 0),
                rain: Number(row.rain_gauge || 0),
                lux: Number(row.sensor_cahaya || 0)
              });
            }
          }
        });
        historyData.sort((a, b) => a.time - b.time);
      }
      
      updateRecapView();
    });
  }
  
  function updateRealtimeCards(wind, rain, lux, timeStr) {
    // Cards
    if (dom.wind) dom.wind.textContent = wind.toFixed(2);
    if (dom.rain) dom.rain.textContent = rain.toFixed(2);
    if (dom.lux) dom.lux.textContent = lux.toFixed(0);
    if (dom.time) dom.time.textContent = timeStr;
    
    // Trends
    updateTrend(dom.windTrend, wind, previousValues.wind);
    updateTrend(dom.rainTrend, rain, previousValues.rain);
    updateTrend(dom.luxTrend, lux, previousValues.lux);
    
    // Progress bars
    if (dom.windProgress) dom.windProgress.style.width = Math.min(wind / 20 * 100, 100) + '%';
    if (dom.rainProgress) dom.rainProgress.style.width = Math.min(rain / 50 * 100, 100) + '%';
    if (dom.luxProgress) dom.luxProgress.style.width = Math.min(lux / 2000 * 100, 100) + '%';
    
    previousValues = { wind, rain, lux };
    
    updateLiveIndicator(true);
  }
  
  function updateKPI(wind, rain, lux) {
    const windKwh = Math.max(0, wind * 0.15).toFixed(1);
    const solarKwh = Math.max(0, (lux / 1000) * 0.2).toFixed(1);
    const hydroKwh = Math.max(0, rain * 0.3).toFixed(1);
    
    if (dom.windKpi) dom.windKpi.textContent = windKwh + ' kWh/hari';
    if (dom.solarKpi) dom.solarKpi.textContent = solarKwh + ' kWh/hari';
    if (dom.hydroKpi) dom.hydroKpi.textContent = hydroKwh + ' kWh/hari';
  }
  
  function updateTrend(trendEl, current, previous) {
    if (!trendEl || previous === 0) {
      trendEl.textContent = '—';
      return;
    }
    
    const change = ((current - previous) / previous * 100).toFixed(1);
    const isUp = change >= 0;
    const symbol = isUp ? '↗️' : '↘️';
    
    trendEl.className = 'trend-indicator';
    trendEl.style.color = isUp ? '#10b981' : '#ef4444';
    trendEl.innerHTML = `${symbol} ${isUp ? '+' : ''}${change}%`;
  }
  
  function updateStatus(message, type = 'info') {
    if (!dom.status) return;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: '⏳'
    };
    
    const icon = icons[type] || icons.info;
    dom.status.innerHTML = `<span class="status-icon">${icon}</span> ${message}`;
    
    const colors = {
      success: 'var(--accent-soft)',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    
    dom.status.style.background = colors[type] || colors.info;
  }
  
  function updateLiveIndicator(connected) {
    if (!dom.live) return;
    
    const text = connected ? 'Live' : 'Offline';
    const color = connected ? 'var(--accent)' : '#ef4444';
    
    dom.live.style.background = color;
    dom.live.querySelector('span:last-child').textContent = text;
  }
  
  function updateRecapView() {
    if (!dom.recapInfo || !dom.recapTbody) return;
    
    if (!historyData.length) {
      dom.recapInfo.textContent = 'Belum ada data historis';
      dom.recapTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);">Tidak ada data</td></tr>';
      return;
    }
    
    const aggregated = aggregateData(historyData, currentAgg);
    
    dom.recapInfo.textContent = `Data: ${aggregated.length} titik (${currentAgg})`;
    
    // Update table
    dom.recapTbody.innerHTML = '';
    aggregated.slice(-10).reverse().forEach(row => {
      const potential = calculatePotential(row.wind, row.rain, row.lux);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.timeStr}</td>
        <td>${row.wind.toFixed(2)}</td>
        <td>${row.rain.toFixed(2)}</td>
        <td>${row.lux.toFixed(0)}</td>
        <td>${potential.toFixed(2)}</td>
      `;
      dom.recapTbody.appendChild(tr);
    });
    
    // Update chart
    if (dom.recapChart) {
      updateRecapChart(aggregated);
    }
  }
  
  function aggregateData(data, mode) {
    const map = new Map();
    
    data.forEach(item => {
      let key;
      const d = item.time;
      
      switch (mode) {
        case 'minute':
          key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
          break;
        case 'hour':
          key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:00`;
          break;
        case 'day':
          key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
          break;
        case 'month':
          key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
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
    
    return Array.from(map.values()).map(b => ({
      timeStr: b.timeStr,
      wind: b.wind / b.count,
      rain: b.rain / b.count,
      lux: b.lux / b.count
    })).sort((a, b) => new Date(a.timeStr) - new Date(b.timeStr));
  }
  
  function calculatePotential(wind, rain, lux) {
    return (wind * 0.15 + rain * 0.3 + (lux / 1000 * 0.2)).toFixed(2);
  }
  
  function updateRecapChart(data) {
    if (!data.length || !dom.recapChart) return;
    
    const labels = data.map(d => d.timeStr).slice(-20);
    const windData = data.map(d => d.wind).slice(-20);
    const rainData = data.map(d => d.rain).slice(-20);
    const luxData = data.map(d => d.lux).slice(-20);
    
    dom.recapChart.data.labels = labels;
    dom.recapChart.data.datasets[0].data = windData;
    dom.recapChart.data.datasets[1].data = rainData;
    dom.recapChart.data.datasets[2].data = luxData;
    dom.recapChart.update('active', { duration: 500 });
  }
  
  function initCharts() {
    // Realtime Chart
    const realtimeCanvas = document.getElementById('chart-realtime');
    if (realtimeCanvas) {
      const ctx = realtimeCanvas.getContext('2d');
      
      dom.realtimeChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Angin (km/h)',
              data: [],
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4,
              borderWidth: 3,
              fill: true,
              pointRadius: 4
            },
            {
              label: 'Hujan (mm)',
              data: [],
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              tension: 0.4,
              borderWidth: 3,
              fill: true,
              yAxisID: 'y1'
            },
            {
              label: 'Cahaya (lux/100)',
              data: [],
              borderColor: '#d4af37',
              backgroundColor: 'rgba(212, 175, 55, 0.1)',
              tension: 0.4,
              borderWidth: 3,
              fill: true,
              yAxisID: 'y2'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: { color: '#e5e7eb', maxRotation: 45 },
              grid: { color: 'rgba(255,255,255,0.1)' }
            },
            y: {
              ticks: { color: '#e5e7eb' },
              grid: { color: 'rgba(255,255,255,0.1)' }
            },
            y1: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#f59e0b' }
            },
            y2: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#d4af37' }
            }
          },
          plugins: {
            legend: {
              labels: { 
                color: '#e5e7eb',
                padding: 20,
                usePointStyle: true 
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              titleColor: '#e5e7eb',
              bodyColor: '#e5e7eb',
              borderColor: '#10b981',
              cornerRadius: 8
            }
          },
          animation: {
            duration: 800,
            easing: 'easeOutQuart'
          }
        }
      });
    }
    
    // Rekap Chart
    const recapCanvas = document.getElementById('chart-rekap');
    if (recapCanvas) {
      const ctx = recapCanvas.getContext('2d');
      
      dom.recapChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Angin (km/h)',
              data: [],
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129
