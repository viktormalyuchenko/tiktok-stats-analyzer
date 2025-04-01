// --- DOM Elements ---
const startButton = document.getElementById('startButton');
const demoButton = document.getElementById('demoButton');
const howToModal = document.getElementById('howToModal');
const haveFileButton = document.getElementById('haveFileButton');
const selectFileModal = document.getElementById('selectFileModal');
const yearSelect = document.getElementById('yearSelect');
const uploadArea = document.getElementById('uploadArea');
const zipFileInput = document.getElementById('zipFileInput');
const uploadLabel = uploadArea?.querySelector('.upload-label');
const uploadText = document.getElementById('uploadText');
const uploadStatus = document.getElementById('uploadStatus');

const mainContent = document.getElementById('mainContent');
const readyScreen = document.getElementById('readyScreen');
const showSlideshowButton = document.getElementById('showSlideshowButton');
const fullscreenSlideshow = document.getElementById('fullscreenSlideshow');
const fsSlidesContainer = fullscreenSlideshow?.querySelector('.fs-slides-container');
const fsSlideshowArea = document.getElementById('fsSlideshowArea'); // Area for click/key navigation
const closeSlideshowButton = document.getElementById('closeSlideshowButton');
const fsProgressBar = fullscreenSlideshow?.querySelector('.fs-progress-bar');

const mainResults = document.getElementById('mainResults');
// Carousel elements are removed
const tableSection = document.getElementById('table'); // Only table remains in results
const statsTableBody = document.getElementById('statsTable')?.getElementsByTagName('tbody')[0];
const tableYearSpan = document.getElementById('tableYear');
const resetButton = document.getElementById('resetButton');
const shareImageButton = document.getElementById('shareImageButton'); // Share button
const shareCardContainer = document.getElementById('shareCardContainer'); // Hidden container for image generation
const shareCard = document.getElementById('shareCard'); // The card element itself
const shareYearEl = shareCard?.querySelector('.share-year'); // Elements inside the card
const shareUsernameEl = shareCard?.querySelector('.share-username');
const shareValuesEl = shareCard?.querySelectorAll('.share-stat-value');

const accordionItems = document.querySelectorAll('.accordion-item');

// --- Global Variables ---
let tiktokData = null;
let userTimezone = "UTC";
let currentAnalysisResult = null; // Store results for sharing

// Slideshow specific variables
let fsSlidesData = []; // Data array for fullscreen slides
let currentFsSlideIndex = 0;
let slideshowTimeoutId = null;
const SLIDESHOW_INTERVAL = 5000; // ms per slide

// --- Helper Functions ---

/** Parses TikTok date string (YYYY-MM-DD HH:MM:SS) into a Date object (UTC). */
function parseDateString(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString === "N/A") return null;
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, year, month, day, hours, minutes, seconds] = match.map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds > 59) return null;
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    if (isNaN(utcDate.getTime())) return null;
    if (utcDate.getUTCFullYear() !== year || utcDate.getUTCMonth() !== month - 1 || utcDate.getUTCDate() !== day) return null;
    return utcDate;
}

/** Formats date to user timezone. */
function formatToUserTimezone(dateInput, timezone, options = {}) {
    let dateObj;
    if (dateInput instanceof Date) dateObj = dateInput;
    else if (typeof dateInput === 'string' && dateInput !== "N/A") dateObj = parseDateString(dateInput);
    else return typeof dateInput === 'string' ? dateInput : "N/A";
    if (!dateObj || isNaN(dateObj.getTime())) return typeof dateInput === 'string' ? dateInput : "N/A";
    const defaultOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', timeZone: timezone, hour12: false };
    const finalOptions = { ...defaultOptions, ...options };
    try { return dateObj.toLocaleString('ru-RU', finalOptions); }
    catch (error) { console.error("Date format error:", error); return "Ошибка даты"; }
}

/** Creates HTML element. */
function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    for (const key in attributes) element.setAttribute(key, attributes[key]);
    if (typeof children === 'string') element.innerHTML = children;
    else if (Array.isArray(children)) {
        children.forEach(child => { if (child instanceof Node) element.appendChild(child); else if (typeof child === 'string') element.appendChild(document.createTextNode(child)); });
    } else if (children instanceof Node) element.appendChild(children);
    return element;
}

/** Gets user timezone. */
function getUserTimezone() { try { userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone; console.log("TZ:", userTimezone); } catch { userTimezone = "UTC"; console.warn("Не удалось определить часовой пояс, используем UTC."); } }

/** Populates year select. */
function populateYearSelect() {
    if (!yearSelect) return;
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let year = currentYear; year >= 2017; year--) { const option = createElement('option', { value: year }, String(year)); yearSelect.appendChild(option); }
    yearSelect.value = currentYear;
}

/** Updates status message. */
function updateStatus(message, type = 'loading') { if (uploadStatus) { uploadStatus.textContent = message; uploadStatus.className = `status-${type}`; uploadStatus.style.display = message ? 'block' : 'none'; } }

/** Handles errors. */
function handleError(message, error = null) { console.error(message, error || ''); updateStatus(`Ошибка: ${message}`, 'error'); if (zipFileInput) zipFileInput.value = ''; resetToInitialState(); }

