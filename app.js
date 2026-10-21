/* ==========================================================================
   桃園市小水力發電潛力場址 Web GIS 圖台 - Application Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // Global Variables
  let allSites = window.SITES_DATA || [];
  let filteredSites = [...allSites];
  let map = null;
  let markersGroup = null;
  let activeBasemap = 'osm';
  let tileLayers = {};

  // Filter State
  const filterState = {
    tier: 'ALL',
    rivers: new Set(),
    minKw: 0,
    minGen: 0,
    search: ''
  };

  // DOM Elements
  const kpiCount = document.getElementById('kpi-count');
  const kpiKw = document.getElementById('kpi-kw');
  const kpiGen = document.getElementById('kpi-gen');
  
  const inputSearch = document.getElementById('input-search');
  const tierPillsContainer = document.getElementById('tier-filter-pills');
  const riverChipsContainer = document.getElementById('river-filter-chips');
  const sliderKw = document.getElementById('slider-kw');
  const valKwSlider = document.getElementById('val-kw-slider');
  const sliderGen = document.getElementById('slider-gen');
  const valGenSlider = document.getElementById('val-gen-slider');
  const siteCardsList = document.getElementById('site-cards-list');

  // Modals
  const guidedModal = document.getElementById('guided-overview-modal');
  const btnCloseGuide = document.getElementById('btn-close-guide');
  const btnStartExplore = document.getElementById('btn-start-explore');
  const btnOpenGuide = document.getElementById('btn-open-guide');
  const btnResetFilters = document.getElementById('btn-reset-filters');
  const btnToggleBasemap = document.getElementById('btn-toggle-basemap');

  const siteEvalModal = document.getElementById('site-eval-modal');
  const btnCloseEval = document.getElementById('btn-close-eval');

  // Filter Panel Toggle
  const btnToggleFilters = document.getElementById('btn-toggle-filters');
  const filtersContainer = document.getElementById('filters-container');
  const listCountBadge = document.getElementById('list-count-badge');

  // Presets
  const presetTier1 = document.getElementById('preset-tier1');
  const presetHighKw = document.getElementById('preset-high-kw');
  const presetNankan = document.getElementById('preset-nankan');
  const presetLaojie = document.getElementById('preset-laojie');

  // Helper function to close guided modal
  function hideGuidedModal() {
    if (guidedModal) {
      guidedModal.classList.remove('active');
    }
  }

  function showGuidedModal() {
    if (guidedModal) {
      guidedModal.classList.add('active');
    }
  }

  // 1. Attach Modal & Control Event Listeners IMMEDIATELY
  function setupImmediateListeners() {
    // Filter Panel Toggle
    if (btnToggleFilters && filtersContainer) {
      btnToggleFilters.addEventListener('click', () => {
        btnToggleFilters.classList.toggle('collapsed');
        filtersContainer.classList.toggle('collapsed');
      });
    }

    // Guided Modal Actions
    if (btnCloseGuide) btnCloseGuide.addEventListener('click', hideGuidedModal);
    if (btnStartExplore) btnStartExplore.addEventListener('click', hideGuidedModal);
    if (btnOpenGuide) btnOpenGuide.addEventListener('click', showGuidedModal);

    // Close on Backdrop Click
    if (guidedModal) {
      guidedModal.addEventListener('click', (e) => {
        if (e.target === guidedModal) hideGuidedModal();
      });
    }

    if (siteEvalModal) {
      siteEvalModal.addEventListener('click', (e) => {
        if (e.target === siteEvalModal) siteEvalModal.classList.remove('active');
      });
    }

    if (btnCloseEval) {
      btnCloseEval.addEventListener('click', () => {
        siteEvalModal.classList.remove('active');
      });
    }

    // Preset Buttons
    if (presetTier1) {
      presetTier1.addEventListener('click', () => {
        resetFilters();
        selectTierPill('Ⅰ');
        hideGuidedModal();
      });
    }

    if (presetHighKw) {
      presetHighKw.addEventListener('click', () => {
        resetFilters();
        sliderKw.value = 100;
        filterState.minKw = 100;
        valKwSlider.innerText = '≥ 100 kW';
        applyFilters();
        hideGuidedModal();
      });
    }

    if (presetNankan) {
      presetNankan.addEventListener('click', () => {
        resetFilters();
        toggleRiverChip('南崁溪', true);
        hideGuidedModal();
      });
    }

    if (presetLaojie) {
      presetLaojie.addEventListener('click', () => {
        resetFilters();
        toggleRiverChip('老街溪', true);
        hideGuidedModal();
      });
    }

    // Search Input
    if (inputSearch) {
      inputSearch.addEventListener('input', (e) => {
        filterState.search = e.target.value.trim().toLowerCase();
        applyFilters();
      });
    }

    // Tier Pills
    if (tierPillsContainer) {
      tierPillsContainer.querySelectorAll('.tier-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          tierPillsContainer.querySelectorAll('.tier-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          filterState.tier = pill.dataset.tier;
          applyFilters();
        });
      });
    }

    // kW Slider
    if (sliderKw) {
      sliderKw.addEventListener('input', (e) => {
        filterState.minKw = parseFloat(e.target.value);
        valKwSlider.innerText = `≥ ${filterState.minKw} kW`;
        applyFilters();
      });
    }

    // Annual Gen Slider
    if (sliderGen) {
      sliderGen.addEventListener('input', (e) => {
        filterState.minGen = parseFloat(e.target.value);
        valGenSlider.innerText = `≥ ${filterState.minGen} 萬度`;
        applyFilters();
      });
    }

    // Reset Filters Button
    if (btnResetFilters) {
      btnResetFilters.addEventListener('click', resetFilters);
    }

    // Header Basemap Switcher Toggle
    if (btnToggleBasemap) {
      btnToggleBasemap.addEventListener('click', () => {
        const order = ['nlsc_emap', 'nlsc_photo', 'nlsc_cadastral', 'nlsc_b5000'];
        const nextIdx = (order.indexOf(activeBasemap) + 1) % order.length;
        switchBasemap(order[nextIdx]);
      });
    }

    // Attach NLSC Widget Layer Button Listeners
    const widget = document.getElementById('nlsc-basemap-widget');
    if (widget) {
      widget.querySelectorAll('.nlsc-layer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetLayer = btn.dataset.layer;
          if (targetLayer) switchBasemap(targetLayer);
        });
      });
    }
  }

  // Helper to switch basemap layers
  function switchBasemap(layerKey) {
    if (!map || !tileLayers[layerKey]) return;
    
    // Remove current basemap layer
    if (tileLayers[activeBasemap] && map.hasLayer(tileLayers[activeBasemap])) {
      map.removeLayer(tileLayers[activeBasemap]);
    }

    // Add new basemap layer
    tileLayers[layerKey].addTo(map);
    activeBasemap = layerKey;

    // Update active UI state on widget buttons
    const widget = document.getElementById('nlsc-basemap-widget');
    if (widget) {
      widget.querySelectorAll('.nlsc-layer-btn').forEach(btn => {
        if (btn.dataset.layer === layerKey) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  }

  // 2. Initialize River Chips
  function initRiverFilterChips() {
    const riversList = ['南崁溪', '老街溪', '社子溪', '大堀溪', '茄苳溪', '新街溪', '雙溪口溪', '埔心溪'];
    if (!riverChipsContainer) return;
    riverChipsContainer.innerHTML = '';
    
    riversList.forEach(river => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.dataset.river = river;
      chip.innerText = river;
      chip.addEventListener('click', () => {
        if (filterState.rivers.has(river)) {
          filterState.rivers.delete(river);
          chip.classList.remove('active');
        } else {
          filterState.rivers.add(river);
          chip.classList.add('active');
        }
        applyFilters();
      });
      riverChipsContainer.appendChild(chip);
    });
  }

  // 3. Initialize Leaflet Map with NLSC (國土測繪圖資服務雲) WMTS Layers
  function initMap() {
    if (!document.getElementById('map')) return;

    map = L.map('map', {
      center: [24.98, 121.25],
      zoom: 11,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // 1. 內政部國土測繪中心 - 臺灣通用電子地圖 (EMAP)
    tileLayers.nlsc_emap = L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://maps.nlsc.gov.tw/" target="_blank">內政部國土測繪中心 NLSC</a>'
    });

    // 2. 內政部國土測繪中心 - 正射影像圖 (PHOTO2)
    tileLayers.nlsc_photo = L.tileLayer('https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://maps.nlsc.gov.tw/" target="_blank">內政部國土測繪中心 NLSC</a>'
    });

    // 3. 內政部國土測繪中心 - 地籍圖 (LAND_OPENDATA) + EMAP 組合圖層
    const cadastralTiles = L.tileLayer('https://wmts.nlsc.gov.tw/wmts/LAND_OPENDATA/default/GoogleMapsCompatible/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://maps.nlsc.gov.tw/" target="_blank">內政部國土測繪中心 NLSC</a>'
    });
    tileLayers.nlsc_cadastral = L.layerGroup([
      tileLayers.nlsc_emap,
      cadastralTiles
    ]);

    // 4. 內政部國土測繪中心 - 1/5000 臺灣通用電子地圖 (B5000)
    tileLayers.nlsc_b5000 = L.tileLayer('https://wmts.nlsc.gov.tw/wmts/B5000/default/GoogleMapsCompatible/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://maps.nlsc.gov.tw/" target="_blank">內政部國土測繪中心 NLSC</a>'
    });

    // Set default basemap to NLSC 臺灣通用電子地圖
    activeBasemap = 'nlsc_emap';
    tileLayers.nlsc_emap.addTo(map);
    markersGroup = L.layerGroup().addTo(map);
  }

  function selectTierPill(tierVal) {
    if (!tierPillsContainer) return;
    tierPillsContainer.querySelectorAll('.tier-pill').forEach(p => {
      if (p.dataset.tier === tierVal) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
    filterState.tier = tierVal;
    applyFilters();
  }

  function toggleRiverChip(riverName, isSelect) {
    if (!riverChipsContainer) return;
    const chip = riverChipsContainer.querySelector(`.chip[data-river="${riverName}"]`);
    if (chip) {
      if (isSelect) {
        filterState.rivers.add(riverName);
        chip.classList.add('active');
      } else {
        filterState.rivers.delete(riverName);
        chip.classList.remove('active');
      }
      applyFilters();
    }
  }

  function resetFilters() {
    filterState.tier = 'ALL';
    filterState.rivers.clear();
    filterState.minKw = 0;
    filterState.minGen = 0;
    filterState.search = '';

    if (inputSearch) inputSearch.value = '';
    if (sliderKw) sliderKw.value = 0;
    if (valKwSlider) valKwSlider.innerText = '≥ 0 kW';
    if (sliderGen) sliderGen.value = 0;
    if (valGenSlider) valGenSlider.innerText = '≥ 0 萬度';

    selectTierPill('ALL');
    if (riverChipsContainer) {
      riverChipsContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    }

    applyFilters();
  }

  // 4. Apply Filters
  function applyFilters() {
    filteredSites = allSites.filter(site => {
      if (filterState.tier !== 'ALL' && site.tier !== filterState.tier) return false;
      if (filterState.rivers.size > 0 && !Array.from(filterState.rivers).some(r => site.river.includes(r))) return false;
      if (site.capacity_kw < filterState.minKw) return false;
      if (site.annual_gen_10k < filterState.minGen) return false;
      if (filterState.search) {
        const fullText = (site.title + ' ' + site.river + ' ' + site.structure_type + ' ' + site.notes).toLowerCase();
        if (!fullText.includes(filterState.search)) return false;
      }
      return true;
    });

    updateKpiRibbon();
    renderMapMarkers();
    renderSiteCards();
  }

  // 5. Update KPI Ribbon
  function updateKpiRibbon() {
    if (!kpiCount) return;
    const totalCount = filteredSites.length;
    const totalKw = filteredSites.reduce((sum, s) => sum + s.capacity_kw, 0);
    const totalGen = filteredSites.reduce((sum, s) => sum + s.annual_gen_10k, 0);

    kpiCount.innerText = `${totalCount} / ${allSites.length}`;
    kpiKw.innerText = `${totalKw.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`;
    kpiGen.innerText = `${totalGen.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} 萬度`;
    if (listCountBadge) {
      listCountBadge.innerText = `${totalCount} 個場址`;
    }
  }

  // 6. Render Map Markers
  function renderMapMarkers() {
    if (!markersGroup) return;
    markersGroup.clearLayers();

    filteredSites.forEach(site => {
      if (site.lat && site.lng) {
        const color = getTierColor(site.tier);
        const size = Math.max(26, Math.min(42, 24 + (site.capacity_kw / 15)));

        const customIcon = L.divIcon({
          className: 'custom-marker-wrapper',
          html: `
            <div class="custom-leaflet-marker" style="width: ${size}px; height: ${size}px; color: ${color};">
              <div class="marker-inner" style="background: ${color};">
                ${site.sort_no}
              </div>
            </div>
          `,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        });

        const marker = L.marker([site.lat, site.lng], { icon: customIcon });

        const popupHtml = `
          <div style="min-width: 220px; font-family: 'Noto Sans TC', sans-serif;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #0b0f19;">${site.title}</div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">${site.river} · 開發分級：<strong style="color: ${color};">${site.tier}</strong></div>
            <div style="background: #f1f5f9; padding: 6px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 8px;">
              <div>裝置容量：<strong>${site.capacity_kw} kW</strong></div>
              <div>年發電量：<strong>${site.annual_gen_10k} 萬度/年</strong></div>
            </div>
            <button onclick="window.openSiteModal(${site.sort_no})" style="width: 100%; background: #00f2fe; color: #0b0f19; border: none; padding: 6px; border-radius: 4px; font-weight: 700; font-size: 12px; cursor: pointer;">
              查看完整初評表 <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        `;

        marker.bindPopup(popupHtml);
        markersGroup.addLayer(marker);
      }
    });
  }

  // 7. Render Sidebar Site Cards
  function renderSiteCards() {
    if (!siteCardsList) return;
    siteCardsList.innerHTML = '';

    if (filteredSites.length === 0) {
      siteCardsList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
          <i class="fa-solid fa-filter-circle-xmark" style="font-size: 36px; margin-bottom: 12px; color: var(--text-dim);"></i>
          <p>無符合條件之場址，請嘗試調整篩選條件。</p>
        </div>
      `;
      return;
    }

    filteredSites.forEach(site => {
      const card = document.createElement('div');
      card.className = `site-card tier-${site.tier}`;
      card.innerHTML = `
        <div class="card-top">
          <div class="card-title">
            <span class="card-no">#${site.sort_no}</span>
            <span class="title-text">${site.title}</span>
          </div>
          <span class="tier-badge ${getTierBadgeClass(site.tier)}">第 ${site.tier} 級</span>
        </div>

        <div class="card-metrics">
          <div class="metric-cell">
            <span class="metric-lbl">設計流量</span>
            <span class="metric-val">${site.q50_text}</span>
          </div>
          <div class="metric-cell">
            <span class="metric-lbl">裝置容量</span>
            <span class="metric-val">${site.capacity_kw} kW</span>
          </div>
          <div class="metric-cell">
            <span class="metric-lbl">年發電量</span>
            <span class="metric-val">${site.annual_gen_10k} 萬度</span>
          </div>
        </div>

        <div class="card-footer">
          <div class="river-tag"><i class="fa-solid fa-water"></i> 流域：<strong>${site.river}</strong></div>
          <div class="click-hint">詳細初評表 <i class="fa-solid fa-angle-right"></i></div>
        </div>

        ${site.notes ? `
          <div class="card-notes-alert">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>${site.notes}</span>
          </div>
        ` : ''}
      `;

      card.addEventListener('click', () => {
        if (site.lat && site.lng && map) {
          map.flyTo([site.lat, site.lng], 14, { duration: 1.2 });
        }
        openSiteEvalModal(site);
      });

      siteCardsList.appendChild(card);
    });
  }

  // 8. Open Full Site Evaluation Modal (對照 chrome_5lRckHqWGg.png)
  function openSiteEvalModal(site) {
    if (!siteEvalModal) return;
    
    document.getElementById('eval-modal-title').innerText = site.title;
    const badge = document.getElementById('eval-modal-tier-badge');
    badge.className = `tier-badge ${getTierBadgeClass(site.tier)}`;
    badge.innerText = `第 ${site.tier} 級`;

    // Photo Gallery
    const heroImg = document.getElementById('eval-hero-img');
    const thumbsRow = document.getElementById('eval-thumbs-row');
    thumbsRow.innerHTML = '';

    if (site.images && site.images.length > 0) {
      heroImg.src = site.images[0];
      site.images.forEach((imgUrl, idx) => {
        const thumb = document.createElement('div');
        thumb.className = `thumb-item ${idx === 0 ? 'active' : ''}`;
        thumb.innerHTML = `<img src="${imgUrl}" alt="場址相片 ${idx+1}" />`;
        thumb.addEventListener('click', () => {
          heroImg.src = imgUrl;
          thumbsRow.querySelectorAll('.thumb-item').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
        });
        thumbsRow.appendChild(thumb);
      });
      document.getElementById('gallery-section').style.display = 'flex';
    } else {
      document.getElementById('gallery-section').style.display = 'none';
    }

    // Table Fields
    document.getElementById('ev-location').innerText = site.location_desc || site.title;
    document.getElementById('ev-tier-text').innerText = `第 ${site.tier} 級 (${getTierDescription(site.tier)})`;
    document.getElementById('ev-notes').innerText = site.notes || '無特殊限制';
    document.getElementById('ev-coord').innerText = site.twd97_coord || (site.lat ? `WGS84: ${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}` : '-');
    document.getElementById('ev-river').innerText = site.river;
    document.getElementById('ev-struct').innerText = site.structure_type;
    document.getElementById('ev-dev-type').innerText = site.development_type;

    document.getElementById('ev-q50').innerText = site.q50_text;
    document.getElementById('ev-head').innerText = site.head_text;
    document.getElementById('ev-kw').innerText = `${site.capacity_kw} kW`;
    document.getElementById('ev-gen').innerText = `${site.annual_gen_10k} 萬度/年`;

    document.getElementById('ev-land-owner').innerText = site.land_owner;
    document.getElementById('ev-indigenous').innerText = site.indigenous_land;

    document.getElementById('ev-ecology').innerText = site.ecology_items;

    document.getElementById('ev-grid').innerText = site.grid_distance;
    document.getElementById('ev-road').innerText = site.road_distance;

    document.getElementById('ev-promotion').innerText = site.promotion_factors;

    siteEvalModal.classList.add('active');
  }

  // Global window handle for Leaflet Popup button
  window.openSiteModal = function(sortNo) {
    const site = allSites.find(s => s.sort_no === sortNo);
    if (site) {
      openSiteEvalModal(site);
    }
  };

  // Helper utilities
  function getTierColor(tier) {
    switch (tier) {
      case 'Ⅰ': return '#00f2fe';
      case 'Ⅱ': return '#43e97b';
      case 'Ⅲ': return '#f6d365';
      case 'Ⅳ': return '#fda085';
      case 'Ⅴ': return '#ff416c';
      default: return '#00f2fe';
    }
  }

  function getTierBadgeClass(tier) {
    switch (tier) {
      case 'Ⅰ': return 't1';
      case 'Ⅱ': return 't2';
      case 'Ⅲ': return 't3';
      case 'Ⅳ': return 't4';
      case 'Ⅴ': return 't5';
      default: return 't1';
    }
  }

  function getTierDescription(tier) {
    switch (tier) {
      case 'Ⅰ': return '最優先開發場址，條件良好';
      case 'Ⅱ': return '次優先，需注意住宅噪音/配合降高計畫';
      case 'Ⅲ': return '中等條件，新街溪區段';
      case 'Ⅳ': return '基礎條件，茄苳溪區段';
      case 'Ⅴ': return '需額外評估，現勘流量偏少/位於改道範圍';
      default: return '評估中';
    }
  }

  // EXECUTION START
  setupImmediateListeners();
  initMap();
  initRiverFilterChips();
  applyFilters();

  // If fetch is available, update data dynamically as secondary fallback
  if (typeof fetch === 'function') {
    fetch('sites_full_data.json?v=6.0')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          allSites = data;
          applyFilters();
        }
      })
      .catch(e => {
        // Silently use inline window.SITES_DATA fallback
      });
  }

});
