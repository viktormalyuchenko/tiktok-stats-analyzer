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
// Elements inside shareCard for updating
const shareUsernameEl = shareCard?.querySelector('.share-username');
const shareYearEl = shareCard?.querySelector('.share-year');
const sharePersonaEl = shareCard?.querySelector('.share-persona');
const shareVideosWatchedEl = shareCard?.querySelector('.share-videos-watched');
const shareWatchTimeEl = shareCard?.querySelector('.share-watch-time');
const shareSessionsEl = shareCard?.querySelector('.share-sessions');
const shareAvgSessionEl = shareCard?.querySelector('.share-avg-session');
const shareCommentsEl = shareCard?.querySelector('.share-comments');
const shareLikesEl = shareCard?.querySelector('.share-likes');
const shareEmojiEl = shareCard?.querySelector('.share-emoji');


const accordionItems = document.querySelectorAll('.accordion-item');

// --- Global Variables ---
let tiktokData = null;
let userTimezone = "UTC";
let currentAnalysisResult = null; // Store results for sharing

// Slideshow specific variables
let fsSlidesData = []; // Data array for fullscreen slides
let currentFsSlideIndex = 0;
let slideshowTimeoutId = null;
const SLIDESHOW_INTERVAL = 5500; // ms per slide

// --- Helper Functions ---

/** Parses TikTok date string (YYYY-MM-DD HH:MM:SS) into a Date object (UTC). */
function parseDateString(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString === "N/A") return null;
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, year, month, day, hours, minutes, seconds] = match.map(Number);
    // Basic range validation
    if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds > 59) return null;
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    if (isNaN(utcDate.getTime())) return null;
    // Double-check components to catch invalid dates like Feb 30
    if (utcDate.getUTCFullYear() !== year || utcDate.getUTCMonth() !== month - 1 || utcDate.getUTCDate() !== day) return null;
    return utcDate;
}

/** Formats date to user timezone. */
function formatToUserTimezone(dateInput, timezone, options = {}) {
    let dateObj;
    if (dateInput instanceof Date) dateObj = dateInput;
    else if (typeof dateInput === 'string' && dateInput !== "N/A") dateObj = parseDateString(dateInput);
    else return typeof dateInput === 'string' ? dateInput : "N/A"; // Return original invalid string or N/A

    if (!dateObj || isNaN(dateObj.getTime())) return typeof dateInput === 'string' ? dateInput : "N/A"; // Return original if parsing failed

    // Define default options for date formatting
    const defaultOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', timeZone: timezone, hour12: false };
    // Merge defaults with provided options
    const finalOptions = { ...defaultOptions, ...options };

    try {
        return dateObj.toLocaleString('ru-RU', finalOptions);
    } catch (error) {
        console.error("Date format error:", error, "Input:", dateInput, "Options:", finalOptions);
        // Fallback to a simpler UTC format if localization fails
        try {
            return dateObj.toISOString().replace('T', ' ').substring(0, 16) + " UTC"; // YYYY-MM-DD HH:MM UTC
        } catch {
            return "Ошибка даты"; // Final fallback
        }
    }
}


/** Creates HTML element. */
function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    for (const key in attributes) element.setAttribute(key, attributes[key]);
    if (typeof children === 'string') element.innerHTML = children; // Allow HTML content
    else if (Array.isArray(children)) {
        children.forEach(child => {
            if (child instanceof Node) element.appendChild(child);
            else if (typeof child === 'string') element.appendChild(document.createTextNode(child));
        });
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
    for (let year = currentYear; year >= 2017; year--) { // Adjust start year if needed
        const option = createElement('option', { value: year }, String(year));
        yearSelect.appendChild(option);
    }
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
    if (mainResults) { mainResults.classList.remove('visible'); mainResults.style.display = 'none'; if (tableSection) tableSection.style.display = 'block'; } // Show table by default inside results
    if (mainContent) mainContent.style.display = 'block';
    resetUploadText(); if (zipFileInput) zipFileInput.value = '';
    document.body.style.overflow = '';
    if (statsTableBody) statsTableBody.innerHTML = ''; if (fsSlidesContainer) fsSlidesContainer.innerHTML = '';
    updateStatus('', 'loading'); // Clear status message
    console.log("Состояние сброшено.");
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (mainContent) mainContent.style.display = 'none'; if (readyScreen) readyScreen.style.display = 'none'; if (mainResults) mainResults.style.display = 'none'; // Hide everything during processing
    if (fileExtension === '.zip' || file.type.includes('zip')) handleZipFile(file);
    else if (fileExtension === '.json' || file.type.includes('json')) handleJsonFile(file);
    else { handleError('Не удалось определить тип файла.'); resetUploadText(); } // Should not happen often
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
    // Add more checks if needed
    return true;
}

// --- Data Analysis Functions ---

