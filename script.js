/**
 * ============================================================================
 * SMART TEMPERATURE ANALYZER & CONVERTER WITH INTELLIGENT ALERTS
 * Complete Interactive Controller (Step 2 Audit Implementation)
 * ============================================================================
 */

(function () {
  'use strict';

  // --- Thermodynamic Constants ---
  const ABSOLUTE_ZERO = {
    C: -273.15,
    F: -459.67,
    K: 0.0,
    R: 0.0
  };

  const UNIT_META = {
    C: { code: 0, symbol: '°C', name: 'Celsius', minLabel: '-273.15 °C' },
    F: { code: 1, symbol: '°F', name: 'Fahrenheit', minLabel: '-459.67 °F' },
    K: { code: 2, symbol: 'K', name: 'Kelvin', minLabel: '0.00 K' },
    R: { code: 3, symbol: '°R', name: 'Rankine', minLabel: '0.00 °R' }
  };

  const RAPID_CHANGE_LIMIT_C = 8.0;

  // --- 6-Tier Intelligent Alert Configuration ---
  const ALERT_TIERS = {
    Freezing: {
      code: 0,
      category: 'Freezing',
      cssClass: 'Freezing',
      badge: 'CRYOGENIC / FREEZING',
      message: 'Very cold temperature detected (<= 0°C). Sub-zero freezing condition.',
      recommendation: 'Insulate pipes & equipment; monitor for frost and ice formation.',
      color: '#38bdf8',
      mercuryTop: '#7dd3fc',
      mercuryBottom: '#0284c7',
      displayTheme: 'low',
      displayThemeDesc: 'Low Temp (Blue Display)',
      segId: 'segFreezing'
    },
    Cold: {
      code: 1,
      category: 'Cold',
      cssClass: 'Cold',
      badge: 'LOW TEMPERATURE',
      message: 'Low temperature detected (0°C to 15°C). Cool thermal environment.',
      recommendation: 'Maintain thermal regulation; suitable for cold-storage monitoring.',
      color: '#3b82f6',
      mercuryTop: '#60a5fa',
      mercuryBottom: '#2563eb',
      displayTheme: 'low',
      displayThemeDesc: 'Low Temp (Blue Display)',
      segId: 'segCold'
    },
    Comfortable: {
      code: 2,
      category: 'Comfortable',
      cssClass: 'Comfortable',
      badge: 'OPTIMAL / NORMAL',
      message: 'Temperature is in the comfortable normal range (15°C to 25°C).',
      recommendation: 'No corrective action required; ideal ambient operating conditions.',
      color: '#10b981',
      mercuryTop: '#34d399',
      mercuryBottom: '#059669',
      displayTheme: 'medium',
      displayThemeDesc: 'Medium Temp (Mild Display)',
      segId: 'segComfortable'
    },
    Warm: {
      code: 3,
      category: 'Warm',
      cssClass: 'Warm',
      badge: 'ELEVATED WARM',
      message: 'Warm temperature detected (25°C to 35°C). Moderate thermal load.',
      recommendation: 'Ensure adequate ventilation and airflow across active systems.',
      color: '#f59e0b',
      mercuryTop: '#fbbf24',
      mercuryBottom: '#d97706',
      displayTheme: 'medium',
      displayThemeDesc: 'Medium Temp (Mild Display)',
      segId: 'segWarm'
    },
    Hot: {
      code: 4,
      category: 'Hot',
      cssClass: 'Hot',
      badge: 'HIGH HEAT WARNING',
      message: 'High temperature detected (35°C to 45°C). Thermal stress warning!',
      recommendation: 'Activate active cooling systems and inspect for overheating.',
      color: '#f97316',
      mercuryTop: '#fb923c',
      mercuryBottom: '#ea580c',
      displayTheme: 'high',
      displayThemeDesc: 'High Temp (Red Alert Display)',
      segId: 'segHot'
    },
    'Extreme Heat / Danger': {
      code: 5,
      category: 'Extreme Heat / Danger',
      cssClass: 'Extreme',
      badge: 'CRITICAL DANGER',
      message: 'CRITICAL ALERT! Extreme heat / danger level (> 45°C) exceeded!',
      recommendation: 'Immediate thermal shutdown or emergency cooling intervention required!',
      color: '#ef4444',
      mercuryTop: '#ff5e57',
      mercuryBottom: '#dc2626',
      displayTheme: 'high',
      displayThemeDesc: 'Extreme Heat (Red Danger Display)',
      segId: 'segExtreme'
    }
  };

  const STORAGE_KEY_HISTORY = 'smart_temp_analyzer_history_v2';
  const STORAGE_KEY_ALERTS  = 'smart_temp_analyzer_alert_log_v1';
  const STORAGE_KEY_MODE    = 'smart_temp_analyzer_mode_v1';

  // --- State ---
  let cBackendAvailable = false;
  let soundEnabled = true;
  let audioCtx = null;
  let historyRecords = [];
  let alertLogRecords = [];
  let currentAnalyzerArray = [-4.5, 8.0, 18.5, 22.0, 24.5, 31.0, 39.5, 48.0];
  let readingTimestamps = [];
  let lastAnalyzerUnit = 'C';
  let activePresetName = 'Room';
  let customLowC = 18.0;
  let customHighC = 25.0;
  let lastAnalyzedPayload = null;

  // Chart.js Instances
  let trendChartInstance = null;
  let barChartInstance = null;
  let categoryChartInstance = null;

  // --- DOM References ---
  const htmlEl = document.documentElement;
  const topNavbar = document.getElementById('topNavbar');
  const cEngineStatusBadge = document.getElementById('cEngineStatusBadge');
  const heroEngineBadgeText = document.getElementById('heroEngineBadgeText');

  const converterForm = document.getElementById('converterForm');
  const tempInput = document.getElementById('tempInput');
  const tempInputWrapper = document.getElementById('tempInputWrapper');
  const inputUnitAddon = document.getElementById('inputUnitAddon');
  const physicalLimitHint = document.getElementById('physicalLimitHint');
  const selectedUnitIndicator = document.getElementById('selectedUnitIndicator');

  const fromUnitSelect = document.getElementById('fromUnitSelect');
  const toUnitSelect = document.getElementById('toUnitSelect');
  const swapUnitsBtn = document.getElementById('swapUnitsBtn');

  const pairSourceText = document.getElementById('pairSourceText');
  const pairTargetText = document.getElementById('pairTargetText');
  const activeFormulaText = document.getElementById('activeFormulaText');
  const stepByStepFormulaText = document.getElementById('stepByStepFormulaText');

  const validationErrorBox = document.getElementById('validationErrorBox');
  const errorHeadline = document.getElementById('errorHeadline');
  const errorMessage = document.getElementById('errorMessage');
  const errorDetail = document.getElementById('errorDetail');

  const repeatBtn = document.getElementById('repeatBtn');
  const resetBtn = document.getElementById('resetBtn');

  const enteredSummaryBadge = document.getElementById('enteredSummaryBadge');
  const resCelsius = document.getElementById('resCelsius');
  const resFahrenheit = document.getElementById('resFahrenheit');
  const resKelvin = document.getElementById('resKelvin');
  const resRankine = document.getElementById('resRankine');

  const heroPreviewC = document.getElementById('heroPreviewC');
  const heroPreviewF = document.getElementById('heroPreviewF');
  const heroPreviewK = document.getElementById('heroPreviewK');
  const heroPreviewR = document.getElementById('heroPreviewR');
  const heroBadgeStatus = document.getElementById('heroBadgeStatus');

  const thermoMercuryFill = document.getElementById('thermoMercuryFill');
  const thermoLiveReadout = document.getElementById('thermoLiveReadout');
  const thermoLiveCategory = document.getElementById('thermoLiveCategory');
  const displayShiftText = document.getElementById('displayShiftText');
  const thermalStateDot = document.getElementById('thermalStateDot');
  const thermalStateLabel = document.getElementById('thermalStateLabel');

  const alertCard = document.getElementById('alertCard');
  const alertIconContainer = document.getElementById('alertIconContainer');
  const alertSeverityPill = document.getElementById('alertSeverityPill');
  const alertMessageTitle = document.getElementById('alertMessageTitle');
  const alertMessageSub = document.getElementById('alertMessageSub');
  const spectrumSegments = document.querySelectorAll('.spectrum-seg');

  // Multi-Reading Analyzer DOM
  const batchReadingsInput = document.getElementById('batchReadingsInput');
  const analyzerUnitSelect = document.getElementById('analyzerUnitSelect');
  const runBatchAnalysisBtn = document.getElementById('runBatchAnalysisBtn');
  const csvUploadInput = document.getElementById('csvUploadInput');
  const uploadCsvBtn = document.getElementById('uploadCsvBtn');
  const generateRandomDataBtn = document.getElementById('generateRandomDataBtn');
  const exportAnalyzerCsvBtn = document.getElementById('exportAnalyzerCsvBtn');
  const singleReadingInput = document.getElementById('singleReadingInput');
  const addSingleReadingBtn = document.getElementById('addSingleReadingBtn');
  const clearAnalyzerReadingsBtn = document.getElementById('clearAnalyzerReadingsBtn');
  const activeReadingsChips = document.getElementById('activeReadingsChips');
  const analyzerErrorBox = document.getElementById('analyzerErrorBox');
  const analyzerErrorMessage = document.getElementById('analyzerErrorMessage');
  const dailySummaryText = document.getElementById('dailySummaryText');
  const heatmapStripContainer = document.getElementById('heatmapStripContainer');

  // 8 KPI Cards
  const statMin = document.getElementById('statMin');
  const statMinSub = document.getElementById('statMinSub');
  const statMax = document.getElementById('statMax');
  const statMaxSub = document.getElementById('statMaxSub');
  const statAvg = document.getElementById('statAvg');
  const statAvgSub = document.getElementById('statAvgSub');
  const statMedian = document.getElementById('statMedian');
  const statMedianSub = document.getElementById('statMedianSub');
  const statRange = document.getElementById('statRange');
  const statRangeSub = document.getElementById('statRangeSub');
  const statStdDev = document.getElementById('statStdDev');
  const statStdDevSub = document.getElementById('statStdDevSub');
  const statTrend = document.getElementById('statTrend');
  const statTrendSub = document.getElementById('statTrendSub');
  const statNextPred = document.getElementById('statNextPred');
  const statNextPredSub = document.getElementById('statNextPredSub');
  const chartCountBadge = document.getElementById('chartCountBadge');

  // Rapid Change & Custom Thresholds DOM
  const rapidChangeBanner = document.getElementById('rapidChangeBanner');
  const rapidChangeHeadline = document.getElementById('rapidChangeHeadline');
  const rapidChangeDetails = document.getElementById('rapidChangeDetails');
  const rapidChangeBadge = document.getElementById('rapidChangeBadge');
  const activePresetBadge = document.getElementById('activePresetBadge');
  const customLowThreshold = document.getElementById('customLowThreshold');
  const customHighThreshold = document.getElementById('customHighThreshold');
  const applyThresholdsBtn = document.getElementById('applyThresholdsBtn');
  const thresholdEvaluationStrip = document.getElementById('thresholdEvaluationStrip');

  // 6 Alert Tier Counts & Tables
  const countFreezing = document.getElementById('countFreezing');
  const countCold = document.getElementById('countCold');
  const countComfortable = document.getElementById('countComfortable');
  const countWarm = document.getElementById('countWarm');
  const countHot = document.getElementById('countHot');
  const countExtreme = document.getElementById('countExtreme');
  const analyzedReadingsCountNote = document.getElementById('analyzedReadingsCountNote');
  const analyzedAlertsTableBody = document.getElementById('analyzedAlertsTableBody');
  const alertHistoryCountNote = document.getElementById('alertHistoryCountNote');
  const alertHistoryLogBody = document.getElementById('alertHistoryLogBody');
  const clearAlertLogBtn = document.getElementById('clearAlertLogBtn');

  // History & Export
  const historyTableBody = document.getElementById('historyTableBody');
  const historyShowingBadge = document.getElementById('historyShowingBadge');
  const historyTotalNote = document.getElementById('historyTotalNote');
  const showAllHistoryToggle = document.getElementById('showAllHistoryToggle');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const exportHistoryCsvBtn = document.getElementById('exportHistoryCsvBtn');
  const downloadReportBtn = document.getElementById('downloadReportBtn');
  const heroDownloadReportBtn = document.getElementById('heroDownloadReportBtn');

  // Sidebar Sound & Theme Toggles
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundToggleLabel = document.getElementById('soundToggleLabel');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const sunIcon = document.getElementById('sunIcon');
  const moonIcon = document.getElementById('moonIcon');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const toastContainer = document.getElementById('toastContainer');

  // ============================================================================
  // 1. INITIALIZATION
  // ============================================================================
  async function initApp() {
    loadSavedThemeMode();
    loadHistoryFromStorage();
    initTimestampsForDefaultReadings();
    initCharts();
    bindEventListeners();

    await checkCBackendHealth();
    await performLiveConversion(false);
    await executeMultiReadingAnalysis(false);
    renderHistoryTable();
    renderAlertHistoryLog();
  }

  function initTimestampsForDefaultReadings() {
    const base = Date.now() - currentAnalyzerArray.length * 15 * 60000;
    readingTimestamps = currentAnalyzerArray.map((_, i) =>
      new Date(base + i * 15 * 60000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    );
  }

  async function checkCBackendHealth() {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'ok') {
          cBackendAvailable = true;
          cEngineStatusBadge.textContent = 'Live System Active';
          heroEngineBadgeText.textContent = 'SMART THERMAL TELEMETRY & ANALYSIS SYSTEM';
          return;
        }
      }
    } catch (_) {}
    cBackendAvailable = false;
    cEngineStatusBadge.textContent = 'Intelligent Monitor';
  }

  // ============================================================================
  // 2. WEB AUDIO API ALERT SOUND SYNTHESIZER
  // ============================================================================
  function playAlertTone(severityType = 'warning') {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtx) audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (severityType === 'danger') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.setValueAtTime(980, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.32);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.24);
      }
    } catch (_) {}
  }

  // ============================================================================
  // 3. CONVERSION, STEP-BY-STEP FORMULA & STATISTICAL ENGINE
  // ============================================================================
  function getPairFormulaString(fromU, toU) {
    const map = {
      'C->C': '°C = °C (Identity)',
      'C->F': '°F = (°C × 9/5) + 32',
      'C->K': 'K = °C + 273.15',
      'C->R': '°R = (°C + 273.15) × 9/5',
      'F->C': '°C = (°F − 32) × 5/9',
      'F->F': '°F = °F (Identity)',
      'F->K': 'K = (°F − 32) × 5/9 + 273.15',
      'F->R': '°R = °F + 459.67',
      'K->C': '°C = K − 273.15',
      'K->F': '°F = (K − 273.15) × 9/5 + 32',
      'K->K': 'K = K (Identity)',
      'K->R': '°R = K × 9/5',
      'R->C': '°C = (°R − 491.67) × 5/9',
      'R->F': '°F = °R − 459.67',
      'R->K': 'K = °R × 5/9',
      'R->R': '°R = °R (Identity)'
    };
    return map[`${fromU}->${toU}`] || 'T_out = f(T_in)';
  }

  function toCelsiusLocal(val, unit) {
    switch (unit) {
      case 'C': return val;
      case 'F': return (val - 32.0) * 5.0 / 9.0;
      case 'K': return val - 273.15;
      case 'R': return (val - 491.67) * 5.0 / 9.0;
      default: return val;
    }
  }

  function fromCelsiusLocal(c, unit) {
    switch (unit) {
      case 'C': return c;
      case 'F': return (c * 9.0 / 5.0) + 32.0;
      case 'K': return c + 273.15;
      case 'R': return (c + 273.15) * 9.0 / 5.0;
      default: return c;
    }
  }

  function getStepByStepFormulaLocal(val, fromU, toU) {
    const symFrom = UNIT_META[fromU].symbol;
    const symTo = UNIT_META[toU].symbol;
    const c = toCelsiusLocal(val, fromU);
    const res = fromCelsiusLocal(c, toU);

    if (fromU === toU) {
      return `Step 1: Identical unit selected → ${val.toFixed(2)} ${symFrom} = ${res.toFixed(2)} ${symTo}`;
    }
    if (fromU === 'C' && toU === 'F') {
      const s1 = val * 1.8;
      return `Step 1: ${val.toFixed(2)} × 9/5 = ${s1.toFixed(2)}  →  Step 2: ${s1.toFixed(2)} + 32 = ${res.toFixed(2)} °F`;
    }
    if (fromU === 'C' && toU === 'K') {
      return `Step 1: ${val.toFixed(2)} + 273.15 = ${res.toFixed(2)} K`;
    }
    if (fromU === 'C' && toU === 'R') {
      const s1 = val + 273.15;
      return `Step 1: ${val.toFixed(2)} + 273.15 = ${s1.toFixed(2)} K  →  Step 2: ${s1.toFixed(2)} × 9/5 = ${res.toFixed(2)} °R`;
    }
    if (fromU === 'F' && toU === 'C') {
      const s1 = val - 32.0;
      return `Step 1: ${val.toFixed(2)} − 32 = ${s1.toFixed(2)}  →  Step 2: ${s1.toFixed(2)} × 5/9 = ${res.toFixed(2)} °C`;
    }
    if (fromU === 'F' && toU === 'K') {
      const s1 = (val - 32.0) * 5.0 / 9.0;
      return `Step 1: (${val.toFixed(2)} − 32) × 5/9 = ${s1.toFixed(2)} °C  →  Step 2: ${s1.toFixed(2)} + 273.15 = ${res.toFixed(2)} K`;
    }
    if (fromU === 'F' && toU === 'R') {
      return `Step 1: ${val.toFixed(2)} + 459.67 = ${res.toFixed(2)} °R`;
    }
    if (fromU === 'K' && toU === 'C') {
      return `Step 1: ${val.toFixed(2)} − 273.15 = ${res.toFixed(2)} °C`;
    }
    if (fromU === 'K' && toU === 'F') {
      const s1 = val - 273.15;
      return `Step 1: ${val.toFixed(2)} − 273.15 = ${s1.toFixed(2)} °C  →  Step 2: (${s1.toFixed(2)} × 9/5) + 32 = ${res.toFixed(2)} °F`;
    }
    if (fromU === 'K' && toU === 'R') {
      return `Step 1: ${val.toFixed(2)} × 9/5 = ${res.toFixed(2)} °R`;
    }
    return `Step 1: Convert ${val.toFixed(2)} ${symFrom} to ${c.toFixed(2)} °C  →  Step 2: Convert to ${res.toFixed(2)} ${symTo}`;
  }

  function classifyCelsiusLocal(c) {
    if (c <= 0.0) return ALERT_TIERS.Freezing;
    if (c <= 15.0) return ALERT_TIERS.Cold;
    if (c <= 25.0) return ALERT_TIERS.Comfortable;
    if (c <= 35.0) return ALERT_TIERS.Warm;
    if (c <= 45.0) return ALERT_TIERS.Hot;
    return ALERT_TIERS['Extreme Heat / Danger'];
  }

  function localConvertEngine(rawStr, fromUnit, toUnit) {
    const trimmed = String(rawStr).trim();
    if (trimmed === '') {
      return {
        valid: false,
        errorHeadline: 'INVALID INPUT!',
        errorMessage: 'Temperature input cannot be empty.',
        errorDetail: 'Please type a valid numeric temperature value.'
      };
    }

    const numericRegex = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
    if (!numericRegex.test(trimmed)) {
      return {
        valid: false,
        errorHeadline: 'INVALID TEMPERATURE!',
        errorMessage: 'Non-numeric input is not allowed.',
        errorDetail: `Entered "${trimmed}" is not a valid number.`
      };
    }

    const val = parseFloat(trimmed);
    const minLimit = ABSOLUTE_ZERO[fromUnit];
    const meta = UNIT_META[fromUnit];

    if (val < minLimit - 1e-7) {
      return {
        valid: false,
        errorHeadline: 'INVALID TEMPERATURE!',
        errorMessage: 'Temperature cannot be below absolute zero.',
        errorDetail: `Entered: ${val.toFixed(2)} ${meta.symbol} | Minimum allowed in ${meta.name} is ${meta.minLabel}.`
      };
    }

    const clean = (n) => (Math.abs(n) < 1e-9 ? 0 : n);
    const c = clean(toCelsiusLocal(val, fromUnit));
    const f = clean(fromCelsiusLocal(c, 'F'));
    const k = clean(fromCelsiusLocal(c, 'K'));
    const r = clean(fromCelsiusLocal(c, 'R'));
    const pairRes = clean(fromCelsiusLocal(c, toUnit));
    const alertObj = classifyCelsiusLocal(c);

    return {
      valid: true,
      inputValue: val,
      fromUnit,
      toUnit,
      pairResult: pairRes,
      formula: getPairFormulaString(fromUnit, toUnit),
      stepFormula: getStepByStepFormulaLocal(val, fromUnit, toUnit),
      celsius: c,
      fahrenheit: f,
      kelvin: k,
      rankine: r,
      alert: alertObj
    };
  }

  function localAnalyzeArrayEngine(values, unit) {
    const count = values.length;
    if (count === 0) return { valid: false, error: 'Please enter at least one temperature reading.' };

    const meta = UNIT_META[unit];
    const minLimit = ABSOLUTE_ZERO[unit];

    for (let i = 0; i < count; i++) {
      if (Number.isNaN(values[i])) {
        return { valid: false, error: `Reading #${i + 1} is not a valid number.` };
      }
      if (values[i] < minLimit - 1e-7) {
        return {
          valid: false,
          error: `Reading #${i + 1} (${values[i].toFixed(2)} ${meta.symbol}) is below Absolute Zero (${meta.minLabel})!`
        };
      }
    }

    const categoryCounts = { Freezing: 0, Cold: 0, Comfortable: 0, Warm: 0, Hot: 0, ExtremeHeat: 0 };
    const readings = [];
    const celsiusVals = [];

    let sumIn = 0;
    let sumC = 0;
    let minIdx = 0;
    let maxIdx = 0;
    let maxDeltaC = 0;
    let rapidChangeDetected = 0;
    let rapidFromIdx = 1;
    let rapidToIdx = 1;

    values.forEach((v, idx) => {
      const c = toCelsiusLocal(v, unit);
      const f = fromCelsiusLocal(c, 'F');
      const k = fromCelsiusLocal(c, 'K');
      const r = fromCelsiusLocal(c, 'R');
      const cls = classifyCelsiusLocal(c);

      celsiusVals.push(c);
      sumIn += v;
      sumC += c;

      if (idx === 0 || c < celsiusVals[minIdx]) minIdx = idx;
      if (idx === 0 || c > celsiusVals[maxIdx]) maxIdx = idx;

      if (idx > 0) {
        const delta = Math.abs(c - celsiusVals[idx - 1]);
        if (delta > maxDeltaC) {
          maxDeltaC = delta;
          rapidFromIdx = idx;
          rapidToIdx = idx + 1;
        }
        if (delta >= RAPID_CHANGE_LIMIT_C) {
          rapidChangeDetected = 1;
        }
      }

      if (cls.code === 0) categoryCounts.Freezing++;
      else if (cls.code === 1) categoryCounts.Cold++;
      else if (cls.code === 2) categoryCounts.Comfortable++;
      else if (cls.code === 3) categoryCounts.Warm++;
      else if (cls.code === 4) categoryCounts.Hot++;
      else categoryCounts.ExtremeHeat++;

      readings.push({
        index: idx + 1,
        input: v,
        celsius: c,
        fahrenheit: f,
        kelvin: k,
        rankine: r,
        code: cls.code,
        category: cls.category,
        badge: cls.badge,
        message: cls.message,
        recommendation: cls.recommendation,
        color: cls.color,
        displayTheme: cls.displayTheme
      });
    });

    const sortedIn = [...values].sort((a, b) => a - b);
    const sortedC = [...celsiusVals].sort((a, b) => a - b);

    const min = sortedIn[0];
    const max = sortedIn[count - 1];
    const average = sumIn / count;
    const range = max - min;

    const minC = sortedC[0];
    const maxC = sortedC[count - 1];
    const averageC = sumC / count;
    const rangeC = maxC - minC;

    const mid = Math.floor(count / 2);
    const median = count % 2 === 1 ? sortedIn[mid] : (sortedIn[mid - 1] + sortedIn[mid]) / 2.0;
    const medianC = count % 2 === 1 ? sortedC[mid] : (sortedC[mid - 1] + sortedC[mid]) / 2.0;

    let sqIn = 0;
    let sqC = 0;
    for (let i = 0; i < count; i++) {
      sqIn += Math.pow(values[i] - average, 2);
      sqC += Math.pow(celsiusVals[i] - averageC, 2);
    }
    const stdDev = Math.sqrt(sqIn / count);
    const stdDevC = Math.sqrt(sqC / count);

    let slopeC = 0;
    let trend = 'Stable';
    let trendCode = 0;
    let nextPredictionC = averageC;
    let nextPrediction = average;

    if (count >= 2) {
      const meanX = (count - 1) / 2.0;
      let num = 0;
      let den = 0;
      for (let i = 0; i < count; i++) {
        const dx = i - meanX;
        const dy = celsiusVals[i] - averageC;
        num += dx * dy;
        den += dx * dx;
      }
      slopeC = den > 0 ? num / den : 0;
      const interceptC = averageC - slopeC * meanX;
      nextPredictionC = Math.max(ABSOLUTE_ZERO.C, interceptC + slopeC * count);
      nextPrediction = fromCelsiusLocal(nextPredictionC, unit);

      if (slopeC > 0.25) {
        trend = 'Rising';
        trendCode = 1;
      } else if (slopeC < -0.25) {
        trend = 'Falling';
        trendCode = -1;
      }
    }

    return {
      valid: true,
      count,
      inputUnit: unit,
      unitSymbol: meta.symbol,
      stats: {
        min, max, average, median, range, stdDev, nextPrediction,
        minC, maxC, averageC, medianC, rangeC, stdDevC, nextPredictionC,
        minIndex: minIdx + 1,
        maxIndex: maxIdx + 1,
        rapidChangeDetected,
        maxDeltaC,
        rapidChangeFromIdx: rapidFromIdx,
        rapidChangeToIdx: rapidToIdx,
        slopeC, trendCode, trend, categoryCounts
      },
      readings
    };
  }

  // ============================================================================
  // 4. LIVE CONVERTER EXECUTION
  // ============================================================================
  async function performLiveConversion(logToHistory = false) {
    const rawVal = tempInput.value;
    const fromU = fromUnitSelect.value;
    const toU = toUnitSelect.value;

    const fromMeta = UNIT_META[fromU];
    const toMeta = UNIT_META[toU];
    inputUnitAddon.textContent = fromMeta.symbol;
    selectedUnitIndicator.textContent = `${fromMeta.symbol} → ${toMeta.symbol}`;
    physicalLimitHint.textContent = `Physical Limit Check: Must be ≥ ${fromMeta.minLabel} (Absolute Zero)`;
    activeFormulaText.textContent = getPairFormulaString(fromU, toU);

    let result = localConvertEngine(rawVal, fromU, toU);

    if (cBackendAvailable && String(rawVal).trim() !== '' && result.valid) {
      try {
        const url = `/api/convert?value=${encodeURIComponent(rawVal.trim())}&from=${fromU}&to=${toU}`;
        const response = await fetch(url);
        if (response.ok) {
          const cData = await response.json();
          if (cData && cData.valid) {
            const tierCfg = ALERT_TIERS[cData.alert.category] || classifyCelsiusLocal(cData.celsius);
            result = {
              valid: true,
              inputValue: cData.inputValue,
              fromUnit: cData.fromUnit,
              toUnit: cData.toUnit,
              pairResult: cData.pairResult,
              formula: cData.formula,
              stepFormula: cData.stepFormula || getStepByStepFormulaLocal(cData.inputValue, fromU, toU),
              celsius: cData.celsius,
              fahrenheit: cData.fahrenheit,
              kelvin: cData.kelvin,
              rankine: cData.rankine,
              alert: tierCfg
            };
          } else if (cData && !cData.valid) {
            result = cData;
          }
        }
      } catch (_) {}
    }

    if (!result.valid) {
      tempInputWrapper.classList.add('input-error');
      validationErrorBox.classList.remove('hidden');
      errorHeadline.textContent = result.errorHeadline || 'INVALID TEMPERATURE!';
      errorMessage.textContent = result.errorMessage || 'Temperature cannot be below absolute zero.';
      errorDetail.textContent = result.errorDetail || '';
      pairSourceText.textContent = 'Invalid';
      pairTargetText.textContent = '--';
      stepByStepFormulaText.textContent = 'Awaiting valid input above Absolute Zero...';
      if (logToHistory) {
        playAlertTone('danger');
        showToast(`${errorHeadline.textContent} ${errorMessage.textContent}`, 'error');
      }
      return;
    }

    tempInputWrapper.classList.remove('input-error');
    validationErrorBox.classList.add('hidden');

    pairSourceText.textContent = `${result.inputValue.toFixed(2)} ${fromMeta.symbol}`;
    pairTargetText.textContent = `${result.pairResult.toFixed(2)} ${toMeta.symbol}`;
    activeFormulaText.textContent = result.formula;
    stepByStepFormulaText.textContent = result.stepFormula;

    enteredSummaryBadge.textContent = `Input: ${result.inputValue.toFixed(2)} ${fromMeta.symbol}`;
    resCelsius.textContent = `${result.celsius.toFixed(2)} °C`;
    resFahrenheit.textContent = `${result.fahrenheit.toFixed(2)} °F`;
    resKelvin.textContent = `${result.kelvin.toFixed(2)} K`;
    resRankine.textContent = `${result.rankine.toFixed(2)} °R`;

    heroPreviewC.textContent = `${result.celsius.toFixed(2)} °C`;
    heroPreviewF.textContent = `${result.fahrenheit.toFixed(2)} °F`;
    heroPreviewK.textContent = `${result.kelvin.toFixed(2)} K`;
    heroPreviewR.textContent = `${result.rankine.toFixed(2)} °R`;
    heroBadgeStatus.textContent = result.alert.category.toUpperCase();
    heroBadgeStatus.style.color = result.alert.color;

    const clampedC = Math.max(-45, Math.min(65, result.celsius));
    const fillPercent = Math.round(((clampedC + 45) / 110) * 86 + 8);
    thermoMercuryFill.style.height = `${fillPercent}%`;
    document.documentElement.style.setProperty('--mercury-top', result.alert.mercuryTop);
    document.documentElement.style.setProperty('--mercury-bottom', result.alert.mercuryBottom);
    document.documentElement.style.setProperty('--mercury-glow', `${result.alert.color}88`);

    thermoLiveReadout.textContent = `${result.celsius.toFixed(1)} °C`;
    thermoLiveReadout.style.color = result.alert.color;
    thermoLiveCategory.textContent = result.alert.category;

    alertCard.style.borderLeftColor = result.alert.color;
    alertIconContainer.style.color = result.alert.color;
    alertIconContainer.style.background = `${result.alert.color}22`;
    alertSeverityPill.textContent = result.alert.badge;
    alertSeverityPill.style.color = result.alert.color;
    alertSeverityPill.style.background = `${result.alert.color}22`;
    alertMessageTitle.textContent = `${result.alert.category}: ${result.alert.message}`;
    alertMessageTitle.style.color = result.alert.color;
    alertMessageSub.textContent = `Recommendation: ${result.alert.recommendation}`;

    spectrumSegments.forEach((seg) => {
      seg.classList.toggle('active-seg', seg.id === result.alert.segId);
    });

    applyDynamicDisplayTheme(result.alert);

    if (logToHistory) {
      const now = new Date();
      const timeStr = now.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const record = {
        id: Date.now(),
        timestamp: timeStr,
        inputValue: result.inputValue,
        inputUnit: fromU,
        celsius: result.celsius,
        fahrenheit: result.fahrenheit,
        kelvin: result.kelvin,
        rankine: result.rankine,
        category: result.alert.category,
        cssClass: result.alert.cssClass,
        alertMessage: result.alert.message
      };

      historyRecords.push(record);
      saveHistoryToStorage();
      renderHistoryTable();

      // Log into Alert History Log as well
      appendAlertEvent(
        result.alert.category,
        `${result.inputValue.toFixed(2)} ${fromMeta.symbol} (${result.celsius.toFixed(2)} °C)`,
        result.alert.message,
        result.alert.cssClass
      );

      if (result.alert.code >= 4 || result.alert.code === 0) {
        playAlertTone('danger');
      } else {
        playAlertTone('warning');
      }

      // Append to Multi-Reading Analyzer
      const targetAnalyzerUnit = analyzerUnitSelect.value;
      const valInAnalyzerUnit = Number(fromCelsiusLocal(result.celsius, targetAnalyzerUnit).toFixed(2));
      currentAnalyzerArray.push(valInAnalyzerUnit);
      readingTimestamps.push(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      syncAnalyzerInputWithArray();
      await executeMultiReadingAnalysis(false);

      showToast(
        `Logged ${result.inputValue.toFixed(2)} ${fromMeta.symbol} (${result.alert.category}) to History (Last 10) & Analyzer!`,
        'success'
      );
    }
  }

  function applyDynamicDisplayTheme(alertCfg) {
    if (!alertCfg) {
      htmlEl.setAttribute('data-thermal-theme', 'default');
      thermalStateDot.style.background = '#00d2ff';
      thermalStateLabel.textContent = 'Default Navy';
      displayShiftText.textContent = 'Default Navy Theme';
      return;
    }
    htmlEl.setAttribute('data-thermal-theme', alertCfg.displayTheme);
    thermalStateDot.style.background = alertCfg.color;
    thermalStateDot.style.boxShadow = `0 0 12px ${alertCfg.color}`;
    thermalStateLabel.textContent = alertCfg.displayThemeDesc;
    displayShiftText.textContent = alertCfg.displayThemeDesc;
  }

  // ============================================================================
  // 5. MULTI-READING ANALYZER, PREDICTION, DAILY SUMMARY & HEATMAP STRIP
  // ============================================================================
  function parseBatchReadingsString(str) {
    const tokens = String(str)
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return tokens.map((t) => {
      const regex = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
      return regex.test(t) ? parseFloat(t) : NaN;
    });
  }

  function syncAnalyzerInputWithArray() {
    batchReadingsInput.value = currentAnalyzerArray.join(', ');
    renderActiveReadingChips();
  }

  function ensureReadingTimestamps(count) {
    while (readingTimestamps.length < count) {
      const idx = readingTimestamps.length;
      const t = new Date(Date.now() - (count - idx) * 60000);
      readingTimestamps.push(
        t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }
  }

  function renderActiveReadingChips() {
    const unitSym = UNIT_META[analyzerUnitSelect.value].symbol;
    if (currentAnalyzerArray.length === 0) {
      activeReadingsChips.innerHTML = `<span style="font-size: 0.78rem; color: var(--text-secondary);">No readings in list. Add readings above.</span>`;
      return;
    }

    activeReadingsChips.innerHTML = currentAnalyzerArray
      .map(
        (val, idx) => `
        <span class="reading-item-chip">
          <span>#${idx + 1}: ${Number.isNaN(val) ? 'Invalid' : val} ${unitSym}</span>
          <button type="button" class="reading-chip-remove" data-remove-idx="${idx}" title="Remove reading">&times;</button>
        </span>
      `
      )
      .join('');

    activeReadingsChips.querySelectorAll('.reading-chip-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const removeIdx = parseInt(btn.getAttribute('data-remove-idx'), 10);
        currentAnalyzerArray.splice(removeIdx, 1);
        readingTimestamps.splice(removeIdx, 1);
        syncAnalyzerInputWithArray();
        await executeMultiReadingAnalysis(false);
      });
    });
  }

  async function handleAnalyzerUnitSwitch() {
    const newUnit = analyzerUnitSelect.value;
    if (newUnit !== lastAnalyzerUnit && currentAnalyzerArray.length > 0) {
      currentAnalyzerArray = currentAnalyzerArray.map((val) => {
        if (Number.isNaN(val)) return val;
        const c = toCelsiusLocal(val, lastAnalyzerUnit);
        const converted = fromCelsiusLocal(c, newUnit);
        return Number(converted.toFixed(2));
      });
      syncAnalyzerInputWithArray();
    }
    lastAnalyzerUnit = newUnit;
    await executeMultiReadingAnalysis(false);
  }

  async function executeMultiReadingAnalysis(triggerNotifications = true) {
    const unit = analyzerUnitSelect.value;
    lastAnalyzerUnit = unit;
    const rawStr = batchReadingsInput.value;
    const parsedValues = parseBatchReadingsString(rawStr);
    currentAnalyzerArray = parsedValues;
    ensureReadingTimestamps(parsedValues.length);
    renderActiveReadingChips();

    let analysis = null;

    if (cBackendAvailable && rawStr.trim() !== '') {
      try {
        const res = await fetch(
          `/api/analyze?unit=${encodeURIComponent(unit)}&values=${encodeURIComponent(rawStr.trim())}`
        );
        if (res.ok) {
          analysis = await res.json();
        }
      } catch (_) {}
    }

    if (!analysis) {
      analysis = localAnalyzeArrayEngine(parsedValues, unit);
    }

    if (!analysis.valid) {
      analyzerErrorBox.classList.remove('hidden');
      analyzerErrorMessage.textContent = analysis.error || 'Invalid readings detected.';
      return;
    }

    analyzerErrorBox.classList.add('hidden');
    lastAnalyzedPayload = analysis;

    const s = analysis.stats;
    const sym = analysis.unitSymbol;

    // 1. Daily Summary Line ("Hottest reading was X at time Y")
    const hotIdx = (s.maxIndex || 1) - 1;
    const coldIdx = (s.minIndex || 1) - 1;
    const hotTime = readingTimestamps[hotIdx] || '12:00:00';
    const coldTime = readingTimestamps[coldIdx] || '12:00:00';
    dailySummaryText.innerHTML =
      `Hottest reading was <strong>${s.max.toFixed(2)} ${sym}</strong> (${s.maxC.toFixed(2)} °C) at <code>${hotTime}</code> (Reading #${s.maxIndex || 1}) &bull; ` +
      `Coldest reading was <strong>${s.min.toFixed(2)} ${sym}</strong> (${s.minC.toFixed(2)} °C) at <code>${coldTime}</code> (Reading #${s.minIndex || 1})`;

    // 2. Populate 8 Summary KPI Cards
    statMin.textContent = `${s.min.toFixed(2)} ${sym}`;
    statMinSub.textContent = `${s.minC.toFixed(2)} °C (Reading #${s.minIndex || 1})`;

    statMax.textContent = `${s.max.toFixed(2)} ${sym}`;
    statMaxSub.textContent = `${s.maxC.toFixed(2)} °C (Reading #${s.maxIndex || 1})`;

    statAvg.textContent = `${s.average.toFixed(2)} ${sym}`;
    statAvgSub.textContent = `${s.averageC.toFixed(2)} °C (Dashed line on chart)`;

    statMedian.textContent = `${s.median.toFixed(2)} ${sym}`;
    statMedianSub.textContent = `${s.medianC.toFixed(2)} °C (Sorted midpoint)`;

    statRange.textContent = `${s.range.toFixed(2)} ${sym}`;
    statRangeSub.textContent = `Δ ${s.rangeC.toFixed(2)} °C`;

    statStdDev.textContent = `±${s.stdDev.toFixed(2)} ${sym}`;
    statStdDevSub.textContent = `σ = ${s.stdDevC.toFixed(2)} °C`;

    const trendArrow = s.trend === 'Rising' ? '↗ Rising' : s.trend === 'Falling' ? '↘ Falling' : '→ Stable';
    statTrend.textContent = trendArrow;
    statTrend.style.color =
      s.trend === 'Rising' ? '#f97316' : s.trend === 'Falling' ? '#38bdf8' : '#10b981';
    statTrendSub.textContent = `Slope: ${s.slopeC >= 0 ? '+' : ''}${s.slopeC.toFixed(2)} °C/step`;

    const predVal = s.nextPrediction !== undefined ? s.nextPrediction : s.average;
    const predC = s.nextPredictionC !== undefined ? s.nextPredictionC : s.averageC;
    statNextPred.textContent = `${predVal.toFixed(2)} ${sym}`;
    statNextPredSub.textContent = `${predC.toFixed(2)} °C (Reading #${analysis.count + 1} forecast)`;

    chartCountBadge.textContent = `${analysis.count} Readings (${sym})`;

    // 3. Render Sequence Heatmap Colour Strip
    renderHeatmapStrip(analysis.readings, sym);

    // 4. Rapid Change Warning Detection
    if (s.rapidChangeDetected) {
      rapidChangeBanner.classList.add('rapid-warning-active');
      rapidChangeHeadline.textContent = `RAPID TEMPERATURE CHANGE WARNING! (Max ΔT = ${s.maxDeltaC.toFixed(2)} °C)`;
      rapidChangeDetails.textContent =
        `Sudden thermal jump/drop of ${s.maxDeltaC.toFixed(2)} °C detected between Reading #${s.rapidChangeFromIdx} and Reading #${s.rapidChangeToIdx} (Threshold: ≥ ${RAPID_CHANGE_LIMIT_C.toFixed(1)} °C).`;
      rapidChangeBadge.textContent = 'RAPID SPIKE ALERT';
      rapidChangeBadge.style.color = '#ef4444';
      rapidChangeBadge.style.background = 'rgba(239, 68, 68, 0.25)';

      if (triggerNotifications) {
        playAlertTone('danger');
        appendAlertEvent(
          'Rapid Change Warning',
          `ΔT = ${s.maxDeltaC.toFixed(2)} °C (#${s.rapidChangeFromIdx} → #${s.rapidChangeToIdx})`,
          `Sudden temperature shift of ${s.maxDeltaC.toFixed(2)} °C exceeds rapid-change limit (${RAPID_CHANGE_LIMIT_C}°C).`,
          'Extreme'
        );
      }
    } else {
      rapidChangeBanner.classList.remove('rapid-warning-active');
      rapidChangeHeadline.textContent = 'Rapid Thermal Change Monitor: Normal Rate';
      rapidChangeDetails.textContent =
        `Max step change between consecutive readings is ${(s.maxDeltaC || 0).toFixed(2)} °C (within safe < ${RAPID_CHANGE_LIMIT_C.toFixed(1)} °C transition limit).`;
      rapidChangeBadge.textContent = 'STABLE TRANSITION';
      rapidChangeBadge.style.color = '#10b981';
      rapidChangeBadge.style.background = 'rgba(16, 185, 129, 0.2)';
    }

    // 5. Update 6 Alert Tier Counters
    const cc = s.categoryCounts;
    countFreezing.textContent = String(cc.Freezing || 0);
    countCold.textContent = String(cc.Cold || 0);
    countComfortable.textContent = String(cc.Comfortable || 0);
    countWarm.textContent = String(cc.Warm || 0);
    countHot.textContent = String(cc.Hot || 0);
    countExtreme.textContent = String(cc.ExtremeHeat || 0);

    // 6. Evaluate Custom Low/High Thresholds & Render Per-Reading Table
    evaluateCustomThresholdsAndRenderTable(analysis, triggerNotifications);

    // 7. Update All 3 Charts (Line Chart with Average & Prediction, Bar Chart, Doughnut Chart)
    updateAnalyzerCharts(analysis);
  }

  function renderHeatmapStrip(readings, unitSym) {
    if (!heatmapStripContainer) return;
    heatmapStripContainer.innerHTML = readings
      .map(
        (r) => `
        <div class="heatmap-cell" style="background: linear-gradient(145deg, ${r.color}, ${r.color}bb);" title="Reading #${r.index}: ${r.input.toFixed(2)} ${unitSym} (${r.celsius.toFixed(2)} °C) - ${r.category}">
          <span class="heatmap-cell-idx">#${r.index}</span>
          <span class="heatmap-cell-val">${r.celsius.toFixed(1)}°C</span>
          <span class="heatmap-cell-cat">${r.category.split(' ')[0]}</span>
        </div>
      `
      )
      .join('');
  }

  function evaluateCustomThresholdsAndRenderTable(analysis, logBreaches = false) {
    customLowC = parseFloat(customLowThreshold.value);
    customHighC = parseFloat(customHighThreshold.value);
    if (Number.isNaN(customLowC)) customLowC = 18.0;
    if (Number.isNaN(customHighC)) customHighC = 25.0;

    const sym = analysis.unitSymbol;
    let inBandCount = 0;
    let lowBreaches = 0;
    let highBreaches = 0;

    analyzedReadingsCountNote.textContent = `(${analysis.count} readings classified • Active Preset: ${activePresetName} [${customLowC}°C to ${customHighC}°C])`;

    analyzedAlertsTableBody.innerHTML = analysis.readings
      .map((r) => {
        const pillClass = r.code === 5 ? 'Extreme' : r.category;
        let bandBadge = '';
        if (r.celsius < customLowC) {
          lowBreaches++;
          bandBadge = `<span class="cat-pill Cold">Below Low (&lt; ${customLowC}°C)</span>`;
        } else if (r.celsius > customHighC) {
          highBreaches++;
          bandBadge = `<span class="cat-pill Extreme">Above High (&gt; ${customHighC}°C)</span>`;
        } else {
          inBandCount++;
          bandBadge = `<span class="cat-pill Comfortable">Within Band (${customLowC}–${customHighC}°C)</span>`;
        }

        return `
          <tr>
            <td><strong>#${r.index}</strong></td>
            <td><strong>${r.input.toFixed(2)} ${sym}</strong></td>
            <td><code>${r.celsius.toFixed(2)} °C</code></td>
            <td><code>${r.fahrenheit.toFixed(2)} °F</code></td>
            <td><code>${r.kelvin.toFixed(2)} K</code></td>
            <td><code>${r.rankine.toFixed(2)} °R</code></td>
            <td><span class="cat-pill ${pillClass}">${r.category}</span></td>
            <td>${bandBadge}</td>
            <td>
              <strong>${r.message}</strong><br/>
              <small style="color: var(--text-secondary);">Action: ${r.recommendation}</small>
            </td>
          </tr>
        `;
      })
      .join('');

    thresholdEvaluationStrip.innerHTML = `
      <div>
        <strong>${activePresetName} Band (${customLowC.toFixed(1)}°C – ${customHighC.toFixed(1)}°C):</strong>
        <span>${inBandCount} of ${analysis.count} readings within safe band</span>
      </div>
      <div style="display:flex; gap:10px;">
        <span class="cat-pill Cold">Below Low: ${lowBreaches}</span>
        <span class="cat-pill Comfortable">Safe: ${inBandCount}</span>
        <span class="cat-pill Extreme">Above High: ${highBreaches}</span>
      </div>
    `;

    if (logBreaches && (lowBreaches > 0 || highBreaches > 0)) {
      playAlertTone('warning');
      appendAlertEvent(
        `Threshold Breach (${activePresetName})`,
        `${lowBreaches} Low / ${highBreaches} High`,
        `Custom threshold check [${customLowC.toFixed(1)}°C – ${customHighC.toFixed(1)}°C]: ${lowBreaches} reading(s) below low limit and ${highBreaches} reading(s) above high limit.`,
        highBreaches > 0 ? 'Extreme' : 'Cold'
      );
    }
  }

  // ============================================================================
  // 6. ALERT HISTORY LOG WITH TIMESTAMPS
  // ============================================================================
  function appendAlertEvent(alertType, triggerVal, msg, cssClass = 'Warm') {
    const now = new Date();
    alertLogRecords.unshift({
      id: Date.now() + Math.random(),
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      alertType,
      triggerVal,
      msg,
      cssClass
    });
    if (alertLogRecords.length > 30) alertLogRecords.pop();
    try {
      localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(alertLogRecords));
    } catch (_) {}
    renderAlertHistoryLog();
  }

  function renderAlertHistoryLog() {
    if (!alertHistoryLogBody) return;
    alertHistoryCountNote.textContent = `(${alertLogRecords.length} alert events logged)`;

    if (alertLogRecords.length === 0) {
      alertHistoryLogBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding: 22px; color: var(--text-secondary);">
            No alert events logged yet. Log a reading, trigger a rapid spike, or evaluate custom thresholds to record timestamped alerts.
          </td>
        </tr>
      `;
      return;
    }

    alertHistoryLogBody.innerHTML = alertLogRecords
      .slice(0, 10)
      .map(
        (item, idx) => `
        <tr>
          <td><strong>#${idx + 1}</strong></td>
          <td><code>${item.timestamp}</code></td>
          <td><span class="cat-pill ${item.cssClass}">${item.alertType}</span></td>
          <td><strong>${item.triggerVal}</strong></td>
          <td>${item.msg}</td>
        </tr>
      `
      )
      .join('');
  }

  // ============================================================================
  // 7. THREE CHART.JS VISUALIZATIONS (Line + Average + Prediction, Bar, Doughnut)
  // ============================================================================
  function initCharts() {
    if (typeof Chart === 'undefined') return;

    const trendCtx = document.getElementById('trendChart');
    const barCtx = document.getElementById('readingsBarChart');
    const catCtx = document.getElementById('categoryChart');

    if (trendCtx) {
      trendChartInstance = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Reading (°C)',
              data: [],
              borderColor: '#00d2ff',
              backgroundColor: 'rgba(0, 210, 255, 0.14)',
              pointBackgroundColor: [],
              pointBorderColor: '#ffffff',
              pointRadius: 5,
              pointHoverRadius: 7,
              borderWidth: 2.6,
              tension: 0.3,
              fill: true
            },
            {
              label: 'Average (°C)',
              data: [],
              borderColor: '#ff7b39',
              borderDash: [7, 5],
              borderWidth: 2.2,
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.08)' } },
            y: {
              ticks: { color: '#94a3b8', callback: (val) => `${val}°C` },
              grid: { color: 'rgba(148, 163, 184, 0.12)' }
            }
          },
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } }
          }
        }
      });
    }

    if (barCtx) {
      barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Temperature (°C)',
              data: [],
              backgroundColor: [],
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
            y: {
              ticks: { color: '#94a3b8', callback: (val) => `${val}°C` },
              grid: { color: 'rgba(148, 163, 184, 0.12)' }
            }
          },
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } }
          }
        }
      });
    }

    if (catCtx) {
      categoryChartInstance = new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: [
            'Freezing (≤0°C)',
            'Cold (0–15°C)',
            'Comfortable (15–25°C)',
            'Warm (25–35°C)',
            'Hot (35–45°C)',
            'Extreme Heat (>45°C)'
          ],
          datasets: [
            {
              data: [0, 0, 0, 0, 0, 0],
              backgroundColor: ['#38bdf8', '#3b82f6', '#10b981', '#f59e0b', '#f97316', '#ef4444'],
              borderColor: 'rgba(15, 23, 42, 0.85)',
              borderWidth: 2,
              hoverOffset: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 }, padding: 10 }
            }
          },
          cutout: '60%'
        }
      });
    }
  }

  function updateAnalyzerCharts(analysis) {
    const s = analysis.stats;
    const predC = Number((s.nextPredictionC !== undefined ? s.nextPredictionC : s.averageC).toFixed(2));

    if (trendChartInstance) {
      const labels = [...analysis.readings.map((r) => `R#${r.index}`), `Next (#${analysis.count + 1})`];
      const cValues = [...analysis.readings.map((r) => Number(r.celsius.toFixed(2))), predC];
      const avgLine = labels.map(() => Number(s.averageC.toFixed(2)));
      const pointColors = [...analysis.readings.map((r) => r.color), '#a855f7'];

      trendChartInstance.data.labels = labels;
      trendChartInstance.data.datasets[0].data = cValues;
      trendChartInstance.data.datasets[0].pointBackgroundColor = pointColors;
      trendChartInstance.data.datasets[1].data = avgLine;
      trendChartInstance.data.datasets[1].label = `Average (${s.averageC.toFixed(2)} °C)`;
      trendChartInstance.update();
    }

    if (barChartInstance) {
      barChartInstance.data.labels = analysis.readings.map((r) => `R#${r.index}`);
      barChartInstance.data.datasets[0].data = analysis.readings.map((r) => Number(r.celsius.toFixed(2)));
      barChartInstance.data.datasets[0].backgroundColor = analysis.readings.map((r) => r.color);
      barChartInstance.update();
    }

    if (categoryChartInstance) {
      const cc = s.categoryCounts;
      categoryChartInstance.data.datasets[0].data = [
        cc.Freezing || 0,
        cc.Cold || 0,
        cc.Comfortable || 0,
        cc.Warm || 0,
        cc.Hot || 0,
        cc.ExtremeHeat || 0
      ];
      categoryChartInstance.update();
    }
  }

  // ============================================================================
  // 8. CONVERSION HISTORY (LAST 10), CSV UPLOAD/EXPORT & REPORT DOWNLOAD
  // ============================================================================
  function loadHistoryFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) historyRecords = parsed;
      }
      const rawAlerts = localStorage.getItem(STORAGE_KEY_ALERTS);
      if (rawAlerts) {
        const parsedAlerts = JSON.parse(rawAlerts);
        if (Array.isArray(parsedAlerts)) alertLogRecords = parsedAlerts;
      }
    } catch (_) {
      historyRecords = [];
      alertLogRecords = [];
    }
  }

  function saveHistoryToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyRecords));
    } catch (_) {}
  }

  function renderHistoryTable() {
    const total = historyRecords.length;
    const showAll = showAllHistoryToggle && showAllHistoryToggle.checked;

    historyTotalNote.textContent = `(${total} total stored in localStorage)`;
    historyShowingBadge.textContent = showAll ? `Showing All ${total} Conversions` : 'Showing Last 10 Conversions';

    if (total === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding: 28px; color: var(--text-secondary);">
            No conversion records saved yet. Click "Log to History (Last 10) & Send to Analyzer" in the converter above to store readings.
          </td>
        </tr>
      `;
      return;
    }

    const reversed = [...historyRecords].reverse();
    const list = showAll ? reversed : reversed.slice(0, 10);

    historyTableBody.innerHTML = list
      .map((item, idx) => {
        const num = total - idx;
        const sym = UNIT_META[item.inputUnit] ? UNIT_META[item.inputUnit].symbol : item.inputUnit;
        const pillClass = item.cssClass || 'Comfortable';
        return `
          <tr>
            <td><strong>#${num}</strong></td>
            <td><code>${item.timestamp}</code></td>
            <td><strong>${Number(item.inputValue).toFixed(2)} ${sym}</strong></td>
            <td><code>${Number(item.celsius).toFixed(2)} °C</code></td>
            <td><code>${Number(item.fahrenheit).toFixed(2)} °F</code></td>
            <td><code>${Number(item.kelvin).toFixed(2)} K</code></td>
            <td><code>${Number(item.rankine || (item.celsius + 273.15) * 1.8).toFixed(2)} °R</code></td>
            <td><span class="cat-pill ${pillClass}">${item.category}</span></td>
            <td>${item.alertMessage}</td>
          </tr>
        `;
      })
      .join('');
  }

  function exportAnalyzedToCsv() {
    if (!lastAnalyzedPayload || !lastAnalyzedPayload.valid) {
      showToast('No analyzed data available to export.', 'error');
      return;
    }
    const rows = [
      ['Index', 'Input', 'Unit', 'Celsius_C', 'Fahrenheit_F', 'Kelvin_K', 'Rankine_R', 'Category', 'Alert_Message'].join(',')
    ];
    lastAnalyzedPayload.readings.forEach((r) => {
      rows.push(
        [
          r.index,
          r.input.toFixed(2),
          lastAnalyzedPayload.inputUnit,
          r.celsius.toFixed(2),
          r.fahrenheit.toFixed(2),
          r.kelvin.toFixed(2),
          r.rankine.toFixed(2),
          `"${r.category}"`,
          `"${r.message}"`
        ].join(',')
      );
    });
    downloadCsvFile(rows.join('\r\n'), 'Analyzed_Temperature_Readings.csv');
    showToast('Exported analyzed readings to CSV!', 'success');
  }

  function exportHistoryToCsv() {
    if (historyRecords.length === 0) {
      showToast('Conversion history is empty.', 'error');
      return;
    }
    const rows = [
      ['Index', 'Timestamp', 'Input_Value', 'Input_Unit', 'Celsius_C', 'Fahrenheit_F', 'Kelvin_K', 'Rankine_R', 'Category', 'Safety_Message'].join(',')
    ];
    historyRecords.forEach((h, i) => {
      rows.push(
        [
          i + 1,
          `"${h.timestamp}"`,
          h.inputValue.toFixed(2),
          h.inputUnit,
          h.celsius.toFixed(2),
          h.fahrenheit.toFixed(2),
          h.kelvin.toFixed(2),
          (h.rankine || (h.celsius + 273.15) * 1.8).toFixed(2),
          `"${h.category}"`,
          `"${h.alertMessage}"`
        ].join(',')
      );
    });
    downloadCsvFile(rows.join('\r\n'), 'Temperature_Conversion_History.csv');
    showToast('Exported conversion history to CSV!', 'success');
  }

  function downloadCsvFile(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleDownloadReport() {
    const now = new Date();
    const lines = [
      '====================================================================================',
      '        SMART TEMPERATURE ANALYZER & CONVERTER WITH INTELLIGENT ALERTS              ',
      '                     COMPLETE TEMPERATURE ANALYSIS REPORT                           ',
      '====================================================================================',
      `Generated Date & Time : ${now.toLocaleString()}`,
      'Supported Units       : Celsius (°C), Fahrenheit (°F), Kelvin (K), Rankine (°R)',
      '====================================================================================',
      ''
    ];

    if (lastAnalyzedPayload && lastAnalyzedPayload.valid) {
      const s = lastAnalyzedPayload.stats;
      const sym = lastAnalyzedPayload.unitSymbol;
      lines.push(
        '1. MULTI-READING STATISTICAL SUMMARY',
        '------------------------------------------------------------------------------------',
        `Total Analyzed Readings : ${lastAnalyzedPayload.count} (${sym})`,
        `Minimum Temperature     : ${s.min.toFixed(2)} ${sym} (${s.minC.toFixed(2)} °C)`,
        `Maximum Temperature     : ${s.max.toFixed(2)} ${sym} (${s.maxC.toFixed(2)} °C)`,
        `Average (Mean)          : ${s.average.toFixed(2)} ${sym} (${s.averageC.toFixed(2)} °C)`,
        `Median                  : ${s.median.toFixed(2)} ${sym} (${s.medianC.toFixed(2)} °C)`,
        `Range (Max - Min)       : ${s.range.toFixed(2)} ${sym} (${s.rangeC.toFixed(2)} °C)`,
        `Standard Deviation (SD) : ±${s.stdDev.toFixed(2)} ${sym} (σ = ${s.stdDevC.toFixed(2)} °C)`,
        `Temperature Trend       : ${s.trend} (Slope: ${s.slopeC >= 0 ? '+' : ''}${s.slopeC.toFixed(2)} °C/step)`,
        `Next-Reading Prediction : ${(s.nextPrediction || s.average).toFixed(2)} ${sym} (${(s.nextPredictionC || s.averageC).toFixed(2)} °C)`,
        ''
      );
    }

    lines.push(
      '2. LOGGED CONVERSION HISTORY (Last 10)',
      '------------------------------------------------------------------------------------'
    );
    if (historyRecords.length === 0) {
      lines.push('  No manual conversion logs saved in localStorage.');
    } else {
      historyRecords.slice(-10).forEach((h, i) => {
        const sym = UNIT_META[h.inputUnit] ? UNIT_META[h.inputUnit].symbol : h.inputUnit;
        lines.push(
          `  #${i + 1} [${h.timestamp}] ${h.inputValue.toFixed(2)} ${sym} -> ${h.celsius.toFixed(2)} °C | ${h.fahrenheit.toFixed(2)} °F | ${h.kelvin.toFixed(2)} K | [${h.category}]`
        );
      });
    }

    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Smart_Temperature_Analysis_Report_${now.toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Downloaded complete Temperature Analysis Report!', 'success');
  }

  // ============================================================================
  // 9. LIGHT / DARK MODE & TOAST NOTIFICATIONS
  // ============================================================================
  function loadSavedThemeMode() {
    const saved = localStorage.getItem(STORAGE_KEY_MODE);
    applyThemeMode(saved === 'light' ? 'light' : 'dark');
  }

  function applyThemeMode(mode) {
    htmlEl.setAttribute('data-mode', mode);
    if (mode === 'light') {
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
    } else {
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
    }
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  }

  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3400);
  }

  // ============================================================================
  // 10. EVENT LISTENERS
  // ============================================================================
  function bindEventListeners() {
    // Live conversion as user types
    tempInput.addEventListener('input', () => performLiveConversion(false));
    fromUnitSelect.addEventListener('change', () => performLiveConversion(false));
    toUnitSelect.addEventListener('change', () => performLiveConversion(false));

    // Swap Units Button
    swapUnitsBtn.addEventListener('click', () => {
      const prevFrom = fromUnitSelect.value;
      fromUnitSelect.value = toUnitSelect.value;
      toUnitSelect.value = prevFrom;
      performLiveConversion(false);
      showToast(`Swapped units: ${UNIT_META[fromUnitSelect.value].symbol} ↔ ${UNIT_META[toUnitSelect.value].symbol}`, 'info');
    });

    // Form submit logs reading & sends to analyzer
    converterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      performLiveConversion(true);
    });

    // Quick Test Presets in Converter
    document.querySelectorAll('#converter .preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = chip.getAttribute('data-val');
        const unit = chip.getAttribute('data-unit') || 'C';
        fromUnitSelect.value = unit;
        tempInput.value = val;
        performLiveConversion(false);
      });
    });

    // Clickable rows in Reference Table of Common Temperatures
    document.querySelectorAll('.clickable-ref-row').forEach((row) => {
      row.addEventListener('click', () => {
        const refC = parseFloat(row.getAttribute('data-ref-c'));
        const targetUnit = fromUnitSelect.value;
        const convertedVal = fromCelsiusLocal(refC, targetUnit);
        tempInput.value = Number(convertedVal.toFixed(2));
        performLiveConversion(false);
        showToast(`Loaded benchmark (${refC.toFixed(2)} °C) into live converter!`, 'info');
      });
    });

    // Repeat & Reset Buttons
    repeatBtn.addEventListener('click', () => {
      tempInput.focus();
      tempInput.select();
      showToast('Type a new temperature value for live conversion.', 'info');
    });

    resetBtn.addEventListener('click', () => {
      tempInput.value = '';
      fromUnitSelect.value = 'C';
      toUnitSelect.value = 'F';
      tempInputWrapper.classList.remove('input-error');
      validationErrorBox.classList.add('hidden');
      pairSourceText.textContent = '-- °C';
      pairTargetText.textContent = '-- °F';
      stepByStepFormulaText.textContent = 'Enter a temperature value above...';
      resCelsius.textContent = '--';
      resFahrenheit.textContent = '--';
      resKelvin.textContent = '--';
      resRankine.textContent = '--';
      applyDynamicDisplayTheme(null);
      tempInput.focus();
      showToast('Converter reset and default Navy display restored.', 'info');
    });

    // Multi-Reading Analyzer Controls
    runBatchAnalysisBtn.addEventListener('click', () => executeMultiReadingAnalysis(true));
    analyzerUnitSelect.addEventListener('change', () => handleAnalyzerUnitSwitch());

    batchReadingsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeMultiReadingAnalysis(true);
      }
    });

    // CSV File Upload
    uploadCsvBtn.addEventListener('click', () => csvUploadInput.click());
    csvUploadInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const content = String(evt.target.result || '');
        const matches = content.match(/[+-]?\d+(\.\d+)?/g);
        if (!matches || matches.length === 0) {
          showToast('No numeric temperature values found in uploaded CSV file.', 'error');
          return;
        }
        const unit = analyzerUnitSelect.value;
        const validNums = matches
          .map((m) => parseFloat(m))
          .filter((n) => !Number.isNaN(n) && n >= ABSOLUTE_ZERO[unit])
          .slice(0, 50);

        if (validNums.length === 0) {
          showToast('Uploaded numbers were all below Absolute Zero for selected unit.', 'error');
          return;
        }
        currentAnalyzerArray = validNums;
        readingTimestamps = [];
        ensureReadingTimestamps(validNums.length);
        syncAnalyzerInputWithArray();
        await executeMultiReadingAnalysis(true);
        showToast(`Loaded ${validNums.length} readings from "${file.name}"!`, 'success');
      };
      reader.readAsText(file);
      csvUploadInput.value = '';
    });

    // Random Sample Data Generator
    generateRandomDataBtn.addEventListener('click', async () => {
      const unit = analyzerUnitSelect.value;
      const randomSeries = [];
      for (let i = 0; i < 8; i++) {
        // Generate realistic random Celsius between -10°C and +50°C
        const randC = -10 + Math.random() * 60;
        const valInUnit = fromCelsiusLocal(randC, unit);
        randomSeries.push(Number(valInUnit.toFixed(1)));
      }
      currentAnalyzerArray = randomSeries;
      readingTimestamps = [];
      ensureReadingTimestamps(randomSeries.length);
      syncAnalyzerInputWithArray();
      await executeMultiReadingAnalysis(true);
      showToast(`Generated 8 random sample readings in ${UNIT_META[unit].symbol}!`, 'info');
    });

    // Export Analyzed CSV
    exportAnalyzerCsvBtn.addEventListener('click', exportAnalyzedToCsv);

    // Add Single Reading One-by-One
    addSingleReadingBtn.addEventListener('click', async () => {
      const raw = singleReadingInput.value.trim();
      if (!raw) return;
      const num = parseFloat(raw);
      if (Number.isNaN(num)) {
        showToast('Please enter a valid numeric reading to add.', 'error');
        return;
      }
      const unit = analyzerUnitSelect.value;
      if (num < ABSOLUTE_ZERO[unit] - 1e-7) {
        playAlertTone('danger');
        showToast(`Cannot add ${num} ${UNIT_META[unit].symbol}: Below Absolute Zero!`, 'error');
        return;
      }
      currentAnalyzerArray.push(num);
      readingTimestamps.push(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      singleReadingInput.value = '';
      syncAnalyzerInputWithArray();
      await executeMultiReadingAnalysis(true);
      showToast(`Added ${num} ${UNIT_META[unit].symbol} to analyzer series.`, 'success');
    });

    singleReadingInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSingleReadingBtn.click();
      }
    });

    clearAnalyzerReadingsBtn.addEventListener('click', () => {
      currentAnalyzerArray = [];
      readingTimestamps = [];
      syncAnalyzerInputWithArray();
      analyzerErrorBox.classList.add('hidden');
      showToast('Cleared analyzer readings list.', 'info');
    });

    // Sample Datasets in Analyzer
    document.querySelectorAll('#analyzer .preset-chip').forEach((chip) => {
      chip.addEventListener('click', async () => {
        const ds = chip.getAttribute('data-dataset');
        const u = chip.getAttribute('data-unit') || 'C';
        analyzerUnitSelect.value = u;
        lastAnalyzerUnit = u;
        batchReadingsInput.value = ds;
        readingTimestamps = [];
        await executeMultiReadingAnalysis(true);
        showToast('Loaded sample dataset into Analyzer!', 'info');
      });
    });

    // Environment Presets (Room, Fridge/Food Storage, CPU, Fever Check)
    document.querySelectorAll('.threshold-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.threshold-preset-btn').forEach((b) => b.classList.remove('active-preset'));
        btn.classList.add('active-preset');
        activePresetName = btn.getAttribute('data-preset-name');
        const low = parseFloat(btn.getAttribute('data-low'));
        const high = parseFloat(btn.getAttribute('data-high'));
        customLowThreshold.value = low;
        customHighThreshold.value = high;
        activePresetBadge.textContent = `Preset: ${activePresetName} (${low}°C – ${high}°C)`;
        if (lastAnalyzedPayload && lastAnalyzedPayload.valid) {
          evaluateCustomThresholdsAndRenderTable(lastAnalyzedPayload, true);
        }
        showToast(`Applied "${activePresetName}" preset (${low}°C to ${high}°C).`, 'info');
      });
    });

    applyThresholdsBtn.addEventListener('click', () => {
      activePresetName = 'Custom';
      const low = parseFloat(customLowThreshold.value);
      const high = parseFloat(customHighThreshold.value);
      activePresetBadge.textContent = `Custom Band (${low}°C – ${high}°C)`;
      document.querySelectorAll('.threshold-preset-btn').forEach((b) => b.classList.remove('active-preset'));
      if (lastAnalyzedPayload && lastAnalyzedPayload.valid) {
        evaluateCustomThresholdsAndRenderTable(lastAnalyzedPayload, true);
        showToast(`Evaluated custom thresholds (${low}°C – ${high}°C).`, 'success');
      }
    });

    clearAlertLogBtn.addEventListener('click', () => {
      alertLogRecords = [];
      try {
        localStorage.removeItem(STORAGE_KEY_ALERTS);
      } catch (_) {}
      renderAlertHistoryLog();
      showToast('Cleared Alert History Log.', 'info');
    });

    // History & Export Buttons
    showAllHistoryToggle.addEventListener('change', renderHistoryTable);
    clearHistoryBtn.addEventListener('click', () => {
      historyRecords = [];
      saveHistoryToStorage();
      renderHistoryTable();
      showToast('Conversion history cleared.', 'info');
    });

    exportHistoryCsvBtn.addEventListener('click', exportHistoryToCsv);
    downloadReportBtn.addEventListener('click', handleDownloadReport);
    heroDownloadReportBtn.addEventListener('click', handleDownloadReport);

    // Sound Alert Toggle
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundToggleLabel.textContent = `Alert Sound: ${soundEnabled ? 'ON' : 'OFF'}`;
      if (soundEnabled) playAlertTone('warning');
      showToast(`Alert sound notifications turned ${soundEnabled ? 'ON' : 'OFF'}.`, 'info');
    });

    // Light / Dark Mode Toggle
    themeToggleBtn.addEventListener('click', () => {
      const cur = htmlEl.getAttribute('data-mode') === 'light' ? 'light' : 'dark';
      applyThemeMode(cur === 'light' ? 'dark' : 'light');
    });

    // Mobile Left Sidebar Toggle
    mobileMenuBtn.addEventListener('click', () => {
      topNavbar.classList.toggle('sidebar-open');
    });

    // Sidebar link active state
    document.querySelectorAll('.sidebar-nav .nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        topNavbar.classList.remove('sidebar-open');
        document.querySelectorAll('.sidebar-nav .nav-link').forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
