// --- Configuration ---
const CENSUS_PATH = 'resources/data/census_summary.json';
const RACES = [
  'Dwarf', 'Gnome', 'High Elf', 'Human', 'Night Elf',
  'Goblin', 'Orc', 'Tauren', 'Troll', 'Undead'
];
const CLASSES = [
  'Paladin', 'Druid', 'Hunter', 'Mage', 'Priest',
  'Rogue', 'Warlock', 'Warrior', 'Shaman'
];
const LEVELS = Array.from({length: 60}, (_, i) => i + 1);
const SERVERS = ['Nordanaar', 'Ambershire', "Tel'Abim", 'South Seas'];
const PLACEHOLDER_ICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="gray"/></svg>';

const ALLIANCE_RACES = ['Dwarf', 'Gnome', 'High Elf', 'Human', 'Night Elf'];
const HORDE_RACES = ['Goblin', 'Orc', 'Tauren', 'Troll', 'Undead'];

// Color definitions
const RACE_COLORS = {
  'Dwarf': '#8B4513',      // Saddle Brown
  'Gnome': '#FF69B4',      // Hot Pink
  'High Elf': '#87CEEB',   // Sky Blue
  'Human': '#F5DEB3',      // Wheat
  'Night Elf': '#228B22',  // Forest Green
  'Goblin': '#32CD32',     // Lime Green
  'Orc': '#8B0000',        // Dark Red
  'Tauren': '#D2691E',     // Chocolate
  'Troll': '#4169E1',      // Royal Blue
  'Undead': '#708090'      // Slate Gray
};

const CLASS_COLORS = {
  'Warrior': '#C79C6E',    // Brown
  'Paladin': '#F58CBA',    // Pink
  'Hunter': '#ABD473',     // Green
  'Rogue': '#FFF569',      // Yellow
  'Priest': '#FFFFFF',     // White
  'Shaman': '#0070DE',     // Blue
  'Mage': '#69CCF0',       // Light Blue
  'Warlock': '#9482C9',    // Purple
  'Druid': '#FF7D0A'       // Orange
};

// Generate random roll once at the beginning of the script
const ICON_RANDOM_ROLL = Math.floor(Math.random() * 20) + 1;

// --- State ---
let censusData = null;
let currentServer = SERVERS[0];
let currentFaction = 'all';
let filters = { race: null, class: null, level: null };
let selectedLevels = new Set(); // Changed to support multiple level selection
let showLevel60 = true;
let levelColorCoding = 'none'; // 'none', 'race', 'class', 'faction'

// Multi-selection state
let isDragging = false;
let dragStartLevel = null;
let dragEndLevel = null;
let isMultiSelectMode = true; // Enable multi-select by default

// Chart type state
let chartTypes = {
  race: 'bar', // 'bar' or 'pie'
  class: 'bar' // 'bar' or 'pie'
};

// --- URL Parameter Handling ---
function updateURL() {
  const params = new URLSearchParams();
  
  // Add server
  if (currentServer !== SERVERS[0]) {
    params.set('realm', currentServer);
  }
  
  // Add faction
  if (currentFaction !== 'all') {
    params.set('faction', currentFaction);
  }
  
  // Add show/hide 60s
  if (!showLevel60) {
    params.set('hide60s', 'true');
  }
  
  // Add race filter
  if (filters.race) {
    params.set('race', filters.race);
  }
  
  // Add class filter
  if (filters.class) {
    params.set('class', filters.class);
  }
  
  // Add level filter (legacy single level support)
  if (filters.level) {
    params.set('level', filters.level);
  }
  
  // Add selected levels (new multi-level support)
  if (selectedLevels.size > 0) {
    params.set('levels', Array.from(selectedLevels).sort((a, b) => a - b).join(','));
  }
  
  // Add level color coding
  if (levelColorCoding !== 'none') {
    params.set('levelColor', levelColorCoding);
  }
  
  // Update URL without reloading the page
  const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
  window.history.replaceState({}, '', newURL);
}