function processProfileData(profileSection, selectedYear) {
    const profileInfo = profileSection?.["Profile Info"]?.ProfileMap;
    const tableData = {};
    if (profileInfo) {
        tableData['Имя пользователя (userName)'] = profileInfo.userName || 'N/A';
        tableData['Bio'] = profileInfo.bioDescription || 'N/A';
    } else {
        console.warn("Не удалось найти 'Profile Info -> ProfileMap'.");
        tableData['Профиль'] = 'Информация не найдена';
    }
    const slideInfo = { userName: profileInfo?.userName || '' };
    return { tableData, slideInfo };
}

function processWatchHistoryData(watchHistorySection, selectedYear) {
    const videoList = watchHistorySection?.VideoList;
    const tableData = {};
    let videoCount = 0, totalWatchTimeMinutes = 0, watchSessions = 0, averageSessionLength = 0;
    let longestSessionMinutes = 0, longestSessionDateStr = 'N/A', mostActiveWeekday = 'N/A';
    let earliestVideoDate = null, latestVideoDate = null;

    if (Array.isArray(videoList) && videoList.length > 0) {
        const yearVideoList = videoList.filter(video => {
            if (!video || !video.Date) return false;
            const videoDate = parseDateString(video.Date);
            return videoDate && videoDate.getUTCFullYear() === selectedYear;
        });
        videoCount = yearVideoList.length;
        if (videoCount > 0) {
            const averageWatchSeconds = 15;
            totalWatchTimeMinutes = Math.round((videoCount * averageWatchSeconds) / 60);
            yearVideoList.sort((a, b) => { const dA = parseDateString(a.Date), dB = parseDateString(b.Date); if (!dA && !dB) return 0; if (!dA) return 1; if (!dB) return -1; return dA - dB; });
            for (const video of yearVideoList) { const d = parseDateString(video.Date); if (d) { if (!earliestVideoDate) earliestVideoDate = d; latestVideoDate = d; } }

            let currentSessionStart = null; let currentSessionEnd = null; let currentSessionVideoCount = 0; longestSessionMinutes = 0;
            yearVideoList.forEach((video, index) => {
                const videoDate = parseDateString(video.Date); if (!videoDate) return;
                if (currentSessionStart === null) { watchSessions = 1; currentSessionStart = videoDate; currentSessionEnd = videoDate; currentSessionVideoCount = 1; }
                else {
                    const timeDiffMinutes = (videoDate - currentSessionEnd) / (1000 * 60);
                    if (timeDiffMinutes > 30) { const dur = currentSessionVideoCount * averageWatchSeconds / 60; if (dur > longestSessionMinutes) { longestSessionMinutes = Math.round(dur); longestSessionDateStr = formatToUserTimezone(currentSessionStart, userTimezone, { month: 'short', day: 'numeric' }); } watchSessions++; currentSessionStart = videoDate; currentSessionVideoCount = 1; }
                    else { currentSessionVideoCount++; } currentSessionEnd = videoDate;
                }
                if (index === yearVideoList.length - 1 && currentSessionStart) { const dur = currentSessionVideoCount * averageWatchSeconds / 60; if (dur > longestSessionMinutes) { longestSessionMinutes = Math.round(dur); longestSessionDateStr = formatToUserTimezone(currentSessionStart, userTimezone, { month: 'short', day: 'numeric' }); } }
            });
            averageSessionLength = watchSessions > 0 ? Math.round(totalWatchTimeMinutes / watchSessions) : 0;
            const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']; const wc = Array(7).fill(0); yearVideoList.forEach(v => { const d = parseDateString(v.Date); if (d) wc[d.getUTCDay()]++; }); const mc = Math.max(...wc); if (mc > 0) mostActiveWeekday = weekdays[wc.indexOf(mc)];
        }
    } else { console.warn("Watch History не найден или пуст."); }

    tableData['Всего просмотрено видео'] = videoCount.toLocaleString('ru-RU');
    tableData['Общее время (оценка)'] = `${totalWatchTimeMinutes.toLocaleString('ru-RU')} мин ≈ ${Math.round(totalWatchTimeMinutes / 60).toLocaleString('ru-RU')} ч`;
    tableData['Сессий просмотра'] = watchSessions.toLocaleString('ru-RU');
    tableData['Средняя сессия (оценка)'] = `${averageSessionLength.toLocaleString('ru-RU')} мин`;
    tableData['Самая длинная сессия (оценка)'] = longestSessionMinutes > 0 ? `${longestSessionDateStr} (~${longestSessionMinutes.toLocaleString('ru-RU')} мин)` : 'N/A';
    tableData['Самый активный день'] = mostActiveWeekday;
    tableData['Первое видео года'] = earliestVideoDate ? formatToUserTimezone(earliestVideoDate, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    tableData['Последнее видео года'] = latestVideoDate ? formatToUserTimezone(latestVideoDate, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    const slideInfo = { videoCount, totalWatchTimeHours: Math.round(totalWatchTimeMinutes / 60), watchSessions, averageSessionLength, mostActiveWeekday }; // Added sessions/avg length
    return { tableData, slideInfo };
}

function processCommentsData(commentsSection, selectedYear) {
    const commentsList = commentsSection?.Comments?.CommentsList;
    const tableData = {};
    let commentCount = 0, totalCommentLength = 0, averageCommentLength = 0;
    let mostUsedEmoji = '', maxEmojiCount = 0;
    let earliestCommentDate = null, latestCommentDate = null;
    const emojiCounts = {};

    if (Array.isArray(commentsList) && commentsList.length > 0) {
        const yearComments = commentsList.filter(comment => { if (!comment || !comment.date) return false; const d = parseDateString(comment.date); return d && d.getUTCFullYear() === selectedYear; });
        commentCount = yearComments.length;
        if (commentCount > 0) {
            yearComments.forEach(comment => {
                if (!comment.comment || typeof comment.comment !== 'string') return;
                totalCommentLength += comment.comment.length;
                const commentDate = parseDateString(comment.date); if (commentDate) { if (!earliestCommentDate || commentDate < earliestCommentDate) earliestCommentDate = commentDate; if (!latestCommentDate || commentDate > latestCommentDate) latestCommentDate = commentDate; }
                const emojiRegex = /([\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]\u{FE0F}?(\u{200D}[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]\u{FE0F}?)*)/gu;
                const matches = comment.comment.match(emojiRegex);
                if (matches) { matches.forEach(emoji => { const baseEmoji = emoji.replace(/\u{FE0F}/g, ''); emojiCounts[baseEmoji] = (emojiCounts[baseEmoji] || 0) + 1; }); }
            });
            averageCommentLength = commentCount > 0 ? Math.round(totalCommentLength / commentCount) : 0;
            mostUsedEmoji = ''; maxEmojiCount = 0; for (const emoji in emojiCounts) { if (emojiCounts.hasOwnProperty(emoji) && emojiCounts[emoji] > maxEmojiCount) { mostUsedEmoji = emoji; maxEmojiCount = emojiCounts[emoji]; } }
        }
    } else { console.warn("[processCommentsData] Comment List не найден или пуст."); }

    tableData['Всего комментариев'] = commentCount.toLocaleString('ru-RU');
    if (commentCount > 0) tableData['Средняя длина комментария'] = `${averageCommentLength.toLocaleString('ru-RU')} симв.`;
    tableData['Самый частый эмодзи'] = maxEmojiCount > 0 ? `${mostUsedEmoji} (x${maxEmojiCount.toLocaleString('ru-RU')})` : '(нет эмодзи)';
    tableData['Первый коммент. года'] = earliestCommentDate ? formatToUserTimezone(earliestCommentDate, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    tableData['Последний коммент. года'] = latestCommentDate ? formatToUserTimezone(latestCommentDate, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    const slideInfo = { commentCount, mostUsedEmoji: maxEmojiCount > 0 ? mostUsedEmoji : null };
    return { tableData, slideInfo };
}

function processLikesData(likesSection, selectedYear) {
    const likesList = likesSection?.ItemFavoriteList;
    const tableData = {};
    let likeCount = 0, mostLikedDayCount = 0, mostLikedDayStr = 'N/A';
    let firstLikeDate = null, firstLikeLink = null;
    if (Array.isArray(likesList) && likesList.length > 0) {
        const yearLikes = likesList.filter(like => { if (!like || !like.date) return false; const d = parseDateString(like.date); return d && d.getUTCFullYear() === selectedYear; });
        likeCount = yearLikes.length;
        if (likeCount > 0) {
            const dayCounts = {}; yearLikes.sort((a, b) => { const dA = parseDateString(a.date), dB = parseDateString(b.date); if (!dA && !dB) return 0; if (!dA) return 1; if (!dB) return -1; return dA - dB; });
            for (const like of yearLikes) { const d = parseDateString(like.date); if (d) { if (!firstLikeDate) { firstLikeDate = d; firstLikeLink = (like.link && like.link.startsWith('http')) ? like.link : null; } const ds = d.toISOString().split('T')[0]; dayCounts[ds] = (dayCounts[ds] || 0) + 1; } }
            for (const day in dayCounts) { if (dayCounts[day] > mostLikedDayCount) { mostLikedDayCount = dayCounts[day]; const [y, m, d] = day.split('-'); mostLikedDayStr = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ru-RU', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); } }
        }
    } else { console.warn("Like List не найден или пуст."); }
    tableData['Всего лайков поставлено'] = likeCount.toLocaleString('ru-RU');
    tableData['День с макс. лайками'] = mostLikedDayCount > 0 ? `${mostLikedDayStr} (${mostLikedDayCount.toLocaleString('ru-RU')} лайков)` : 'N/A';
    tableData['Первый лайк года'] = firstLikeDate ? `${formatToUserTimezone(firstLikeDate, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' })} ${firstLikeLink ? `<a href="${firstLikeLink}" target="_blank" rel="noopener noreferrer" title="Открыть видео">🔗</a>` : ''}` : 'N/A';
    return { tableData, slideInfo: { likeCount } };
}

function processSharesData(shareHistoryList, selectedYear) {
    const tableData = {};
    let shareCount = 0, mostSharedDayCount = 0, mostSharedDayStr = 'N/A';
    let firstShareDate = null, firstShareLink = null;
    if (Array.isArray(shareHistoryList) && shareHistoryList.length > 0) {
        const yearShares = shareHistoryList.filter(share => { if (!share || !share.Date) return false; const d = parseDateString(share.Date); return d && d.getUTCFullYear() === selectedYear; });
        shareCount = yearShares.length;
        if (shareCount > 0) {
            const dayCounts = {}; yearShares.sort((a, b) => { const dA = parseDateString(a.Date), dB = parseDateString(b.Date); if (!dA && !dB) return 0; if (!dA) return 1; if (!dB) return -1; return dA - dB; });
            for (const share of yearShares) { const d = parseDateString(share.Date); if (d) { if (!firstShareDate) { firstShareDate = d; firstShareLink = (share.Link && share.Link.startsWith('http')) ? share.Link : null; } const ds = d.toISOString().split('T')[0]; dayCounts[ds] = (dayCounts[ds] || 0) + 1; } }
            for (const day in dayCounts) { if (dayCounts[day] > mostSharedDayCount) { mostSharedDayCount = dayCounts[day]; const [y, m, d] = day.split('-'); mostSharedDayStr = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ru-RU', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); } }
        }
    } else { console.warn("Share History List не найден или пуст."); }
    tableData['Всего репостов сделано'] = shareCount.toLocaleString('ru-RU');
    tableData['День с макс. репостами'] = mostSharedDayCount > 0 ? `${mostSharedDayStr} (${mostSharedDayCount.toLocaleString('ru-RU')} репостов)` : 'N/A';
    tableData['Первый репост года'] = firstShareDate ? `${formatToUserTimezone(firstShareDate, userTimezone, { year: 'numeric', month: 'long', day: 'numeric' })} ${firstShareLink ? `<a href="${firstShareLink}" target="_blank" rel="noopener noreferrer" title="Открыть видео">🔗</a>` : ''}` : 'N/A';
    return { tableData, slideInfo: { shareCount } };
}

function processLiveData(liveSection, selectedYear) {
    const watchLiveHistory = liveSection?.["Watch Live History"]?.WatchLiveMap;
    const tableData = {}; let liveCount = 0;
    if (watchLiveHistory && typeof watchLiveHistory === 'object') { liveCount = Object.values(watchLiveHistory).filter(l => { const d = parseDateString(l.WatchTime); return d && d.getUTCFullYear() === selectedYear; }).length; }
    tableData['Просмотрено трансляций (Live)'] = liveCount.toLocaleString('ru-RU');
    return { tableData, slideInfo: { liveCount } };
}


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
    if (!element || isNaN(targetValue)) { if (element) element.textContent = targetValue?.toLocaleString('ru-RU') || 'N/A'; return; };
    element.classList.add('counting'); let startValue = 0; const startTime = performance.now();
    function updateCounter(currentTime) { const elT = currentTime - startTime, prog = Math.min(1, elT / duration), eP = 1 - Math.pow(1 - prog, 3), cV = Math.floor(eP * (targetValue - startValue) + startValue); element.textContent = cV.toLocaleString('ru-RU'); if (prog < 1) requestAnimationFrame(updateCounter); else { element.textContent = targetValue.toLocaleString('ru-RU'); element.classList.remove('counting'); } } requestAnimationFrame(updateCounter);
}
function createFullscreenSlideElement(slideData) {
    const slide = createElement('div', { class: 'fs-slide' }); if (slideData.title) slide.appendChild(createElement('div', { class: 'fs-title' }, slideData.title)); if (slideData.value !== undefined && slideData.value !== null) { const iD = typeof slideData.value === 'number' ? '0' : slideData.value; const vE = createElement('div', { class: 'fs-value', 'data-target': slideData.value }, iD); slide.appendChild(vE); } if (slideData.label) slide.appendChild(createElement('div', { class: 'fs-label' }, slideData.label)); if (slideData.details) slide.appendChild(createElement('div', { class: 'fs-details' }, slideData.details)); return slide;
}
function showNextFullscreenSlide() {
    if (!fsSlidesContainer || !fsProgressBar) return; clearTimeout(slideshowTimeoutId);
    const slides = fsSlidesContainer.querySelectorAll('.fs-slide'); if (slides.length === 0) return;
    const currentActive = fsSlidesContainer.querySelector('.fs-slide.active'); if (currentActive) { currentActive.classList.remove('active'); currentActive.classList.add('exiting'); setTimeout(() => { currentActive?.classList.remove('exiting'); }, 600); }
    currentFsSlideIndex++; if (currentFsSlideIndex >= slides.length) { endFullscreenSlideshow(); return; }
    const nextSlide = slides[currentFsSlideIndex]; if (!nextSlide) { endFullscreenSlideshow(); return; } nextSlide.classList.add('active');
    const valueElement = nextSlide.querySelector('.fs-value'); if (valueElement && valueElement.hasAttribute('data-target')) { const tV = valueElement.getAttribute('data-target'); const tN = parseInt(tV, 10); if (!isNaN(tN) && typeof fsSlidesData[currentFsSlideIndex]?.value === 'number') { valueElement.textContent = '0'; setTimeout(() => animateCounter(valueElement, tN, 1500), 300); } else { valueElement.textContent = tV; } }
    fsProgressBar.style.transition = 'none'; fsProgressBar.style.width = '0%'; void fsProgressBar.offsetWidth; fsProgressBar.style.transition = `width ${SLIDESHOW_INTERVAL / 1000}s linear`; fsProgressBar.style.width = '100%';
    slideshowTimeoutId = setTimeout(showNextFullscreenSlide, SLIDESHOW_INTERVAL);
}
function showPrevFullscreenSlide() {
    if (!fsSlidesContainer || !fsProgressBar || currentFsSlideIndex <= 0) return; clearTimeout(slideshowTimeoutId);
    const slides = fsSlidesContainer.querySelectorAll('.fs-slide'); if (slides.length === 0) return;
    const currentActive = fsSlidesContainer.querySelector('.fs-slide.active'); if (currentActive) { currentActive.classList.remove('active'); currentActive.classList.add('exiting'); setTimeout(() => { currentActive?.classList.remove('exiting'); }, 600); }
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
function getCommentary(value, type) { if (value === undefined || value === null || value <= 0) return "В этом году здесь было тихо..."; switch (type) { case 'views': if (value < 500) return "Кажется, ты заходил в TikTok не так часто."; if (value < 2000) return "Неплохое начало! Ты определенно в теме."; if (value < 10000) return "Ты провел немало времени, листая ленту!"; return "Ого! Похоже, TikTok был твоим верным спутником!"; case 'likes': if (value < 100) return "Ты ставишь лайки только избранным."; if (value < 1000) return "Ты оценил немало хороших видео!"; if (value < 5000) return "Твои двойные тапы не знали покоя!"; return "Лайк-машина! Ты отметил уйму контента!"; case 'comments': if (value < 20) return "Ты больше наблюдатель."; if (value < 100) return "Тебе было что сказать!"; if (value < 500) return "Ты активно участвовал в обсуждениях!"; return "Настоящий комментатор!"; case 'shares': if (value < 10) return "Самое лучшее - для себя."; if (value < 50) return "Ты поделился находками."; if (value < 200) return "Ты знаешь толк в трендах!"; return "Мастер репостов!"; case 'live': if (value < 5) return "Прямые эфиры – не твое."; if (value < 25) return "Иногда заглядывал на трансляции."; if (value < 100) return "Любишь смотреть в реальном времени!"; return "Поклонник Live!"; default: return "Интересные цифры!"; } }
function prepareFullscreenSlidesData(stats, year) {
    const slides = [];
    slides.push({ title: `Твоя статистика ${year}`, value: stats.profile?.slideInfo?.userName || '👋', label: `Готов увидеть итоги?`, details: "Собрали самые интересные моменты." });
    if (stats.watchHistory?.slideInfo?.videoCount > 0) { const v = stats.watchHistory.slideInfo.videoCount; const d = getCommentary(v, 'views') + `<br><small>(Примерно ${stats.watchHistory.slideInfo.totalWatchTimeHours.toLocaleString('ru-RU')} ч. в TikTok)</small>`; slides.push({ title: "Просмотры", value: v, label: "видео просмотрено", details: d }); }
    if (stats.watchHistory?.slideInfo?.mostActiveWeekday !== 'N/A') slides.push({ title: "Любимый день", value: stats.watchHistory.slideInfo.mostActiveWeekday, label: "твой самый активный день в TikTok" });
    if (stats.likes?.slideInfo?.likeCount > 0) { const v = stats.likes.slideInfo.likeCount; slides.push({ title: "Лайки", value: v, label: "лайков поставлено", details: getCommentary(v, 'likes') }); }
    if (stats.comments?.slideInfo?.commentCount > 0) { const v = stats.comments.slideInfo.commentCount; let d = getCommentary(v, 'comments'); if (stats.comments.slideInfo.mostUsedEmoji) d += ` Твой фаворит: <span style='font-size:1.5em;vertical-align:middle;'>${stats.comments.slideInfo.mostUsedEmoji}</span>`; slides.push({ title: "Комментарии", value: v, label: "комментариев оставлено", details: d }); }
    if (stats.shares?.slideInfo?.shareCount > 0) { const v = stats.shares.slideInfo.shareCount; slides.push({ title: "Репосты", value: v, label: "раз ты поделился видео", details: getCommentary(v, 'shares') }); }
    if (stats.live?.slideInfo?.liveCount > 0) { const v = stats.live.slideInfo.liveCount; slides.push({ title: "Прямые эфиры", value: v, label: "Live-трансляций просмотрено", details: getCommentary(v, 'live') }); }
    slides.push({ title: "Вот и всё!", value: '✨', label: `Твоя статистика за ${year} год`, details: "Ниже детальный отчет." });
    return slides;
}

// --- Demo Data Setup ---
const demoTikTokData = { "Profile": { "Profile Info": { ProfileMap: { userName: "Демо Пользователь", bioDescription: "Это демо-статистика!" } } }, Comment: { Comments: { CommentsList: [{ date: `${new Date().getFullYear()}-01-15 10:00:00`, comment: "Первый демо коммент 🎉" }, { date: `${new Date().getFullYear()}-03-20 12:30:00`, comment: "Еще один! 👍" }, { date: `${new Date().getFullYear()}-05-10 18:00:00`, comment: "Тестируем 🚀" }, { date: `${new Date().getFullYear() - 1}-11-10 18:00:00`, comment: "Прошлый год" }] } }, "Your Activity": { "Watch History": { VideoList: Array.from({ length: 1567 }).map((_, i) => ({ Date: generateRandomDateInYear(new Date().getFullYear()) })) }, "Like List": { ItemFavoriteList: Array.from({ length: 842 }).map((_, i) => ({ Date: generateRandomDateInYear(new Date().getFullYear()), link: `https://example.com/${i}` })) }, "Share History": { ShareHistoryList: Array.from({ length: 95 }).map((_, i) => ({ Date: generateRandomDateInYear(new Date().getFullYear()), Link: `https://example.com/${i}` })) } }, "Tiktok Live": { "Watch Live History": { WatchLiveMap: { "live1": { WatchTime: generateRandomDateInYear(new Date().getFullYear()) }, "live2": { WatchTime: generateRandomDateInYear(new Date().getFullYear()) }, "live3": { WatchTime: generateRandomDateInYear(new Date().getFullYear()) }, "live4": { WatchTime: `${new Date().getFullYear() - 1}-12-01 10:00:00` }, "live5": { WatchTime: generateRandomDateInYear(new Date().getFullYear()) } } } } };
function generateRandomDateInYear(year) { const s = new Date(Date.UTC(year, 0, 1)), e = new Date(Date.UTC(year, 11, 31)); const d = new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime())); return d.toISOString().replace('T', ' ').substring(0, 19); }

function getPersona(stats) {
    if (!stats) return "Загадка"; // Если нет данных

    const views = stats.watchHistory?.slideInfo?.videoCount || 0;
    const likes = stats.likes?.slideInfo?.likeCount || 0;
    const comments = stats.comments?.slideInfo?.commentCount || 0;
    const shares = stats.shares?.slideInfo?.shareCount || 0;
    const avgSession = stats.watchHistory?.slideInfo?.averageSessionLength || 0;

    // Простая логика - можно усложнять
    if (views < 500 && likes < 100 && comments < 10) return "Скромный гость";
    if (comments > 100 && comments > likes / 10) return "Активный комментатор";
    if (likes > 5000 && likes > views / 2) return "Лайк-машина";
    if (shares > 100 && shares > likes / 20) return "Амбассадор контента";
    if (avgSession > 45) return "Марафонец ленты";
    if (views > 10000) return "Заядлый зритель"; // как в примере 'Avid Binge-Watcher'
    if (views > 2000) return "Постоянный зритель";

    return "Уникальный пользователь"; // Общий вариант
}

// --- Image Generation & Sharing ---
async function generateAndShareImage() {
    if (!shareCard || !currentAnalysisResult || typeof html2canvas === 'undefined') { alert("Невозможно поделиться: данные или библиотека не готовы."); updateStatus("Ошибка подготовки", 'error'); return; }
    console.log("Подготовка карточки..."); updateStatus("Готовим картинку...", 'loading');
    const selectedYear = yearSelect.value; const stats = currentAnalysisResult;
    try {
        if (shareUsernameEl) shareUsernameEl.textContent = stats.profile?.slideInfo?.userName || 'Пользователь';
        if (shareYearEl) shareYearEl.textContent = selectedYear;
        const persona = getPersona(stats);
        if (sharePersonaEl) sharePersonaEl.textContent = persona;
        const videosEl = shareCard.querySelector('.share-videos-watched'); const timeEl = shareCard.querySelector('.share-watch-time'); const sessionsEl = shareCard.querySelector('.share-sessions'); const avgSessionEl = shareCard.querySelector('.share-avg-session'); const commentsEl = shareCard.querySelector('.share-comments'); const likesEl = shareCard.querySelector('.share-likes'); const emojiEl = shareCard.querySelector('.share-emoji');
        const videoCount = stats.watchHistory?.slideInfo?.videoCount || 0; if (videosEl) videosEl.textContent = videoCount.toLocaleString('ru-RU');
        const totalHours = stats.watchHistory?.slideInfo?.totalWatchTimeHours || 0; const totalDays = Math.round(totalHours / 24); if (timeEl) timeEl.textContent = totalDays > 0 ? `≈ ${totalDays.toLocaleString('ru-RU')} дн.` : `< 1 дн.`;
        const sessionsCount = stats.watchHistory?.slideInfo?.watchSessions || 0; if (sessionsEl) sessionsEl.textContent = sessionsCount.toLocaleString('ru-RU');
        const avgSessionMinutes = stats.watchHistory?.slideInfo?.averageSessionLength || 0; if (avgSessionEl) avgSessionEl.textContent = `${avgSessionMinutes.toLocaleString('ru-RU')} мин`;
        const commentsCount = stats.comments?.slideInfo?.commentCount || 0; if (commentsEl) commentsEl.textContent = commentsCount.toLocaleString('ru-RU');
        const likesCount = stats.likes?.slideInfo?.likeCount || 0; if (likesEl) likesEl.textContent = likesCount.toLocaleString('ru-RU');
        if (emojiEl) emojiEl.textContent = stats.comments?.slideInfo?.mostUsedEmoji || '-';
    } catch (error) { console.error("Ошибка обновления карточки:", error); handleError("Ошибка подготовки данных."); return; }
    await new Promise(resolve => setTimeout(resolve, 150)); // Delay for DOM
    console.log("Генерация изображения 1080x1920...");
    try {
        const canvas = await html2canvas(shareCard, {
            useCORS: true,
            scale: 1, // Используем масштаб 1, т.к. задаем точные размеры
            backgroundColor: '#1a1a1a',
            width: 1080, // Целевая ширина
            height: 1920, // Целевая высота
            windowWidth: 1080, // Для рендеринга стилей
            windowHeight: 1920
        });
        console.log("Canvas готов."); const filename = `tiktok-stats-${selectedYear}.png`;
        canvas.toBlob(async (blob) => {
            if (!blob) { updateStatus("Ошибка создания Blob", 'error'); console.error("Canvas toBlob null"); try { const dU = canvas.toDataURL('image/png'); downloadImageLink(dU, filename); } catch (e) { console.error("Fallback dl error", e); handleError("Не удалось скачать."); } return; }
            const file = new File([blob], filename, { type: 'image/png' }); const shareText = `Смотри мои итоги года в TikTok! Сгенерировано здесь: https://viktormalyuchenko.github.io/tiktok-stats-analyzer/`; const shareData = { title: `Моя статистика TikTok ${selectedYear}`, text: shareText, files: [file] };
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                console.log("Попытка Web Share...");
                try { await navigator.share(shareData); console.log('Успешно'); updateStatus("Открыто окно шаринга...", 'success'); setTimeout(() => updateStatus('', 'loading'), 3000); }
                catch (error) { if (error.name !== 'AbortError') { console.error('Ошибка Web Share:', error); updateStatus("Ошибка шаринга, скачайте", 'error'); const dU = canvas.toDataURL('image/png'); downloadImageLink(dU, filename); } else { console.log("Шаринг отменен."); updateStatus('', 'loading'); } }
            } else { console.log('Web Share (files) не поддерживается, скачиваем.'); updateStatus("Web Share не поддерживается. Скачиваем картинку...", 'success'); setTimeout(() => { const dataUrl = canvas.toDataURL('image/png'); downloadImageLink(dataUrl, filename); }, 500); }
        }, 'image/png');
    } catch (error) { console.error("Ошибка html2canvas:", error); handleError("Не удалось сгенерировать изображение."); }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    startButton?.addEventListener('click', () => showModal(howToModal));
    demoButton?.addEventListener('click', () => { console.log("Запуск демо..."); updateStatus('Загрузка демо...', 'loading'); if (yearSelect) yearSelect.value = new Date().getFullYear(); setTimeout(() => { processJsonText(JSON.stringify(demoTikTokData)); }, 300); });
    haveFileButton?.addEventListener('click', () => { hideModal(howToModal); showModal(selectFileModal); });
    window.addEventListener('click', (e) => { if (e.target === howToModal) hideModal(howToModal); if (e.target === selectFileModal) hideModal(selectFileModal); });
    // uploadArea?.addEventListener('click', () => zipFileInput?.click());
    zipFileInput?.addEventListener('change', handleFileSelect);
    uploadArea?.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); uploadArea.classList.add('dragover'); if (uploadText) uploadText.textContent = 'Отпустите файл'; });
    uploadArea?.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); uploadArea.classList.remove('dragover'); resetUploadText(); });
    uploadArea?.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); uploadArea.classList.remove('dragover'); resetUploadText(); if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]); });
    showSlideshowButton?.addEventListener('click', () => { if (readyScreen) readyScreen.classList.remove('visible'); setTimeout(() => { if (readyScreen) readyScreen.style.display = 'none'; startFullscreenSlideshow(); }, 500); });
    closeSlideshowButton?.addEventListener('click', endFullscreenSlideshow);
    fsSlideshowArea?.addEventListener('click', (event) => { if (closeSlideshowButton && closeSlideshowButton.contains(event.target)) return; const cX = event.clientX, sW = window.innerWidth; if (cX < sW / 3) showPrevFullscreenSlide(); else if (cX > sW * 2 / 3) showNextFullscreenSlide(); });
    fsSlideshowArea?.addEventListener('keydown', (event) => { if (event.key === 'ArrowRight' || event.key === ' ') showNextFullscreenSlide(); else if (event.key === 'ArrowLeft') showPrevFullscreenSlide(); else if (event.key === 'Escape') endFullscreenSlideshow(); });
    resetButton?.addEventListener('click', resetToInitialState);
    shareImageButton?.addEventListener('click', generateAndShareImage);
    accordionItems.forEach(item => { const h = item.querySelector('.accordion-header'), c = item.querySelector('.accordion-content'); h?.addEventListener('click', () => { const iA = item.classList.contains('active'); accordionItems.forEach(o => { if (o !== item) { o.classList.remove('active'); o.querySelector('.accordion-header')?.setAttribute('aria-expanded', 'false'); const oc = o.querySelector('.accordion-content'); if (oc) oc.style.maxHeight = null; } }); item.classList.toggle('active', !iA); h.setAttribute('aria-expanded', !iA); if (c) c.style.maxHeight = !iA ? c.scrollHeight + 40 + "px" : null; }); });
}

