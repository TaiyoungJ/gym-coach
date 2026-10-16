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

  // 계체 요일 칩 (월~일 순, 복수 선택)
  let bodyChipHTML = '';
  for (let i = 1; i <= 7; i++) {
    const idx = i % 7;
    bodyChipHTML += `<button class="day-chip${s.bodyDays.includes(idx) ? ' on' : ''}" data-day="${idx}" onclick="this.classList.toggle('on')">${dayShort[idx]}</button>`;
  }

  let dayOptions = '';
  for (let i = 1; i <= 7; i++) {
    const idx = i % 7;
    dayOptions += `<option value="${idx}"${s.startDay === idx ? ' selected' : ''}>${dayFull[idx]}</option>`;
  }

  // 진행 판정 옵션 (js/progression.js) — 바닥 비율 60~95%, 구역 표 = 메인/보조 × 2~5세트의 목표 세트 수
  const prog = s.progression;
  let floorOptions = '';
  for (let p = 60; p <= 95; p += 5) floorOptions += `<option value="${p}"${prog.floorPct === p ? ' selected' : ''}>${p}%</option>`;
  const zoneRow = (kind, label) => `
    <div class="zone-grid-label">${label}</div>
    ${[2, 3, 4, 5].map(n => `<select class="zone-select" data-kind="${kind}" data-sets="${n}">${
      Array.from({ length: n }, (_, i) => i + 1).map(v => `<option value="${v}"${Number(prog.goalSets[kind][n]) === v ? ' selected' : ''}>${v}</option>`).join('')
    }</select>`).join('')}`;

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
      <div class="settings-group-label">📏 신체 기록</div>
      <div class="settings-row">
        <div class="settings-row-label">계체 요일</div>
        <div class="settings-row-sub">선택한 요일에 홈 화면에 체중·허리둘레 기록 카드가 보여요</div>
        <div class="day-chips" id="body-day-chips">${bodyChipHTML}</div>
      </div>
      <div class="settings-row">
        <button class="landing-ghost-btn" style="margin-bottom:0;" onclick="openBodyRecordNow()">📏 지금 기록하기</button>
      </div>
    </div>

    <div class="settings-group${prog.enabled ? '' : ' prog-off'}" id="prog-group">
      <div class="settings-group-label">📈 진행 판정</div>
      <div class="settings-row prog-toggle-row">
        <div class="settings-row-head">
          <div>
            <div class="settings-row-label">판정 기능</div>
            <div class="settings-row-sub">세트 구역 표시 · 운동 완료 시 판정</div>
          </div>
          <label class="toggle-wrap">
            <input type="checkbox" id="progEnabledToggle"${prog.enabled ? ' checked' : ''} onchange="document.getElementById('prog-group').classList.toggle('prog-off', !this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="settings-row prog-opt">
        <div class="settings-row-head">
          <div>
            <div class="settings-row-label">바닥 비율</div>
            <div class="settings-row-sub">방지턱 세트 기준 = 단계 목표 × 비율 (반올림)</div>
          </div>
          <select class="day-select" id="progFloorSelect">${floorOptions}</select>
        </div>
      </div>
      <div class="settings-row prog-opt">
        <div class="settings-row-label">구역 나누기</div>
        <div class="settings-row-sub">세트 수별 목표 세트 수 · 나머지 뒤쪽 세트는 방지턱</div>
        <div class="zone-grid">
          <div></div>${[2, 3, 4, 5].map(n => `<div class="zone-grid-head">${n}세트</div>`).join('')}
          ${zoneRow('main', '메인')}
          ${zoneRow('aux', '보조')}
        </div>
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
  const bodyDays = [...document.querySelectorAll('#body-day-chips .day-chip.on')].map(c => parseInt(c.dataset.day));
  const testMode = document.getElementById('testModeToggle').checked;
  // 테스트 모드를 켜고 끌 때 목업 신체 기록 캐시가 실사용에 섞이지 않도록 비운다
  if (testMode !== getSettings().testMode) localStorage.removeItem('gc_body_last');
  const goalSets = { main: {}, aux: {} };
  document.querySelectorAll('.zone-select').forEach(sel => { goalSets[sel.dataset.kind][sel.dataset.sets] = parseInt(sel.value); });
  saveSettingsData({
    startDay: parseInt(document.getElementById('startDaySelect').value),
    sheetUrl: document.getElementById('sheetUrlInput').value.trim(),
    testMode,
    restDays: { weekRange: week.range, days: restDays },
    bodyDays,
    progression: {
      enabled:  document.getElementById('progEnabledToggle').checked,
      floorPct: parseInt(document.getElementById('progFloorSelect').value),
      goalSets,
    },
  });
  missionCache = null; weekStatus = null; missionLoading = true;
  _reloadAfterNav = true;
  // 운동 도중(운동 화면 위에서 연 설정)이면 바뀐 판정 옵션으로 카드를 바로 다시 그린다. 입력값은 전역 상태에 남아 있다.
  if (pageStack.length >= 2 && pageStack[pageStack.length - 2].pageId === 'dashboard') renderCards();
  history.back();
}

function openRoutineDoc() { renderRoutineDoc(); }

// 예정일이 아니어도 신체 기록 카드를 열어 둔 채 홈으로 돌아간다 (js/body-record.js)
function openBodyRecordNow() {
  bodyForceOpen = true;
  history.back();
}