function readURLParams() {
  const params = new URLSearchParams(window.location.search);
  
  // Read server
  const realm = params.get('realm');
  if (realm && SERVERS.includes(realm)) {
    currentServer = realm;
  }
  
  // Read faction
  const faction = params.get('faction');
  if (faction && ['all', 'alliance', 'horde'].includes(faction)) {
    currentFaction = faction;
  }
  
  // Read show/hide 60s
  const hide60s = params.get('hide60s');
  if (hide60s === 'true') {
    showLevel60 = false;
  }
  
  // Read race filter
  const race = params.get('race');
  if (race && RACES.includes(race)) {
    filters.race = race;
  }
  
  // Read class filter
  const cls = params.get('class');
  if (cls && CLASSES.includes(cls)) {
    filters.class = cls;
  }
  
  // Read level filter (legacy single level support)
  const level = params.get('level');
  if (level) {
    const levelNum = parseInt(level, 10);
    if (levelNum >= 1 && levelNum <= 60) {
      filters.level = levelNum;
    }
  }
  
  // Read selected levels (new multi-level support)
  const levels = params.get('levels');
  if (levels) {
    selectedLevels.clear();
    const levelArray = levels.split(',').map(l => parseInt(l.trim(), 10));
    levelArray.forEach(levelNum => {
      if (levelNum >= 1 && levelNum <= 60) {
        selectedLevels.add(levelNum);
      }
    });
  }
  
  // Read level color coding
  const levelColor = params.get('levelColor');
  if (levelColor && ['none', 'race', 'class', 'faction'].includes(levelColor)) {
    levelColorCoding = levelColor;
  }
}

function applyURLParams() {
  // Update UI to reflect URL parameters
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-server') === currentServer) {
      btn.classList.add('active');
    }
  });
  
  document.querySelectorAll('.faction-filter').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-faction') === currentFaction) {
      btn.classList.add('active');
    }
  });
  
  const toggle60sBtn = document.getElementById('toggle-60s');
  if (toggle60sBtn) {
    if (showLevel60) {
      toggle60sBtn.classList.remove('active');
      toggle60sBtn.textContent = 'Hide 60s';
    } else {
      toggle60sBtn.classList.add('active');
      toggle60sBtn.textContent = 'Show 60s';
    }
  }
  
  document.querySelectorAll('.level-color-coding').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-coding') === levelColorCoding) {
      btn.classList.add('active');
    }
  });
  
  // Show/hide Ambershire link based on current server
  const ambershireLink = document.getElementById('ambershire-link');
  if (ambershireLink) {
    ambershireLink.style.display = currentServer === 'Ambershire' ? 'block' : 'none';
  }
}

// --- Data Aggregation & Filtering ---
function getFilteredDataForServer(serverName) {
  if (!censusData || !censusData.realms || !censusData.realms[serverName]) {
    return { 
      raceCounts: {}, 
      classCounts: {}, 
      levelCounts: {}, 
      levelBreakdowns: {},
      totalCharacters: 0, 
      lastScannedDates: { races: {}, classes: {}, levels: {} },
      hasData: false 
    };
  }

  const serverData = censusData.realms[serverName];
  const raceCounts = {};
  const classCounts = {};
  const levelCounts = {};
  const levelBreakdowns = {};
  const lastScannedDates = { races: {}, classes: {}, levels: {} };
  let totalCharacters = 0;
  let latestScanDate = null;

  // Initialize counts based on current faction filter
  const allowedRaces = currentFaction === 'all' ? RACES :
                      currentFaction === 'alliance' ? ALLIANCE_RACES :
                      HORDE_RACES;
  
  allowedRaces.forEach(r => raceCounts[r] = 0);
  CLASSES.forEach(c => classCounts[c] = 0);
  LEVELS.forEach(l => {
    levelCounts[l] = 0;
    levelBreakdowns[l] = { races: {}, classes: {}, factions: { alliance: 0, horde: 0 } };
  });

  // Process TURTLE faction data
  const factionData = serverData.factions.TURTLE;
  if (!factionData) return { raceCounts, classCounts, levelCounts, levelBreakdowns, totalCharacters: 0, lastScannedDates, hasData: false };

  for (const race in factionData.races) {
    // Skip races not in the current faction filter
    if (!allowedRaces.includes(race)) continue;
    if (filters.race && filters.race !== race) continue;
    
    const raceData = factionData.races[race];
    let raceLatestScan = null;
    
    // Determine faction for this race
    const faction = ALLIANCE_RACES.includes(race) ? 'alliance' : 'horde';
    
    for (const cls in raceData.classes) {
      if (filters.class && filters.class !== cls) continue;
      
      const classData = raceData.classes[cls];
      let classLatestScan = null;
      
      for (const level in classData.levels) {
        const lvl = parseInt(level, 10);
        
        // Check if this level should be included based on filters
        let includeLevel = true;
        
        // Legacy single level filter
        if (filters.level && filters.level !== lvl) {
          includeLevel = false;
        }
        
        // New multi-level filter
        if (selectedLevels.size > 0 && !selectedLevels.has(lvl)) {
          includeLevel = false;
        }
        
        if (!includeLevel) continue;
        
        // When level 60s are hidden, skip their contribution to counts
        if (!showLevel60 && lvl === 60) continue;
        
        const levelData = classData.levels[level];
        const count = levelData.count;
        const scanDate = new Date(levelData.lastscanned);

        raceCounts[race] += count;
        classCounts[cls] += count;
        levelCounts[lvl] += count;
        totalCharacters += count;

        // Track breakdowns for level color coding
        if (!levelBreakdowns[lvl].races[race]) levelBreakdowns[lvl].races[race] = 0;
        if (!levelBreakdowns[lvl].classes[cls]) levelBreakdowns[lvl].classes[cls] = 0;
        
        levelBreakdowns[lvl].races[race] += count;
        levelBreakdowns[lvl].classes[cls] += count;
        levelBreakdowns[lvl].factions[faction] += count;

        // Track latest scan dates
        if (!raceLatestScan || scanDate > raceLatestScan) {
          raceLatestScan = scanDate;
        }
        if (!classLatestScan || scanDate > classLatestScan) {
          classLatestScan = scanDate;
        }
        if (!lastScannedDates.levels[lvl] || scanDate > lastScannedDates.levels[lvl]) {
          lastScannedDates.levels[lvl] = scanDate;
        }

        if (!latestScanDate || scanDate > latestScanDate) {
          latestScanDate = scanDate;
        }
      }
      
      if (classLatestScan) {
        lastScannedDates.classes[cls] = classLatestScan;
      }
    }
    
    if (raceLatestScan) {
      lastScannedDates.races[race] = raceLatestScan;
    }
  }

  return { raceCounts, classCounts, levelCounts, levelBreakdowns, totalCharacters, latestScanDate, lastScannedDates, hasData: true };
}

