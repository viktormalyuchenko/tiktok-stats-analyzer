// --- Глобальные переменные ---
const startButton = document.getElementById("startButton");
const demoButton = document.getElementById("demoButton");
const haveFileButton = document.getElementById("haveFileButton");
const uploadModal = document.getElementById("uploadModal");
const uploadArea = document.getElementById("uploadArea");
const zipFileInput = document.getElementById("zipFileInput");
const uploadText = document.getElementById("uploadText");
const uploadStatus = document.getElementById("uploadStatus");

const mainContent = document.getElementById("mainContent");
const fullscreenSlideshow = document.getElementById("fullscreenSlideshow");
const fsSlidesContainer = fullscreenSlideshow?.querySelector(
  ".fs-slides-container"
);
const fsSlideshowArea = document.getElementById("fsSlideshowArea");
const closeSlideshowButton = document.getElementById("closeSlideshowButton");
const fsProgressBar = fullscreenSlideshow?.querySelector(".fs-progress-bar");

const mainResults = document.getElementById("mainResults");
const statsTableBody = document
  .getElementById("statsTable")
  ?.getElementsByTagName("tbody")[0];
const tableYearSpan = document.getElementById("tableYear");
const resetButton = document.getElementById("resetButton");
const shareImageButton = document.getElementById("shareImageButton");
const shareCard = document.getElementById("shareCard");

const storyTrigger = document.getElementById("storyTrigger");

// Переменные состояния
let currentAnalysisResult = null;
let userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
let fsSlidesData = [];
let currentFsSlideIndex = 0;
let slideshowTimeoutId = null;

// --- Утилиты UI ---
function updateStatus(message, type = "loading") {
  if (uploadStatus) {
    uploadStatus.textContent = message;
    uploadStatus.className = ""; // сброс классов
    uploadStatus.classList.add(`status-${type}`);
    uploadStatus.style.display = message ? "block" : "none";
  }
}

function showModal(el) {
  if (el) el.style.display = "block";
}
function hideModal(el) {
  if (el) el.style.display = "none";
}