/** Resets UI to initial state. */
function resetToInitialState() {
    tiktokData = null; fsSlidesData = []; currentFsSlideIndex = 0; currentAnalysisResult = null;
    clearTimeout(slideshowTimeoutId);
    if (fullscreenSlideshow) { fullscreenSlideshow.classList.remove('visible'); fullscreenSlideshow.style.display = 'none'; if (fsProgressBar) { fsProgressBar.style.transition = 'none'; fsProgressBar.style.width = '0%'; } }
    if (readyScreen) { readyScreen.classList.remove('visible'); readyScreen.style.display = 'none'; }
    if (mainResults) { mainResults.classList.remove('visible'); mainResults.style.display = 'none'; if (tableSection) tableSection.style.display = 'block'; }
    if (mainContent) mainContent.style.display = 'block';
    resetUploadText(); if (zipFileInput) zipFileInput.value = '';
    document.body.style.overflow = '';
    if (statsTableBody) statsTableBody.innerHTML = ''; if (fsSlidesContainer) fsSlidesContainer.innerHTML = '';
    updateStatus('', 'loading'); // Clear status message
    console.log("Состояние сброшено.");
}

/** Resets upload area text */
function resetUploadText() { if (uploadText) uploadText.innerHTML = 'Нажмите или перетащите сюда файл<br>(.zip или .json)'; }

/** Function to download image as fallback */
function downloadImageLink(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link); // Clean up
    updateStatus("Картинка скачана!", 'success');
    setTimeout(() => updateStatus('', 'loading'), 2500);
}

// --- UI Modals ---
function showModal(modalElement) { if (modalElement) modalElement.style.display = 'block'; }
function hideModal(modalElement) { if (modalElement) modalElement.style.display = 'none'; }

// --- File Handling ---
function handleFileSelect(event) { const file = event.target.files[0]; if (file) handleFile(file); }
function handleFile(file) {
    if (!file) { resetUploadText(); return; }
    const allowedTypes = ['application/zip', 'application/x-zip-compressed', 'application/json'];
    const allowedExtensions = ['.zip', '.json'];
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) { handleError(`Неподдерживаемый тип файла (${file.type || fileExtension || 'неизвестный'}). Выберите .zip или .json.`); resetUploadText(); return; }
    if (uploadText) uploadText.textContent = `Выбран файл: ${file.name}`;
    updateStatus('Обработка файла...', 'loading');
    if (mainContent) mainContent.style.display = 'none'; if (readyScreen) readyScreen.style.display = 'none'; if (mainResults) mainResults.style.display = 'none';
    if (fileExtension === '.zip' || file.type.includes('zip')) handleZipFile(file);
    else if (fileExtension === '.json' || file.type.includes('json')) handleJsonFile(file);
    else { handleError('Не удалось определить тип файла.'); resetUploadText(); }
}
function handleZipFile(file) {
    if (typeof JSZip === 'undefined') { handleError("Библиотека JSZip не загружена."); return; }
    JSZip.loadAsync(file).then((zip) => {
        const jsonFileKey = Object.keys(zip.files).find(fileName => /user[_ ]?data.*\.json$/i.test(fileName));
        if (!jsonFileKey) throw new Error('Файл user_data*.json не найден в ZIP-архиве.');
        updateStatus('Извлечение JSON...', 'loading'); return zip.file(jsonFileKey).async('text');
    }).then(processJsonText).catch(error => handleError(`Ошибка обработки ZIP: ${error.message}`, error));
}
function handleJsonFile(file) { const reader = new FileReader(); reader.onload = (e) => processJsonText(e.target.result); reader.onerror = (e) => handleError('Ошибка чтения JSON файла.', e); reader.readAsText(file); }

/** Processes JSON, validates, analyzes, shows Ready screen */
function processJsonText(jsonText) {
    try {
        updateStatus('Разбор JSON...', 'loading'); tiktokData = JSON.parse(jsonText);
        if (!validateTikTokData(tiktokData)) { resetUploadText(); return; } // validate calls handleError
        updateStatus('Анализ данных...', 'loading'); const selectedYear = parseInt(yearSelect.value, 10);
        currentAnalysisResult = analyzeTikTokData(tiktokData, selectedYear); // Analyze and store results
        if (!currentAnalysisResult) { handleError("Не удалось проанализировать данные."); return; }
        fsSlidesData = prepareFullscreenSlidesData(currentAnalysisResult, selectedYear); // Prepare FS slides
        if (mainContent) mainContent.style.display = 'none'; updateStatus('', 'loading'); hideModal(selectFileModal);
        if (readyScreen) { readyScreen.style.display = 'block'; requestAnimationFrame(() => readyScreen.classList.add('visible')); }
        else { handleError("Ошибка интерфейса: Экран готовности не найден."); }
    } catch (parseError) { handleError(`Ошибка разбора JSON: ${parseError.message}. Убедитесь, что файл не поврежден.`, parseError); tiktokData = null; currentAnalysisResult = null; }
}

