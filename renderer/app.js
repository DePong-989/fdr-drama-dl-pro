/**
 * HONGGUO CINEMA PRO - Client Application Controller
 * Pure Hongguo Official Duanju Experience
 * 100% Episode Coverage (60-120+ Episodes per drama) & Futuristic Luxury VIP UI
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Universal Electron API Bridge reference
  const api = window.electronAPI || window.api || {};

  // Application State
  let currentLang = 'km';
  let currentView = 'catalog';
  let selectedFormat = 'all'; // 'all' | 'landscape' | 'vertical' | 'trending' | 'real-drama' | 'comic'
  let selectedGenre = 'all';  // 'all' | '战神' | '逆袭' | '总裁' | '甜宠' | '重生' | '神豪' | '赘婿' | '古装' | '悬疑' | '喜剧'
  let selectedSort = 'popular'; // 'popular' | 'newest' | 'episodes'
  let currentKeyword = '';
  let currentPage = 1;
  let totalPages = 100;
  let isLoadingMore = false;
  let hasMoreDramas = true;
  let loadedDramaCount = 0;
  let totalDramasAvailable = 0;
  let currentSettings = {
    downloadDir: 'D:\\FDR Downlaod',
    concurrentDownloads: 5,
    maxConcurrent: 5,
    language: 'km'
  };

  // Detail Modal State
  let currentDetailDrama = null;
  let currentAllEpisodes = [];
  let selectedEpisodeIndices = new Set();
  let currentModalDestDir = '';

  // DOM Elements - Viewport & Layout
  const cinemaViewport = document.querySelector('.cinema-viewport');

  // DOM Elements - Cinema Intro Power System
  const cinemaIntroOverlay = document.getElementById('cinema-intro-overlay');
  const btnPowerOn = document.getElementById('btn-power-on');
  const btnPowerOff = document.getElementById('btn-power-off');

  // DOM Elements - Window & Header
  const btnMinimize = document.getElementById('btn-minimize');
  const btnMaximize = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');
  const dockTabs = document.querySelectorAll('.dock-tab');
  const cinemaViews = document.querySelectorAll('.cinema-view');
  const badgeDlCount = document.getElementById('badge-dl-count');
  const topDestDisplay = document.getElementById('top-dest-display');
  const btnQuickDest = document.getElementById('btn-quick-dest');
  const langDots = document.querySelectorAll('.lang-dot');

  // DOM Elements - Catalog
  const inputCinemaSearch = document.getElementById('input-cinema-search');
  const btnCinemaSearch = document.getElementById('btn-cinema-search');
  const formatPills = document.querySelectorAll('#format-pills-wrap .cat-pill');
  const genrePills = document.querySelectorAll('#genre-pills-wrap .cat-pill');
  const selectCatalogSort = document.getElementById('select-catalog-sort');
  const btnSyncCatalog = document.getElementById('btn-sync-catalog');
  const catalogHeadingTitle = document.getElementById('catalog-heading-title');
  const catalogTotalCounter = document.getElementById('catalog-total-counter');
  const hongguoGrid = document.getElementById('hongguo-grid');
  const catalogInfiniteLoading = document.getElementById('catalog-infinite-loading');
  const catalogInfiniteEnd = document.getElementById('catalog-infinite-end');
  const catalogEndText = document.getElementById('catalog-end-text');
  const btnCatalogScrollTop = document.getElementById('btn-catalog-scroll-top');

  // DOM Elements - Clean Disk
  const btnCleanDiskDownloads = document.getElementById('btn-clean-disk-downloads');
  const btnCleanDiskSettings = document.getElementById('btn-clean-disk-settings');

  // DOM Elements - Downloads Hub
  const dlDestFullPath = document.getElementById('dl-dest-full-path');
  const btnChangeDestFolder = document.getElementById('btn-change-dest-folder');
  const tabToggleBtns = document.querySelectorAll('.tab-toggle-btn');
  const countTabDownloading = document.getElementById('count-tab-downloading');
  const countTabCompleted = document.getElementById('count-tab-completed');
  const btnStartAllQueue = document.getElementById('btn-start-all-queue');
  const btnResumeAll = document.getElementById('btn-resume-all');
  const btnPauseAll = document.getElementById('btn-pause-all');
  const btnClearCompleted = document.getElementById('btn-clear-completed');
  const btnOpenFolder = document.getElementById('btn-open-folder');
  const tasksStreamContainer = document.getElementById('tasks-stream-container');
  let currentDlTab = 'downloading';
  let cachedTasks = [];

  // DOM Elements - Settings
  const settingPathInput = document.getElementById('setting-path-input');
  const btnBrowseSetting = document.getElementById('btn-browse-setting');
  const settingConcurrentSlider = document.getElementById('setting-concurrent-slider');
  const settingConcurrentLabel = document.getElementById('setting-concurrent-label');
  const settingLangDropdown = document.getElementById('setting-lang-dropdown');
  const btnConfirmSaveSettings = document.getElementById('btn-confirm-save-settings');

  // DOM Elements - Detail Modal
  const modalDetail = document.getElementById('modal-detail');
  const btnCloseDetail = document.getElementById('btn-close-detail');
  const detailPosterImg = document.getElementById('detail-poster-img');
  const detailTitleZh = document.getElementById('detail-title-zh');
  const detailTagsRow = document.getElementById('detail-tags-row');
  const modalDestPathText = document.getElementById('modal-dest-path-text');
  const btnModalChangeDir = document.getElementById('btn-modal-change-dir');
  const detailDescText = document.getElementById('detail-desc-text');
  const detailTotalEpBadge = document.getElementById('detail-total-ep-badge');
  const btnSelectAllEps = document.getElementById('btn-select-all-eps');
  const btnDeselectAllEps = document.getElementById('btn-deselect-all-eps');
  const btnInvertSelectEps = document.getElementById('btn-invert-select-eps');
  const btnDownloadSelectedEps = document.getElementById('btn-download-selected-eps');
  const selectedCountNum = document.getElementById('selected-count-num');
  const btnDownloadAllEps = document.getElementById('btn-download-all-eps');
  const btnDownloadThumbOnly = document.getElementById('btn-download-thumb-only');
  const rangeFiltersBar = document.getElementById('range-filters-bar');
  const detailEpisodesGrid = document.getElementById('detail-episodes-grid');

  // DOM Elements - Multi-Season Album
  const modalAlbumBar = document.getElementById('modal-album-bar');
  const albumCountTag = document.getElementById('album-count-tag');
  const albumSeasonPills = document.getElementById('album-season-pills');
  const btnDownloadAllSeasons = document.getElementById('btn-download-all-seasons');

  // DOM Elements - Player Modal & Playlist Navigation
  const modalPlayer = document.getElementById('modal-player');
  const btnClosePlayer = document.getElementById('btn-close-player');
  const playerTitleDisplay = document.getElementById('player-title-display');
  const cinemaVideo = document.getElementById('cinema-video');
  const playerEpNavBar = document.getElementById('player-ep-nav-bar');
  const playerEpIndicator = document.getElementById('player-ep-indicator');
  const btnPlayerPrevEp = document.getElementById('btn-player-prev-ep');
  const btnPlayerNextEp = document.getElementById('btn-player-next-ep');
  let currentPlaylist = [];
  let currentPlaylistIndex = 0;
  let hlsInstance = null;

  // DOM Elements - Favorites
  const badgeFavCount = document.getElementById('badge-fav-count');
  const favoritesGrid = document.getElementById('favorites-grid');
  const favoritesTotalCounter = document.getElementById('favorites-total-counter');
  const btnModalFav = document.getElementById('btn-modal-fav');
  const btnModalCopyLinks = document.getElementById('btn-modal-copy-links');
  let favoritesList = [];

  // DOM Elements - Auto-Shutdown & Export
  const btnAutoShutdown = document.getElementById('btn-auto-shutdown');
  const autoShutdownState = document.getElementById('auto-shutdown-state');
  const btnExportDownloadList = document.getElementById('btn-export-download-list');
  const modalShutdown = document.getElementById('modal-shutdown');
  const shutdownTimerSeconds = document.getElementById('shutdown-timer-seconds');
  const btnCancelShutdown = document.getElementById('btn-cancel-shutdown');
  const btnConfirmShutdownNow = document.getElementById('btn-confirm-shutdown-now');
  let isAutoShutdownEnabled = false;
  let shutdownCountdownInterval = null;
  let shutdownSecondsRemaining = 60;
  let isShutdownTriggered = false;

  // Toast
  const cinemaToast = document.getElementById('cinema-toast');
  let toastTimer = null;
  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    cinemaToast.textContent = msg;
    cinemaToast.classList.add('active');
    toastTimer = setTimeout(() => {
      cinemaToast.classList.remove('active');
    }, 3200);
  }

  // 1. Initial Load of Settings & Output Directory
  try {
    const loadedSettings = await api.getSettings();
    if (loadedSettings) {
      currentSettings = { ...currentSettings, ...loadedSettings };
    }
  } catch (e) {
    console.warn('Failed to load settings from Electron:', e);
  }

  async function updateDiskSpaceUI(folderPath) {
    const badge = document.getElementById('dest-disk-badge');
    if (!badge) return;
    try {
      const info = await api.getDiskSpace(folderPath);
      if (info && info.success) {
        badge.textContent = `💾 ${info.driveLabel}: នៅសល់ ${info.freeGb} GB / ${info.totalGb} GB`;
        if (parseFloat(info.freeGb) < 5) {
          badge.classList.add('warning');
        } else {
          badge.classList.remove('warning');
        }
      } else {
        badge.textContent = '💾 Drive D: ទំហំទំនេរគ្រប់គ្រាន់';
      }
    } catch (e) {
      badge.textContent = '💾 Drive D: ទំហំទំនេរគ្រប់គ្រាន់';
    }
  }

  function updateDestPathUI(newPath) {
    if (!newPath) return;
    currentSettings.downloadDir = newPath;
    currentModalDestDir = newPath;
    if (topDestDisplay) topDestDisplay.textContent = newPath;
    if (dlDestFullPath) dlDestFullPath.textContent = newPath;
    if (settingPathInput) settingPathInput.value = newPath;
    if (modalDestPathText) modalDestPathText.textContent = newPath;
    updateDiskSpaceUI(newPath);
  }

  updateDestPathUI(currentSettings.downloadDir);

  const quickConcurrentSelect = document.getElementById('quick-concurrent-select');
  if (quickConcurrentSelect) {
    quickConcurrentSelect.value = currentSettings.maxConcurrent || currentSettings.concurrentDownloads || 5;
    quickConcurrentSelect.addEventListener('change', async () => {
      const val = parseInt(quickConcurrentSelect.value, 10) || 5;
      currentSettings.maxConcurrent = val;
      currentSettings.concurrentDownloads = val;
      if (settingConcurrentSlider) {
        settingConcurrentSlider.value = val;
        settingConcurrentLabel.textContent = `${val} Tasks`;
      }
      await api.saveSettings(currentSettings);
      showToast(`⚡ បានប្តូរចំនួនទាញយកដំណាលគ្នាទៅ: ${val} ភាគព្រមគ្នា (Parallel)!`);
    });
  }

  // 2. Window Controls
  if (btnMinimize) btnMinimize.onclick = () => api.minimizeWindow();
  if (btnMaximize) btnMaximize.onclick = () => api.maximizeWindow();
  if (btnClose) btnClose.onclick = () => api.closeWindow();

  // 2.1. Cinema Intro Power System (Power ON & Red Button Power OFF)
  if (btnPowerOn && cinemaIntroOverlay) {
    let isLaunching = false;
    btnPowerOn.addEventListener('click', () => {
      if (isLaunching) return;
      isLaunching = true;
      btnPowerOn.style.transform = 'scale(0.95)';
      btnPowerOn.style.boxShadow = '0 0 35px rgba(16, 185, 129, 0.8)';
      cinemaIntroOverlay.classList.add('fade-out');

      setTimeout(async () => {
        cinemaIntroOverlay.style.display = 'none';
        try {
          if (api.launchMainApp) {
            await api.launchMainApp();
          } else if (api.maximizeWindow) {
            await api.maximizeWindow();
          }
        } catch (err) {
          console.error('Launch main app error:', err);
        }
      }, 280);
    });
  }

  if (btnPowerOff) {
    btnPowerOff.addEventListener('click', () => {
      btnPowerOff.style.transform = 'scale(0.92)';
      setTimeout(() => {
        api.closeWindow();
      }, 200);
    });
  }

  // Helper: Update Catalog Heading Title dynamically
  function updateCatalogHeading() {
    if (!catalogHeadingTitle) return;
    if (currentKeyword) {
      if (/hongguoduanju\.com/i.test(currentKeyword) || /\d{17,20}/.test(currentKeyword)) {
        catalogHeadingTitle.textContent = '🔗 លទ្ធផលតាម Link/ID Hongguo:';
      } else {
        catalogHeadingTitle.textContent = `🔍 ស្វែងរក: "${currentKeyword}"`;
      }
      return;
    }

    const activeFormatPill = document.querySelector('#format-pills-wrap .cat-pill.active');
    const activeGenrePill = document.querySelector('#genre-pills-wrap .cat-pill.active');
    const formatText = activeFormatPill ? activeFormatPill.textContent.trim() : '';
    const genreText = activeGenrePill ? activeGenrePill.textContent.trim() : '';

    if (selectedFormat !== 'all' && selectedGenre !== 'all') {
      catalogHeadingTitle.textContent = `🎬 ${formatText} + 🏷️ ${genreText} • Hongguo Official`;
    } else if (selectedFormat !== 'all') {
      catalogHeadingTitle.textContent = `🎬 ${formatText} • Hongguo Official`;
    } else if (selectedGenre !== 'all') {
      catalogHeadingTitle.textContent = `🎬 🏷️ ${genreText} • Hongguo Official`;
    } else {
      catalogHeadingTitle.textContent = '🎬 រឿងភាគ Hongguo Official VIP';
    }
  }

  // 3. Navigation Switcher
  dockTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.getAttribute('data-view');

      if (targetView === 'favorites') {
        switchView('favorites');
        dockTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderFavorites();
        return;
      }

      if (targetView === 'catalog') {
        switchView('catalog');
        dockTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        formatPills.forEach(p => p.classList.remove('active'));
        const allFormatPill = document.querySelector('#format-pills-wrap .cat-pill[data-format="all"]');
        if (allFormatPill) allFormatPill.classList.add('active');
        selectedFormat = 'all';

        genrePills.forEach(p => p.classList.remove('active'));
        const allGenrePill = document.querySelector('#genre-pills-wrap .cat-pill[data-genre="all"]');
        if (allGenrePill) allGenrePill.classList.add('active');
        selectedGenre = 'all';

        currentKeyword = '';
        if (inputCinemaSearch) inputCinemaSearch.value = '';
        currentPage = 1;
        updateCatalogHeading();
        loadHongguoDramas();
        return;
      }

      switchView(targetView);
    });
  });

  function switchView(viewName) {
    currentView = viewName;
    const effectiveView = viewName;

    dockTabs.forEach(t => {
      if (t.getAttribute('data-view') === viewName) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    cinemaViews.forEach(v => {
      if (v.id === `view-${effectiveView}`) {
        v.classList.add('active');
      } else {
        v.classList.remove('active');
      }
    });

    if (viewName === 'downloads') {
      renderDownloadTasks();
    } else if (viewName === 'favorites') {
      renderFavorites();
    }
  }

  // 4. Output Folder Picking
  async function pickDirectory() {
    try {
      const res = await api.selectFolder();
      if (res.success && res.folder) {
        updateDestPathUI(res.folder);
        await api.saveSettings({
          ...currentSettings,
          downloadDir: res.folder
        });
        showToast(`📁 បានប្តូរថតទាញយកទៅកាន់: ${res.folder}`);
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (btnQuickDest) btnQuickDest.onclick = pickDirectory;
  if (btnChangeDestFolder) btnChangeDestFolder.onclick = pickDirectory;
  if (btnBrowseSetting) btnBrowseSetting.onclick = pickDirectory;
  if (btnModalChangeDir) btnModalChangeDir.onclick = pickDirectory;

  // 5. Multi-Dimensional Category Filtering (Row 1: Format + Row 2: Genre)
  formatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      formatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedFormat = pill.getAttribute('data-format') || 'all';
      currentKeyword = '';
      if (inputCinemaSearch) inputCinemaSearch.value = '';
      currentPage = 1;
      updateCatalogHeading();
      if (cinemaViewport) cinemaViewport.scrollTo({ top: 0, behavior: 'smooth' });
      loadHongguoDramas();
    });
  });

  genrePills.forEach(pill => {
    pill.addEventListener('click', () => {
      genrePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedGenre = pill.getAttribute('data-genre') || 'all';
      currentKeyword = '';
      if (inputCinemaSearch) inputCinemaSearch.value = '';
      currentPage = 1;
      updateCatalogHeading();
      if (cinemaViewport) cinemaViewport.scrollTo({ top: 0, behavior: 'smooth' });
      loadHongguoDramas();
    });
  });

  // 7. Search Handling (Supports both title and direct Hongguo link)
  async function performSearch() {
    const val = (inputCinemaSearch.value || '').trim();
    if (!val) {
      currentKeyword = '';
      currentPage = 1;
      updateCatalogHeading();
      loadHongguoDramas();
      return;
    }
    currentKeyword = val;
    currentPage = 1;
    updateCatalogHeading();
    loadHongguoDramas();
  }

  if (btnCinemaSearch) btnCinemaSearch.onclick = performSearch;
  if (inputCinemaSearch) {
    inputCinemaSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch();
    });
  }

  // 7.1. Catalog Sort Handling
  if (selectCatalogSort) {
    selectCatalogSort.addEventListener('change', () => {
      selectedSort = selectCatalogSort.value || 'popular';
      currentPage = 1;
      loadHongguoDramas();
    });
  }

  // 7.2. 1-Click Sync Latest Hongguo Releases
  if (btnSyncCatalog) {
    btnSyncCatalog.addEventListener('click', async () => {
      if (btnSyncCatalog.classList.contains('syncing')) return;
      btnSyncCatalog.classList.add('syncing');
      btnSyncCatalog.disabled = true;
      showToast('🔄 កំពុងពិនិត្យ និងទាញយករឿងថ្មីៗចុងក្រោយបំផុត...');

      try {
        const res = await api.syncLatestDramas();
        if (res && res.success) {
          const totalCount = res.totalCount || res.totalCatalog || 14116;
          showToast(`✅ អាប់ដេតជោគជ័យ! បន្ថែមបាន ${res.newCount} រឿងថ្មី (សរុប ${totalCount.toLocaleString()} រឿង)`);
          currentPage = 1;
          await loadHongguoDramas();
        } else {
          showToast('⚠️ ការអាប់ដេតបានបញ្ចប់ (មិនមានរឿងថ្មីបន្ថែមទេ)');
        }
      } catch (err) {
        console.error('Sync latest error:', err);
        showToast('❌ បរាជ័យក្នុងការអាប់ដេត: ' + (err.message || 'Error'));
      } finally {
        btnSyncCatalog.classList.remove('syncing');
        btnSyncCatalog.disabled = false;
      }
    });
  }

  // 7.3. Clean Disk Cache & Temp Handler
  async function handleCleanDisk() {
    const confirmClean = confirm(
      '🧹 សម្អាតទំហំ Disk (Clear Cache & Temp):\n\n' +
      'តើអ្នកពិតជាចង់លុបឯកសារបណ្ដោះអាសន្ន .part, preview thumbnails, និង session cache ដែរឬទេ?\n' +
      '(ចំណាំ៖ វីដេអូដែលបានទាញយកចប់ ១០០% នឹងមិនត្រូវបានប៉ះពាល់ឡើយ)'
    );
    if (!confirmClean) return;

    showToast('🧹 កំពុងសម្អាត Temp និង Cache files...');
    try {
      const res = await api.cleanDiskCache();
      if (res && res.success) {
        showToast(`✅ បានសម្អាតរួចរាល់! ចំណេញបានទំហំ Disk: ${res.formattedFreed || '0 MB'}`);
        await updateDiskSpaceUI(currentSettings.downloadDir);
      } else {
        showToast('⚠️ មិនមាន File Cache ចាស់ៗត្រូវសម្អាតទេ');
      }
    } catch (err) {
      console.error('Clean disk error:', err);
      showToast('❌ បរាជ័យក្នុងការសម្អាត: ' + (err.message || 'Error'));
    }
  }

  if (btnCleanDiskDownloads) {
    btnCleanDiskDownloads.addEventListener('click', handleCleanDisk);
  }
  if (btnCleanDiskSettings) {
    btnCleanDiskSettings.addEventListener('click', handleCleanDisk);
  }

  // Helper: Verify if drama was released in the last 3 days
  function isDramaNewRelease(drama) {
    if (!drama) return false;
    if (typeof drama.isNew === 'boolean') return drama.isNew;
    try {
      const now = Date.now();
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      if (drama.releaseTime) {
        const diff = now - Number(drama.releaseTime);
        return diff <= THREE_DAYS_MS && diff >= -3600000;
      }
      if (drama.addedAt) {
        const diff = now - Number(drama.addedAt);
        return diff <= THREE_DAYS_MS && diff >= -3600000;
      }
      if (drama.id && /^\d{18,20}$/.test(String(drama.id))) {
        const id = BigInt(drama.id);
        const tsSec = Number(id >> 32n);
        if (tsSec > 1500000000 && tsSec < 2100000000) {
          const diff = now - (tsSec * 1000);
          return diff <= THREE_DAYS_MS && diff >= -3600000;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // Helper: Create single Drama Card DOM Element with Favorite Bookmark Star
  function createDramaCardElement(drama) {
    const card = document.createElement('div');
    card.className = 'hongguo-card';

    const isFav = favoritesList.some(f => String(f.id) === String(drama.id) || f.title === drama.title);
    const epCount = drama.episodesCount || 80;
    const isAlbum = drama.isAlbum || (drama.seasons && drama.seasons.length > 1);
    const albumBadgeHtml = isAlbum 
      ? `<div class="card-badge-album">${drama.albumBadge || `👑 Album: ${drama.seasons ? drama.seasons.length : 2} រដូវកាល`}</div>` 
      : '';
    const isNew = drama.isNew !== undefined ? drama.isNew : isDramaNewRelease(drama);
    const newBadgeHtml = isNew ? `<div class="card-badge-new">🔥 NEW</div>` : '';

    card.innerHTML = `
      <div class="card-poster-wrap">
        <img src="${drama.cover || ''}" alt="${drama.title}" class="card-poster" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'280\\' fill=\\'%23111\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23151b28\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%23888\\' font-size=\\'14\\' text-anchor=\\'middle\\'>Hongguo</text></svg>'">
        ${newBadgeHtml}
        <div class="card-badge-vip">1080P VIP</div>
        <div class="card-badge-ep">${epCount} ភាគ</div>
        ${albumBadgeHtml}
        <button class="card-fav-star-btn ${isFav ? 'active' : ''}" title="${isFav ? 'ដកចេញពីរឿងពេញចិត្ត' : 'ដាក់ចូលរឿងពេញចិត្ត'}">⭐</button>
        <div class="card-hover-actions">
          <button class="btn-card-quick-view">⚡ បើកមើលគ្រប់ភាគ</button>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title-zh" title="${drama.title}">${drama.title}</div>
        <div class="card-meta-line">
          <span class="card-tag">${drama.category || 'Hongguo VIP'}</span>
          <span>✅ ${epCount} ភាគ</span>
        </div>
      </div>
    `;

    const starBtn = card.querySelector('.card-fav-star-btn');
    if (starBtn) {
      starBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavoriteDrama(drama);
      });
    }

    card.addEventListener('click', () => openDramaDetail(drama));
    return card;
  }

  // 8. Infinite Scroll System (No "Next" Button Needed!)
  async function loadMoreDramas() {
    if (isLoadingMore || !hasMoreDramas) return;
    if (currentPage >= totalPages || (totalDramasAvailable > 0 && loadedDramaCount >= totalDramasAvailable)) {
      hasMoreDramas = false;
      if (catalogInfiniteEnd) {
        catalogInfiniteEnd.style.display = 'flex';
        if (catalogEndText) {
          catalogEndText.textContent = `🎉 បានបង្ហាញរឿងទាំងអស់ក្នុងជម្រើសនេះរួចរាល់ (${totalDramasAvailable.toLocaleString()} រឿង)`;
        }
      }
      return;
    }

    isLoadingMore = true;
    if (catalogInfiniteLoading) catalogInfiniteLoading.style.display = 'flex';
    if (catalogInfiniteEnd) catalogInfiniteEnd.style.display = 'none';

    try {
      currentPage++;
      const res = await api.searchDramas({
        keyword: currentKeyword,
        format: selectedFormat,
        genre: selectedGenre,
        page: currentPage,
        sort: selectedSort
      });

      if (res && res.success && Array.isArray(res.list) && res.list.length > 0) {
        const newDramas = res.list;
        newDramas.forEach(drama => {
          hongguoGrid.appendChild(createDramaCardElement(drama));
        });

        loadedDramaCount += newDramas.length;
        totalPages = res.pagecount || totalPages;
        if (res.total) totalDramasAvailable = res.total;

        if (catalogTotalCounter) {
          if (currentKeyword) {
            catalogTotalCounter.textContent = `បង្ហាញ ${loadedDramaCount.toLocaleString()} / ${totalDramasAvailable.toLocaleString()} រឿង (ស្វែងរក)`;
          } else {
            catalogTotalCounter.textContent = `បង្ហាញ ${loadedDramaCount.toLocaleString()} / ${totalDramasAvailable.toLocaleString()} រឿង`;
          }
        }

        if (currentPage >= totalPages || loadedDramaCount >= totalDramasAvailable) {
          hasMoreDramas = false;
          if (catalogInfiniteEnd) {
            catalogInfiniteEnd.style.display = 'flex';
            if (catalogEndText) {
              catalogEndText.textContent = `🎉 បានបង្ហាញរឿងទាំងអស់ក្នុងជម្រើសនេះរួចរាល់ (${totalDramasAvailable.toLocaleString()} រឿង)`;
            }
          }
        }
      } else {
        hasMoreDramas = false;
        if (catalogInfiniteEnd) {
          catalogInfiniteEnd.style.display = 'flex';
          if (catalogEndText) {
            catalogEndText.textContent = `🎉 បានបង្ហាញរឿងទាំងអស់ក្នុងជម្រើសនេះរួចរាល់ (${totalDramasAvailable.toLocaleString()} រឿង)`;
          }
        }
      }
    } catch (err) {
      console.error('Failed to load more dramas on scroll:', err);
    } finally {
      if (catalogInfiniteLoading) catalogInfiniteLoading.style.display = 'none';
      isLoadingMore = false;
    }
  }

  // Viewport scroll listener for infinite scrolling
  if (cinemaViewport) {
    cinemaViewport.addEventListener('scroll', () => {
      if (currentView !== 'catalog') return;

      // Show/hide scroll to top button
      if (btnCatalogScrollTop) {
        if (cinemaViewport.scrollTop > 700) {
          btnCatalogScrollTop.style.display = 'inline-flex';
        } else {
          btnCatalogScrollTop.style.display = 'none';
        }
      }

      // Infinite scroll threshold (auto load more before reaching bottom)
      if (isLoadingMore || !hasMoreDramas) return;
      const scrollRemaining = cinemaViewport.scrollHeight - (cinemaViewport.scrollTop + cinemaViewport.clientHeight);
      if (scrollRemaining < 450) {
        loadMoreDramas();
      }
    });
  }

  if (btnCatalogScrollTop && cinemaViewport) {
    btnCatalogScrollTop.addEventListener('click', () => {
      cinemaViewport.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 9. Load Hongguo Dramas (Initial / Filter Switch / New Search)
  async function loadHongguoDramas() {
    if (!hongguoGrid) return;

    currentPage = 1;
    isLoadingMore = false;
    hasMoreDramas = true;
    loadedDramaCount = 0;

    if (catalogInfiniteLoading) catalogInfiniteLoading.style.display = 'none';
    if (catalogInfiniteEnd) catalogInfiniteEnd.style.display = 'none';
    if (btnCatalogScrollTop) btnCatalogScrollTop.style.display = 'none';

    hongguoGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--gold-300); font-size: 14px; font-weight: 700;">
        <div style="font-size: 28px; margin-bottom: 12px; animation: spin 1s linear infinite;">⏳</div>
        កំពុងទាញយកទិន្នន័យពី Hongguo Official Duanju (14,116+ រឿង)...
      </div>
    `;

    try {
      console.log('Calling api.searchDramas with:', { keyword: currentKeyword, format: selectedFormat, genre: selectedGenre, page: currentPage, sort: selectedSort });
      const res = await api.searchDramas({
        keyword: currentKeyword,
        format: selectedFormat,
        genre: selectedGenre,
        page: currentPage,
        sort: selectedSort
      });
      console.log('api.searchDramas returned:', res ? (res.list ? res.list.length : 0) : 'null');

      if (!res.success || !res.list || res.list.length === 0) {
        hongguoGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--text-muted); font-size: 14px;">
            <div style="font-size: 32px; margin-bottom: 10px;">🔍</div>
            មិនមានទិន្នន័យភាពយន្តដែលត្រូវនឹងការស្វែងរកនេះទេ
          </div>
        `;
        if (catalogTotalCounter) catalogTotalCounter.textContent = '0 រឿង';
        hasMoreDramas = false;
        return;
      }

      const dramas = res.list;
      totalPages = res.pagecount || 1;
      totalDramasAvailable = res.total || dramas.length;
      loadedDramaCount = dramas.length;

      if (catalogTotalCounter) {
        if (currentKeyword) {
          catalogTotalCounter.textContent = `រកឃើញ ${totalDramasAvailable.toLocaleString()} រឿង`;
        } else {
          catalogTotalCounter.textContent = `បង្ហាញ ${loadedDramaCount.toLocaleString()} / ${totalDramasAvailable.toLocaleString()} រឿង`;
        }
      }

      // Render Grid
      hongguoGrid.innerHTML = '';
      dramas.forEach(drama => {
        hongguoGrid.appendChild(createDramaCardElement(drama));
      });

      // Check if all dramas already fit on page 1
      if (currentPage >= totalPages || loadedDramaCount >= totalDramasAvailable) {
        hasMoreDramas = false;
        if (catalogInfiniteEnd) {
          catalogInfiniteEnd.style.display = 'flex';
          if (catalogEndText) {
            catalogEndText.textContent = `🎉 បានបង្ហាញរឿងទាំងអស់ក្នុងជម្រើសនេះរួចរាល់ (${totalDramasAvailable.toLocaleString()} រឿង)`;
          }
        }
      } else {
        hasMoreDramas = true;
      }
    } catch (err) {
      console.error('Failed to load dramas:', err);
      hongguoGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: #ef4444; font-size: 14px;">
          មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ Hongguo API: ${err.message}
        </div>
      `;
    }
  }

  // 10. Open Drama Detail Modal (Guaranteed 100% Full Episodes & Multi-Season Album!)
  async function openDramaDetail(drama) {
    currentDetailDrama = drama;
    currentModalDestDir = currentSettings.downloadDir;
    selectedEpisodeIndices.clear();

    if (modalAlbumBar) modalAlbumBar.style.display = 'none';
    if (btnDownloadAllSeasons) btnDownloadAllSeasons.style.display = 'none';

    modalDetail.classList.add('active');
    detailPosterImg.src = drama.cover || '';
    detailTitleZh.textContent = drama.title || 'Hongguo Drama';
    detailTagsRow.innerHTML = `
      <span class="hero-pill-hot">🔥 HONGGUO VIP</span>
      <span class="hero-pill-ep">${drama.episodesCount || 80} ភាគ</span>
      <span class="hero-pill-vip">${drama.category || 'ពេញនិយម'}</span>
    `;
    modalDestPathText.textContent = currentModalDestDir;
    detailDescText.textContent = 'កំពុងទាញយកបញ្ជីគ្រប់ភាគពី Hongguo Official Server...';
    detailTotalEpBadge.textContent = '• កំពុងផ្ទុក...';
    detailEpisodesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--gold-300);">
        ⏳ កំពុងទាញយកភាគទាំងអស់ពី Server...
      </div>
    `;
    rangeFiltersBar.innerHTML = '';
    if (selectedCountNum) selectedCountNum.textContent = '0';

    try {
      const res = await api.getDramaDetail({
        id: drama.id,
        title: drama.title
      });

      if (!res.success || !res.drama) {
        detailDescText.textContent = 'មិនអាចទាញយកព័ត៌មានលម្អិតនៃរឿងនេះបានទេ';
        return;
      }

      const fullDrama = res.drama;
      currentDetailDrama = fullDrama;
      detailPosterImg.src = fullDrama.cover || drama.cover || '';
      detailTitleZh.textContent = fullDrama.title;
      detailDescText.textContent = fullDrama.content || drama.intro || `${fullDrama.title} - ភាពយន្តភាគខ្លី Hongguo Official។ មានគ្រប់ភាគទាំងអស់ ១០០% ធានាមិនដាច់ភាគ។`;

      currentAllEpisodes = fullDrama.allEpisodes || [];
      const totalCount = currentAllEpisodes.length;
      detailTotalEpBadge.textContent = `• ${totalCount} ភាគ (គ្រប់ភាគទាំងអស់)`;

      // Auto Select All episodes by default as requested
      selectedEpisodeIndices.clear();
      currentAllEpisodes.forEach(ep => selectedEpisodeIndices.add(ep.index));
      if (selectedCountNum) selectedCountNum.textContent = selectedEpisodeIndices.size;

      const isFav = favoritesList.some(f => String(f.id) === String(fullDrama.id) || f.title === fullDrama.title);
      updateDetailFavButton(isFav);
      if (btnModalFav) {
        btnModalFav.onclick = () => toggleFavoriteDrama(currentDetailDrama);
      }

      // Handle Multi-Season Album
      const seasonsList = (fullDrama.seasons && fullDrama.seasons.length > 1) 
        ? fullDrama.seasons 
        : (drama.seasons && drama.seasons.length > 1 ? drama.seasons : null);

      if (seasonsList && seasonsList.length > 1) {
        if (modalAlbumBar) modalAlbumBar.style.display = 'block';
        if (btnDownloadAllSeasons) btnDownloadAllSeasons.style.display = 'inline-flex';
        if (albumCountTag) albumCountTag.textContent = `${seasonsList.length} រដូវកាល (Album)`;

        renderAlbumSeasonPills(seasonsList, fullDrama.id);

        if (btnDownloadAllSeasons) {
          btnDownloadAllSeasons.onclick = async () => {
            await downloadAllSeasonsBatch(seasonsList);
          };
        }
      }

      renderRangeFilters(totalCount);
      renderEpisodeChips(currentAllEpisodes);
    } catch (err) {
      console.error('Failed to get drama detail:', err);
      detailDescText.textContent = `Error: ${err.message}`;
    }
  }

  // Render Multi-Season Pills in Detail Modal
  function renderAlbumSeasonPills(seasonsList, activeId) {
    if (!albumSeasonPills) return;
    albumSeasonPills.innerHTML = '';

    seasonsList.forEach(season => {
      const pill = document.createElement('button');
      const isActive = String(season.id) === String(activeId);
      pill.className = `season-pill ${isActive ? 'active' : ''}`;
      pill.innerHTML = `🎬 ${season.seasonLabel || `រដូវកាលទី ${season.seasonNum}`}`;
      pill.title = `ចុចដើម្បីមើលភាគនៃ ${season.title}`;

      pill.addEventListener('click', async () => {
        if (String(season.id) === String(currentDetailDrama?.id)) return;
        await switchSeasonInModal(season, seasonsList);
      });

      albumSeasonPills.appendChild(pill);
    });
  }

  // Seamless season switcher inside modal
  async function switchSeasonInModal(targetSeason, seasonsList) {
    renderAlbumSeasonPills(seasonsList, targetSeason.id);

    selectedEpisodeIndices.clear();
    if (selectedCountNum) selectedCountNum.textContent = '0';
    detailDescText.textContent = `កំពុងទាញយកទិន្នន័យនៃ ${targetSeason.title}...`;
    detailTotalEpBadge.textContent = '• កំពុងផ្ទុក...';
    detailEpisodesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--gold-300);">
        ⏳ កំពុងទាញយកភាគនៃ ${targetSeason.title}...
      </div>
    `;

    try {
      const res = await api.getDramaDetail({
        id: targetSeason.id,
        title: targetSeason.title
      });

      if (!res.success || !res.drama) {
        detailDescText.textContent = `មិនអាចទាញយកភាគនៃ ${targetSeason.title} បានទេ`;
        return;
      }

      const sDrama = res.drama;
      sDrama.seasons = seasonsList;
      sDrama.isAlbum = true;
      currentDetailDrama = sDrama;

      detailPosterImg.src = sDrama.cover || targetSeason.cover || '';
      detailTitleZh.textContent = sDrama.title;
      detailDescText.textContent = sDrama.content || `${sDrama.title} - ភាពយន្តភាគខ្លី Hongguo Official។`;

      currentAllEpisodes = sDrama.allEpisodes || [];
      const totalCount = currentAllEpisodes.length;
      detailTotalEpBadge.textContent = `• ${totalCount} ភាគ (គ្រប់ភាគទាំងអស់)`;

      // Auto Select All by default
      selectedEpisodeIndices.clear();
      currentAllEpisodes.forEach(ep => selectedEpisodeIndices.add(ep.index));
      if (selectedCountNum) selectedCountNum.textContent = selectedEpisodeIndices.size;

      const isFav = favoritesList.some(f => String(f.id) === String(sDrama.id) || f.title === sDrama.title);
      updateDetailFavButton(isFav);

      renderRangeFilters(totalCount);
      renderEpisodeChips(currentAllEpisodes);
    } catch (err) {
      console.error('Failed to switch season:', err);
      detailDescText.textContent = `Error: ${err.message}`;
    }
  }

  // Queue All Seasons at Once
  async function downloadAllSeasonsBatch(seasonsList) {
    const destDir = currentModalDestDir || currentSettings.downloadDir;
    showToast(`⏳ កំពុងរៀបចំទាញយកគ្រប់រដូវកាល (${seasonsList.length} រដូវកាល)...`);
    
    let totalQueued = 0;
    const allTasks = [];
    for (const season of seasonsList) {
      try {
        let episodes = [];
        let dramaTitle = season.title;
        let dramaCover = season.cover;

        if (String(season.id) === String(currentDetailDrama?.id) && currentAllEpisodes && currentAllEpisodes.length > 0) {
          episodes = currentAllEpisodes;
          dramaTitle = currentDetailDrama.title;
          dramaCover = currentDetailDrama.cover;
        } else {
          const detailRes = await api.getDramaDetail({ id: season.id, title: season.title });
          if (detailRes.success && detailRes.drama) {
            episodes = detailRes.drama.allEpisodes || [];
            dramaTitle = detailRes.drama.title;
            dramaCover = detailRes.drama.cover;
          }
        }

        for (const ep of episodes) {
          allTasks.push({
            id: `hg_${season.id}_ep_${ep.index}_${Date.now()}_${totalQueued}`,
            dramaId: season.id,
            dramaTitle: dramaTitle,
            episodeIndex: ep.index,
            episodeTitle: ep.title,
            url: ep.url,
            vid: ep.vid || '',
            cover: dramaCover,
            destDir,
            customDownloadDir: destDir,
            autoStart: false
          });
          totalQueued++;
        }
      } catch (err) {
        console.error('Failed queueing season:', season.title, err);
      }
    }

    if (allTasks.length > 0) {
      await api.addBatchDownload(allTasks);
    }

    showToast(`👑 បានបន្ថែមគ្រប់រដូវកាលទាំងអស់ (សរុប ${totalQueued} ភាគ) ទៅក្នុងបញ្ជីរង់ចាំ (Waiting)!`);
    modalDetail.classList.remove('active');
    switchView('downloads');
  }

  // 11. Render Range Filters: [1-30], [31-60], [All]
  function renderRangeFilters(totalCount) {
    if (!rangeFiltersBar) return;
    rangeFiltersBar.innerHTML = '';
    const chunkSize = 30;
    const totalChunks = Math.ceil(totalCount / chunkSize);

    const allBtn = document.createElement('button');
    allBtn.className = 'range-filter-chip active';
    allBtn.textContent = `🌟 ទាំងអស់ (${totalCount})`;
    allBtn.onclick = () => {
      document.querySelectorAll('.range-filter-chip').forEach(b => b.classList.remove('active'));
      allBtn.classList.add('active');
      renderEpisodeChips(currentAllEpisodes);
    };
    rangeFiltersBar.appendChild(allBtn);

    for (let c = 0; c < totalChunks; c++) {
      const start = c * chunkSize + 1;
      const end = Math.min((c + 1) * chunkSize, totalCount);
      const btn = document.createElement('button');
      btn.className = 'range-filter-chip';
      btn.textContent = `ភាគ ${start} - ${end}`;
      btn.title = `ចុចដើម្បីមើលភាគទី ${start} ដល់ ${end}`;
      btn.onclick = () => {
        document.querySelectorAll('.range-filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const sliced = currentAllEpisodes.slice(start - 1, end);
        renderEpisodeChips(sliced);
      };
      rangeFiltersBar.appendChild(btn);
    }
  }

  // 12. Render Episode Chips Grid with DocumentFragment (Smooth & Fast)
  function renderEpisodeChips(episodesList) {
    if (!detailEpisodesGrid) return;
    detailEpisodesGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    episodesList.forEach(ep => {
      const isSelected = selectedEpisodeIndices.has(ep.index);
      const chip = document.createElement('div');
      chip.className = 'ep-chip' + (isSelected ? ' selected' : '');
      chip.dataset.epIndex = ep.index;
      chip.title = `${ep.title} - ចុចដើម្បីជ្រើសរើស / ដោះការជ្រើសរើស`;

      chip.innerHTML = `<span class="chip-check-mark">✓</span><span class="chip-title-text">${ep.title}</span>`;

      chip.addEventListener('click', () => {
        if (selectedEpisodeIndices.has(ep.index)) {
          selectedEpisodeIndices.delete(ep.index);
          chip.classList.remove('selected');
        } else {
          selectedEpisodeIndices.add(ep.index);
          chip.classList.add('selected');
        }
        if (selectedCountNum) {
          selectedCountNum.textContent = selectedEpisodeIndices.size;
        }
      });

      fragment.appendChild(chip);
    });

    detailEpisodesGrid.appendChild(fragment);
  }

  function syncEpisodeSelectionUI() {
    if (selectedCountNum) {
      selectedCountNum.textContent = selectedEpisodeIndices.size;
    }
    if (detailEpisodesGrid) {
      const chips = detailEpisodesGrid.querySelectorAll('.ep-chip');
      chips.forEach(chip => {
        const epIndex = parseInt(chip.dataset.epIndex, 10);
        if (selectedEpisodeIndices.has(epIndex)) {
          chip.classList.add('selected');
        } else {
          chip.classList.remove('selected');
        }
      });
    }
  }

  // 13. Episode Selection & Download Triggers
  // Select All Episodes
  if (btnSelectAllEps) {
    btnSelectAllEps.onclick = () => {
      if (!currentAllEpisodes || currentAllEpisodes.length === 0) return;
      selectedEpisodeIndices.clear();
      currentAllEpisodes.forEach(ep => selectedEpisodeIndices.add(ep.index));
      syncEpisodeSelectionUI();
      showToast(`☑️ បានជ្រើសរើសគ្រប់ភាគទាំងអស់ (${selectedEpisodeIndices.size} ភាគ)`);
    };
  }

  // Deselect All Episodes
  if (btnDeselectAllEps) {
    btnDeselectAllEps.onclick = () => {
      selectedEpisodeIndices.clear();
      syncEpisodeSelectionUI();
      showToast('◻️ បានដោះការជ្រើសរើសគ្រប់ភាគទាំងអស់');
    };
  }

  // Invert Selection
  if (btnInvertSelectEps) {
    btnInvertSelectEps.onclick = () => {
      if (!currentAllEpisodes || currentAllEpisodes.length === 0) return;
      currentAllEpisodes.forEach(ep => {
        if (selectedEpisodeIndices.has(ep.index)) {
          selectedEpisodeIndices.delete(ep.index);
        } else {
          selectedEpisodeIndices.add(ep.index);
        }
      });
      syncEpisodeSelectionUI();
      showToast(`🔄 បានបញ្ច្រាសការជ្រើសរើស (${selectedEpisodeIndices.size} ភាគត្រូវបានជ្រើស)`);
    };
  }

  // Download Selected Episodes
  if (btnDownloadSelectedEps) {
    btnDownloadSelectedEps.onclick = async () => {
      if (!currentAllEpisodes || currentAllEpisodes.length === 0) return;
      if (selectedEpisodeIndices.size === 0) {
        showToast('⚠️ សូមជ្រើសរើសភាគដែលចង់ទាញយកជាមុនសិន!');
        return;
      }
      const selectedEps = currentAllEpisodes.filter(ep => selectedEpisodeIndices.has(ep.index));
      await triggerDownloadBatch(selectedEps);
    };
  }

  // Download All Episodes
  if (btnDownloadAllEps) {
    btnDownloadAllEps.onclick = async () => {
      if (!currentAllEpisodes || currentAllEpisodes.length === 0) return;
      triggerDownloadBatch(currentAllEpisodes);
    };
  }

  // Download Poster Only
  if (btnDownloadThumbOnly) {
    btnDownloadThumbOnly.onclick = async () => {
      if (!currentDetailDrama || !currentDetailDrama.cover) {
        showToast('⚠️ មិនមានរូប Poster សម្រាប់ទាញយកទេ');
        return;
      }
      try {
        const destDir = currentModalDestDir || currentSettings.downloadDir;
        const task = {
          id: `thumb_${currentDetailDrama.id}_${Date.now()}`,
          dramaId: currentDetailDrama.id,
          dramaTitle: currentDetailDrama.title,
          episodeTitle: 'Cover Poster',
          url: currentDetailDrama.cover,
          destDir,
          isThumbnailOnly: true
        };
        await api.startDownload(task);
        showToast(`🖼️ បានបញ្ជូនរូប Poster ទៅកាន់ការទាញយក!`);
      } catch (e) {
        showToast(`❌ បរាជ័យ: ${e.message}`);
      }
    };
  }

  // Copy All Stream Links
  if (btnModalCopyLinks) {
    btnModalCopyLinks.onclick = async () => {
      if (!currentAllEpisodes || currentAllEpisodes.length === 0) {
        showToast('⚠️ មិនមានតំណភ្ជាប់ភាគសម្រាប់ចម្លងទេ');
        return;
      }
      let content = `FDR Drama DL Pro - ${currentDetailDrama?.title || 'Drama'}\n`;
      content += `សរុប ${currentAllEpisodes.length} ភាគ\n\n`;
      currentAllEpisodes.forEach(ep => {
        content += `${ep.title}: ${ep.url || ep.previewUrl || ''}\n`;
      });
      await api.copyToClipboard(content);
      showToast(`📋 បានចម្លង Links គ្រប់ភាគ (${currentAllEpisodes.length} ភាគ) ទៅកាន់ Clipboard!`);
    };
  }

  async function triggerDownloadBatch(episodes) {
    if (!episodes || episodes.length === 0) return;

    // License Protection Guard: Must be activated to download!
    if (!currentLicense.isActivated) {
      showToast('🔒 សូមបញ្ចូល Key Activate VIP ជាមុនសិន ទើបអាចទាញយកបាន!');
      openLicenseModal();
      return;
    }

    const destDir = currentModalDestDir || currentSettings.downloadDir;
    const tasks = episodes.map((ep, idx) => ({
      id: `hg_${currentDetailDrama.id}_ep_${ep.index}_${Date.now()}_${idx}`,
      dramaId: currentDetailDrama.id,
      dramaTitle: currentDetailDrama.title,
      episodeIndex: ep.index,
      episodeTitle: ep.title,
      url: ep.url,
      vid: ep.vid || '',
      cover: currentDetailDrama.cover,
      destDir,
      customDownloadDir: destDir,
      autoStart: false
    }));

    try {
      showToast(`⏳ កំពុងបញ្ជូន ${tasks.length} ភាគទៅកាន់បញ្ជី Download...`);
      await api.addBatchDownload(tasks);
      showToast(`📥 បានបញ្ជូនរឿង "${currentDetailDrama.title}" (${tasks.length} ភាគ) ទៅក្នុងបញ្ជីរង់ចាំ (Waiting)! សូមជ្រើស Folder ឬចុច "ទាញយក" នៅពេលរួចរាល់`);
      modalDetail.classList.remove('active');
      switchView('downloads');
    } catch (err) {
      console.error('Error adding batch to download queue:', err);
      showToast(`❌ បរាជ័យក្នុងការបន្ថែមភាគ: ${err.message}`);
    }
  }

  // Close Detail Modal
  if (btnCloseDetail) {
    btnCloseDetail.onclick = () => modalDetail.classList.remove('active');
  }
  modalDetail.addEventListener('click', (e) => {
    if (e.target === modalDetail) modalDetail.classList.remove('active');
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (!modalPlayer || !modalPlayer.classList.contains('active')) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (cinemaVideo.paused) {
        cinemaVideo.play();
      } else {
        cinemaVideo.pause();
      }
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      if (!document.fullscreenElement) {
        cinemaVideo.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    } else if (e.altKey && e.code === 'ArrowLeft') {
      e.preventDefault();
      if (btnPlayerPrevEp && !btnPlayerPrevEp.disabled) btnPlayerPrevEp.click();
    } else if (e.altKey && e.code === 'ArrowRight') {
      e.preventDefault();
      if (btnPlayerNextEp && !btnPlayerNextEp.disabled) btnPlayerNextEp.click();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      cinemaVideo.currentTime = Math.max(0, cinemaVideo.currentTime - 5);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      cinemaVideo.currentTime = Math.min(cinemaVideo.duration || 99999, cinemaVideo.currentTime + 5);
    } else if (e.code === 'Escape') {
      modalPlayer.classList.remove('active');
      cinemaVideo.pause();
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
    }
  });

  // Offline In-App Player Playlist Controller
  function playLocalPlaylist(tasks, startIndex = 0) {
    if (!tasks || tasks.length === 0) return;
    currentPlaylist = tasks;
    currentPlaylistIndex = Math.max(0, Math.min(startIndex, tasks.length - 1));
    modalPlayer.classList.add('active');
    playEpisodeFromPlaylist(currentPlaylistIndex);
  }

  function playEpisodeFromPlaylist(index) {
    const ep = currentPlaylist[index];
    if (!ep || !ep.outputPath) return;

    playerTitleDisplay.textContent = `${ep.dramaTitle} • ${ep.episodeTitle}`;

    if (playerEpNavBar) playerEpNavBar.style.display = 'flex';
    if (playerEpIndicator) playerEpIndicator.textContent = `${ep.episodeTitle} (${index + 1}/${currentPlaylist.length})`;
    if (btnPlayerPrevEp) btnPlayerPrevEp.disabled = index <= 0;
    if (btnPlayerNextEp) btnPlayerNextEp.disabled = index >= currentPlaylist.length - 1;

    // Reset speed to 1x
    playerSpeedBtns.forEach(b => b.classList.remove('active'));
    const defaultSpeedBtn = document.querySelector('.btn-player-speed[data-speed="1"]');
    if (defaultSpeedBtn) defaultSpeedBtn.classList.add('active');
    cinemaVideo.playbackRate = 1.0;

    const fileUrl = 'file:///' + ep.outputPath.replace(/\\/g, '/');
    cinemaVideo.src = fileUrl;
    cinemaVideo.play().catch(e => console.warn('Local play notice:', e));
  }

  if (btnPlayerPrevEp) {
    btnPlayerPrevEp.onclick = () => {
      if (currentPlaylistIndex > 0) {
        currentPlaylistIndex--;
        playEpisodeFromPlaylist(currentPlaylistIndex);
      }
    };
  }

  if (btnPlayerNextEp) {
    btnPlayerNextEp.onclick = () => {
      if (currentPlaylistIndex < currentPlaylist.length - 1) {
        currentPlaylistIndex++;
        playEpisodeFromPlaylist(currentPlaylistIndex);
      }
    };
  }

  // Auto-play next episode when current finishes
  cinemaVideo.addEventListener('ended', () => {
    if (currentPlaylist && currentPlaylist.length > 0 && currentPlaylistIndex < currentPlaylist.length - 1) {
      currentPlaylistIndex++;
      showToast(`⏭️ កំពុងចាក់ភាគបន្ត: ${currentPlaylist[currentPlaylistIndex].episodeTitle}...`);
      playEpisodeFromPlaylist(currentPlaylistIndex);
    }
  });

  // Favorites Controller Functions
  async function loadFavorites() {
    try {
      favoritesList = await api.getFavorites() || [];
      if (badgeFavCount) {
        badgeFavCount.textContent = favoritesList.length;
        badgeFavCount.style.display = favoritesList.length > 0 ? 'inline-block' : 'none';
      }
      if (favoritesTotalCounter) {
        favoritesTotalCounter.textContent = `${favoritesList.length} រឿង`;
      }
      if (currentView === 'favorites') {
        renderFavorites();
      }
    } catch (e) {
      console.warn('Failed to load favorites:', e);
    }
  }

  function renderFavorites() {
    if (!favoritesGrid) return;
    if (favoritesList.length === 0) {
      favoritesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--text-muted); font-size: 14px;">
          <div style="font-size: 36px; margin-bottom: 10px;">⭐</div>
          មិនទាន់មានរឿងនៅក្នុងបញ្ជីពេញចិត្ត (Favorites) ទេ<br>
          <span style="font-size: 12px; color: var(--text-sub);">ចុចលើរូបផ្កាយ ⭐ លើ Poster រឿងដើម្បី Bookmark ទុក</span>
        </div>
      `;
      return;
    }
    favoritesGrid.innerHTML = '';
    favoritesList.forEach(drama => {
      favoritesGrid.appendChild(createDramaCardElement(drama));
    });
  }

  async function toggleFavoriteDrama(drama) {
    if (!drama) return;
    try {
      const res = await api.toggleFavorite(drama);
      if (res && res.success) {
        favoritesList = res.favorites || [];
        showToast(res.isFav ? `⭐ បានបន្ថែមរឿង "${drama.title}" ទៅក្នុងរឿងពេញចិត្ត!` : `🗑️ បានដករឿង "${drama.title}" ចេញពីរឿងពេញចិត្ត`);
        await loadFavorites();
        if (currentDetailDrama && String(currentDetailDrama.id) === String(drama.id)) {
          updateDetailFavButton(res.isFav);
        }
      }
    } catch (e) {
      showToast(`❌ បរាជ័យ: ${e.message}`);
    }
  }

  function updateDetailFavButton(isFav) {
    if (!btnModalFav) return;
    btnModalFav.classList.toggle('active', isFav);
    btnModalFav.textContent = isFav ? '⭐ បានចូលចិត្ត' : '⭐ ចូលចិត្ត';
  }

  // Auto-Shutdown Countdown Controller
  if (btnAutoShutdown) {
    btnAutoShutdown.onclick = () => {
      isAutoShutdownEnabled = !isAutoShutdownEnabled;
      btnAutoShutdown.classList.toggle('active', isAutoShutdownEnabled);
      if (autoShutdownState) {
        autoShutdownState.textContent = isAutoShutdownEnabled ? 'បើក (ON)' : 'បិទ';
      }
      showToast(isAutoShutdownEnabled 
        ? '🌙 បានបើកមុខងារបិទកុំព្យូទ័រស្វ័យប្រវត្ត (Auto-Shutdown) ពេល Download ចប់!'
        : '🌙 បានបិទមុខងារ Auto-Shutdown');
    };
  }

  function triggerAutoShutdownCountdown() {
    if (isShutdownTriggered) return;
    isShutdownTriggered = true;
    shutdownSecondsRemaining = 60;
    if (shutdownTimerSeconds) shutdownTimerSeconds.textContent = '60';
    if (modalShutdown) modalShutdown.classList.add('active');

    api.shutdownPc(60);

    shutdownCountdownInterval = setInterval(() => {
      shutdownSecondsRemaining--;
      if (shutdownTimerSeconds) shutdownTimerSeconds.textContent = shutdownSecondsRemaining;
      if (shutdownSecondsRemaining <= 0) {
        clearInterval(shutdownCountdownInterval);
      }
    }, 1000);
  }

  if (btnCancelShutdown) {
    btnCancelShutdown.onclick = () => {
      api.cancelShutdown();
      if (modalShutdown) modalShutdown.classList.remove('active');
      if (shutdownCountdownInterval) clearInterval(shutdownCountdownInterval);
      isShutdownTriggered = false;
      isAutoShutdownEnabled = false;
      if (btnAutoShutdown) btnAutoShutdown.classList.remove('active');
      if (autoShutdownState) autoShutdownState.textContent = 'បិទ';
      showToast('❌ បានបោះបង់ការបិទកុំព្យូទ័រ (Shutdown Cancelled)!');
    };
  }

  if (btnConfirmShutdownNow) {
    btnConfirmShutdownNow.onclick = () => {
      api.shutdownPc(0);
    };
  }

  // Export Download List as Text File
  if (btnExportDownloadList) {
    btnExportDownloadList.onclick = async () => {
      if (cachedTasks.length === 0) {
        showToast('⚠️ មិនមានរឿងក្នុងបញ្ជីទាញយកសម្រាប់ Export ទេ');
        return;
      }
      let content = `====================================================\n`;
      content += `  FDR DRAMA DL PRO - បញ្ជីរឿងទាញយក (DOWNLOAD ARCHIVE)\n`;
      content += `  Export Date: ${new Date().toLocaleString()}\n`;
      content += `====================================================\n\n`;

      const groups = new Map();
      cachedTasks.forEach(t => {
        if (!groups.has(t.dramaTitle)) groups.set(t.dramaTitle, []);
        groups.get(t.dramaTitle).push(t);
      });

      for (const [title, tasks] of groups) {
        const completed = tasks.filter(t => t.status === 'completed').length;
        content += `[រឿង]: ${title}\n`;
        content += `  - សរុប: ${tasks.length} ភាគ (ចប់: ${completed}/${tasks.length})\n`;
        content += `  - ទីតាំង Folder: ${tasks[0]?.destDir || ''}\n`;
        content += `  - បញ្ជីភាគ:\n`;
        tasks.forEach(t => {
          content += `      ${t.episodeTitle} [${t.status.toUpperCase()}]: ${t.outputPath || t.url}\n`;
        });
        content += `\n----------------------------------------------------\n\n`;
      }

      const res = await api.saveTextFile({
        defaultFileName: `FDR_Dramas_Export_${Date.now()}.txt`,
        content
      });

      if (res && res.success) {
        showToast(`📄 បាន Export បញ្ជីរឿងជោគជ័យ: ${res.filePath}`);
      }
    };
  }

  // Initial favorites load
  loadFavorites();

  // Luxury Synthesizer Chime Sound (Zero-latency Web Audio API)
  function playLuxuryChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [
        { freq: 659.25, time: 0, duration: 0.25 },   // E5
        { freq: 987.77, time: 0.14, duration: 0.3 },  // B5
        { freq: 1318.51, time: 0.28, duration: 0.6 }  // E6
      ];
      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + n.time);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + n.time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n.time + n.duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + n.time);
        osc.stop(ctx.currentTime + n.time + n.duration);
      });
    } catch (e) {
      console.warn('Audio chime notice:', e);
    }
  }

  // Windows Desktop Notification
  function showAppNotification(title, body) {
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '../FDR Download Drama.ico' });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification(title, { body, icon: '../FDR Download Drama.ico' });
            }
          });
        }
      }
    } catch (e) {}
  }

  const completedNotifiedDramas = new Set();
  let isInitialQueueLoaded = false;

  function playPreviewVideo(streamUrl, title) {
    if (!streamUrl) return;
    playerTitleDisplay.textContent = title || 'Preview Player';
    if (playerEpNavBar) playerEpNavBar.style.display = 'none';
    currentPlaylist = [];
    modalPlayer.classList.add('active');

    // Reset speed to 1x
    playerSpeedBtns.forEach(b => b.classList.remove('active'));
    const defaultSpeedBtn = document.querySelector('.btn-player-speed[data-speed="1"]');
    if (defaultSpeedBtn) defaultSpeedBtn.classList.add('active');
    cinemaVideo.playbackRate = 1.0;

    if (streamUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        if (hlsInstance) hlsInstance.destroy();
        hlsInstance = new Hls();
        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(cinemaVideo);
        cinemaVideo.play();
      } else if (cinemaVideo.canPlayType('application/vnd.apple.mpegurl')) {
        cinemaVideo.src = streamUrl;
        cinemaVideo.play();
      }
    } else {
      cinemaVideo.src = streamUrl;
      cinemaVideo.play();
    }
  }

  if (btnClosePlayer) {
    btnClosePlayer.onclick = () => {
      modalPlayer.classList.remove('active');
      cinemaVideo.pause();
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
    };
  }

  // 15. Downloads Hub Queue Processing
  // 15. Downloads Hub Queue Processing
  let renderRafId = null;
  function scheduleRenderDownloadTasks() {
    if (renderRafId) return;
    renderRafId = requestAnimationFrame(() => {
      renderRafId = null;
      renderDownloadTasks();
    });
  }

  api.onQueueUpdate((tasks) => {
    cachedTasks = tasks || [];
    scheduleRenderDownloadTasks();
  });

  function renderDownloadTasks() {
    if (!tasksStreamContainer) return;

    // Group all tasks by drama title into a single consolidated card per drama
    const dramaGroups = new Map();
    cachedTasks.forEach(task => {
      const title = task.dramaTitle || 'Unknown Drama';
      if (!dramaGroups.has(title)) {
        dramaGroups.set(title, {
          dramaTitle: title,
          cover: task.cover || '',
          destDir: task.destDir || currentSettings.downloadDir,
          tasks: []
        });
      }
      dramaGroups.get(title).tasks.push(task);
    });

    const groupsList = Array.from(dramaGroups.values());
    const activeGroups = groupsList.filter(g => g.tasks.some(t => t.status === 'downloading' || t.status === 'queued' || t.status === 'waiting' || t.status === 'paused' || t.status === 'error'));
    const completedGroups = groupsList.filter(g => g.tasks.length > 0 && g.tasks.every(t => t.status === 'completed'));

    // Completion notification & chime
    if (!isInitialQueueLoaded) {
      isInitialQueueLoaded = true;
      groupsList.forEach(grp => {
        if (grp.tasks.length > 0 && grp.tasks.every(t => t.status === 'completed')) {
          completedNotifiedDramas.add(grp.dramaTitle);
        }
      });
    } else {
      groupsList.forEach(grp => {
        const isComplete = grp.tasks.length > 0 && grp.tasks.every(t => t.status === 'completed');
        if (isComplete && !completedNotifiedDramas.has(grp.dramaTitle)) {
          completedNotifiedDramas.add(grp.dramaTitle);
          playLuxuryChime();
          showAppNotification('🎉 ទាញយកចប់សព្វគ្រប់!', `រឿង "${grp.dramaTitle}" បានទាញយកចប់គ្រប់ ${grp.tasks.length} ភាគហើយ។`);
          showToast(`🎉 រឿង "${grp.dramaTitle}" បានទាញយកចប់សព្វគ្រប់!`);
        }
      });

      // Auto-shutdown PC check if enabled and all tasks are finished
      if (isAutoShutdownEnabled && cachedTasks.length > 0 && activeGroups.length === 0 && completedGroups.length > 0 && !isShutdownTriggered) {
        triggerAutoShutdownCountdown();
      }
    }

    if (badgeDlCount) badgeDlCount.textContent = activeGroups.length;
    if (countTabDownloading) countTabDownloading.textContent = activeGroups.length;
    if (countTabCompleted) countTabCompleted.textContent = completedGroups.length;

    const displayGroups = currentDlTab === 'downloading' ? activeGroups : completedGroups;

    if (displayGroups.length === 0) {
      if (!tasksStreamContainer.querySelector('.empty-queue-msg')) {
        tasksStreamContainer.innerHTML = `
          <div class="empty-queue-msg" style="text-align: center; padding: 60px 0; color: var(--text-muted); font-size: 13px;">
            <div style="font-size: 36px; margin-bottom: 10px;">📥</div>
            មិនទាន់មានការទាញយកនៅក្នុងផ្នែកនេះទេ
          </div>
        `;
      }
      return;
    }

    const emptyMsg = tasksStreamContainer.querySelector('.empty-queue-msg');
    if (emptyMsg) emptyMsg.remove();

    const currentTitles = new Set(displayGroups.map(g => g.dramaTitle));
    const existingCards = tasksStreamContainer.querySelectorAll('.drama-series-card');
    existingCards.forEach(card => {
      const cardTitle = card.getAttribute('data-drama-title');
      if (!currentTitles.has(cardTitle)) {
        card.remove();
      }
    });

    displayGroups.forEach(grp => {
      const total = grp.tasks.length;
      const completed = grp.tasks.filter(t => t.status === 'completed').length;
      const downloadingTasks = grp.tasks.filter(t => t.status === 'downloading');
      const queuedTasks = grp.tasks.filter(t => t.status === 'queued');
      const waitingTasks = grp.tasks.filter(t => t.status === 'waiting');
      const pausedTasks = grp.tasks.filter(t => t.status === 'paused');
      const errorTasks = grp.tasks.filter(t => t.status === 'error');
      const isAllCompleted = completed === total;
      const isAllWaiting = waitingTasks.length === total;
      const isPaused = pausedTasks.length > 0 && downloadingTasks.length === 0 && queuedTasks.length === 0;

      const downloadingProgressSum = downloadingTasks.reduce((acc, t) => acc + ((t.progress || 0) / 100), 0);
      const overallPercent = Math.min(100, Math.max(0, 
        ((completed + downloadingProgressSum) / total) * 100
      )).toFixed(1);

      let statusMsg = '';
      if (isAllCompleted) {
        statusMsg = '✅ បានបញ្ចប់គ្រប់ភាគទាំងអស់ (100%)';
      } else if (downloadingTasks.length > 1) {
        statusMsg = `<span class="status-active-ep">⚡ កំពុងទាញយក ${downloadingTasks.length} ភាគដំណាលគ្នា (Parallel):</span> <span class="active-slots-names">${downloadingTasks.map(t => t.episodeTitle).join(', ')}</span>`;
      } else if (downloadingTasks.length === 1) {
        statusMsg = `<span class="status-active-ep">⚡ កំពុងទាញយក: ${downloadingTasks[0].episodeTitle}</span> (${downloadingTasks[0].speed || '1080P VIP'})`;
      } else if (isPaused) {
        statusMsg = `⏸️ បានផ្អាកទាំងអស់ (${completed}/${total} ភាគ)`;
      } else if (isAllWaiting || waitingTasks.length > 0) {
        statusMsg = `<span class="status-waiting-tag">⏳ ក្នុងបញ្ជីរង់ចាំ (${waitingTasks.length} ភាគ)</span> • ចុច "ទាញយក" ដើម្បីចាប់ផ្តើម`;
      } else if (queuedTasks.length > 0) {
        statusMsg = `⏳ ក្នុងជួររង់ចាំទាញយក (${queuedTasks.length} ភាគ)...`;
      } else if (errorTasks.length > 0) {
        statusMsg = `⚠️ មានបញ្ហា ${errorTasks.length} ភាគ (ចុច "ទាញយក" ឬ "មើលភាគ" ដើម្បីទាញឡើងវិញ)`;
      } else {
        statusMsg = '⏳ ក្នុងជួររង់ចាំ...';
      }

      let card = Array.from(tasksStreamContainer.children).find(c => c.getAttribute('data-drama-title') === grp.dramaTitle);

      if (!card) {
        card = document.createElement('div');
        card.className = 'drama-series-card';
        card.setAttribute('data-drama-title', grp.dramaTitle);
        card._grp = grp;

        card.innerHTML = `
          <div class="drama-series-main-row">
            <img src="${grp.cover || ''}" class="drama-series-poster" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'52\\' height=\\'72\\' fill=\\'%23111\\'></svg>'">
            <div class="drama-series-info">
              <div class="drama-series-header-line">
                <span class="drama-series-title" title="${grp.dramaTitle}">${grp.dramaTitle}</span>
                <span class="drama-series-badge-ep">សរុប ${total} ភាគ</span>
                <span class="drama-series-badge-progress">${completed} / ${total} ភាគចប់</span>
              </div>
              <div class="drama-series-folder-line" style="font-size: 11.5px; color: var(--gold-primary); margin: 3px 0 1px 0; display: flex; align-items: center; gap: 6px;">
                <span>📁 Folder: <span class="card-dest-dir-text" style="color: #cbd5e1; font-family: monospace;">${grp.destDir || currentSettings.downloadDir}</span></span>
              </div>
              <div class="drama-series-status-line">
                <div class="drama-series-status-msg">${statusMsg}</div>
                <div class="drama-series-status-pct"><strong>${overallPercent}%</strong></div>
              </div>
              <div class="drama-series-bar-wrap">
                <div class="drama-series-bar-fill" style="width: ${overallPercent}%;"></div>
              </div>
            </div>
            <div class="drama-series-actions">
              <button class="btn-series-tool btn-series-start-dl" title="ចាប់ផ្តើមទាញយករឿងនេះ">
                ⚡ ទាញយក
              </button>
              <button class="btn-series-tool btn-series-change-folder" title="ផ្លាស់ប្តូរ Folder រក្សាទុកសម្រាប់រឿងនេះ">
                📁 ប្តូរ Folder
              </button>
              <button class="btn-series-tool btn-series-toggle" title="Pause / Resume">
                ⏸️ ផ្អាក
              </button>
              <button class="btn-series-tool btn-series-watch" title="ទស្សនារឿងដែលបានទាញយកចប់ក្នុង App ផ្ទាល់">
                🍿 ទស្សនា
              </button>
              <button class="btn-series-tool btn-series-remove" title="Remove Drama From Queue">
                🗑️ ដកចេញ
              </button>
              <button class="btn-series-tool btn-series-merge" title="ផ្គុំ ${completed} ភាគជារឿងពេញ Movie (Lossless Copy)">
                🎬 ផ្គុំជារឿងពេញ
              </button>
              <button class="btn-series-tool btn-series-audio" title="ចម្រាញ់យកសំឡេង MP3 សម្រាប់ស្តាប់ (High Quality 192kbps)">
                🎵 ចម្រាញ់ MP3
              </button>
              <button class="btn-series-tool btn-series-open" title="Open Folder">
                📁 បើកថត
              </button>
              <button class="btn-series-toggle-details" title="Show/Hide Episodes List">
                ▼ មើលភាគ
              </button>
            </div>
          </div>
          <div class="drama-ep-drawer">
            <div class="drama-mini-chips-grid"></div>
          </div>
        `;

        // Action bindings
        const btnChangeFolder = card.querySelector('.btn-series-change-folder');
        if (btnChangeFolder) {
          btnChangeFolder.onclick = async () => {
            const res = await api.selectFolder();
            if (res && res.success && res.folder) {
              await api.updateDramaFolder({ dramaTitle: card._grp.dramaTitle, newDir: res.folder });
              card._grp.destDir = res.folder;
              const folderEl = card.querySelector('.card-dest-dir-text');
              if (folderEl) folderEl.textContent = res.folder;
              showToast(`📁 បានប្តូរ Folder ដាក់រឿង "${card._grp.dramaTitle}" ទៅកាន់:\n${res.folder}`);
            }
          };
        }

        const btnWatch = card.querySelector('.btn-series-watch');
        if (btnWatch) {
          btnWatch.onclick = () => {
            const completedTasks = card._grp.tasks.filter(t => t.status === 'completed');
            if (completedTasks.length > 0) playLocalPlaylist(completedTasks, 0);
          };
        }

        const btnStartDl = card.querySelector('.btn-series-start-dl');
        if (btnStartDl) {
          btnStartDl.onclick = async () => {
            await api.startDrama(card._grp.dramaTitle);
            showToast(`🚀 កំពុងចាប់ផ្តើមទាញយក: ${card._grp.dramaTitle}`);
          };
        }

        const btnRemove = card.querySelector('.btn-series-remove');
        if (btnRemove) {
          btnRemove.onclick = async () => {
            if (confirm(`តើអ្នកពិតជាចង់ដករឿង "${card._grp.dramaTitle}" ចេញពីបញ្ជីទាញយកមែនទេ?`)) {
              await api.removeDrama(card._grp.dramaTitle);
              showToast(`🗑️ បានដករឿង "${card._grp.dramaTitle}" ចេញពីបញ្ជី!`);
            }
          };
        }

        const btnMerge = card.querySelector('.btn-series-merge');
        if (btnMerge) {
          btnMerge.onclick = async () => {
            const cCount = card._grp.tasks.filter(t => t.status === 'completed').length;
            btnMerge.disabled = true;
            btnMerge.textContent = '⏳ កំពុងផ្គុំ...';
            showToast(`🎬 កំពុងផ្គុំ ${cCount} ភាគនៃរឿង "${card._grp.dramaTitle}" ជារឿងពេញ...`);
            try {
              const res = await api.mergeSeries({ dramaTitle: card._grp.dramaTitle, destDir: card._grp.destDir });
              if (res && res.success) {
                playLuxuryChime();
                showToast(`🎉 ផ្គុំជោគជ័យ: ${res.fileName}`);
                if (confirm(`🎉 ផ្គុំជារឿងពេញបានជោគជ័យ!\n\nឈ្មោះ: ${res.fileName}\nសរុប: ${res.episodeCount} ភាគ\n\nតើអ្នកចង់បើកមើល Folder ដែរឬទេ?`)) {
                  api.showInFolder(res.outputFile);
                }
              }
            } catch (err) {
              showToast(`❌ បរាជ័យក្នុងផ្គុំ: ${err.message}`);
            } finally {
              btnMerge.disabled = false;
              btnMerge.textContent = '🎬 ផ្គុំជារឿងពេញ';
            }
          };
        }

        const btnAudio = card.querySelector('.btn-series-audio');
        if (btnAudio) {
          btnAudio.onclick = async () => {
            btnAudio.disabled = true;
            btnAudio.textContent = '⏳ កំពុងបម្លែង MP3...';
            showToast(`🎵 កំពុងចម្រាញ់សំឡេង MP3 នៃរឿង "${card._grp.dramaTitle}"...`);
            try {
              const res = await api.extractAudio({ dramaTitle: card._grp.dramaTitle, destDir: card._grp.destDir });
              if (res && res.success) {
                playLuxuryChime();
                showToast(`🎉 ចម្រាញ់ MP3 ជោគជ័យ: ${res.fileName}`);
                if (confirm(`🎉 ចម្រាញ់ជាឯកសារ MP3 បានជោគជ័យ!\n\nឈ្មោះ: ${res.fileName}\n\nតើអ្នកចង់បើកមើល Folder ដែរឬទេ?`)) {
                  api.showInFolder(res.outputFile);
                }
              } else {
                showToast(`❌ បរាជ័យ: ${res?.error || 'Unknown error'}`);
              }
            } catch (err) {
              showToast(`❌ បរាជ័យក្នុងចម្រាញ់ MP3: ${err.message}`);
            } finally {
              btnAudio.disabled = false;
              btnAudio.textContent = '🎵 ចម្រាញ់ MP3';
            }
          };
        }

        const btnToggle = card.querySelector('.btn-series-toggle');
        if (btnToggle) {
          btnToggle.onclick = () => {
            const pTasks = card._grp.tasks.filter(t => t.status === 'paused');
            const dTasks = card._grp.tasks.filter(t => t.status === 'downloading' || t.status === 'queued');
            const isP = pTasks.length > 0 && dTasks.length === 0;
            if (isP) {
              pTasks.forEach(t => api.resumeDownload(t.id));
            } else {
              dTasks.forEach(t => api.pauseDownload(t.id));
            }
          };
        }

        const btnOpen = card.querySelector('.btn-series-open');
        if (btnOpen) {
          btnOpen.onclick = () => {
            const firstPath = card._grp.tasks[0]?.outputPath;
            const folderPath = firstPath ? firstPath.substring(0, firstPath.lastIndexOf('\\')) : card._grp.destDir;
            api.openFolder(folderPath);
          };
        }

        const btnDetails = card.querySelector('.btn-series-toggle-details');
        const drawer = card.querySelector('.drama-ep-drawer');
        if (btnDetails && drawer) {
          btnDetails.onclick = () => {
            drawer.classList.toggle('open');
            btnDetails.textContent = drawer.classList.contains('open') ? '▲ បិទភាគ' : '▼ មើលភាគ';
          };
        }

        // Build initial mini chips
        const chipsGrid = card.querySelector('.drama-mini-chips-grid');
        grp.tasks.forEach(t => {
          let chipClass = 'chip-queued';
          let epLabel = t.episodeTitle;
          if (t.status === 'waiting') chipClass = 'chip-waiting';
          if (t.status === 'downloading') {
            chipClass = 'chip-downloading';
            epLabel = `⚡ ${t.episodeTitle} (${t.progress || 0}%)`;
          }
          if (t.status === 'completed') chipClass = 'chip-completed';
          if (t.status === 'paused') chipClass = 'chip-paused';
          if (t.status === 'error') chipClass = 'chip-error';

          const chip = document.createElement('div');
          chip.className = `mini-ep-chip ${chipClass}`;
          chip.setAttribute('data-id', t.id);
          chip.title = `${t.episodeTitle}: ${t.status} (${t.progress || 0}%)`;
          chip.textContent = epLabel;
          if (t.status === 'completed') {
            chip.style.cursor = 'pointer';
            chip.onclick = () => {
              const comp = card._grp.tasks.filter(x => x.status === 'completed');
              const idx = comp.findIndex(x => x.id === t.id);
              if (idx !== -1) playLocalPlaylist(comp, idx);
            };
          } else if (t.status === 'error') {
            chip.onclick = () => api.resumeDownload(t.id);
          }
          chipsGrid.appendChild(chip);
        });

        tasksStreamContainer.appendChild(card);
      }

      // Update card state in-place (silky smooth, zero DOM destruction!)
      card._grp = grp;

      const badgeProg = card.querySelector('.drama-series-badge-progress');
      if (badgeProg && badgeProg.textContent !== `${completed} / ${total} ភាគចប់`) {
        badgeProg.textContent = `${completed} / ${total} ភាគចប់`;
      }

      const folderEl = card.querySelector('.card-dest-dir-text');
      const targetFolder = grp.destDir || currentSettings.downloadDir;
      if (folderEl && folderEl.textContent !== targetFolder) {
        folderEl.textContent = targetFolder;
      }

      const statusEl = card.querySelector('.drama-series-status-msg');
      if (statusEl && statusEl.innerHTML !== statusMsg) {
        statusEl.innerHTML = statusMsg;
      }

      const pctEl = card.querySelector('.drama-series-status-pct');
      if (pctEl && pctEl.innerHTML !== `<strong>${overallPercent}%</strong>`) {
        pctEl.innerHTML = `<strong>${overallPercent}%</strong>`;
      }

      const barFill = card.querySelector('.drama-series-bar-fill');
      if (barFill && barFill.style.width !== `${overallPercent}%`) {
        barFill.style.width = `${overallPercent}%`;
      }

      // Update action button states smoothly
      const btnStart = card.querySelector('.btn-series-start-dl');
      if (btnStart) btnStart.style.display = (isAllWaiting || waitingTasks.length > 0 || errorTasks.length > 0) ? 'inline-flex' : 'none';

      const btnTog = card.querySelector('.btn-series-toggle');
      if (btnTog) {
        if (!isAllCompleted && !isAllWaiting && (downloadingTasks.length > 0 || queuedTasks.length > 0 || isPaused)) {
          btnTog.style.display = 'inline-flex';
          btnTog.textContent = isPaused ? '▶️ បន្ត' : '⏸️ ផ្អាក';
        } else {
          btnTog.style.display = 'none';
        }
      }

      const btnWatch = card.querySelector('.btn-series-watch');
      if (btnWatch) btnWatch.style.display = completed > 0 ? 'inline-flex' : 'none';

      const btnMrg = card.querySelector('.btn-series-merge');
      if (btnMrg) btnMrg.style.display = completed >= 2 ? 'inline-flex' : 'none';

      const btnAud = card.querySelector('.btn-series-audio');
      if (btnAud) btnAud.style.display = completed >= 1 ? 'inline-flex' : 'none';

      const btnOpn = card.querySelector('.btn-series-open');
      if (btnOpn) btnOpn.style.display = completed > 0 ? 'inline-flex' : 'none';

      // Update Mini Chips in drawer (In-place, without collapsing drawer!)
      const chipsGrid = card.querySelector('.drama-mini-chips-grid');
      if (chipsGrid) {
        grp.tasks.forEach(t => {
          let chip = chipsGrid.querySelector(`.mini-ep-chip[data-id="${t.id}"]`);
          let chipClass = 'chip-queued';
          let epLabel = t.episodeTitle;
          if (t.status === 'waiting') chipClass = 'chip-waiting';
          if (t.status === 'downloading') {
            chipClass = 'chip-downloading';
            epLabel = `⚡ ${t.episodeTitle} (${t.progress || 0}%)`;
          }
          if (t.status === 'completed') chipClass = 'chip-completed';
          if (t.status === 'paused') chipClass = 'chip-paused';
          if (t.status === 'error') chipClass = 'chip-error';

          if (!chip) {
            chip = document.createElement('div');
            chip.setAttribute('data-id', t.id);
            chipsGrid.appendChild(chip);
          }

          const targetClass = `mini-ep-chip ${chipClass}`;
          if (chip.className !== targetClass) chip.className = targetClass;
          if (chip.textContent !== epLabel) chip.textContent = epLabel;
          chip.title = `${t.episodeTitle}: ${t.status} (${t.progress || 0}%)`;

          if (t.status === 'completed' && !chip._hasWatchHandler) {
            chip._hasWatchHandler = true;
            chip.style.cursor = 'pointer';
            chip.onclick = () => {
              const comp = card._grp.tasks.filter(x => x.status === 'completed');
              const idx = comp.findIndex(x => x.id === t.id);
              if (idx !== -1) playLocalPlaylist(comp, idx);
            };
          } else if (t.status === 'error') {
            chip.onclick = () => api.resumeDownload(t.id);
          }
        });
      }
    });
  }

  tabToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabToggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDlTab = btn.getAttribute('data-tab') || 'downloading';
      scheduleRenderDownloadTasks();
    });
  });

  if (btnStartAllQueue) {
    btnStartAllQueue.onclick = async () => {
      await api.startAllWaiting();
      showToast('🚀 បានចាប់ផ្តើមទាញយកគ្រប់រឿងក្នុងបញ្ជីរង់ចាំ (Batch Download)!');
    };
  }

  if (btnResumeAll) {
    btnResumeAll.onclick = () => {
      cachedTasks.filter(t => t.status === 'paused').forEach(t => api.resumeDownload(t.id));
    };
  }
  if (btnPauseAll) {
    btnPauseAll.onclick = () => {
      cachedTasks.filter(t => t.status === 'downloading' || t.status === 'queued').forEach(t => api.pauseDownload(t.id));
    };
  }
  if (btnClearCompleted) {
    btnClearCompleted.onclick = () => {
      cachedTasks = cachedTasks.filter(t => t.status !== 'completed');
      renderDownloadTasks();
      api.clearCompletedDownloads();
    };
  }
  if (btnOpenFolder) {
    btnOpenFolder.onclick = () => api.openFolder(currentSettings.downloadDir);
  }

  // 16. Settings Save
  if (settingConcurrentSlider) {
    settingConcurrentSlider.addEventListener('input', () => {
      settingConcurrentLabel.textContent = `${settingConcurrentSlider.value} Tasks`;
    });
  }

  if (btnConfirmSaveSettings) {
    btnConfirmSaveSettings.onclick = async () => {
      const concurrentVal = parseInt(settingConcurrentSlider.value, 10) || 5;
      const cfg = {
        ...currentSettings,
        maxConcurrent: concurrentVal,
        concurrentDownloads: concurrentVal,
        language: settingLangDropdown ? settingLangDropdown.value : 'km'
      };
      await api.saveSettings(cfg);
      currentSettings = cfg;
      showToast('✅ បានរក្សាទុកការកំណត់ដោយជោគជ័យ!');
    };
  }

  // Language Dot buttons in header
  langDots.forEach(dot => {
    dot.addEventListener('click', () => {
      langDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      const lang = dot.getAttribute('data-lang');
      currentLang = lang;
      if (settingLangDropdown) settingLangDropdown.value = lang;
      showToast(`Language switched to: ${lang.toUpperCase()}`);
    });
  });

  // ===================================================================
  // 18. VIP LICENSE KEY ACTIVATION SYSTEM
  // ===================================================================
  let currentLicense = { isActivated: false, deviceId: '', plan: 'Free Trial' };

  const btnVipBadge = document.getElementById('btn-vip-badge');
  const vipBadgeIcon = document.getElementById('vip-badge-icon');
  const vipBadgeText = document.getElementById('vip-badge-text');
  const modalLicense = document.getElementById('modal-license');
  const btnCloseLicense = document.getElementById('btn-close-license');
  const modalDeviceIdVal = document.getElementById('modal-device-id-val');
  const btnCopyDeviceIdModal = document.getElementById('btn-copy-device-id-modal');
  const inputLicenseKey = document.getElementById('input-license-key');
  const btnSubmitActivate = document.getElementById('btn-submit-activate');
  const btnDeactivateKey = document.getElementById('btn-deactivate-key');
  const licenseFeedbackMsg = document.getElementById('license-feedback-msg');
  const modalLicenseStatusBanner = document.getElementById('modal-license-status-banner');

  const settingDeviceIdVal = document.getElementById('setting-device-id-val');
  const btnCopyDeviceIdSettings = document.getElementById('btn-copy-device-id-settings');
  const settingLicenseBadge = document.getElementById('setting-license-badge');
  const settingPlanText = document.getElementById('setting-plan-text');
  const btnOpenLicenseSettings = document.getElementById('btn-open-license-settings');

  async function refreshLicenseUI() {
    try {
      const lic = await api.getLicenseStatus();
      if (lic) {
        currentLicense = lic;
        // Update Header Badge
        if (btnVipBadge) {
          if (lic.isActivated) {
            btnVipBadge.classList.add('activated');
            if (vipBadgeIcon) vipBadgeIcon.textContent = '✨';
            if (vipBadgeText) vipBadgeText.textContent = `${lic.plan} (Active)`;
          } else {
            btnVipBadge.classList.remove('activated');
            if (vipBadgeIcon) vipBadgeIcon.textContent = '🔒';
            if (vipBadgeText) vipBadgeText.textContent = 'Activate VIP Key';
          }
        }

        // Update Modal
        if (modalDeviceIdVal) modalDeviceIdVal.textContent = lic.deviceId || 'FDR-XXXX-XXXX-XXXX';
        if (btnDeactivateKey) btnDeactivateKey.style.display = lic.isActivated ? 'inline-block' : 'none';
        if (modalLicenseStatusBanner) {
          if (lic.isActivated) {
            modalLicenseStatusBanner.innerHTML = `
              <span style="color:#10b981; font-weight:800;">✅ បាន Activate ជោគជ័យ: ${lic.plan} (${lic.expiry})</span>
              <span style="color:var(--text-muted); font-size:11px;">Key: ${lic.key ? lic.key.substring(0, 12) + '...' : ''}</span>
            `;
          } else {
            modalLicenseStatusBanner.innerHTML = `
              <span style="color:#f87171; font-weight:700;">🔒 មិនទាន់ Activate នៅឡើយទេ (សូមផ្ញើ Device ID ទៅកាន់ Admin)</span>
            `;
          }
        }

        // Update Settings page
        if (settingDeviceIdVal) settingDeviceIdVal.textContent = lic.deviceId || 'FDR-XXXX-XXXX-XXXX';
        if (settingPlanText) settingPlanText.textContent = lic.isActivated ? `✨ ${lic.plan}` : '🔒 មិនទាន់ Activate';
        if (settingLicenseBadge) {
          if (lic.isActivated) {
            settingLicenseBadge.classList.add('activated');
          } else {
            settingLicenseBadge.classList.remove('activated');
          }
        }
      }
    } catch (e) {
      console.warn('Error refreshing license:', e);
    }
  }

  function openLicenseModal() {
    if (!modalLicense) return;
    refreshLicenseUI();
    if (licenseFeedbackMsg) licenseFeedbackMsg.style.display = 'none';
    if (inputLicenseKey) inputLicenseKey.value = '';
    modalLicense.classList.add('active');
  }

  function closeLicenseModal() {
    if (modalLicense) modalLicense.classList.remove('active');
  }

  if (btnVipBadge) btnVipBadge.onclick = openLicenseModal;
  if (btnOpenLicenseSettings) btnOpenLicenseSettings.onclick = openLicenseModal;
  if (btnCloseLicense) btnCloseLicense.onclick = closeLicenseModal;
  if (modalLicense) {
    modalLicense.addEventListener('click', (e) => {
      if (e.target === modalLicense) closeLicenseModal();
    });
  }

  async function copyDeviceId() {
    const devId = currentLicense.deviceId || (modalDeviceIdVal ? modalDeviceIdVal.textContent : '');
    if (devId) {
      await api.copyToClipboard(devId);
      showToast(`📋 បានចម្លង Device ID: ${devId} រួចរាល់!`);
    }
  }

  if (btnCopyDeviceIdModal) btnCopyDeviceIdModal.onclick = copyDeviceId;
  if (btnCopyDeviceIdSettings) btnCopyDeviceIdSettings.onclick = copyDeviceId;

  if (btnSubmitActivate) {
    btnSubmitActivate.onclick = async () => {
      const keyVal = (inputLicenseKey?.value || '').trim();
      if (!keyVal) {
        if (licenseFeedbackMsg) {
          licenseFeedbackMsg.className = 'license-feedback-msg error';
          licenseFeedbackMsg.textContent = '⚠️ សូមបញ្ចូល License Key ជាមុនសិន!';
          licenseFeedbackMsg.style.display = 'block';
        }
        return;
      }

      btnSubmitActivate.disabled = true;
      btnSubmitActivate.textContent = '⏳ កំពុងផ្ទៀងផ្ទាត់...';
      try {
        const res = await api.activateLicense(keyVal);
        if (res && res.success) {
          playLuxuryChime();
          if (licenseFeedbackMsg) {
            licenseFeedbackMsg.className = 'license-feedback-msg success';
            licenseFeedbackMsg.textContent = `🎉 អបអរសាទរ! បាន Activate ជោគជ័យ: ${res.license.plan}`;
            licenseFeedbackMsg.style.display = 'block';
          }
          showToast(`🎉 បាន Activate ជោគជ័យ: ${res.license.plan}!`);
          await refreshLicenseUI();
          setTimeout(() => closeLicenseModal(), 1800);
        } else {
          if (licenseFeedbackMsg) {
            licenseFeedbackMsg.className = 'license-feedback-msg error';
            licenseFeedbackMsg.textContent = `❌ ${res?.error || 'License Key មិនត្រឹមត្រូវ'}`;
            licenseFeedbackMsg.style.display = 'block';
          }
        }
      } catch (err) {
        if (licenseFeedbackMsg) {
          licenseFeedbackMsg.className = 'license-feedback-msg error';
          licenseFeedbackMsg.textContent = `❌ ${err.message}`;
          licenseFeedbackMsg.style.display = 'block';
        }
      } finally {
        btnSubmitActivate.disabled = false;
        btnSubmitActivate.textContent = '⚡ ដំណើរការ Activate Key ឥឡូវនេះ';
      }
    };
  }

  if (btnDeactivateKey) {
    btnDeactivateKey.onclick = async () => {
      if (confirm('តើអ្នកពិតជាចង់ដោះ License Key ចេញពីកុំព្យូទ័រនេះមែនទេ?')) {
        await api.deactivateLicense();
        showToast('🗑️ បានដោះ License Key ចេញរួចរាល់!');
        await refreshLicenseUI();
      }
    };
  }

  // Initial License status load
  refreshLicenseUI();

  // ===================================================================
  // 19. NBC BAKONG KHQR ONLINE PAYMENT & AUTO-ACTIVATION CONTROLLER
  // ===================================================================
  const modalBuyKhqr = document.getElementById('modal-buy-khqr');
  const btnCloseKhqr = document.getElementById('btn-close-khqr');
  const btnOpenBuyKhqr = document.getElementById('btn-open-buy-khqr');
  const btnKhqrCancel = document.getElementById('btn-khqr-cancel');
  const btnKhqrCheckNow = document.getElementById('btn-khqr-check-now');
  const khqrImgDisplay = document.getElementById('khqr-img-display');
  const khqrAmountBadge = document.getElementById('khqr-amount-badge');
  const khqrDeviceId = document.getElementById('khqr-device-id');
  const khqrBankTarget = document.getElementById('khqr-bank-target');
  const khqrMerchantName = document.getElementById('khqr-merchant-name');
  const khqrStatusText = document.getElementById('khqr-status-text');

  // Admin KHQR Settings Elements
  const adminKhqrMerchantName = document.getElementById('admin-khqr-merchant-name');
  const adminKhqrBakongId = document.getElementById('admin-khqr-bakong-id');
  const adminKhqrAccNum = document.getElementById('admin-khqr-acc-num');
  const adminKhqrBankName = document.getElementById('admin-khqr-bank-name');
  const adminKhqrPrice = document.getElementById('admin-khqr-price');
  const adminKhqrToken = document.getElementById('admin-khqr-token');
  const adminKhqrTelegram = document.getElementById('admin-khqr-telegram');
  const btnSaveAdminKhqr = document.getElementById('btn-save-admin-khqr');
  const btnTestBakongToken = document.getElementById('btn-test-bakong-token');
  const bakongTokenFeedback = document.getElementById('bakong-token-feedback');

  // Admin Instant Keygen Elements
  const keygenInputDeviceId = document.getElementById('keygen-input-device-id');
  const keygenSelectPlan = document.getElementById('keygen-select-plan');
  const btnGenerateAdminKey = document.getElementById('btn-generate-admin-key');
  const btnKeygenSelfActivate = document.getElementById('btn-keygen-self-activate');
  const keygenResultWrap = document.getElementById('keygen-result-wrap');
  const keygenResultKeyText = document.getElementById('keygen-result-key-text');
  const btnCopyGeneratedKey = document.getElementById('btn-copy-generated-key');
  const btnCopyGeneratedMsg = document.getElementById('btn-copy-generated-msg');

  // KHQR Payment Modal Extra Elements
  const btnKhqrCopyBill = document.getElementById('btn-khqr-copy-bill');
  const btnKhqrTelegramSlip = document.getElementById('btn-khqr-telegram-slip');
  const khqrInputFastKey = document.getElementById('khqr-input-fast-key');
  const btnKhqrFastActivate = document.getElementById('btn-khqr-fast-activate');

  let activeKhqrMd5 = null;
  let khqrPollInterval = null;
  let lastGeneratedKeyInfo = null;

  async function loadAdminPaymentConfig() {
    try {
      const cfg = await api.getPaymentConfig();
      if (cfg) {
        if (adminKhqrMerchantName) adminKhqrMerchantName.value = cfg.merchantName || 'ADMIN FDR';
        if (adminKhqrBakongId) adminKhqrBakongId.value = cfg.bakongAccountId || 'abaakhppxxx@abaa';
        if (adminKhqrAccNum) adminKhqrAccNum.value = cfg.accountNumber || '600 462 336';
        if (adminKhqrBankName) adminKhqrBankName.value = cfg.bankName || 'ABA Bank';
        if (adminKhqrPrice) adminKhqrPrice.value = cfg.priceUsd || 25;
        if (adminKhqrToken) adminKhqrToken.value = cfg.bakongToken || '';
        if (adminKhqrTelegram) adminKhqrTelegram.value = cfg.telegramAdmin || 'https://t.me/socheka_admin';
      }
    } catch (e) {
      console.warn('Could not load payment config:', e);
    }
  }

  if (btnSaveAdminKhqr) {
    btnSaveAdminKhqr.onclick = async () => {
      const newCfg = {
        merchantName: (adminKhqrMerchantName?.value || 'ADMIN FDR').trim(),
        bakongAccountId: (adminKhqrBakongId?.value || 'abaakhppxxx@abaa').trim(),
        accountNumber: (adminKhqrAccNum?.value || '600 462 336').trim(),
        bankName: (adminKhqrBankName?.value || 'ABA Bank').trim(),
        priceUsd: parseFloat(adminKhqrPrice?.value || 25) || 25,
        bakongToken: (adminKhqrToken?.value || '').trim(),
        telegramAdmin: (adminKhqrTelegram?.value || 'https://t.me/socheka_admin').trim()
      };
      const res = await api.savePaymentConfig(newCfg);
      if (res && res.success) {
        playLuxuryChime();
        showToast('✅ បានរក្សាទុកកុងទទួលលុយ KHQR ជោគជ័យ!');
      } else {
        showToast(`❌ បរាជ័យ: ${res?.error || 'Unknown error'}`);
      }
    };
  }

  // Test Bakong Open API Token Live
  if (btnTestBakongToken) {
    btnTestBakongToken.onclick = async () => {
      const token = (adminKhqrToken?.value || '').trim();
      if (!token) {
        if (bakongTokenFeedback) {
          bakongTokenFeedback.style.display = 'block';
          bakongTokenFeedback.style.color = '#f87171';
          bakongTokenFeedback.textContent = '⚠️ សូមបញ្ចូល Bearer Token របស់ Bakong ជាមុនសិន!';
        }
        return;
      }

      btnTestBakongToken.disabled = true;
      btnTestBakongToken.textContent = '⏳ កំពុងតេស្ត...';
      if (bakongTokenFeedback) {
        bakongTokenFeedback.style.display = 'block';
        bakongTokenFeedback.style.color = '#38bdf8';
        bakongTokenFeedback.textContent = '⏳ កំពុងផ្ទៀងផ្ទាត់ជាមួយ NBC Bakong Open API...';
      }

      try {
        const testRes = await api.testBakongToken(token);
        if (testRes && testRes.success) {
          playLuxuryChime();
          if (bakongTokenFeedback) {
            bakongTokenFeedback.style.color = '#34d399';
            bakongTokenFeedback.textContent = testRes.message;
          }
          showToast('✅ NBC Bakong Token ត្រឹមត្រូវ 100%!');
        } else {
          if (bakongTokenFeedback) {
            bakongTokenFeedback.style.color = '#f87171';
            bakongTokenFeedback.textContent = testRes?.error || 'Token មិនត្រឹមត្រូវ';
          }
          showToast(`❌ ${testRes?.error || 'Token មិនត្រឹមត្រូវ'}`);
        }
      } catch (err) {
        if (bakongTokenFeedback) {
          bakongTokenFeedback.style.color = '#f87171';
          bakongTokenFeedback.textContent = `❌ ${err.message}`;
        }
      } finally {
        btnTestBakongToken.disabled = false;
        btnTestBakongToken.textContent = '🔍 តេស្តសាកល្បង Token';
      }
    };
  }

  // Admin Instant Key Generator Logic
  if (btnGenerateAdminKey) {
    btnGenerateAdminKey.onclick = async () => {
      let targetDevId = (keygenInputDeviceId?.value || '').trim().toUpperCase();
      if (!targetDevId) {
        targetDevId = currentLicense.deviceId || 'FDR-XXXX-XXXX-XXXX';
        if (keygenInputDeviceId) keygenInputDeviceId.value = targetDevId;
      }

      const plan = keygenSelectPlan?.value || 'LIFETIME';
      const genRes = await api.generateLicenseKey({ deviceId: targetDevId, planType: plan });
      if (genRes && genRes.key) {
        lastGeneratedKeyInfo = {
          deviceId: genRes.deviceId,
          planType: genRes.planType,
          key: genRes.key
        };
        if (keygenResultKeyText) keygenResultKeyText.textContent = genRes.key;
        if (keygenResultWrap) keygenResultWrap.style.display = 'block';
        playLuxuryChime();
        showToast(`👑 បានបង្កើត Key (${plan}): ${genRes.key}`);
      }
    };
  }

  if (btnCopyGeneratedKey) {
    btnCopyGeneratedKey.onclick = async () => {
      if (lastGeneratedKeyInfo && lastGeneratedKeyInfo.key) {
        await api.copyToClipboard(lastGeneratedKeyInfo.key);
        showToast(`📋 បានចម្លង Key: ${lastGeneratedKeyInfo.key}`);
      }
    };
  }

  if (btnCopyGeneratedMsg) {
    btnCopyGeneratedMsg.onclick = async () => {
      if (!lastGeneratedKeyInfo) return;
      const msg = `🎉 FDR Drama DL Pro - VIP Activation Key
--------------------------------------------
🖥️ Device ID: ${lastGeneratedKeyInfo.deviceId}
👑 VIP Plan: ${lastGeneratedKeyInfo.planType}
🔑 Activation Key: ${lastGeneratedKeyInfo.key}
--------------------------------------------
👉 របៀបប្រើ៖ បើកកម្មវិធី FDR Drama DL Pro -> ចុច "👑 គ្រប់គ្រង Key" -> បិទភ្ជាប់ Key ខាងលើ -> ចុច "Activate" ជាការស្រេច!`;
      await api.copyToClipboard(msg);
      showToast('✉️ បានចម្លងសារផ្ញើទៅកាន់ភ្ញៀវរួចរាល់!');
    };
  }

  if (btnKeygenSelfActivate) {
    btnKeygenSelfActivate.onclick = async () => {
      const plan = keygenSelectPlan?.value || 'LIFETIME';
      const myDevId = currentLicense.deviceId;
      const genRes = await api.generateLicenseKey({ deviceId: myDevId, planType: plan });
      if (genRes && genRes.key) {
        const actRes = await api.activateLicense(genRes.key);
        if (actRes && actRes.success) {
          playLuxuryChime();
          showToast(`🎉 អបអរសាទរ! កុំព្យូទ័រនេះត្រូវបាន Activate VIP (${plan}) ជោគជ័យ!`);
          await refreshLicenseUI();
        }
      }
    };
  }

  function stopKHQRPolling() {
    if (khqrPollInterval) {
      clearInterval(khqrPollInterval);
      khqrPollInterval = null;
    }
  }

  function closeKHQRModal() {
    stopKHQRPolling();
    if (modalBuyKhqr) modalBuyKhqr.classList.remove('active');
  }

  async function checkKHQROnce(isManual = false) {
    if (!activeKhqrMd5) return;
    if (isManual && khqrStatusText) {
      khqrStatusText.innerHTML = '<span style="color:#38bdf8;">🔄 កំពុងពិនិត្យជាមួយ NBC Bakong...</span>';
    }

    try {
      const checkRes = await api.checkKHQRPayment(activeKhqrMd5);
      if (checkRes && checkRes.paid) {
        stopKHQRPolling();
        if (khqrStatusText) {
          khqrStatusText.innerHTML = '🎉 ទទួលបានការបង់ប្រាក់ជោគជ័យ! កំពុង Unlock VIP...';
          khqrStatusText.style.color = '#34d399';
        }
        
        // Auto-activate license on this device with selected plan
        const devId = currentLicense.deviceId || (await api.getLicenseStatus())?.deviceId;
        const actRes = await api.autoActivateLicense({
          deviceId: devId,
          planType: selectedPlanType
        });

        playLuxuryChime();
        showToast(`🎉 ការទូទាត់ជោគជ័យ! អាជ្ញាប័ណ្ណ VIP (${selectedPlanType}) បាន Auto-Activate 100%!`);
        await refreshLicenseUI();

        setTimeout(() => {
          closeKHQRModal();
          closeLicenseModal();
        }, 1800);
      } else if (checkRes && checkRes.status === 'no_token') {
        if (khqrStatusText) {
          khqrStatusText.innerHTML = '<span style="color:#f59e0b;">⚠️ មិនទាន់មាន Bakong Token ទេ (សូមផ្ញើ Slip ទៅ Telegram Admin)</span>';
        }
        if (isManual) {
          showToast('⚠️ មិនទាន់មាន Bakong Token ទេ សូមផ្ញើ Slip ទៅ Telegram Admin ដើម្បីទទួល Key!');
        }
      } else if (checkRes && checkRes.status === 'unauthorized') {
        if (khqrStatusText) {
          khqrStatusText.innerHTML = '<span style="color:#ef4444;">❌ Bakong Token មិនត្រឹមត្រូវ (សូមពិនិត្យក្នុង Settings)</span>';
        }
        if (isManual) {
          showToast('❌ Bakong Token មិនត្រឹមត្រូវ សូមពិនិត្យការកំណត់ Settings!');
        }
      } else {
        if (isManual) {
          showToast('⏳ មិនទាន់ឃើញមានលុយចូលនៅឡើយទេ សូមព្យាយាមម្តងទៀតបន្ទាប់ពីបាញ់ប្រាក់រួច!');
          if (khqrStatusText) {
            khqrStatusText.innerHTML = '<span>កំពុងរង់ចាំការបាញ់ប្រាក់... (ពិនិត្យស្វ័យប្រវត្តរៀងរាល់ 3s)</span>';
          }
        }
      }
    } catch (e) {
      console.warn('KHQR check error:', e);
    }
  }

  let selectedPlanType = 'LIFETIME';
  let selectedPlanPrice = 25.00;

  async function updateActiveKHQR() {
    const devId = currentLicense.deviceId || 'FDR-VIP-PASS';
    if (khqrStatusText) {
      khqrStatusText.textContent = `⚡ កំពុងបង្កើត Official KHQR ($${selectedPlanPrice.toFixed(2)})...`;
    }

    try {
      const qrRes = await api.generateKHQR({
        deviceId: devId,
        amount: selectedPlanPrice,
        billNumber: `${devId}-${selectedPlanType}`
      });

      if (qrRes && qrRes.qrDataUrl) {
        activeKhqrMd5 = qrRes.md5;
        if (khqrImgDisplay) khqrImgDisplay.src = qrRes.qrDataUrl;
        if (khqrAmountBadge) khqrAmountBadge.textContent = `$${qrRes.amount} USD`;
        if (khqrDeviceId) khqrDeviceId.textContent = devId;
        if (khqrMerchantName) khqrMerchantName.textContent = qrRes.merchantName || 'ADMIN FDR';
        
        const cfg = await api.getPaymentConfig();
        if (khqrBankTarget && cfg) {
          khqrBankTarget.textContent = `${cfg.bankName || 'ABA'} (${cfg.accountNumber || cfg.bakongAccountId})`;
        }

        if (khqrStatusText) {
          if (cfg && cfg.bakongToken && cfg.bakongToken.trim()) {
            khqrStatusText.innerHTML = '<span style="color:#34d399;">⚡ កំពុងរង់ចាំការទូទាត់ប្រាក់... (ប្រព័ន្ធនឹង Activate ស្វ័យប្រវត្តិ)</span>';
          } else {
            khqrStatusText.innerHTML = '<span style="color:#f59e0b;">⚠️ មិនទាន់មាន Bakong Token ទេ (ស្កេនបាញ់រួច ចុចផ្ញើ Slip ទៅ Telegram)</span>';
          }
        }

        // Restart polling
        stopKHQRPolling();
        khqrPollInterval = setInterval(() => {
          checkKHQROnce(false);
        }, 3500);
      }
    } catch (err) {
      showToast(`❌ បរាជ័យក្នុងការបង្កើត QR: ${err.message}`);
    }
  }

  // Bind Plan Choices
  const planButtons = document.querySelectorAll('.btn-plan-choice');
  planButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      planButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPlanType = btn.getAttribute('data-plan') || 'LIFETIME';
      selectedPlanPrice = parseFloat(btn.getAttribute('data-price')) || 25.00;
      await updateActiveKHQR();
    });
  });

  async function openBuyKHQRModal() {
    if (!modalBuyKhqr) return;
    modalBuyKhqr.classList.add('active');
    await updateActiveKHQR();
  }

  // KHQR Copy Bill info
  if (btnKhqrCopyBill) {
    btnKhqrCopyBill.onclick = async () => {
      const cfg = await api.getPaymentConfig();
      const devId = currentLicense.deviceId || 'FDR-XXXX-XXXX-XXXX';
      const text = `🏦 ព័ត៌មានបាញ់ប្រាក់ FDR Drama DL Pro VIP:
- ធនាគារ: ${cfg.bankName || 'ABA Bank'}
- ឈ្មោះគណនី: ${cfg.accountName || 'SOCHEKA HOUN'}
- លេខកុង: ${cfg.accountNumber || '600 462 336'}
- តម្លៃ: $${selectedPlanPrice.toFixed(2)} USD (${selectedPlanType})
- Device ID: ${devId}`;
      await api.copyToClipboard(text);
      showToast('📋 បានចម្លងព័ត៌មានបាញ់ប្រាក់ទៅ Clipboard!');
    };
  }

  // KHQR Send Slip to Telegram Admin
  if (btnKhqrTelegramSlip) {
    btnKhqrTelegramSlip.onclick = async () => {
      const cfg = await api.getPaymentConfig();
      const devId = currentLicense.deviceId || 'FDR-XXXX-XXXX-XXXX';
      let tgTarget = (cfg.telegramAdmin || 'https://t.me/socheka_admin').trim();
      if (!tgTarget.startsWith('http')) {
        const username = tgTarget.replace('@', '');
        tgTarget = `https://t.me/${username}`;
      }

      const prefilledText = encodeURIComponent(
        `សួស្តី Admin ខ្ញុំបានបាញ់ប្រាក់ទិញ License VIP សម្រាប់ Device ID: ${devId} (Plan: ${selectedPlanType} $${selectedPlanPrice.toFixed(2)}) រួចរាល់ហើយ សូមជួយ Activate Key អោយខ្ញុំផង!`
      );
      const fullUrl = `${tgTarget}?text=${prefilledText}`;
      api.openPath(fullUrl);
      showToast('✈️ កំពុងបើក Telegram ទៅកាន់ Admin...');
    };
  }

  // Fast Key Activation inside KHQR Modal
  if (btnKhqrFastActivate) {
    btnKhqrFastActivate.onclick = async () => {
      const keyVal = (khqrInputFastKey?.value || '').trim();
      if (!keyVal) {
        showToast('⚠️ សូមបញ្ចូល License Key!');
        return;
      }
      btnKhqrFastActivate.disabled = true;
      btnKhqrFastActivate.textContent = '⏳ ...';
      try {
        const res = await api.activateLicense(keyVal);
        if (res && res.success) {
          playLuxuryChime();
          showToast(`🎉 បាន Activate VIP (${res.license.plan}) ជោគជ័យ 100%!`);
          await refreshLicenseUI();
          setTimeout(() => {
            closeKHQRModal();
            closeLicenseModal();
          }, 1500);
        } else {
          showToast(`❌ ${res?.error || 'License Key មិនត្រឹមត្រូវ'}`);
        }
      } catch (err) {
        showToast(`❌ ${err.message}`);
      } finally {
        btnKhqrFastActivate.disabled = false;
        btnKhqrFastActivate.textContent = '⚡ Activate';
      }
    };
  }

  if (btnOpenBuyKhqr) btnOpenBuyKhqr.onclick = openBuyKHQRModal;
  if (btnCloseKhqr) btnCloseKhqr.onclick = closeKHQRModal;
  if (btnKhqrCancel) btnKhqrCancel.onclick = closeKHQRModal;
  if (btnKhqrCheckNow) btnKhqrCheckNow.onclick = () => checkKHQROnce(true);

  if (modalBuyKhqr) {
    modalBuyKhqr.addEventListener('click', (e) => {
      if (e.target === modalBuyKhqr) closeKHQRModal();
    });
  }

  // Load Admin KHQR config into settings inputs
  loadAdminPaymentConfig();

  // 17. Auto-Updater Controller (GitHub Releases)
  const btnCheckUpdaterSettings = document.getElementById('btn-check-updater-settings');
  const settingAppVersion = document.getElementById('setting-app-version');
  const settingUpdaterStatus = document.getElementById('setting-updater-status');

  const modalUpdater = document.getElementById('modal-updater');
  const updaterModalTitle = document.getElementById('updater-modal-title');
  const updaterModalDesc = document.getElementById('updater-modal-desc');
  const updaterReleaseNotes = document.getElementById('updater-release-notes');
  const updaterProgressWrapper = document.getElementById('updater-progress-wrapper');
  const updaterProgressLabel = document.getElementById('updater-progress-label');
  const updaterProgressPercent = document.getElementById('updater-progress-percent');
  const updaterProgressFill = document.getElementById('updater-progress-fill');
  const btnUpdaterCancel = document.getElementById('btn-updater-cancel');
  const btnUpdaterAction = document.getElementById('btn-updater-action');

  let updaterCurrentState = 'idle';

  if (api && api.getAppVersion) {
    api.getAppVersion().then(v => {
      if (settingAppVersion && v) settingAppVersion.textContent = `v${v}`;
    }).catch(() => {});
  }

  function showUpdaterModal(title, desc, actionText, actionFn, notes = null) {
    if (!modalUpdater) return;
    if (updaterModalTitle) updaterModalTitle.textContent = title;
    if (updaterModalDesc) updaterModalDesc.textContent = desc;
    if (updaterReleaseNotes) {
      if (notes) {
        updaterReleaseNotes.innerHTML = typeof notes === 'string' ? notes.replace(/\n/g, '<br>') : JSON.stringify(notes);
        updaterReleaseNotes.style.display = 'block';
      } else {
        updaterReleaseNotes.style.display = 'none';
      }
    }
    if (btnUpdaterAction) {
      btnUpdaterAction.textContent = actionText;
      btnUpdaterAction.onclick = actionFn;
    }
    modalUpdater.classList.add('active');
  }

  function closeUpdaterModal() {
    if (modalUpdater) modalUpdater.classList.remove('active');
  }

  if (btnUpdaterCancel) btnUpdaterCancel.onclick = closeUpdaterModal;

  if (api && api.onUpdateStatus) {
    api.onUpdateStatus((data) => {
      console.log('[AutoUpdater Status]:', data);
      if (!data) return;

      if (data.status === 'checking') {
        if (settingUpdaterStatus) {
          settingUpdaterStatus.style.display = 'block';
          settingUpdaterStatus.style.color = '#38bdf8';
          settingUpdaterStatus.textContent = '⏳ កំពុងពិនិត្យមើលកំណែថ្មីពី GitHub Releases...';
        }
      } else if (data.status === 'available') {
        updaterCurrentState = 'available';
        if (settingUpdaterStatus) {
          settingUpdaterStatus.style.display = 'block';
          settingUpdaterStatus.style.color = '#34d399';
          settingUpdaterStatus.textContent = `🎉 រកឃើញកំណែថ្មី v${data.version}!`;
        }
        showUpdaterModal(
          `🎉 រកឃើញកំណែថ្មី v${data.version}!`,
          `កំណែថ្មីនេះមានការកែលម្អមុខងារ និងដំណើរការរលូនជាងមុន។ តើអ្នកចង់ទាញយកឥឡូវនេះទេ?`,
          '⚡ ទាញយក Update ឥឡូវនេះ',
          async () => {
            if (btnUpdaterAction) {
              btnUpdaterAction.disabled = true;
              btnUpdaterAction.textContent = '⏳ កំពុងចាប់ផ្តើម...';
            }
            if (updaterProgressWrapper) updaterProgressWrapper.style.display = 'block';
            await api.downloadUpdate();
          },
          data.releaseNotes
        );
      } else if (data.status === 'not-available') {
        if (settingUpdaterStatus) {
          settingUpdaterStatus.style.display = 'block';
          settingUpdaterStatus.style.color = '#34d399';
          settingUpdaterStatus.textContent = data.message || '✅ កម្មវិធីជាកំណែចុងក្រោយបំផុតហើយ!';
        }
        showToast(data.message || '✅ កម្មវិធីជាកំណែចុងក្រោយបង្អស់ហើយ!');
      } else if (data.status === 'downloading') {
        updaterCurrentState = 'downloading';
        if (updaterProgressWrapper) updaterProgressWrapper.style.display = 'block';
        if (updaterProgressPercent) updaterProgressPercent.textContent = `${data.percent}%`;
        if (updaterProgressFill) updaterProgressFill.style.width = `${data.percent}%`;
        if (updaterProgressLabel) updaterProgressLabel.textContent = `⚡ កំពុងទាញយក (${data.percent}%)...`;
      } else if (data.status === 'downloaded') {
        updaterCurrentState = 'downloaded';
        if (updaterProgressWrapper) updaterProgressWrapper.style.display = 'none';
        showUpdaterModal(
          '🎉 ទាញយកចប់សព្វគ្រប់!',
          `កំណែថ្មី v${data.version} ត្រូវបានទាញយករួចរាល់។ សូមចុច Restart ដើម្បីអនុវត្តការអាប់ដេតភ្លាមៗ!`,
          '🔄 Restart & Update ឥឡូវនេះ',
          () => {
            api.installUpdate();
          }
        );
        showToast(`🎉 បានទាញយកកំណែថ្មី v${data.version} រួចរាល់!`);
      } else if (data.status === 'error') {
        if (settingUpdaterStatus) {
          settingUpdaterStatus.style.display = 'block';
          settingUpdaterStatus.style.color = '#f87171';
          settingUpdaterStatus.textContent = data.message || '❌ បរាជ័យក្នុងការពិនិត្យ Update';
        }
        if (btnUpdaterAction) {
          btnUpdaterAction.disabled = false;
          btnUpdaterAction.textContent = '⚡ ព្យាយាមម្តងទៀត';
        }
      }
    });
  }

  if (btnCheckUpdaterSettings) {
    btnCheckUpdaterSettings.onclick = async () => {
      btnCheckUpdaterSettings.disabled = true;
      btnCheckUpdaterSettings.innerHTML = '⏳ <span>កំពុងពិនិត្យ...</span>';
      if (settingUpdaterStatus) {
        settingUpdaterStatus.style.display = 'block';
        settingUpdaterStatus.style.color = 'var(--gold-400)';
        settingUpdaterStatus.textContent = 'កំពុងពិនិត្យកំណែថ្មីពី GitHub...';
      }

      try {
        const res = await api.checkForUpdates();
        if (res && res.status === 'dev') {
          showToast(res.message);
          if (settingUpdaterStatus) {
            settingUpdaterStatus.style.color = 'var(--gold-400)';
            settingUpdaterStatus.textContent = res.message;
          }
        }
      } catch (err) {
        showToast(`❌ បរាជ័យ: ${err.message}`);
      } finally {
        btnCheckUpdaterSettings.disabled = false;
        btnCheckUpdaterSettings.innerHTML = '🔄 <span>ពិនិត្យកំណែថ្មី (Check Update)</span>';
      }
    };
  }

  // 18. Kickoff Initial Hongguo Catalog
  loadHongguoDramas();
});