function resetToInitialState() {
  currentAnalysisResult = null;
  fsSlidesData = [];
  if (fullscreenSlideshow) {
    fullscreenSlideshow.classList.remove("visible");
    fullscreenSlideshow.style.display = "none";
  }
  if (mainResults) {
    mainResults.classList.remove("visible");
    mainResults.style.display = "none";
  }
  if (mainContent) mainContent.style.display = "block";

  if (zipFileInput) zipFileInput.value = "";
  if (uploadText)
    uploadText.innerHTML =
      "Нажмите или перетащите сюда файл<br>(.zip или .json)";
  if (statsTableBody) statsTableBody.innerHTML = "";
  updateStatus("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- Обработка файлов ---
function handleFile(file) {
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();

  if (uploadText) uploadText.textContent = `Выбран файл: ${file.name}`;
  updateStatus("Обработка файла...", "loading");

  if (ext === "zip") handleZipFile(file);
  else if (ext === "json") {
    const reader = new FileReader();
    reader.onload = (e) => processJsonText(e.target.result);
    reader.onerror = () => updateStatus("Ошибка чтения файла", "error");
    reader.readAsText(file);
  } else {
    updateStatus("Нужен файл .zip или .json", "error");
  }
}

function handleZipFile(file) {
  if (typeof JSZip === "undefined") {
    import("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js")
      .then(() => processZipContent(file))
      .catch(() => updateStatus("Ошибка загрузки распаковщика", "error"));
  } else {
    processZipContent(file);
  }
}

function processZipContent(file) {
  JSZip.loadAsync(file)
    .then((zip) => {
      // Ищем файл, похожий на user_data.json
      const jsonFileKey = Object.keys(zip.files).find((n) =>
        n.match(/user[_ ]?data.*\.json$/i)
      );
      if (!jsonFileKey) throw new Error("JSON не найден в архиве");
      return zip.file(jsonFileKey).async("text");
    })
    .then(processJsonText)
    .catch((e) => {
      console.error(e);
      updateStatus("Ошибка ZIP: " + e.message, "error");
    });
}

// --- Обработка JSON и Анализ (СВЯЗЬ С ANALYZER.JS) ---
function processJsonText(jsonText) {
  try {
    updateStatus("Анализ данных...", "loading");
    const rawData = JSON.parse(jsonText);
    const selectedYear = new Date().getFullYear();

    // ВЫЗОВ ANALYZER.JS
    if (typeof TikTokAnalyzer === "undefined")
      throw new Error("Analyzer script not loaded");

    currentAnalysisResult = TikTokAnalyzer.runAnalysis(
      rawData,
      selectedYear,
      userTimezone
    );

    // Успех
    reachMetrikaGoal("analysis_success");
    hideModal(uploadModal);
    mainContent.style.display = "none";

    // Подготовка слайдов (тоже можно вынести, но пока оставим тут для генерации HTML)
    prepareSlidesAndTable(currentAnalysisResult, selectedYear);

    mainResults.style.display = "block"; // Показываем сразу #mainResults
    // Небольшая задержка для плавности (чтобы браузер успел отрисовать DOM)
    requestAnimationFrame(() => {
      mainResults.classList.add("visible");
      mainResults.style.opacity = 1;
      mainResults.style.transform = "translateY(0)";
    });

    // 4. Скроллим наверх
    window.scrollTo({ top: 0, behavior: "smooth" });

    updateStatus("");
  } catch (e) {
    console.error(e);
    updateStatus("Ошибка анализа: " + e.message, "error");
    mainContent.style.display = "block";
  }
}

// --- Генерация UI результатов ---
function prepareSlidesAndTable(stats, year) {
  // 0. Таблица (как было)
  statsTableBody.innerHTML = "";
  const addRow = (key, val) => {
    const row = statsTableBody.insertRow();
    const th = document.createElement("th");
    th.textContent = key;
    row.appendChild(th);
    row.insertCell(1).textContent = val;
  };
  const addHeader = (text) => {
    const row = statsTableBody.insertRow();
    row.className = "group-header";
    const cell = row.insertCell(0);
    cell.colSpan = 2;
    cell.textContent = text;
  };
  if (stats.profile) {
    addHeader("👤 Профиль");
    Object.entries(stats.profile.tableData).forEach(([k, v]) => addRow(k, v));
  }
  if (stats.watchHistory) {
    addHeader("📺 Просмотры");
    Object.entries(stats.watchHistory.tableData).forEach(([k, v]) =>
      addRow(k, v)
    );
  }
  if (stats.likes) {
    addHeader("❤️ Лайки");
    Object.entries(stats.likes.tableData).forEach(([k, v]) => addRow(k, v));
  }
  if (stats.comments) {
    addHeader("💬 Комментарии");
    Object.entries(stats.comments.tableData).forEach(([k, v]) => addRow(k, v));
  }
  if (stats.shares) {
    addHeader("🔗 Репосты");
    Object.entries(stats.shares.tableData).forEach(([k, v]) => addRow(k, v));
  }
  if (stats.live) {
    addHeader("🔴 Live");
    Object.entries(stats.live.tableData).forEach(([k, v]) => addRow(k, v));
  }

  // --- BENTO GRID V2 ---

  // Header & Avatar (как было)
  const userName = stats.profile?.slideInfo?.userName || "User";
  document.getElementById("resUsername").textContent = userName.startsWith("@")
    ? userName
    : "@" + userName;
  document.getElementById("resYear").textContent = year;

  // --- НОВАЯ ЛОГИКА ДАТ ---
  const rangeBadge = document.getElementById("resDateRange");
  const dateRange = stats.watchHistory?.slideInfo?.dateRange;
  const isPartial = stats.watchHistory?.slideInfo?.isPartialData;

  if (isPartial && dateRange) {
    rangeBadge.style.display = "inline-block";
    rangeBadge.textContent = `⚠️ Данные: ${dateRange}`;
    rangeBadge.title =
      "TikTok отдает историю просмотров только за последние 180 дней";
  } else {
    rangeBadge.style.display = "none";
  }

  // Avatar Logic (как было)
  const imgEl = document.getElementById("resAvatarImg");
  const initEl = document.getElementById("resAvatarInitials");
  const avatarUrl = stats.profile?.slideInfo?.avatarUrl;
  initEl.textContent = userName.replace("@", "").charAt(0) || "U";
  if (avatarUrl) {
    imgEl.src = avatarUrl;
    imgEl.style.display = "block";
    initEl.style.display = "none";
    imgEl.onerror = () => {
      imgEl.style.display = "none";
      initEl.style.display = "block";
    };
  } else {
    imgEl.style.display = "none";
    initEl.style.display = "block";
  }

  // 1. PERSONA
  const personaData = getPersonaDetails(stats);
  const persona = personaData.title; // Для слайдов

  document.getElementById("valPersona").textContent = personaData.title;
  document.getElementById("valPersonaDesc").textContent = personaData.desc;
  document.getElementById("personaIcon").textContent = personaData.icon;

  // Новые поля
  document.getElementById("personaStatLabel").textContent =
    personaData.statLabel;
  document.getElementById("personaStatValue").textContent =
    personaData.statValue;

  // 2. HERO (Время + Сессии)
  const hours = stats.watchHistory?.slideInfo?.totalWatchTimeHours || 0;
  let timeLabelDetails = "Много это или мало — решать тебе.";
  if (isPartial) {
    timeLabelDetails = `(Учтены только данные за ${dateRange})`;
  }
  const days = (hours / 24).toFixed(1);
  const dailyAvg = stats.watchHistory?.slideInfo?.dailyAverage || 0;
  const sessions = stats.watchHistory?.slideInfo?.watchSessions || 0;

  // Основная цифра
  document.getElementById("valTotalHours").textContent = hours.toLocaleString();

  // Футер
  document.getElementById("valSessions").textContent = nFmt(sessions);
  document.getElementById("valDailyAvg").textContent = dailyAvg;

  // 3. PEAK MONTH (Пиковый месяц) - НОВОЕ
  const monthlyData = stats.watchHistory?.slideInfo?.monthlyActivity || [];
  const monthsNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];
  let maxMonthIdx = 0;
  if (monthlyData.length > 0) {
    maxMonthIdx = monthlyData.indexOf(Math.max(...monthlyData));
    document.getElementById("valPeakMonth").textContent =
      monthsNames[maxMonthIdx];

    // Рисуем мини-график
    const monthContainer = document.getElementById("monthsChart");
    monthContainer.innerHTML = "";
    const maxVal = Math.max(...monthlyData) || 1;
    monthlyData.forEach((val, idx) => {
      const bar = document.createElement("div");
      bar.className = "month-bar" + (idx === maxMonthIdx ? " active" : "");
      bar.style.height = Math.max(10, (val / maxVal) * 100) + "%";
      bar.title = `${monthsNames[idx]}: ${val}`;
      monthContainer.appendChild(bar);
    });
  } else {
    document.getElementById("valPeakMonth").textContent = "Нет данных";
  }

  // 4. GENEROSITY (Лайк Рейт) - НОВОЕ
  const likes = stats.likes?.slideInfo?.matchedLikeCount || 0;
  const views = stats.watchHistory?.slideInfo?.videoCount || 0;
  const likeRatio =
    views > 0 ? Math.min(100, Math.round((likes / views) * 100)) : 0;
  document.getElementById("valLikeRatio").textContent = likeRatio;
  // Анимация круга SVG
  setTimeout(() => {
    const circle = document.getElementById("ratioCirclePath");
    if (circle) circle.setAttribute("stroke-dasharray", `${likeRatio}, 100`);
  }, 100);

  // 5. NIGHT OWL (Ночь) - НОВОЕ
  const nightPct = stats.watchHistory?.slideInfo?.nightPercentage || 0;
  document.getElementById("valNightPercent").textContent = nightPct;

  // 4. GENERAL STATS (Сводка - 4 цифры)
  document.getElementById("valVideos").textContent = nFmt(
    stats.watchHistory?.slideInfo?.videoCount
  );
  document.getElementById("valLikes").textContent = nFmt(
    stats.likes?.slideInfo?.likeCount
  );
  document.getElementById("valComments").textContent = nFmt(
    stats.comments?.slideInfo?.commentCount
  );
  document.getElementById("valShares").textContent = nFmt(
    stats.shares?.slideInfo?.shareCount
  );

  // 5. SOCIAL STYLE (Общение - Объединенная)
  // Эмодзи
  const topEmoji = stats.comments?.slideInfo?.mostUsedEmoji;
  document.getElementById("valMainEmoji").textContent = topEmoji || "😶";

  // Длина коммента
  const avgLen = stats.comments?.slideInfo?.avgCommentLen || 0;
  document.getElementById("valAvgCommentLen").textContent = avgLen;

  // 6. COMMENTS (Болтливость) - НОВОЕ
  //   const avgLen = stats.comments?.slideInfo?.avgCommentLen || 0;
  //   document.getElementById("valAvgCommentLen").textContent = avgLen + " симв.";

  // 7. TOP EMOJIS
  //   const emojiContainer = document.getElementById("emojiList");
  //   emojiContainer.innerHTML = "";
  //   const topEmojis = stats.comments?.slideInfo?.topEmojis || [];
  //   if (topEmojis.length > 0) {
  //     topEmojis.forEach((item, index) => {
  //       const div = document.createElement("div");
  //       div.className = "emoji-item";
  //       const medals = ["🥇", "🥈", "🥉"];
  //       div.innerHTML = `<span>${medals[index] || ""} ${
  //         item.char
  //       }</span> <span class="emoji-count">x${item.count}</span>`;
  //       emojiContainer.appendChild(div);
  //     });
  //   } else {
  //     emojiContainer.innerHTML =
  //       '<div class="card-subtext" style="text-align:center">Нет эмодзи</div>';
  //   }

  // 8. CHART
  renderHourlyChart(stats.watchHistory?.slideInfo?.hourlyActivity);
  const weekendRatio = stats.watchHistory?.slideInfo?.weekendRatio || 0;
  document.getElementById(
    "weekendBadge"
  ).textContent = `${weekendRatio}% в выходные`;

  // 9. СЛАЙДЫ (СТОРИС)
  fsSlidesData = [
    { title: `Итоги ${year}`, value: userName, label: "Твой год в цифрах" },
    {
      title: "Потрачено времени",
      value: hours + " ч",
      label: `~${days} дней`,
      details: timeLabelDetails,
    },
    { title: "Вайб года", value: persona, label: "Твой архетип" },
    {
      title: "Пик активности",
      value: monthsNames[maxMonthIdx],
      label: "самый активный месяц",
    },
    {
      title: "Режим совы",
      value: nightPct + "%",
      label: "видео просмотрено ночью",
    },
    {
      title: "Щедрость",
      value: likeRatio + "%",
      label: "видео получают твой лайк",
    },
  ];
}

function getPersonaDetails(stats) {
  const views = stats.watchHistory?.slideInfo?.videoCount || 0;
  const likes = stats.likes?.slideInfo?.likeCount || 0;
  const comments = stats.comments?.slideInfo?.commentCount || 0;
  const shares = stats.shares?.slideInfo?.shareCount || 0;
  const hours = stats.watchHistory?.slideInfo?.totalWatchTimeHours || 0;

  // Метрики
  const likeRatio = views > 0 ? (likes / views) * 100 : 0; // % лайков

  // 1. ДИСТРИБЬЮТОР МЕМОВ (Много репостов)
  // Если репостит чаще, чем обычный человек (например > 50 раз за год)
  if (shares > 100) {
    return {
      title: "Дистрибьютор мемов",
      icon: "📨",
      desc: "Ты — главный поставщик контента в чаты друзей. Без тебя их лента была бы скучной.",
      statLabel: "Отправлено друзьям",
      statValue: `${shares} видео`,
    };
  }

  // 2. ДУШНИЛА / КРИТИК (Много комментов)
  if (comments > 300) {
    return {
      title: "Эксперт в комментах",
      icon: "🤓",
      desc: "Ты не просто смотришь, ты участвуешь. Твое мнение под видео важнее самого видео.",
      statLabel: "Написано мнений",
      statValue: `${comments} шт.`,
    };
  }

  // 3. САППОРТ (Много лайков, высокий Like Ratio > 25%)
  if (likeRatio > 25) {
    return {
      title: "Саппорт",
      icon: "💖",
      desc: "У тебя самое доброе сердце. Ты поддерживаешь авторов лайком, не жалея пальца.",
      statLabel: "Щедрость",
      statValue: `${likeRatio.toFixed(0)}% лайков`,
    };
  }

  // 4. ПОВЕЛИТЕЛЬ ЛЕНТЫ (Очень много просмотров > 20к или > 500 часов)
  if (views > 20000 || hours > 400) {
    return {
      title: "Повелитель ленты",
      icon: "👑",
      desc: "Ты прошел TikTok до конца. Алгоритмы больше не знают, что тебе предложить.",
      statLabel: "Потрачено жизни",
      statValue: `${hours} часов`,
    };
  }

  // 5. ПРИЗРАК (Мало лайков, мало комментов, но смотрит)
  // Если лайков меньше 1% от просмотров
  if (views > 1000 && likeRatio < 1) {
    return {
      title: "Призрак",
      icon: "👻",
      desc: "Ты смотришь, смеешься, но не оставляешь следов. Алгоритм в замешательстве.",
      statLabel: "Скрытность",
      statValue: "100%",
    };
  }

  // 6. На расслабоне (Стандартный юзер)
  return {
    title: "На расслабоне",
    icon: "🍹", // Или 🧘‍♂️ или 🕶️
    desc: "ТикТок не управляет тобой, это ты управляешь им. Зашел, посмеялся, вышел. Идеальный баланс.",
    statLabel: "Всего просмотрено",
    statValue: `${nFmt(views)} видео`,
  };
}

// Форматтер чисел (1.2k)
function nFmt(num) {
  if (!num) return "0";
  if (num > 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num > 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

// Рендер CSS Графика
function renderHourlyChart(hourlyData) {
  const container = document.getElementById("hourlyChart");
  container.innerHTML = "";

  if (!hourlyData || hourlyData.length === 0) {
    container.innerHTML =
      '<div style="color:grey; width:100%; text-align:center">Нет данных</div>';
    return;
  }

  const maxVal = Math.max(...hourlyData);

  hourlyData.forEach((count, hour) => {
    const bar = document.createElement("div");
    bar.className = "chart-bar";
    // Высота в процентах (минимум 5% чтобы было видно)
    const heightPct = maxVal > 0 ? (count / maxVal) * 100 : 0;

    // Красим активные часы в градиент
    if (heightPct > 50) {
      bar.style.background =
        "linear-gradient(to top, var(--color-tiktok-pink), var(--color-tiktok-cyan))";
    }

    bar.style.height = `${Math.max(5, heightPct)}%`;
    bar.setAttribute("data-hour", `${hour}:00`); // Тултип
    bar.title = `${hour}:00 - ${count} видео`;
    container.appendChild(bar);
  });
}

// Описания персон
function getPersonaDescription(persona) {
  if (persona.includes("Призрак"))
    return "Ты смотришь, но не оставляешь следов.";
  if (persona.includes("Скроллер"))
    return "Ты можешь листать ленту бесконечно.";
  if (persona.includes("Критик")) return "Твое мнение всегда важно.";
  if (persona.includes("Пулемет"))
    return "Ты раздаешь лайки как бесплатные конфеты.";
  if (persona.includes("Инфлюенсер"))
    return "Ты главный дистрибьютор контента среди друзей.";
  return "Ты уникален в своих предпочтениях.";
}

// --- Слайд-шоу ---
function startFullscreenSlideshow() {
  if (!fsSlidesContainer) return;
  fsSlidesContainer.innerHTML = "";

  // Создаем DOM элементы слайдов
  fsSlidesData.forEach((data) => {
    const slide = document.createElement("div");
    slide.className = "fs-slide";
    slide.innerHTML = `
            <div class="fs-title">${data.title}</div>
            <div class="fs-value">${data.value}</div>
            <div class="fs-label">${data.label}</div>
            ${
              data.details
                ? `<div class="fs-details">${data.details}</div>`
                : ""
            }
        `;
    fsSlidesContainer.appendChild(slide);
  });

  currentFsSlideIndex = -1;
  fullscreenSlideshow.style.display = "flex";
  requestAnimationFrame(() => fullscreenSlideshow.classList.add("visible"));
  showNextFullscreenSlide();
}

function showNextFullscreenSlide() {
  clearTimeout(slideshowTimeoutId); // Сбрасываем предыдущий таймер

  const slides = fsSlidesContainer.querySelectorAll(".fs-slide");
  const current = fsSlidesContainer.querySelector(".active");

  // Убираем активный класс
  if (current) current.classList.remove("active");

  currentFsSlideIndex++;

  // Если слайды кончились — закрываем
  if (currentFsSlideIndex >= slides.length) {
    endFullscreenSlideshow();
    return;
  }

  // Показываем новый
  slides[currentFsSlideIndex].classList.add("active");

  // Анимация прогресс-бара
  if (fsProgressBar) {
    fsProgressBar.style.transition = "none";
    fsProgressBar.style.width = "0%";
    void fsProgressBar.offsetWidth; // Магия: заставляет браузер применить стиль немедленно
    fsProgressBar.style.transition = "width 5s linear"; // 5 секунд на слайд
    fsProgressBar.style.width = "100%";
  }

  // Запускаем таймер для следующего слайда
  slideshowTimeoutId = setTimeout(showNextFullscreenSlide, 5000);
}

function showPrevFullscreenSlide() {
  // Если это первый слайд, ничего не делаем или можно закрыть (на твой вкус)
  if (currentFsSlideIndex <= 0) return;

  clearTimeout(slideshowTimeoutId);

  const slides = fsSlidesContainer.querySelectorAll(".fs-slide");
  const current = fsSlidesContainer.querySelector(".active");

  if (current) {
    current.classList.remove("active");
    // Опционально: добавить класс для анимации ухода вправо
  }

  currentFsSlideIndex--;
  slides[currentFsSlideIndex].classList.add("active");

  // Сбрасываем и перезапускаем прогресс-бар
  if (fsProgressBar) {
    fsProgressBar.style.transition = "none";
    fsProgressBar.style.width = "0%";
    void fsProgressBar.offsetWidth; // force reflow
    fsProgressBar.style.transition = "width 5s linear";
    fsProgressBar.style.width = "100%";
  }

  // Перезапускаем таймер
  slideshowTimeoutId = setTimeout(showNextFullscreenSlide, 5000);
}

function endFullscreenSlideshow() {
  clearTimeout(slideshowTimeoutId);
  fullscreenSlideshow.classList.remove("visible");
  setTimeout(() => {
    fullscreenSlideshow.style.display = "none";
    mainResults.style.display = "block";
    requestAnimationFrame(() => mainResults.classList.add("visible"));
  }, 500);
}

// --- Шаринг картинки ---
async function generateAndShareImage() {
  if (!shareCard || typeof html2canvas === "undefined") {
    await import(
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
    );
  }

  updateStatus("Рисуем карточку...", "loading");

  // Заполнение данными
  if (currentAnalysisResult) {
    const stats = currentAnalysisResult;
    const fill = (sel, txt) => {
      const el = shareCard.querySelector(sel);
      if (el) el.innerHTML = txt;
    };

    fill(".share-year", "2025");
    fill(".share-username", stats.profile?.slideInfo?.userName);

    // --- ПЕРСОНА И АДАПТИВНЫЙ ШРИФТ ---
    const pData = getPersonaDetails(stats);
    const personaTitle = pData.title;

    fill(".share-persona", personaTitle);
    fill(".share-desc", pData.desc);

    // Логика уменьшения шрифта
    const personaEl = shareCard.querySelector(".share-persona");
    if (personaEl) {
      const len = personaTitle.length;

      // Сброс на размер по умолчанию (для коротких слов типа "Саппорт")
      personaEl.style.fontSize = "7.5rem";

      if (len > 15) {
        // Длинные: "Повелитель ленты" (16), "Дистрибьютор..." (18)
        personaEl.style.fontSize = "4.2rem";
      } else if (len > 9) {
        // Средние: "Исследователь" (13), "На расслабоне" (13)
        personaEl.style.fontSize = "5.5rem";
      }
    }
    // ----------------------------------

    // Статистика
    fill(
      ".share-time",
      (stats.watchHistory?.slideInfo?.totalWatchTimeHours || 0) + " ч"
    );
    fill(".share-likes", nFmt(stats.likes?.slideInfo?.likeCount));
    fill(".share-sessions", nFmt(stats.watchHistory?.slideInfo?.watchSessions));
    fill(
      ".share-videos-watched",
      nFmt(stats.watchHistory?.slideInfo?.videoCount)
    );
  }

  try {
    const canvas = await html2canvas(shareCard, {
      backgroundColor: "#050505",
      scale: 1,
      useCORS: true,
    });

    canvas.toBlob((blob) => {
      const file = new File([blob], "tiktok-wrapped.png", {
        type: "image/png",
      });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        navigator
          .share({
            files: [file],
            title: "Мой TikTok Wrapped",
            text: "Смотри, сколько времени я потратил! 👉 tiktok.viktoor.ru",
          })
          .catch(console.error);
      } else {
        const link = document.createElement("a");
        link.download = "tiktok-wrapped.png";
        link.href = canvas.toDataURL();
        link.click();
      }
      updateStatus("Готово!", "success");
      setTimeout(() => updateStatus(""), 2000);
    });
  } catch (e) {
    console.error(e);
    updateStatus("Ошибка: " + e.message, "error");
  }
}

// --- Метрика ---
function reachMetrikaGoal(goal) {
  if (typeof ym === "function") ym(99841001, "reachGoal", goal);
}

// --- Инициализация ---
document.addEventListener("DOMContentLoaded", () => {
  // Event Listeners
  startButton?.addEventListener("click", () => showModal(uploadModal));

  // Drag & Drop
  zipFileInput?.addEventListener("click", (e) => {
    // Останавливаем всплытие, чтобы клик по инпуту не триггерил клик по uploadArea снова
    e.stopPropagation();
  });

  zipFileInput?.addEventListener("change", function (e) {
    if (this.files && this.files[0]) {
      handleFile(this.files[0]);
    }
    this.value = "";
  });
  uploadArea?.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });
  uploadArea?.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  closeSlideshowButton?.addEventListener("click", endFullscreenSlideshow);
  if (fsSlideshowArea) {
    // Клик мышкой или тап пальцем
    fsSlideshowArea.addEventListener("click", (event) => {
      // Игнорируем клик, если нажали на кнопку закрытия
      if (event.target.closest("#closeSlideshowButton")) return;

      const clickX = event.clientX;
      const screenWidth = window.innerWidth;

      // Если клик в левой трети экрана -> Назад
      if (clickX < screenWidth / 3) {
        showPrevFullscreenSlide();
      } else {
        // Иначе -> Вперед
        showNextFullscreenSlide();
      }
    });

    // Управление клавиатурой
    window.addEventListener("keydown", (event) => {
      // Работает только если слайд-шоу видно
      if (fullscreenSlideshow.style.display === "flex") {
        if (event.key === "ArrowLeft") showPrevFullscreenSlide();
        if (event.key === "ArrowRight" || event.key === " ")
          showNextFullscreenSlide();
        if (event.key === "Escape") endFullscreenSlideshow();
      }
    });
  }

  storyTrigger?.addEventListener("click", () => {
    startFullscreenSlideshow();
  });

  // Также при нажатии на Enter на аватарке (доступность)
  storyTrigger?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startFullscreenSlideshow();
  });

  // Misc
  resetButton?.addEventListener("click", resetToInitialState);
  shareImageButton?.addEventListener("click", generateAndShareImage);

  // Закрытие модалок по клику на фон
  window.onclick = (e) => {
    if (e.target === uploadModal) hideModal(uploadModal);
  };

  // Демо режим
  demoButton?.addEventListener("click", () => {
    // Создаем фейк-данные для демо
    const fakeData = {
      Profile: { "Profile Info": { ProfileMap: { userName: "DemoUser" } } },
      "Your Activity": {
        "Watch History": {
          VideoList: Array(5230).fill({
            Date: `${new Date().getFullYear()}-05-01 12:00:00`,
          }),
        },
        "Like List": {
          ItemFavoriteList: Array(1200).fill({
            date: `${new Date().getFullYear()}-05-01 12:00:00`,
          }),
        },
        "Share History": {
          ShareHistoryList: Array(45).fill({
            Date: `${new Date().getFullYear()}-05-01 12:00:00`,
          }),
        },
      },
      Comment: {
        Comments: {
          CommentsList: Array(300).fill({
            date: `${new Date().getFullYear()}-05-01 12:00:00`,
            comment: "Wow! 😂",
          }),
        },
      },
      "Tiktok Live": {
        "Watch Live History": {
          WatchLiveMap: {
            a: { WatchTime: `${new Date().getFullYear()}-05-01 12:00:00` },
          },
        },
      },
    };
    processJsonText(JSON.stringify(fakeData));
  });
});