// --- Data Validation ---
function validateTikTokData(data) {
    if (!data || typeof data !== 'object') { handleError('Файл данных пуст или имеет неверную структуру.'); return false; }
    const essentialKeys = ['Your Activity', 'Profile'];
    for (const key of essentialKeys) { if (!data.hasOwnProperty(key) || typeof data[key] !== 'object' || data[key] === null) { handleError(`Отсутствует обязательный раздел: "${key}".`); return false; } }
    if (!data['Your Activity']?.['Watch History']?.VideoList || !data['Your Activity']?.['Like List']?.ItemFavoriteList) console.warn('Watch History или Like List не найдены/пусты.');
    return true;
}

// --- Data Analysis Functions ---
// (Include the full, corrected versions of processProfileData, processWatchHistoryData, processCommentsData, processLikesData, processSharesData, processLiveData from previous steps here)
function processProfileData(profileSection, selectedYear) { const pI = profileSection?.["Profile Info"]?.ProfileMap; const tD = {}; if (pI) { tD['Имя пользователя (userName)'] = pI.userName || 'N/A'; tD['Bio'] = pI.bioDescription || 'N/A'; } else { console.warn("Profile Info->ProfileMap not found."); tD['Профиль'] = 'N/A'; } return { tableData: tD, slideInfo: { userName: pI?.userName || '' } }; }
function processWatchHistoryData(watchHistorySection, selectedYear) { const vL = watchHistorySection?.VideoList; const tD = {}; let vC = 0, tWTM = 0, wS = 0, aSL = 0, lSM = 0, lSDS = 'N/A', mAW = 'N/A', eVD = null, lVD = null; if (Array.isArray(vL) && vL.length > 0) { const yVL = vL.filter(v => { if (!v || !v.Date) return false; const d = parseDateString(v.Date); return d && d.getUTCFullYear() === selectedYear }); vC = yVL.length; if (vC > 0) { const avgS = 15; tWTM = Math.round((vC * avgS) / 60); yVL.sort((a, b) => { const dA = parseDateString(a.Date), dB = parseDateString(b.Date); if (!dA && !dB) return 0; if (!dA) return 1; if (!dB) return -1; return dA - dB; }); for (const v of yVL) { const d = parseDateString(v.Date); if (d) { if (!eVD) eVD = d; lVD = d; } } let cSS = null, cSE = null, cSVC = 0; lSM = 0; yVL.forEach((v, i) => { const d = parseDateString(v.Date); if (!d) return; if (cSS === null) { wS = 1; cSS = d; cSE = d; cSVC = 1; } else { const tDM = (d - cSE) / (1000 * 60); if (tDM > 30) { const dur = cSVC * avgS / 60; if (dur > lSM) { lSM = Math.round(dur); lSDS = formatToUserTimezone(cSS, userTimezone, { month: 'short', day: 'numeric' }); } wS++; cSS = d; cSVC = 1; } else { cSVC++; } cSE = d; } if (i === yVL.length - 1 && cSS) { const dur = cSVC * avgS / 60; if (dur > lSM) { lSM = Math.round(dur); lSDS = formatToUserTimezone(cSS, userTimezone, { month: 'short', day: 'numeric' }); } } }); aSL = wS > 0 ? Math.round(tWTM / wS) : 0; const wk = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], wc = Array(7).fill(0); yVL.forEach(v => { const d = parseDateString(v.Date); if (d) wc[d.getUTCDay()]++; }); const mc = Math.max(...wc); if (mc > 0) mAW = wk[wc.indexOf(mc)]; } } else console.warn("Watch History empty."); tD['Всего просмотрено видео'] = vC.toLocaleString('ru-RU'); tD['Общее время (оценка)'] = `${tWTM.toLocaleString('ru-RU')} мин ≈ ${Math.round(tWTM / 60).toLocaleString('ru-RU')} ч`; tD['Сессий просмотра'] = wS.toLocaleString('ru-RU'); tD['Средняя сессия (оценка)'] = `${aSL.toLocaleString('ru-RU')} мин`; tD['Самая длинная сессия (оценка)'] = lSM > 0 ? `${lSDS} (~${lSM.toLocaleString('ru-RU')} мин)` : 'N/A'; tD['Самый активный день'] = mAW; tD['Первое видео года'] = eVD ? formatToUserTimezone(eVD, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'; tD['Последнее видео года'] = lVD ? formatToUserTimezone(lVD, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'; return { tableData: tD, slideInfo: { videoCount: vC, totalWatchTimeHours: Math.round(tWTM / 60), mostActiveWeekday: mAW } }; }
function processCommentsData(commentsSection, selectedYear) { const cL = commentsSection?.Comments?.CommentsList; const tD = {}; let cC = 0, tCL = 0, aCL = 0, mUE = '', mEC = 0, eCD = null, lCD = null; const eC = {}; if (Array.isArray(cL) && cL.length > 0) { const yC = cL.filter(c => { if (!c || !c.date) return false; const d = parseDateString(c.date); return d && d.getUTCFullYear() === selectedYear }); cC = yC.length; if (cC > 0) { yC.forEach(c => { if (!c.comment || typeof c.comment !== 'string') return; tCL += c.comment.length; const d = parseDateString(c.date); if (d) { if (!eCD || d < eCD) eCD = d; if (!lCD || d > lCD) lCD = d; } const r = /([\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]\u{FE0F}?(\u{200D}[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]\u{FE0F}?)*)/gu; const m = c.comment.match(r); if (m) { m.forEach(e => { const bE = e.replace(/\u{FE0F}/g, ''); eC[bE] = (eC[bE] || 0) + 1; }); } }); aCL = cC > 0 ? Math.round(tCL / cC) : 0; mUE = ''; mEC = 0; for (const e in eC) { if (eC.hasOwnProperty(e) && eC[e] > mEC) { mUE = e; mEC = eC[e]; } } } } else console.warn("Comment List empty."); tD['Всего комментариев'] = cC.toLocaleString('ru-RU'); if (cC > 0) tD['Средняя длина комментария'] = `${aCL.toLocaleString('ru-RU')} симв.`; tD['Самый частый эмодзи'] = mEC > 0 ? `${mUE} (x${mEC.toLocaleString('ru-RU')})` : '(нет эмодзи)'; tD['Первый коммент. года'] = eCD ? formatToUserTimezone(eCD, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'; tD['Последний коммент. года'] = lCD ? formatToUserTimezone(lCD, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'; return { tableData: tD, slideInfo: { commentCount: cC, mostUsedEmoji: mEC > 0 ? mUE : null } }; }
function processLikesData(likesSection, selectedYear) { const lL = likesSection?.ItemFavoriteList; const tD = {}; let lC = 0, mDC = 0, mDS = 'N/A', fLD = null, fLL = null; if (Array.isArray(lL) && lL.length > 0) { const yL = lL.filter(l => { if (!l || !l.date) return false; const d = parseDateString(l.date); return d && d.getUTCFullYear() === selectedYear }); lC = yL.length; if (lC > 0) { const dC = {}; yL.sort((a, b) => { const dA = parseDateString(a.date), dB = parseDateString(b.date); if (!dA && !dB) return 0; if (!dA) return 1; if (!dB) return -1; return dA - dB; }); for (const l of yL) { const d = parseDateString(l.date); if (d) { if (!fLD) { fLD = d; fLL = (l.link && l.link.startsWith('http')) ? l.link : null; } const ds = d.toISOString().split('T')[0]; dC[ds] = (dC[ds] || 0) + 1; } } for (const day in dC) { if (dC[day] > mDC) { mDC = dC[day]; const [y, m, d] = day.split('-'); mDS = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ru-RU', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); } } } } else console.warn("Like List empty."); tD['Всего лайков поставлено'] = lC.toLocaleString('ru-RU'); tD['День с макс. лайками'] = mDC > 0 ? `${mDS} (${mDC.toLocaleString('ru-RU')} лайков)` : 'N/A'; tD['Первый лайк года'] = fLD ? `${formatToUserTimezone(fLD, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' })} ${fLL ? `<a href="${fLL}" target="_blank" rel="noopener noreferrer" title="Открыть видео">🔗</a>` : ''}` : 'N/A'; return { tableData: tD, slideInfo: { likeCount: lC } }; }
function processSharesData(shareHistoryList, selectedYear) { const tD = {}; let sC = 0, mSC = 0, mSS = 'N/A', fSD = null, fSL = null; if (Array.isArray(shareHistoryList) && shareHistoryList.length > 0) { const yS = shareHistoryList.filter(s => { if (!s || !s.Date) return false; const d = parseDateString(s.Date); return d && d.getUTCFullYear() === selectedYear }); sC = yS.length; if (sC > 0) { const dC = {}; yS.sort((a, b) => { const dA = parseDateString(a.Date), dB = parseDateString(b.Date); if (!dA && !dB) return 0; if (!dA) return 1; if (!dB) return -1; return dA - dB; }); for (const s of yS) { const d = parseDateString(s.Date); if (d) { if (!fSD) { fSD = d; fSL = (s.Link && s.Link.startsWith('http')) ? s.Link : null; } const ds = d.toISOString().split('T')[0]; dC[ds] = (dC[ds] || 0) + 1; } } for (const day in dC) { if (dC[day] > mSC) { mSC = dC[day]; const [y, m, d] = day.split('-'); mSS = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ru-RU', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); } } } } else console.warn("Share List empty."); tD['Всего репостов сделано'] = sC.toLocaleString('ru-RU'); tD['День с макс. репостами'] = mSC > 0 ? `${mSS} (${mSC.toLocaleString('ru-RU')} репостов)` : 'N/A'; tD['Первый репост года'] = fSD ? `${formatToUserTimezone(fSD, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' })} ${fSL ? `<a href="${fSL}" target="_blank" rel="noopener noreferrer" title="Открыть видео">🔗</a>` : ''}` : 'N/A'; return { tableData: tD, slideInfo: { shareCount: sC } }; }
function processLiveData(liveSection, selectedYear) { const wLH = liveSection?.["Watch Live History"]?.WatchLiveMap; const tD = {}; let lC = 0; if (wLH && typeof wLH === 'object') { lC = Object.values(wLH).filter(l => { const d = parseDateString(l.WatchTime); return d && d.getUTCFullYear() === selectedYear }).length; } tD['Просмотрено трансляций (Live)'] = lC.toLocaleString('ru-RU'); return { tableData: tD, slideInfo: { liveCount: lC } }; }


/** Analyzes all data, populates table, returns stats object */
function analyzeTikTokData(data, selectedYear) {
    if (!data) return null;
    if (statsTableBody) statsTableBody.innerHTML = ''; addStatsToTable.currentGroup = null;
    const allStats = {};
    const runProcess = (key, func, dataPath, groupName) => { try { allStats[key] = func(dataPath, selectedYear); addStatsToTable(allStats[key].tableData, groupName); } catch (e) { console.error(`Error processing ${key}:`, e); addStatsToTable({}, `${groupName} (Ошибка)`); } };
    runProcess('profile', processProfileData, data?.Profile, "👤 Профиль");
    runProcess('watchHistory', processWatchHistoryData, data?.["Your Activity"]?.["Watch History"], "📺 История просмотров");
    runProcess('comments', processCommentsData, data?.Comment, "💬 Комментарии");
    runProcess('likes', processLikesData, data?.["Your Activity"]?.["Like List"], "❤️ Лайки");
    runProcess('shares', processSharesData, data?.["Your Activity"]?.["Share History"]?.ShareHistoryList, "🔗 Репосты");
    runProcess('live', processLiveData, data?.["Tiktok Live"], "🔴 Трансляции (Live)");
    return allStats;
}

// --- Table Generation ---
function addStatsToTable(stats, groupName) {
    if (!statsTableBody) return; let groupHeaderAdded = false;
    if (!stats || Object.keys(stats).length === 0) { if (addStatsToTable.currentGroup !== groupName) { const gR = statsTableBody.insertRow(); gR.classList.add('group-header'); const gC = gR.insertCell(0); gC.colSpan = 2; gC.innerHTML = `<strong>${groupName}</strong>`; addStatsToTable.currentGroup = groupName; groupHeaderAdded = true; const nDR = statsTableBody.insertRow(); const hC = nDR.insertCell(0); hC.scope = "row"; hC.style.cssText = 'font-style:italic;color:var(--text-muted)'; hC.textContent = '(Данные отсутствуют или ошибка)'; const vC = nDR.insertCell(1); vC.textContent = '-'; vC.style.color = 'var(--text-muted)'; } return; }
    if (addStatsToTable.currentGroup !== groupName) { const gR = statsTableBody.insertRow(); gR.classList.add('group-header'); const gC = gR.insertCell(0); gC.colSpan = 2; gC.innerHTML = `<strong>${groupName}</strong>`; addStatsToTable.currentGroup = groupName; groupHeaderAdded = true; }
    for (const key in stats) { if (stats.hasOwnProperty(key)) { const row = statsTableBody.insertRow(); const hC = document.createElement('th'); hC.scope = "row"; hC.textContent = key; row.appendChild(hC); const vC = row.insertCell(1); vC.innerHTML = stats[key] ?? 'N/A'; if (vC.innerHTML === 'N/A' || vC.innerHTML === '0') vC.style.color = 'var(--text-muted)'; } }
}
addStatsToTable.currentGroup = null;

// --- Fullscreen Slideshow Logic ---
function animateCounter(element, targetValue, duration = 1500) {
    if (!element || isNaN(targetValue)) { if (element) element.textContent = 'N/A'; return; };
    element.classList.add('counting'); let startValue = 0; const startTime = performance.now();
    function updateCounter(currentTime) { const elT = currentTime - startTime, prog = Math.min(1, elT / duration), eP = 1 - Math.pow(1 - prog, 3), cV = Math.floor(eP * (targetValue - startValue) + startValue); element.textContent = cV.toLocaleString('ru-RU'); if (prog < 1) requestAnimationFrame(updateCounter); else { element.textContent = targetValue.toLocaleString('ru-RU'); element.classList.remove('counting'); } } requestAnimationFrame(updateCounter);
}
function createFullscreenSlideElement(slideData) {
    const slide = createElement('div', { class: 'fs-slide' }); if (slideData.title) slide.appendChild(createElement('div', { class: 'fs-title' }, slideData.title)); if (slideData.value !== undefined && slideData.value !== null) { const iD = typeof slideData.value === 'number' ? '0' : slideData.value; const vE = createElement('div', { class: 'fs-value', 'data-target': slideData.value }, iD); slide.appendChild(vE); } if (slideData.label) slide.appendChild(createElement('div', { class: 'fs-label' }, slideData.label)); if (slideData.details) slide.appendChild(createElement('div', { class: 'fs-details' }, slideData.details)); return slide;
}
function showNextFullscreenSlide() {
    if (!fsSlidesContainer || !fsProgressBar) return; clearTimeout(slideshowTimeoutId);
    const slides = fsSlidesContainer.querySelectorAll('.fs-slide'); if (slides.length === 0) return;
    const currentActive = fsSlidesContainer.querySelector('.fs-slide.active'); if (currentActive) { currentActive.classList.remove('active'); currentActive.classList.add('exiting'); setTimeout(() => { currentActive.classList.remove('exiting'); }, 600); }
    currentFsSlideIndex++; if (currentFsSlideIndex >= slides.length) { endFullscreenSlideshow(); return; }
    const nextSlide = slides[currentFsSlideIndex]; if (!nextSlide) { endFullscreenSlideshow(); return; } nextSlide.classList.add('active');
    const valueElement = nextSlide.querySelector('.fs-value'); if (valueElement && valueElement.hasAttribute('data-target')) { const tV = valueElement.getAttribute('data-target'); const tN = parseInt(tV, 10); if (!isNaN(tN) && typeof fsSlidesData[currentFsSlideIndex]?.value === 'number') { valueElement.textContent = '0'; setTimeout(() => animateCounter(valueElement, tN, 1500), 300); } else { valueElement.textContent = tV; } }
    fsProgressBar.style.transition = 'none'; fsProgressBar.style.width = '0%'; void fsProgressBar.offsetWidth; fsProgressBar.style.transition = `width ${SLIDESHOW_INTERVAL / 1000}s linear`; fsProgressBar.style.width = '100%';
    slideshowTimeoutId = setTimeout(showNextFullscreenSlide, SLIDESHOW_INTERVAL);
}
function showPrevFullscreenSlide() {
    if (!fsSlidesContainer || !fsProgressBar || currentFsSlideIndex <= 0) return; clearTimeout(slideshowTimeoutId);
    const slides = fsSlidesContainer.querySelectorAll('.fs-slide'); if (slides.length === 0) return;
    const currentActive = fsSlidesContainer.querySelector('.fs-slide.active'); if (currentActive) { currentActive.classList.remove('active'); currentActive.classList.add('exiting'); setTimeout(() => { currentActive.classList.remove('exiting'); }, 600); }
    currentFsSlideIndex--; const prevSlide = slides[currentFsSlideIndex]; if (!prevSlide) return; prevSlide.classList.add('active');
    const valueElement = prevSlide.querySelector('.fs-value'); if (valueElement && valueElement.hasAttribute('data-target')) { const tV = valueElement.getAttribute('data-target'); const tN = parseInt(tV, 10); if (!isNaN(tN) && typeof fsSlidesData[currentFsSlideIndex]?.value === 'number') { valueElement.textContent = '0'; setTimeout(() => animateCounter(valueElement, tN, 1500), 300); } else { valueElement.textContent = tV; } }
    fsProgressBar.style.transition = 'none'; fsProgressBar.style.width = '0%'; void fsProgressBar.offsetWidth; fsProgressBar.style.transition = `width ${SLIDESHOW_INTERVAL / 1000}s linear`; fsProgressBar.style.width = '100%';
    slideshowTimeoutId = setTimeout(showNextFullscreenSlide, SLIDESHOW_INTERVAL);
}
function startFullscreenSlideshow() {
    if (!fsSlidesContainer || !fullscreenSlideshow || !fsProgressBar) return;
    fsSlidesContainer.innerHTML = ''; fsSlidesData.forEach(data => fsSlidesContainer.appendChild(createFullscreenSlideElement(data)));
    currentFsSlideIndex = -1; fsProgressBar.style.transition = 'none'; fsProgressBar.style.width = '0%';
    fullscreenSlideshow.style.display = 'flex'; requestAnimationFrame(() => fullscreenSlideshow.classList.add('visible'));
    document.body.style.overflow = 'hidden'; if (fsSlideshowArea) fsSlideshowArea.focus();
    showNextFullscreenSlide();
}
function endFullscreenSlideshow() {
    if (!fullscreenSlideshow || !mainResults || !tableSection || !tableYearSpan || !yearSelect) { console.error("Missing elements for ending slideshow"); return; }
    clearTimeout(slideshowTimeoutId); fullscreenSlideshow.classList.remove('visible'); document.body.style.overflow = '';
    setTimeout(() => {
        fullscreenSlideshow.style.display = 'none'; mainResults.style.display = 'block';
        requestAnimationFrame(() => mainResults.classList.add('visible'));
        tableSection.style.display = 'block'; tableYearSpan.textContent = yearSelect.value;
    }, 400);
}
function prepareFullscreenSlidesData(stats, year) {
    const slides = [];
    slides.push({ title: `Твоя статистика ${year}`, value: stats.profile?.slideInfo?.userName || '👋', label: `Готов увидеть итоги?`, details: "Собрали самые интересные моменты." });
    if (stats.watchHistory?.slideInfo?.videoCount > 0) slides.push({ title: "Просмотры", value: stats.watchHistory.slideInfo.videoCount, label: "видео просмотрено", details: `Примерно ${stats.watchHistory.slideInfo.totalWatchTimeHours.toLocaleString('ru-RU')} ч. в TikTok!` });
    if (stats.watchHistory?.slideInfo?.mostActiveWeekday !== 'N/A') slides.push({ title: "Любимый день", value: stats.watchHistory.slideInfo.mostActiveWeekday, label: "твой самый активный день в TikTok" });
    if (stats.likes?.slideInfo?.likeCount > 0) slides.push({ title: "Лайки", value: stats.likes.slideInfo.likeCount, label: "лайков поставлено" });
    if (stats.comments?.slideInfo?.commentCount > 0) { let d = "Ты не молчал!"; if (stats.comments.slideInfo.mostUsedEmoji) d += ` Твой фаворит: <span style='font-size:1.5em;vertical-align:middle;'>${stats.comments.slideInfo.mostUsedEmoji}</span>`; slides.push({ title: "Комментарии", value: stats.comments.slideInfo.commentCount, label: "комментариев оставлено", details: d }); }
    if (stats.shares?.slideInfo?.shareCount > 0) slides.push({ title: "Репосты", value: stats.shares.slideInfo.shareCount, label: "раз ты поделился видео" });
    if (stats.live?.slideInfo?.liveCount > 0) slides.push({ title: "Прямые эфиры", value: stats.live.slideInfo.liveCount, label: "Live-трансляций просмотрено" });
    slides.push({ title: "Вот и всё!", value: '✨', label: `Твоя статистика за ${year} год`, details: "Ниже детальный отчет." });
    return slides;
}

// --- Demo Data Setup ---
const demoTikTokData = { "Profile": { "Profile Info": { ProfileMap: { userName: "Демо Пользователь", bioDescription: "Это демо-статистика!" } } }, Comment: { Comments: { CommentsList: [{ date: `${new Date().getFullYear()}-01-15 10:00:00`, comment: "Первый демо коммент 🎉" }, { date: `${new Date().getFullYear()}-03-20 12:30:00`, comment: "Еще один! 👍" }, { date: `${new Date().getFullYear()}-05-10 18:00:00`, comment: "Тестируем 🚀" }, { date: `${new Date().getFullYear() - 1}-11-10 18:00:00`, comment: "Прошлый год" }] } }, "Your Activity": { "Watch History": { VideoList: Array.from({ length: 1567 }).map((_, i) => ({ Date: generateRandomDateInYear(new Date().getFullYear()) })) }, "Like List": { ItemFavoriteList: Array.from({ length: 842 }).map((_, i) => ({ Date: generateRandomDateInYear(new Date().getFullYear()), link: `https://example.com/${i}` })) }, "Share History": { ShareHistoryList: Array.from({ length: 95 }).map((_, i) => ({ Date: generateRandomDateInYear(new Date().getFullYear()), Link: `https://example.com/${i}` })) } }, "Tiktok Live": { "Watch Live History": { WatchLiveMap: { "live1": { WatchTime: generateRandomDateInYear(new Date().getFullYear()) }, "live2": { WatchTime: generateRandomDateInYear(new Date().getFullYear()) }, "live3": { WatchTime: generateRandomDateInYear(new Date().getFullYear()) }, "live4": { WatchTime: `${new Date().getFullYear() - 1}-12-01 10:00:00` }, "live5": { WatchTime: generateRandomDateInYear(new Date().getFullYear()) } } } } };
function generateRandomDateInYear(year) { const s = new Date(Date.UTC(year, 0, 1)), e = new Date(Date.UTC(year, 11, 31)); const d = new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime())); return d.toISOString().replace('T', ' ').substring(0, 19); }

// --- Image Generation & Sharing ---
async function generateAndShareImage() {
    if (!shareCard || !currentAnalysisResult || typeof html2canvas === 'undefined') { alert("Невозможно поделиться: данные не готовы или библиотека html2canvas не загружена."); updateStatus("Ошибка подготовки к шарингу", 'error'); return; }
    console.log("Подготовка карточки для шаринга..."); updateStatus("Готовим картинку...", 'loading');
    const selectedYear = yearSelect.value; const stats = currentAnalysisResult;
    try {
        if (shareYearEl) shareYearEl.textContent = selectedYear;
        if (shareUsernameEl) shareUsernameEl.textContent = stats.profile?.slideInfo?.userName || 'Неизвестно';
        if (shareValuesEl && shareValuesEl.length >= 4) {
            shareValuesEl[0].textContent = stats.watchHistory?.slideInfo?.videoCount.toLocaleString('ru-RU') || '0';
            shareValuesEl[1].textContent = `~ ${stats.watchHistory?.slideInfo?.totalWatchTimeHours.toLocaleString('ru-RU') || '0'}`;
            shareValuesEl[2].textContent = stats.likes?.slideInfo?.likeCount.toLocaleString('ru-RU') || '0';
            shareValuesEl[3].textContent = stats.comments?.slideInfo?.commentCount.toLocaleString('ru-RU') || '0';
        } else { console.warn("Не все элементы .share-stat-value найдены"); }
    } catch (error) { console.error("Ошибка обновления данных карточки:", error); handleError("Ошибка подготовки данных для картинки."); return; }
    await new Promise(resolve => setTimeout(resolve, 100)); // Delay for DOM update
    console.log("Генерация изображения...");
    try {
        const canvas = await html2canvas(shareCard, { useCORS: true, scale: window.devicePixelRatio || 2, backgroundColor: '#ffffff' });
        console.log("Canvas сгенерирован."); const filename = `tiktok-stats-${selectedYear}.png`;
        canvas.toBlob(async (blob) => {
            if (!blob) { updateStatus("Ошибка создания Blob", 'error'); console.error("Canvas toBlob returned null"); try { const dU = canvas.toDataURL('image/png'); downloadImageLink(dU, filename); } catch (e) { console.error("Fallback download error", e); handleError("Не удалось скачать изображение"); } return; }
            const file = new File([blob], filename, { type: 'image/png' }); const shareData = { title: `Моя статистика TikTok за ${selectedYear}`, text: `Смотри мои итоги года в TikTok!`, files: [file] }; // Customize text
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                console.log("Попытка Web Share API...");
                try { await navigator.share(shareData); console.log('Успешно поделились'); updateStatus("Открыто окно шаринга...", 'success'); setTimeout(() => updateStatus('', 'loading'), 3000); }
                catch (error) { if (error.name !== 'AbortError') { console.error('Ошибка Web Share API:', error); updateStatus("Ошибка шаринга, скачайте файл", 'error'); const dU = canvas.toDataURL('image/png'); downloadImageLink(dU, filename); } else { console.log("Шаринг отменен."); updateStatus('', 'loading'); } }
            } else { console.log('Web Share API (для файлов) не поддерживается, предлагаем скачать.'); const dU = canvas.toDataURL('image/png'); downloadImageLink(dU, filename); }
        }, 'image/png');
    } catch (error) { console.error("Ошибка html2canvas:", error); handleError("Не удалось сгенерировать изображение."); }
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    // Initial buttons & Modals
    startButton?.addEventListener('click', () => showModal(howToModal));
    demoButton?.addEventListener('click', () => { console.log("Запуск демо..."); updateStatus('Загрузка демо...', 'loading'); if (yearSelect) yearSelect.value = new Date().getFullYear(); setTimeout(() => { processJsonText(JSON.stringify(demoTikTokData)); }, 300); });
    haveFileButton?.addEventListener('click', () => { hideModal(howToModal); showModal(selectFileModal); });
    window.addEventListener('click', (e) => { if (e.target === howToModal) hideModal(howToModal); if (e.target === selectFileModal) hideModal(selectFileModal); });

    // File Input & Drag/Drop
    uploadArea?.addEventListener('click', () => zipFileInput?.click());
    zipFileInput?.addEventListener('change', handleFileSelect);
    uploadArea?.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); uploadArea.classList.add('dragover'); if (uploadText) uploadText.textContent = 'Отпустите файл'; });
    uploadArea?.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); uploadArea.classList.remove('dragover'); resetUploadText(); });
    uploadArea?.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); uploadArea.classList.remove('dragover'); resetUploadText(); if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]); });

    // Ready Screen Button
    showSlideshowButton?.addEventListener('click', () => { if (readyScreen) readyScreen.classList.remove('visible'); setTimeout(() => { if (readyScreen) readyScreen.style.display = 'none'; startFullscreenSlideshow(); }, 500); });

    // Fullscreen Slideshow Navigation & Close
    closeSlideshowButton?.addEventListener('click', endFullscreenSlideshow);
    fsSlideshowArea?.addEventListener('click', (event) => { if (closeSlideshowButton && closeSlideshowButton.contains(event.target)) return; const cX = event.clientX, sW = window.innerWidth; if (cX < sW / 3) showPrevFullscreenSlide(); else if (cX > sW * 2 / 3) showNextFullscreenSlide(); });
    fsSlideshowArea?.addEventListener('keydown', (event) => { if (event.key === 'ArrowRight' || event.key === ' ') showNextFullscreenSlide(); else if (event.key === 'ArrowLeft') showPrevFullscreenSlide(); else if (event.key === 'Escape') endFullscreenSlideshow(); });

    // Results Section Buttons
    resetButton?.addEventListener('click', resetToInitialState);
    shareImageButton?.addEventListener('click', generateAndShareImage); // Share button listener

    // Accordion (FAQ)
    accordionItems.forEach(item => { const h = item.querySelector('.accordion-header'), c = item.querySelector('.accordion-content'); h?.addEventListener('click', () => { const iA = item.classList.contains('active'); accordionItems.forEach(o => { if (o !== item) { o.classList.remove('active'); o.querySelector('.accordion-header')?.setAttribute('aria-expanded', 'false'); const oc = o.querySelector('.accordion-content'); if (oc) oc.style.maxHeight = null; } }); item.classList.toggle('active', !iA); h.setAttribute('aria-expanded', !iA); if (c) c.style.maxHeight = !iA ? c.scrollHeight + 40 + "px" : null; }); });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Critical element check
    if (!mainContent || !fullscreenSlideshow || !mainResults || !shareCard || !readyScreen) {
        console.error("Критические элементы разметки не найдены! Проверьте ID: mainContent, fullscreenSlideshow, mainResults, shareCard, readyScreen.");
        document.body.innerHTML = '<p style="color: red; text-align: center; padding: 50px;">Ошибка: Не удалось загрузить интерфейс страницы. Пожалуйста, обновите.</p>';
        return;
    }
    getUserTimezone();
    populateYearSelect();
    setupEventListeners();
    resetToInitialState(); // Set initial UI state
});