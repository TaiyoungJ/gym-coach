/* ── 루틴 변경 (다른 요일 루틴으로 수행) ───────────────────── */
// 공휴일 등으로 정해진 요일에 못 하면, 이번 주 목표치는 그대로 두고 수행 요일만 바꾼다.
// GAS getMission의 testDate 인자로 "같은 주의 다른 날짜" 미션을 받아 오늘 것으로 쓴다 (서버 수정 없음).
// 저장은 날짜/요일 = 실제 오늘, 루틴명 = 고른 루틴 (기존처럼 "O요일: " 접두사 제거).
//
// localStorage
//   gc_swap         = { date: 오늘, targetDate, targetDay }   — 그날 하루만 유효, 날짜 바뀌면 자동 해제
//   gc_swap_mission = 고른 요일 미션에 date/day 를 오늘 값으로 바꾼 것 (재실행 시 즉시 렌더용)

const DAY_KOR = ['일', '월', '화', '수', '목', '금', '토'];
let _weekMissions = {};   // { iso: mission }  시트를 열 때 받아 둔 이번 주 미션 (세션 메모리)

// 'YYYY-MM-DD' → 로컬 자정 Date (new Date(iso) 는 UTC 로 해석돼 요일이 어긋날 수 있음)
function isoToDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDaySwap() {
  try {
    const raw = localStorage.getItem('gc_swap');
    if (!raw) return null;
    const swap = JSON.parse(raw);
    if (swap.date !== toIso(new Date())) {   // 날짜가 지났으면 자동 해제
      localStorage.removeItem('gc_swap');
      localStorage.removeItem('gc_swap_mission');
      return null;
    }
    return swap;
  } catch { return null; }
}
function readSwapMission() {
  try {
    const raw = localStorage.getItem('gc_swap_mission');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSwapMission(m) {
  try { localStorage.setItem('gc_swap_mission', JSON.stringify(m)); } catch {}
}

// 다른 요일 미션을 오늘 것으로: 날짜·요일만 실제 오늘로 바꾼다. routineName 은 서버 값 그대로.
function applySwapToMission(m) {
  const now = new Date();
  return { ...m, date: toIso(now), day: DAY_KOR[now.getDay()] };
}

function setDaySwap(targetDate, mission) {
  const applied = applySwapToMission(mission);
  try {
    localStorage.setItem('gc_swap', JSON.stringify({ date: toIso(new Date()), targetDate, targetDay: DAY_KOR[isoToDate(targetDate).getDay()] }));
  } catch {}
  writeSwapMission(applied);
  missionCache   = applied;
  missionLoading = false;
  updateLandingStatus();
}

function clearDaySwap() {
  localStorage.removeItem('gc_swap');
  localStorage.removeItem('gc_swap_mission');
  missionCache = readMissionCache();     // 오늘의 정식 캐시는 건드리지 않았으므로 즉시 복구
  missionLoading = !missionCache;
  updateLandingStatus();
  refreshMission();
}

/* ── 오늘의 운동 카드 하단 줄 ──────────────────────────────── */
function renderDaySwapRow() {
  const swap = getDaySwap();
  if (!swap) {
    return `<button class="day-swap-btn" onclick="openDaySwapSheet()">📅 루틴 변경</button>`;
  }
  const todayKor = DAY_KOR[new Date().getDay()];
  return `
    <div class="day-swap-active">
      <span class="day-swap-info">📅 ${todayKor}요일 · <b>${swap.targetDay}요일 루틴</b>으로 진행 중</span>
      <button class="day-swap-reset" onclick="clearDaySwap()">원래대로</button>
    </div>`;
}

/* ── 요일 선택 바텀시트 ────────────────────────────────────── */
// 이번 주 월~일 목록. 캐시(오늘·내일·모레)가 있는 날은 즉시, 나머지는 병렬로 받아 도착하는 대로 채운다.
function getThisWeekDates() {
  const today = new Date(), diff = (today.getDay() === 0) ? -6 : 1 - today.getDay();
  const mon = new Date(today); mon.setDate(today.getDate() + diff);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    dates.push({ iso: toIso(d), day: DAY_KOR[d.getDay()], dateNum: d.getDate() });
  }
  return dates;
}

function openDaySwapSheet() {
  const todayIso = toIso(new Date());
  const swap     = getDaySwap();
  const selected = swap ? swap.targetDate : todayIso;
  const testMode = getSettings().testMode;

  let html = '';
  getThisWeekDates().forEach(({ iso, day, dateNum }) => {
    // 즉시 채울 수 있는 것: 세션 메모리 → 날짜별 캐시 (테스트 모드는 캐시 대신 목업)
    let m = _weekMissions[iso] || (testMode ? { ...getMockMission(), date: iso, day } : readMissionCache(iso));
    if (m && !m.error) _weekMissions[iso] = m;
    const isToday = iso === todayIso;
    html += `<button class="rn-item ds-item${iso === selected ? ' selected' : ''}" id="ds-${iso}" data-iso="${iso}" onclick="selectSwapDay('${iso}')">
               <span class="ds-left"><span class="ds-day">${day} ${dateNum}${isToday ? '<span class="ds-today">오늘</span>' : ''}</span>
               <span class="ds-name" id="ds-name-${iso}">${dsNameText(m)}</span></span>
               <span class="rn-check">✓</span>
             </button>`;
  });

  openBottomSheet(`
    <div class="popup-header">
      <span class="popup-label">루틴 변경</span>
      <button class="popup-close" onclick="closeBottomSheet()">닫기</button>
    </div>
    <div class="sheet-scroll-body">
      <div class="rn-list">${html}</div>
      <div class="rn-hint">오늘 할 루틴의 요일을 고르세요. 목표 중량·횟수는 이번 주 기준으로 가져와요.</div>
    </div>
  `);

  // 이미 있는 날은 바로 상태 반영, 없는 날은 병렬로 받아 도착하는 대로 행 갱신
  getThisWeekDates().forEach(({ iso }) => {
    if (_weekMissions[iso]) { applyDsRowState(iso); return; }
    fetchWeekMission(iso).then(() => applyDsRowState(iso));
  });
}

function fetchWeekMission(iso) {
  if (_weekMissions[iso]) return Promise.resolve(_weekMissions[iso]);
  if (getSettings().testMode) {
    _weekMissions[iso] = { ...getMockMission(), date: iso, day: DAY_KOR[isoToDate(iso).getDay()] };
    return Promise.resolve(_weekMissions[iso]);
  }
  return apiGet({ action: 'getMission', testDate: iso })
    .then(m => { if (m && !m.error) _weekMissions[iso] = m; return _weekMissions[iso] || null; })
    .catch(() => null);
}

function dsNameText(m) {
  if (!m) return '<span class="ds-loading">불러오는 중…</span>';
  if (!m.exercises || m.exercises.length === 0) return '쉬는 날';
  const r = m.routineName || '';
  return r.includes(':') ? r.split(':').slice(1).join(':').trim() : r;
}

// 행 하나의 표시 상태(루틴명·비활성) 갱신
function applyDsRowState(iso) {
  const btn    = document.getElementById('ds-' + iso);
  const nameEl = document.getElementById('ds-name-' + iso);
  if (!btn || !nameEl) return;
  const m = _weekMissions[iso];
  if (!m) {
    // 받아오기 실패: 누르면 다시 시도하도록 안내만 바꾼다
    if (!nameEl.querySelector('.ds-loading')) return;
    nameEl.innerHTML = '<span class="ds-loading">불러오지 못했어요 · 눌러서 다시 시도</span>';
    return;
  }
  nameEl.innerHTML = dsNameText(m);
  const isRest = !m.exercises || m.exercises.length === 0;
  btn.disabled = isRest;
  btn.classList.toggle('ds-rest', isRest);
}

async function selectSwapDay(iso) {
  const todayIso = toIso(new Date());
  let m = _weekMissions[iso];
  if (!m) {
    const nameEl = document.getElementById('ds-name-' + iso);
    if (nameEl) nameEl.innerHTML = '<span class="ds-loading">불러오는 중…</span>';
    m = await fetchWeekMission(iso);
    applyDsRowState(iso);
    if (!m) return;
    if (!m.exercises || m.exercises.length === 0) return;
  }
  closeBottomSheet();
  if (iso === todayIso) { if (getDaySwap()) clearDaySwap(); return; }
  setDaySwap(iso, m);
}