// --- Y-Axis Label Functions ---
function generateYAxisLabels(max) {
  if (max <= 0) return [0];
  
  // Always include 0 and max, with one middle value
  return [0, Math.round(max / 2), max];
}

function addYAxisLabels(containerId, labels, maxValue) {
  const container = document.querySelector(`#${containerId} .chart-bars`);
  const yAxisContainer = document.createElement('div');
  yAxisContainer.className = 'y-axis-labels';
  
  // Add labels positioned at their correct heights
  labels.slice().reverse().forEach((label, index) => {
    const labelElement = document.createElement('div');
    labelElement.className = 'y-axis-label';
    labelElement.textContent = label.toLocaleString();
    
    // Make 0 label invisible
    if (label === 0) {
      labelElement.style.visibility = 'hidden';
    }
    
    // Position labels: max at top, middle in center, 0 at bottom
    let percentage;
    if (index === 0) { // max value
      percentage = 5; // Move down slightly to prevent clipping
    } else if (index === 1) { // middle value
      percentage = 50;
    } else { // 0 value
      percentage = 95; // Move up slightly to prevent clipping
    }
    
    labelElement.style.position = 'absolute';
    labelElement.style.top = `${percentage}%`;
    labelElement.style.transform = 'translateY(-50%)';
    
    yAxisContainer.appendChild(labelElement);
  });
  
  container.appendChild(yAxisContainer);
}

function addYAxisLabelsRight(containerId, labels, maxValue) {
  const container = document.querySelector(`#${containerId} .chart-bars`);
  const yAxisContainer = document.createElement('div');
  yAxisContainer.className = 'y-axis-labels-right';
  
  // Add labels positioned at their correct heights
  labels.slice().reverse().forEach((label, index) => {
    const labelElement = document.createElement('div');
    labelElement.className = 'y-axis-label';
    labelElement.textContent = label.toLocaleString();
    
    // Make 0 label invisible
    if (label === 0) {
      labelElement.style.visibility = 'hidden';
    }
    
    // Position labels: max at top, middle in center, 0 at bottom
    let percentage;
    if (index === 0) { // max value
      percentage = 5; // Move down slightly to prevent clipping
    } else if (index === 1) { // middle value
      percentage = 50;
    } else { // 0 value
      percentage = 95; // Move up slightly to prevent clipping
    }
    
    labelElement.style.position = 'absolute';
    labelElement.style.top = `${percentage}%`;
    labelElement.style.transform = 'translateY(-50%)';
    
    yAxisContainer.appendChild(labelElement);
  });
  
  container.appendChild(yAxisContainer);
}

// --- Multi-Selection Functions ---

function toggleLevelSelection(level, isCtrlClick = false) {
  // Prevent click during drag operations
  if (isDragging) {
    return;
  }
  
  // Always multi-select on mobile, or when ctrl is held on desktop
  if (isCtrlClick || isMultiSelectMode) {
    // Multi-select mode: toggle individual level
    if (selectedLevels.has(level)) {
      selectedLevels.delete(level);
    } else {
      selectedLevels.add(level);
    }
  } else {
    // Single select mode: clear all and select this level
    selectedLevels.clear();
    selectedLevels.add(level);
  }
  
  // Update legacy filter for backward compatibility
  if (selectedLevels.size === 1) {
    filters.level = Array.from(selectedLevels)[0];
  } else {
    filters.level = null;
  }
  
  updateURL();
  render();
}

