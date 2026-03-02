(() => {
  const YFM = (window.YFM = window.YFM || {});

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_TO_INDEX = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  function parseMinutes(hhmm) {
    const match = /^(\\d{2}):(\\d{2})$/.exec(hhmm || '');
    if (!match) return 0;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function isWithinSchedule(settings, now = new Date()) {
    if (!settings.scheduleEnabled) return true;

    const activeDays = new Set(settings.scheduleDays || []);
    if (activeDays.size === 0) return false;

    const start = parseMinutes(settings.scheduleStart);
    const end = parseMinutes(settings.scheduleEnd);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const dayName = DAY_NAMES[now.getDay()];
    const yesterdayName = DAY_NAMES[(now.getDay() + 6) % 7];

    if (start === end) {
      return activeDays.has(dayName);
    }

    if (start < end) {
      return activeDays.has(dayName) && nowMin >= start && nowMin < end;
    }

    const inLateSegment = activeDays.has(dayName) && nowMin >= start;
    const inAfterMidnightSegment = activeDays.has(yesterdayName) && nowMin < end;
    return inLateSegment || inAfterMidnightSegment;
  }

  function effectiveFocusEnabled(settings, now = new Date()) {
    if (!settings.focusEnabled) return false;
    if (!isWithinSchedule(settings, now)) return false;
    const bypassUntil = Number(settings.focusBypassUntil) || 0;
    if (now.getTime() < bypassUntil) return false;
    return true;
  }

  function withDayTime(baseDate, dayIndex, minutesFromMidnight) {
    const next = new Date(baseDate);
    const currentDay = next.getDay();
    const delta = (dayIndex - currentDay + 7) % 7;
    next.setDate(next.getDate() + delta);
    next.setHours(Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60, 0, 0);
    return next;
  }

  function nextBoundaryTime(settings, now = new Date()) {
    if (!settings.scheduleEnabled) return null;

    const activeDays = settings.scheduleDays || [];
    if (!activeDays.length) return null;

    const start = parseMinutes(settings.scheduleStart);
    const end = parseMinutes(settings.scheduleEnd);

    const candidates = [];
    for (const dayName of activeDays) {
      const dayIndex = DAY_TO_INDEX[dayName];
      if (dayIndex === undefined) continue;

      for (let weekOffset = 0; weekOffset <= 1; weekOffset += 1) {
        const startDate = withDayTime(now, dayIndex, start);
        startDate.setDate(startDate.getDate() + weekOffset * 7);
        if (startDate.getTime() > now.getTime()) {
          candidates.push(startDate);
        }

        const endDate = new Date(startDate);
        if (start <= end) {
          endDate.setHours(Math.floor(end / 60), end % 60, 0, 0);
        } else {
          endDate.setDate(endDate.getDate() + 1);
          endDate.setHours(Math.floor(end / 60), end % 60, 0, 0);
        }

        if (endDate.getTime() > now.getTime()) {
          candidates.push(endDate);
        }
      }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.getTime() - b.getTime());
    return candidates[0];
  }

  YFM.schedule = {
    DAY_NAMES,
    parseMinutes,
    isWithinSchedule,
    effectiveFocusEnabled,
    nextBoundaryTime,
  };
})();
