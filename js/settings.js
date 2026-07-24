/* ── Settings Page ─────────────────────────────────────────── */
function renderSettings() {
  pushPage('settings');
  // 이하 getRenderRoot() = 방금 만든 settings 레이어의 inner
  const s    = getSettings();
  const week = getThisWeekRange();
  const dayFull  = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  const dayShort = ['일','월','화','수','목','금','토'];

  const today = new Date(), diff = (today.getDay() === 0) ? -6 : 1 - today.getDay();
  const mon   = new Date(today); mon.setDate(today.getDate() + diff);
  const thisWeekRest = s.restDays.weekRange === week.range ? s.restDays.days : [];
  let chipHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const iso = toIso(d), label = dayShort[d.getDay()] + ' ' + d.getDate();
    chipHTML += `<button class="day-chip${thisWeekRest.includes(iso) ? ' on' : ''}" data-date="${iso}" onclick="this.classList.toggle('on')">${label}</button>`;
  }

  let dayOptions = '';
  for (let i = 1; i <= 7; i++) {
    const idx = i % 7;
    dayOptions += `<option value="${idx}"${s.startDay === idx ? ' selected' : ''}>${dayFull[idx]}</option>`;
  }

  getRenderRoot().innerHTML = `
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <button class="back-btn" onclick="goBackFromSettings()">← 뒤로</button>
        <span class="page-title">환경설정</span>
      </div>
      <span class="logo" style="font-size:16px;font-weight:900;letter-spacing:0.03em;text-transform:none;">🏋️핸니의 체육관🏋️</span>
    </div>

    <div class="settings-group">
      <div class="settings-group-label">⏱ 루틴 설정</div>
      <div class="settings-row">
        <div class="settings-row-head">
          <div>
            <div class="settings-row-label">루틴 시작 요일</div>
            <div class="settings-row-sub">주차 등록 알림 기준일</div>
          </div>
          <select class="day-select" id="startDaySelect">${dayOptions}</select>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-label">이번 주 쉬는 날</div>
        <div class="settings-row-sub">일정 충돌로 빠지는 날을 선택하세요</div>
        <div class="day-chips" id="rest-day-chips">${chipHTML}</div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-label">🔗 연동</div>
      <div class="settings-row">
        <div class="settings-row-label">스프레드시트 URL</div>
        <div class="settings-row-sub">주차 등록 버튼 클릭 시 이동할 링크</div>
        <input class="url-input" id="sheetUrlInput" type="url"
          placeholder="https://docs.google.com/spreadsheets/..."
          value="${s.sheetUrl || ''}">
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-label">🧪 개발</div>
      <div class="settings-row">
        <div class="settings-row-head">
          <div>
            <div class="settings-row-label">테스트 모드</div>
            <div class="settings-row-sub">목업 데이터로 앱 동작 확인</div>
          </div>
          <label class="toggle-wrap">
            <input type="checkbox" id="testModeToggle"${s.testMode ? ' checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <button class="save-settings-btn" onclick="onSaveSettings()">설정 저장</button>`;
}

function goBackFromSettings() { history.back(); }

function onSaveSettings() {
  const week     = getThisWeekRange();
  const chips    = document.querySelectorAll('#rest-day-chips .day-chip');
  const restDays = [...chips].filter(c => c.classList.contains('on')).map(c => c.dataset.date);
  saveSettingsData({
    startDay: parseInt(document.getElementById('startDaySelect').value),
    sheetUrl: document.getElementById('sheetUrlInput').value.trim(),
    testMode: document.getElementById('testModeToggle').checked,
    restDays: { weekRange: week.range, days: restDays },
  });
  missionCache = null; weekStatus = null; missionLoading = true;
  _reloadAfterNav = true;
  history.back();
}

function openRoutineDoc() { renderRoutineDoc(); }