// --- Theme Switcher Logic ---
const themeToggleButton = document.getElementById('themeToggleButton');
const themeIconMoon = document.getElementById('themeIconMoon');
const themeIconSun = document.getElementById('themeIconSun');
const bodyElement = document.body;
const currentThemeLSKey = 'themePreference'; // Ключ для localStorage

/**
 * Применяет выбранную тему (light/dark)
 * @param {string} theme - 'light' или 'dark'
 */
const applyTheme = (theme) => {
    if (theme === 'dark') {
        bodyElement.classList.add('dark-mode');
        themeToggleButton?.setAttribute('aria-label', 'Переключить на светлую тему');
    } else {
        bodyElement.classList.remove('dark-mode');
        themeToggleButton?.setAttribute('aria-label', 'Переключить на темную тему');
    }
    // Сохраняем выбор в localStorage
    try {
        localStorage.setItem(currentThemeLSKey, theme);
    } catch (e) {
        console.warn("Не удалось сохранить тему в localStorage:", e);
    }
};

/**
 * Определяет и возвращает начальную тему
 * @returns {string} 'light' или 'dark'
 */
const determineInitialTheme = () => {
    let initialTheme = 'light'; // По умолчанию светлая
    try {
        const savedTheme = localStorage.getItem(currentThemeLSKey);
        if (savedTheme) {
            initialTheme = savedTheme;
        } else {
            // Если в localStorage нет, проверяем системные настройки
            // if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            //     initialTheme = 'dark';
            // }
        }
    } catch (e) {
        console.warn("Не удалось получить тему из localStorage или media query:", e);
        // В случае ошибки оставляем 'light'
    }
    console.log(`Начальная тема: ${initialTheme}`);
    return initialTheme;
};

// --- Theme Switcher Initialization ---
function setupThemeSwitcher() {
    if (!themeToggleButton || !themeIconMoon || !themeIconSun) {
        console.error("Элементы переключателя тем не найдены!");
        return;
    }

    // Применяем начальную тему при загрузке страницы
    const initialTheme = determineInitialTheme();
    applyTheme(initialTheme);

    // Добавляем обработчик клика на кнопку
    themeToggleButton.addEventListener('click', () => {
        const isDarkMode = bodyElement.classList.contains('dark-mode');
        const newTheme = isDarkMode ? 'light' : 'dark';
        applyTheme(newTheme);
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (!mainContent || !fullscreenSlideshow || !mainResults || !shareCard || !readyScreen) { console.error("Критические элементы разметки не найдены!"); document.body.innerHTML = '<p style="color: red; text-align: center; padding: 50px;">Ошибка: Не удалось загрузить интерфейс страницы.</p>'; return; }
    getUserTimezone();
    populateYearSelect();
    setupEventListeners();
    setupThemeSwitcher(); // <--- ДОБАВЬ ЭТУ СТРОКУ
    resetToInitialState();
});