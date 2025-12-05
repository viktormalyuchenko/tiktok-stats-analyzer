/**
 * analyzer.js
 * Версия 2.0: Синхронизация дат и расширенная таблица
 */

const TikTokAnalyzer = {
  // --- Вспомогательные функции ---

  parseDateString(dateString) {
    if (!dateString || typeof dateString !== "string" || dateString === "N/A")
      return null;
    const match = dateString.match(
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/
    );
    if (!match) return null;
    const [, year, month, day, hours, minutes, seconds] = match.map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const utcDate = new Date(
      Date.UTC(year, month - 1, day, hours, minutes, seconds)
    );
    return isNaN(utcDate.getTime()) ? null : utcDate;
  },

  formatDate(dateInput, timezone, options = {}) {
    let dateObj;
    if (dateInput instanceof Date) dateObj = dateInput;
    else dateObj = this.parseDateString(dateInput);
    if (!dateObj || isNaN(dateObj.getTime())) return "N/A";
    const defaultOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      timeZone: timezone,
      hour12: false,
    };
    try {
      return dateObj.toLocaleString("ru-RU", { ...defaultOptions, ...options });
    } catch (e) {
      return dateObj.toISOString().substring(0, 16);
    }
  },

  // --- АНАЛИЗАТОРЫ ---

  processProfile(profileSection) {
    const profileInfo = profileSection?.["Profile Info"]?.ProfileMap || {};
    // Ищем аватарку в разных полях
    const avatarUrl =
      profileInfo.avatarUrl ||
      profileInfo.profilePhoto ||
      profileInfo.headImgUrl ||
      null;

    return {
      tableData: {
        Никнейм: profileInfo.userName || "N/A",
        "Описание (Bio)": profileInfo.bioDescription || "-",
        Email: profileInfo.emailAddress || "-",
        Телефон: profileInfo.telephoneNumber || "-",
        "Дата рождения": profileInfo.birthDate || "-",
      },
      slideInfo: { userName: profileInfo.userName || "", avatarUrl },
    };
  },

  processWatchHistory(watchSection, year, timezone) {
    const videoList = watchSection?.VideoList || [];
    const yearVideos = [];
    const hourlyActivity = new Array(24).fill(0);
    const monthlyActivity = new Array(12).fill(0);

    let weekendVideos = 0;
    let nightVideos = 0;

    for (const v of videoList) {
      const date = this.parseDateString(v.Date);
      if (date && date.getUTCFullYear() === year) {
        yearVideos.push({ date, obj: v });

        // Статистика
        monthlyActivity[date.getMonth()]++;
        try {
          const hourStr = date.toLocaleString("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: timezone,
          });
          const hour = parseInt(hourStr, 10) % 24;
          hourlyActivity[hour]++;
          if (hour >= 0 && hour < 5) nightVideos++;
          const day = date.getDay();
          if (day === 0 || day === 6) weekendVideos++;
        } catch (e) {
          hourlyActivity[date.getUTCHours()]++;
        }
      }
    }

    yearVideos.sort((a, b) => a.date - b.date);

    // --- Расчет дат и диапазонов ---
    const count = yearVideos.length;
    let dateRangeString = `${year} год`;
    let daysSpan = 365;
    let startDate = null;
    let endDate = null;
    let isPartial = false;

    if (count > 0) {
      startDate = yearVideos[0].date;
      endDate = yearVideos[count - 1].date;

      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      daysSpan = diffDays > 0 ? diffDays : 1;

      if (daysSpan < 300) {
        isPartial = true;
        const opts = { month: "long", day: "numeric" };
        dateRangeString = `${this.formatDate(
          startDate,
          timezone,
          opts
        )} - ${this.formatDate(endDate, timezone, opts)} (${daysSpan} дн.)`;
      }
    }

    // --- Метрики ---
    const avgWatchTimeSec = 15;
    const totalMinutes = Math.round((count * avgWatchTimeSec) / 60);
    const totalHours = Math.round(totalMinutes / 60);
    const dailyAvg = (totalHours / daysSpan).toFixed(1);

    // Сессии
    let sessions = 0;
    let longestSession = 0;
    let currentSessionVideos = 0;
    if (count > 0) {
      sessions = 1;
      currentSessionVideos = 1;
      for (let i = 1; i < count; i++) {
        const diff =
          (yearVideos[i].date - yearVideos[i - 1].date) / (1000 * 60);
        if (diff > 30) {
          longestSession = Math.max(
            longestSession,
            (currentSessionVideos * avgWatchTimeSec) / 60
          );
          sessions++;
          currentSessionVideos = 1;
        } else {
          currentSessionVideos++;
        }
      }
      longestSession = Math.max(
        longestSession,
        (currentSessionVideos * avgWatchTimeSec) / 60
      );
    }

    const days = [
      "Воскресенье",
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
    ];
    const dayCounts = new Array(7).fill(0);
    yearVideos.forEach((v) => dayCounts[v.date.getUTCDay()]++);
    const favDay =
      count > 0 ? days[dayCounts.indexOf(Math.max(...dayCounts))] : "-";

    return {
      tableData: {
        "Видео просмотрено": count.toLocaleString(),
        "Общее время (оценка)": `${totalHours} часов (${totalMinutes.toLocaleString()} мин)`,
        "Период данных": isPartial ? `⚠️ ${dateRangeString}` : dateRangeString,
        "Среднее время в день": `${dailyAvg} часа`,
        "Количество сессий": sessions.toLocaleString(),
        "Самая долгая сессия": `~${Math.round(longestSession)} мин`,
        "Любимый день недели": favDay,
        "Ночная активность (00-05)": `${
          count > 0 ? Math.round((nightVideos / count) * 100) : 0
        }%`,
        "Активность в выходные": `${
          count > 0 ? Math.round((weekendVideos / count) * 100) : 0
        }%`,
        "Первое видео": count > 0 ? this.formatDate(startDate, timezone) : "-",
        "Последнее видео": count > 0 ? this.formatDate(endDate, timezone) : "-",
      },
      slideInfo: {
        videoCount: count,
        totalWatchTimeHours: totalHours,
        watchSessions: sessions,
        averageSessionLength:
          sessions > 0 ? Math.round(totalMinutes / sessions) : 0,
        mostActiveWeekday: count > 0 ? favDay.substring(0, 3) : "-",
        hourlyActivity: hourlyActivity,
        monthlyActivity: monthlyActivity,
        nightPercentage:
          count > 0 ? Math.round((nightVideos / count) * 100) : 0,
        weekendRatio: count > 0 ? Math.round((weekendVideos / count) * 100) : 0,
        dailyAverage: dailyAvg,
        dateRange: dateRangeString,
        isPartialData: isPartial,
        // Важно: возвращаем даты для фильтрации лайков
        realStartDate: startDate,
        realEndDate: endDate,
      },
    };
  },

  processLikes(likeSection, year, dateLimit) {
    const list = likeSection?.ItemFavoriteList || [];
    let totalCount = 0;
    let matchedCount = 0;

    // Объявляем переменные для дат
    let firstLike = null;
    let lastLike = null;

    // Запускаем цикл
    list.forEach((item) => {
      const d = this.parseDateString(item.date);

      // Если дата валидна и год совпадает
      if (d && d.getUTCFullYear() === year) {
        totalCount++;

        // Ищем первый и последний лайк
        if (!firstLike || d < firstLike) firstLike = d;
        if (!lastLike || d > lastLike) lastLike = d;

        // Считаем лайки внутри периода просмотров (для процента щедрости)
        if (dateLimit.start && dateLimit.end) {
          if (d >= dateLimit.start && d <= dateLimit.end) {
            matchedCount++;
          }
        } else {
          matchedCount++;
        }
      }
    });

    return {
      tableData: {
        "Лайков за год (Всего)": totalCount.toLocaleString(),
        "Лайков в период просмотра": dateLimit.start
          ? `${matchedCount.toLocaleString()} (для %)`
          : "-",
        "Первый лайк": firstLike ? this.formatDate(firstLike, "UTC") : "-",
        "Последний лайк": lastLike ? this.formatDate(lastLike, "UTC") : "-",
      },
      slideInfo: {
        likeCount: totalCount,
        matchedLikeCount: matchedCount,
      },
    };
  },

  processComments(commentSection, year) {
    const list = commentSection?.Comments?.CommentsList || [];
    let count = 0;
    let totalChars = 0;
    const emojiCounts = {};

    list.forEach((c) => {
      const d = this.parseDateString(c.date);
      if (d && d.getUTCFullYear() === year) {
        count++;
        const txt = c.comment || "";

        totalChars += [...txt].length;

        const emojiRegex =
          /([\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])/gu;
        const matches = txt.match(emojiRegex);
        if (matches)
          matches.forEach((e) => (emojiCounts[e] = (emojiCounts[e] || 0) + 1));
      }
    });

    const sortedEmojis = Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((e) => ({ char: e[0], count: e[1] }));

    const topEmojiString = sortedEmojis.map((e) => e.char).join(" ");

    return {
      tableData: {
        "Всего комментариев": count.toLocaleString(),
        "Средняя длина":
          count > 0 ? `${Math.round(totalChars / count)} симв.` : "0",
        "Топ эмодзи": topEmojiString || "-",
      },
      slideInfo: {
        commentCount: count,
        avgCommentLen: count > 0 ? Math.round(totalChars / count) : 0,
        mostUsedEmoji: sortedEmojis[0]?.char,
        topEmojis: sortedEmojis,
      },
    };
  },

  processShares(shareSection, year) {
    const list = shareSection?.ShareHistoryList || [];
    let count = 0;
    list.forEach((item) => {
      const d = this.parseDateString(item.Date);
      if (d && d.getUTCFullYear() === year) count++;
    });
    return {
      tableData: { "Репостов за год": count.toLocaleString() },
      slideInfo: { shareCount: count },
    };
  },

  processLive(liveSection, year) {
    const map = liveSection?.["Watch Live History"]?.WatchLiveMap || {};
    let count = 0;
    Object.values(map).forEach((item) => {
      const d = this.parseDateString(item.WatchTime);
      if (d && d.getUTCFullYear() === year) count++;
    });
    return {
      tableData: { "Live трансляций": count.toLocaleString() },
      slideInfo: { liveCount: count },
    };
  },

  getPersona(stats) {
    // ... (Тут твоя функция getPersonaDetails из script.js,
    // но лучше ее оставить в script.js или перенести сюда.
    // Пока оставим простую заглушку для совместимости, если script.js использует свою)
    return "User";
  },

  /** ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА */
  runAnalysis(data, year, timezone) {
    const validation = this.validateData(data);
    if (!validation.valid) throw new Error(validation.error);

    const results = {};

    // 1. Сначала считаем Просмотры, чтобы получить Диапазон Дат
    results.watchHistory = this.processWatchHistory(
      data["Your Activity"]?.["Watch History"],
      year,
      timezone
    );

    // Достаем даты
    const dateLimit = {
      start: results.watchHistory.slideInfo.realStartDate,
      end: results.watchHistory.slideInfo.realEndDate,
    };

    // 2. Считаем остальное, передавая лимит
    results.profile = this.processProfile(data.Profile);
    results.likes = this.processLikes(
      data["Your Activity"]?.["Like List"],
      year,
      dateLimit
    );
    results.comments = this.processComments(data.Comment, year);
    results.shares = this.processShares(
      data["Your Activity"]?.["Share History"],
      year
    );
    results.live = this.processLive(data["Tiktok Live"], year);

    return results;
  },

  validateData(data) {
    if (!data || typeof data !== "object")
      return { valid: false, error: "Файл пуст" };
    if (!data["Your Activity"] && !data["Activity"])
      return { valid: false, error: "Неверный формат JSON" };
    return { valid: true };
  },
};