function selectLevelRange(startLevel, endLevel) {
  const minLevel = Math.min(startLevel, endLevel);
  const maxLevel = Math.max(startLevel, endLevel);
  
  for (let level = minLevel; level <= maxLevel; level++) {
    selectedLevels.add(level);
  }
  
  updateURL();
  render();
}

function clearLevelSelection() {
  selectedLevels.clear();
  filters.level = null;
  updateURL();
  render();
}

function isLevelSelected(level) {
  return selectedLevels.has(level);
}

function getSelectedLevelsCount() {
  return selectedLevels.size;
}

function toggleChartType(chartType) {
  chartTypes[chartType] = chartTypes[chartType] === 'bar' ? 'pie' : 'bar';
  updateChartToggleButton(chartType);
  updateChartContainerClass(chartType);
  render();
}

function updateChartToggleButton(chartType) {
  const btn = document.querySelector(`[data-chart="${chartType}"]`);
  if (btn) {
    btn.textContent = chartTypes[chartType] === 'bar' ? '🥧' : '📊';
    btn.title = chartTypes[chartType] === 'bar' ? 'Switch to pie chart' : 'Switch to bar chart';
  }
}

function updateChartContainerClass(chartType) {
  const container = document.getElementById(`${chartType}-chart`);
  if (container) {
    if (chartTypes[chartType] === 'pie') {
      container.classList.add('pie-mode');
    } else {
      container.classList.remove('pie-mode');
    }
  }
}

function updateSelectionInfo() {
  const selectionInfo = document.getElementById('selection-info');
  const clearBtn = document.getElementById('clear-level-selection');
  
  if (selectedLevels.size === 0) {
    if (selectionInfo) selectionInfo.textContent = '';
    if (clearBtn) clearBtn.style.display = 'none';
  } else if (selectedLevels.size === 1) {
    const level = Array.from(selectedLevels)[0];
    if (selectionInfo) selectionInfo.textContent = `Level ${level} selected`;
    if (clearBtn) clearBtn.style.display = 'inline-block';
  } else {
    const sortedLevels = Array.from(selectedLevels).sort((a, b) => a - b);
    const minLevel = sortedLevels[0];
    const maxLevel = sortedLevels[sortedLevels.length - 1];
    
    if (selectionInfo) {
      if (maxLevel - minLevel + 1 === selectedLevels.size) {
        // Continuous range
        selectionInfo.textContent = `Levels ${minLevel}-${maxLevel} selected`;
      } else {
        // Non-continuous selection
        selectionInfo.textContent = `${selectedLevels.size} levels selected`;
      }
    }
    if (clearBtn) clearBtn.style.display = 'inline-block';
  }
  
}

// --- Color Coding Functions ---

function generateLevelTooltip(level, breakdowns, totalCharacters) {
  const breakdown = breakdowns[level];
  if (!breakdown) return `Level ${level}: 0`;
  
  const total = breakdown.races ? Object.values(breakdown.races).reduce((a, b) => a + b, 0) : 0;
  let tooltip = `Level ${level}: ${total}`;
  
  // Only show detailed breakdown when no color coding is active
  if (levelColorCoding === 'none') {
    tooltip += '\n\nRaces:';
    Object.entries(breakdown.races || {})
      .sort(([,a], [,b]) => b - a)
      .forEach(([race, count]) => {
        tooltip += `\n${race}: ${count}`;
      });
    
    tooltip += '\n\nClasses:';
    Object.entries(breakdown.classes || {})
      .sort(([,a], [,b]) => b - a)
      .forEach(([cls, count]) => {
        tooltip += `\n${cls}: ${count}`;
      });
  }
  
  return tooltip;
}

// --- Rendering ---
function render() {
  const serverInfoElement = document.getElementById('server-info');

  const { raceCounts, classCounts, levelCounts, levelBreakdowns, totalCharacters, latestScanDate, lastScannedDates, hasData } = getFilteredDataForServer(currentServer);

  // Server Info
  serverInfoElement.innerHTML = `
    Realm: ${currentServer}<br/>
    Total Characters: ${totalCharacters.toLocaleString()} - not meant to be representative of total population.<br/>
    Last Scanned: ${latestScanDate ? latestScanDate.toLocaleDateString() : 'N/A'}
    <br/>
    <span class="data-note">Only characters seen in the last 90 days are counted.</span>
  `;

  if (hasData) {
    renderChart('race-chart', RACES, raceCounts, 'race', totalCharacters, lastScannedDates.races);
    renderChart('class-chart', CLASSES, classCounts, 'class', totalCharacters, lastScannedDates.classes);
    const levelLabels = showLevel60 ? LEVELS : LEVELS.filter(lvl => lvl !== 60);
    renderLevelChart('level-chart', levelLabels, levelCounts, levelBreakdowns, totalCharacters, lastScannedDates.levels);
  } else {
    // Clear all charts when no data is available
    document.querySelector('#race-chart .chart-bars').innerHTML = '';
    document.querySelector('#class-chart .chart-bars').innerHTML = '';
    document.querySelector('#level-chart .chart-bars').innerHTML = '';
  }
  
  // Update selection info display
  updateSelectionInfo();
}

function getIcon(label, type) {
  let fileLabel = label.replace(/ /g, '_');
  
  // Apply random icon changes based on the pre-rolled number
  if (ICON_RANDOM_ROLL === 1 && label === 'Gnome' && type === 'race') {
    fileLabel = 'Gnome_tongue';
  } else if (ICON_RANDOM_ROLL === 2 && label === 'Paladin' && type === 'class') {
    fileLabel = 'Paladin_wilt';
  } else if (ICON_RANDOM_ROLL === 3 && label === 'Undead' && type === 'race') {
    fileLabel = 'Undead_skin';
  }
  
  return `resources/icons/${fileLabel}.png`;
}

function renderChart(containerId, labels, counts, filterKey, totalCharacters, lastScannedDates) {
  const container = document.querySelector(`#${containerId} .chart-bars`);
  container.innerHTML = '';
  
  const chartType = chartTypes[filterKey] || 'bar';
  
  if (chartType === 'pie') {
    renderPieChart(container, labels, counts, filterKey, totalCharacters, lastScannedDates);
  } else {
    renderBarChart(container, containerId, labels, counts, filterKey, totalCharacters, lastScannedDates);
  }
}

function renderBarChart(container, containerId, labels, counts, filterKey, totalCharacters, lastScannedDates) {
  const max = Math.max(...labels.map(l => counts[l] || 0), 1);
  
  // Generate Y-axis labels (3-5 labels depending on max value)
  const yAxisLabels = generateYAxisLabels(max);
  
  labels.forEach(label => {
    const value = counts[label] || 0;
    const percentage = totalCharacters > 0 ? ((value / totalCharacters) * 100).toFixed(1) : 0;
    const lastScanned = lastScannedDates[label] ? lastScannedDates[label].toLocaleDateString() : 'N/A';
    
    const bar = document.createElement('div');
    bar.className = 'bar' + (filters[filterKey] === label ? ' selected' : '');
    bar.style.height = `${(value / max) * 150 + 10}px`;
    bar.title = `${label}: ${value} (${percentage}%)\nLast Scanned: ${lastScanned}`;
    bar.onclick = () => {
      filters[filterKey] = filters[filterKey] === label ? null : label;
      updateURL(); // Update URL when filter changes
      render();
    };

    if (filterKey === 'race' || filterKey === 'class') {
      const icon = document.createElement('img');
      icon.src = getIcon(label, filterKey);
      icon.alt = label;
      icon.onerror = function() { this.src = PLACEHOLDER_ICON; };
      bar.appendChild(icon);
      
      // Add colored bar beneath icon (only visible when color coding is active, not when filtering)
      if ((filterKey === 'race' && levelColorCoding === 'race') ||
          (filterKey === 'class' && levelColorCoding === 'class')) {
        const colorBar = document.createElement('div');
        colorBar.className = 'icon-color-bar';
        const color = filterKey === 'race' ? RACE_COLORS[label] : CLASS_COLORS[label];
        colorBar.style.backgroundColor = color;
        bar.appendChild(colorBar);
      }
    }

    // Only append label for Race and Class charts, not for Levels
    if (filterKey === 'race' || filterKey === 'class') {
      const lblDiv = document.createElement('div');
      lblDiv.className = 'bar-label';
      lblDiv.textContent = label;
      bar.appendChild(lblDiv);
    }

    container.appendChild(bar);
  });
  
  // Add Y-axis labels
  addYAxisLabels(containerId, yAxisLabels, max);
}

function renderPieChart(container, labels, counts, filterKey, totalCharacters, lastScannedDates) {
  const pieContainer = document.createElement('div');
  pieContainer.className = 'pie-chart';
  
  const pieSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const isMobile = window.innerWidth <= 768;
  const svgSize = isMobile ? '100' : '150';
  pieSvg.setAttribute('width', svgSize);
  pieSvg.setAttribute('height', svgSize);
  pieSvg.setAttribute('viewBox', `0 0 ${svgSize} ${svgSize}`);
  
  const legend = document.createElement('div');
  legend.className = 'pie-legend';
  
  let currentAngle = 0;
  const radius = isMobile ? 40 : 60;
  const centerX = isMobile ? 50 : 75;
  const centerY = isMobile ? 50 : 75;
  
  // Sort labels by count for better visual order
  const sortedLabels = labels.filter(label => counts[label] > 0).sort((a, b) => counts[b] - counts[a]);
  
  sortedLabels.forEach(label => {
    const value = counts[label] || 0;
    const percentage = totalCharacters > 0 ? ((value / totalCharacters) * 100) : 0;
    const angle = (percentage / 100) * 360;
    
    if (angle > 0) {
      const color = filterKey === 'race' ? RACE_COLORS[label] : CLASS_COLORS[label];
      
      // Create pie slice
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      const x1 = centerX + radius * Math.cos((startAngle - 90) * Math.PI / 180);
      const y1 = centerY + radius * Math.sin((startAngle - 90) * Math.PI / 180);
      const x2 = centerX + radius * Math.cos((endAngle - 90) * Math.PI / 180);
      const y2 = centerY + radius * Math.sin((endAngle - 90) * Math.PI / 180);
      
      const largeArcFlag = angle > 180 ? 1 : 0;
      
      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');
      
      path.setAttribute('d', pathData);
      path.setAttribute('fill', color);
      path.setAttribute('stroke', '#fff');
      path.setAttribute('stroke-width', '1');
      path.style.cursor = 'pointer';
      path.title = `${label}: ${value} (${percentage.toFixed(1)}%)\nLast Scanned: ${lastScannedDates[label] ? lastScannedDates[label].toLocaleDateString() : 'N/A'}`;
      
      path.onclick = () => {
        filters[filterKey] = filters[filterKey] === label ? null : label;
        updateURL();
        render();
      };
      
      pieSvg.appendChild(path);
      
      // Add legend item
      const legendItem = document.createElement('div');
      legendItem.className = 'pie-legend-item';
      
      const colorBox = document.createElement('div');
      colorBox.className = 'pie-legend-color';
      colorBox.style.backgroundColor = color;
      
      const labelText = document.createElement('span');
      labelText.textContent = `${label}: ${percentage.toFixed(1)}%`;
      
      legendItem.appendChild(colorBox);
      legendItem.appendChild(labelText);
      legend.appendChild(legendItem);
      
      currentAngle += angle;
    }
  });
  
  pieContainer.appendChild(pieSvg);
  pieContainer.appendChild(legend);
  
  // Add Alliance/Horde breakdown for RACES chart
  if (filterKey === 'race') {
    const allianceCount = ALLIANCE_RACES.reduce((sum, race) => sum + (counts[race] || 0), 0);
    const hordeCount = HORDE_RACES.reduce((sum, race) => sum + (counts[race] || 0), 0);
    const totalFaction = allianceCount + hordeCount;
    
    if (totalFaction > 0) {
      const factionLegend = document.createElement('div');
      factionLegend.style.marginTop = '10px';
      factionLegend.style.paddingTop = '10px';
      factionLegend.style.borderTop = '1px solid #3a3a3a';
      factionLegend.style.display = 'block';
      factionLegend.style.textAlign = 'left';
      factionLegend.style.marginLeft = '-25px';
      factionLegend.style.color = 'white';
      factionLegend.style.fontSize = '0.8rem';
      
      const alliancePercent = ((allianceCount / totalFaction) * 100).toFixed(1);
      const hordePercent = ((hordeCount / totalFaction) * 100).toFixed(1);
      
      const allianceItem = document.createElement('div');
      allianceItem.className = 'faction-legend-item';
      allianceItem.style.display = 'flex';
      allianceItem.style.alignItems = 'center';
      allianceItem.style.gap = '5px';
      allianceItem.innerHTML = `<div style="width: 12px; height: 12px; background-color: #0070DE; border-radius: 2px;"></div><span>Alliance: ${alliancePercent}%</span>`;
      
      const hordeItem = document.createElement('div');
      hordeItem.className = 'faction-legend-item';
      hordeItem.style.display = 'flex';
      hordeItem.style.alignItems = 'center';
      hordeItem.style.gap = '5px';
      hordeItem.innerHTML = `<div style="width: 12px; height: 12px; background-color: #C41F3B; border-radius: 2px;"></div><span>Horde: ${hordePercent}%</span>`;
      
      factionLegend.appendChild(allianceItem);
      factionLegend.appendChild(document.createElement('br'));
      factionLegend.appendChild(hordeItem);
      pieContainer.appendChild(factionLegend);
    }
  }
  
  container.appendChild(pieContainer);
}

function renderLevelChart(containerId, labels, counts, breakdowns, totalCharacters, lastScannedDates) {
  const container = document.querySelector(`#${containerId} .chart-bars`);
  container.innerHTML = '';
  
  // Use actual maximum value for Y-axis scaling
  const max = Math.max(...labels.map(l => counts[l] || 0), 1);
  
  // Generate Y-axis labels (3-5 labels depending on max value)
  const yAxisLabels = generateYAxisLabels(max);
  
  labels.forEach(label => {
    const value = counts[label] || 0;
    const breakdown = breakdowns[label];
    
    const barContainer = document.createElement('div');
    barContainer.className = 'bar-container' + (isLevelSelected(label) ? ' selected' : '');
    // Set height with smaller base for mobile
    const isMobile = window.innerWidth <= 768;
    const baseHeight = isMobile ? 95 : 150; // Increased mobile base height to 90px
    barContainer.style.height = `${(value / max) * baseHeight + 10}px`;
    barContainer.dataset.level = label; // Store level for drag selection
    
    // Generate tooltip based on color coding
    const tooltip = generateLevelTooltip(label, breakdowns, totalCharacters);
    barContainer.title = tooltip;
    
    // Click handler - always multi-select
    barContainer.addEventListener('click', (event) => {
      const isCtrlClick = event.ctrlKey || event.metaKey;
      toggleLevelSelection(label, isCtrlClick);
    });
    
    // Desktop mouse drag events
    barContainer.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        isDragging = true;
        dragStartLevel = label;
        dragEndLevel = label;
        event.preventDefault();
      }
    });
    
    barContainer.addEventListener('mouseenter', () => {
      if (isDragging && dragStartLevel !== null) {
        dragEndLevel = label;
      }
    });
    
    barContainer.addEventListener('mouseup', (event) => {
      if (isDragging && event.button === 0) {
        isDragging = false;
        if (dragStartLevel !== null && dragEndLevel !== null && dragStartLevel !== dragEndLevel) {
          selectLevelRange(dragStartLevel, dragEndLevel);
        }
        dragStartLevel = null;
        dragEndLevel = null;
      }
    });

    if (levelColorCoding === 'none') {
      // Single colored bar
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = '100%';
      bar.style.width = '100%';
      bar.style.backgroundColor = '#1a4d8c';
      bar.style.borderRadius = '2px 2px 0 0';
      barContainer.appendChild(bar);
    } else {
      // Stacked bar
      let currentHeight = 0;
      
      if (levelColorCoding === 'race') {
        // Use fixed race order: Dwarf, Gnome, High Elf, Human, Night Elf, Goblin, Orc, Tauren, Troll, Undead
        const raceOrder = ['Dwarf', 'Gnome', 'High Elf', 'Human', 'Night Elf', 'Goblin', 'Orc', 'Tauren', 'Troll', 'Undead'];
        
        raceOrder.forEach(race => {
          const count = breakdown.races[race] || 0;
          if (count > 0) {
            const segment = document.createElement('div');
            segment.className = 'bar-segment';
            const segmentHeight = (count / value) * 100;
            segment.style.height = `${segmentHeight}%`;
            segment.style.backgroundColor = RACE_COLORS[race];
            segment.style.bottom = `${currentHeight}%`;
            segment.title = `Level ${label} - ${race}: ${count}`;
            currentHeight += segmentHeight;
            barContainer.appendChild(segment);
          }
        });
      } else if (levelColorCoding === 'class') {
        // Use fixed class order: Paladin, Druid, Hunter, Mage, Priest, Rogue, Warlock, Warrior, Shaman
        const classOrder = ['Paladin', 'Druid', 'Hunter', 'Mage', 'Priest', 'Rogue', 'Warlock', 'Warrior', 'Shaman'];
        
        classOrder.forEach(cls => {
          const count = breakdown.classes[cls] || 0;
          if (count > 0) {
            const segment = document.createElement('div');
            segment.className = 'bar-segment';
            const segmentHeight = (count / value) * 100;
            segment.style.height = `${segmentHeight}%`;
            segment.style.backgroundColor = CLASS_COLORS[cls];
            segment.style.bottom = `${currentHeight}%`;
            segment.title = `Level ${label} - ${cls}: ${count}`;
            currentHeight += segmentHeight;
            barContainer.appendChild(segment);
          }
        });
      } else if (levelColorCoding === 'faction') {
        // Faction segments
        const alliance = breakdown.factions.alliance || 0;
        const horde = breakdown.factions.horde || 0;
        
        if (alliance > 0) {
          const allianceSegment = document.createElement('div');
          allianceSegment.className = 'bar-segment';
          const allianceHeight = (alliance / value) * 100;
          allianceSegment.style.height = `${allianceHeight}%`;
          allianceSegment.style.backgroundColor = '#0070DE'; // Alliance blue
          allianceSegment.style.bottom = `${currentHeight}%`;
          allianceSegment.title = `Level ${label} - Alliance: ${alliance}`;
          currentHeight += allianceHeight;
          barContainer.appendChild(allianceSegment);
        }
        
        if (horde > 0) {
          const hordeSegment = document.createElement('div');
          hordeSegment.className = 'bar-segment';
          const hordeHeight = (horde / value) * 100;
          hordeSegment.style.height = `${hordeHeight}%`;
          hordeSegment.style.backgroundColor = '#C41F3B'; // Horde red
          hordeSegment.style.bottom = `${currentHeight}%`;
          hordeSegment.title = `Level ${label} - Horde: ${horde}`;
          barContainer.appendChild(hordeSegment);
        }
      }
    }


    // Add x-axis labels at 1 and every 5 levels; show 59 only when 60s are hidden
    if (label === 1 || label % 5 === 0 || (!showLevel60 && label === 59)) {
      const levelNotation = document.createElement('div');
      levelNotation.className = 'level-notation';
      levelNotation.textContent = label;
      barContainer.appendChild(levelNotation);
    }

    container.appendChild(barContainer);
  });
  
  // Add Y-axis labels
  addYAxisLabels(containerId, yAxisLabels, max);
  
  // Add right-side Y-axis labels
  addYAxisLabelsRight(containerId, yAxisLabels, max);
  
  // Add global mouse event handlers for drag selection
  container.addEventListener('mouseup', (event) => {
    if (isDragging && event.button === 0) {
      isDragging = false;
      if (dragStartLevel !== null && dragEndLevel !== null && dragStartLevel !== dragEndLevel) {
        selectLevelRange(dragStartLevel, dragEndLevel);
      }
      dragStartLevel = null;
      dragEndLevel = null;
    }
  });
  
  // Prevent text selection during drag
  container.addEventListener('selectstart', (event) => {
    if (isDragging) {
      event.preventDefault();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  readURLParams(); // Read initial URL parameters
  applyURLParams(); // Apply initial URL parameters to UI
  
  // Initialize chart toggle buttons
  updateChartToggleButton('race');
  updateChartToggleButton('class');
  updateChartContainerClass('race');
  updateChartContainerClass('class');

  document.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => {
      currentServer = btn.getAttribute('data-server');
      filters = { race: null, class: null, level: null };
      selectedLevels.clear(); // Clear level selections when changing server
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Show/hide Ambershire link
      const ambershireLink = document.getElementById('ambershire-link');
      if (ambershireLink) {
        ambershireLink.style.display = currentServer === 'Ambershire' ? 'block' : 'none';
      }
      
      updateURL(); // Update URL when server changes
      render();
    };
  });
  document.querySelector('.tab').classList.add('active');

  // Add faction filter event listeners
  document.querySelectorAll('.faction-filter').forEach(btn => {
    btn.onclick = () => {
      currentFaction = btn.getAttribute('data-faction');
      filters = { race: null, class: null, level: null };
      selectedLevels.clear(); // Clear level selections when changing faction
      document.querySelectorAll('.faction-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateURL(); // Update URL when faction changes
      render();
    };
  });

  // Toggle 60s visibility
  const toggle60sBtn = document.getElementById('toggle-60s');
  if (toggle60sBtn) {
    toggle60sBtn.addEventListener('click', () => {
      showLevel60 = !showLevel60;
      if (showLevel60) {
        toggle60sBtn.classList.remove('active');
        toggle60sBtn.textContent = 'Hide 60s';
      } else {
        toggle60sBtn.classList.add('active');
        toggle60sBtn.textContent = 'Show 60s';
      }
      updateURL(); // Update URL when 60s visibility changes
      render();
    });
  }

  // Add level color coding event listeners
  document.querySelectorAll('.level-color-coding').forEach(btn => {
    btn.onclick = () => {
      levelColorCoding = btn.getAttribute('data-coding');
      document.querySelectorAll('.level-color-coding').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateURL(); // Update URL when level color coding changes
      render();
    };
  });

  // Add clear selection button event listener
  const clearSelectionBtn = document.getElementById('clear-level-selection');
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', () => {
      clearLevelSelection();
    });
  }


  // Add chart toggle button event listeners
  document.querySelectorAll('.chart-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const chartType = btn.getAttribute('data-chart');
      toggleChartType(chartType);
    });
  });

  fetch(CENSUS_PATH)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      censusData = data;
      console.log('Census data loaded:', censusData);
      render();
    })
    .catch(err => {
      document.getElementById('app').innerHTML = '<p style="color:red">Failed to load census data. Ensure `census_summary.json` exists in `resources/data/`.</p>';
      console.error('ERROR: Fetch census data failed:', err);
    });

  // Add resize handler to re-render charts when window size changes
  window.addEventListener('resize', () => {
    if (censusData) {
      render();
    }
  });
});
