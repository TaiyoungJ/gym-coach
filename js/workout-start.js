/* ── Popup helper ──────────────────────────────────────────── */
function closePopup(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('popup-container').innerHTML = '';
}

/* ── Background data loading ───────────────────────────────── */
// 앱 시작: 캐시로 즉시 그리고, 뒤에서 최신본을 받아 갱신한다.
// 캐시가 "미리 받아둔"(_prefetched) 것이면 정식 데이터로 쓰되, 낡았을 수 있으니
// 최신본이 올 때까지 오늘의 운동 카드 상단에 확인 중 바를 흘려 보여준다.
let missionSyncing     = false;  // 확인 중 바 표시 여부
let _missionFetching   = false;  // getMission 진행 중 (중복 호출 방지)
let _lastMissionFetchAt = 0;     // 마지막 getMission 완료 시각 — 앱 복귀 재조회 스로틀용

async function loadBackgroundData() {
  const s = getSettings();

  // A) 오늘 미션 캐시가 있으면 네트워크를 기다리지 않고 즉시 렌더 (테스트 모드 제외)
  //    루틴 변경(js/day-swap.js)이 켜져 있으면 그때 받아 둔 미션을 대신 쓰고 최신본 확인 바를 보여준다.
  const swap = getDaySwap();
  if (swap) {
    const cached = readSwapMission();
    if (cached && !cached.error) {
      missionCache   = cached;
      missionLoading = false;
      missionSyncing = true;
      updateLandingStatus();
    }
  } else if (!s.testMode) {
    const cached = readMissionCache();
    if (cached && !cached.error) {
      missionCache   = cached;
      missionLoading = false;
      missionSyncing = !!cached._prefetched;   // 미리 받은 것이면 "확인 중" 바
      updateLandingStatus();
    }
  }

  // B) 서로 독립적인 호출은 동시에 발사 (병렬)
  apiGet({ action: 'checkWeekStatus' })
    .then(res => { weekStatus = res; updateWeekAlert(); })
    .catch(() => {});
  loadBodyLast();   // 신체 기록 마지막 값 (js/body-record.js)
  await refreshMission();
}

// 오늘 미션 최신본을 받아 캐시·화면을 갱신한다. 앱 시작·복귀·새로고침 버튼에서 공용.
// showBar: 사용자가 요청한 새로고침이면 바를 보여준다 (복귀 자동 재조회는 조용히).
async function refreshMission({ showBar = false } = {}) {
  if (_missionFetching) return;
  _missionFetching = true;
  const s = getSettings();
  if (showBar) { missionSyncing = true; updateSyncBar(); }

  try {
    const swap = getDaySwap();   // 루틴 변경 중이면 고른 요일 기준으로 받는다 (js/day-swap.js)
    if (swap) {
      const raw = s.testMode ? getMockMission() : await apiGet({ action: 'getMission', testDate: swap.targetDate });
      const fresh = applySwapToMission(raw);
      missionCache = fresh;
      if (!s.testMode && fresh && !fresh.error) writeSwapMission(fresh);   // 오늘의 정식 캐시는 그대로 둔다
    } else {
      const fresh = s.testMode ? getMockMission() : await apiGet({ action: 'getMission' });
      missionCache = fresh;
      if (!s.testMode && fresh && !fresh.error) {
        writeMissionCache(fresh);   // 정식 캐시로 저장 (_prefetched 없음)
        prefetchMissions();         // 내일·모레도 미리 받아 둠 (백그라운드)
      }
    }
  } catch (err) {
    // 네트워크 실패 시 이미 캐시가 있으면(미리 받은 것 포함) 그대로 유지, 없을 때만 에러 표시
    if (!missionCache) missionCache = { error: err.message, exercises: [] };
  }
  _missionFetching = false;
  _lastMissionFetchAt = Date.now();
  missionLoading = false;
  const wasSyncing = missionSyncing;
  missionSyncing = false;
  updateLandingStatus();
  if (wasSyncing) finishSyncBar(!missionCache?.error);
}

// 내일·모레 미션을 미리 받아 날짜별 캐시에 저장한다. 실패는 무시(다음 날 기존처럼 스켈레톤).
// GAS getMission의 testDate 인자를 그대로 사용하므로 서버 수정이 없다.
function prefetchMissions() {
  if (getSettings().testMode) return;
  [1, 2].forEach(offset => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    const dateIso = toIso(d);
    apiGet({ action: 'getMission', testDate: dateIso })
      .then(m => { if (m && !m.error) writeMissionCache({ ...m, _prefetched: true }, dateIso); })
      .catch(() => {});
  });
}

// 앱이 다시 앞으로 왔을 때(시트 입력 후 복귀 등) 랜딩이면 조용히 최신본을 다시 받는다.
function onAppVisible() {
  if (document.visibilityState !== 'visible' || currentPage !== 'landing') return;
  if (getSettings().testMode) return;
  if (Date.now() - _lastMissionFetchAt < 30 * 1000) return;
  refreshMission();
}

// lastWeekLog 항목 → "지난:" 배지 팝업에 쓸 상세(날짜·세트별 무게/횟수·세트 간 휴식·메모).
// weights/date/rest는 신규 GAS 배포에서만 오므로, 없으면 대표 무게를 세트 수만큼 채우고 휴식은 표시를 생략한다.
function buildLastDetail(lastEx) {
  if (!lastEx) return null;
  const reps = (lastEx.reps || []).map(r => String(r).trim());
  const weights = Array.isArray(lastEx.weights) && lastEx.weights.length
    ? lastEx.weights.map(w => String(w).trim())
    : reps.map(() => String(lastEx.weight ?? ''));
  return {
    date:    lastEx.date || '',
    day:     lastEx.day || '',
    weights,
    reps,
    rest:    lastEx.rest || '',
    memo:    lastEx.memo || '',
  };
}

/* ── Start Workout ─────────────────────────────────────────── */
async function startWorkout() {
  const s = getSettings();
  if (missionLoading) {
    const btn = document.getElementById('start-btn');
    if (btn) { btn.disabled = true; btn.textContent = '불러오는 중...'; }
    await new Promise(resolve => {
      const t = setInterval(() => { if (!missionLoading) { clearInterval(t); resolve(); } }, 100);
    });
  }
  if (!missionCache || missionCache.error) {
    renderError(missionCache?.error || '미션 데이터를 불러올 수 없어요'); return;
  }
  if (!missionCache.exercises || missionCache.exercises.length === 0) {
    renderRestDay(); return;
  }

  missionData = missionCache;
  const lastLog = missionData.lastWeekLog || [];
  const norm    = str => str.replace(/\s/g,'');

  exercises = missionData.exercises.map((ex, i) => {
    if (ex.isSuperset) {
      const subExercises = (ex.subExercises || []).map(sub => {
        // 🆕 lastLog 매칭 시 name + variation 조합으로 비교
        const displayName = buildDisplayName(sub.name, sub.variation);
        const lastEx = lastLog.find(l => norm(buildDisplayName(l.name, l.variation)) === norm(displayName));
        return {
          name:         sub.name,
          variation:    sub.variation || '',
          displayName:  displayName,  // 🆕 화면 표시용
          targetWeight: sub.targetWeight || 0,
          targetReps:   sub.targetReps || 0,
          lastRecord:   lastEx ? `${lastEx.weight}kg · ${lastEx.reps.join(', ')}회` : null,
          lastDetail:   buildLastDetail(lastEx),
        };
      });
      return { id: i+1, name: ex.name, variation: ex.variation||'', sets: ex.sets, tag: ex.tag||null, isSuperset: true, subExercises };
    }
    const displayName = buildDisplayName(ex.name, ex.variation);
    const lastEx      = lastLog.find(l => norm(buildDisplayName(l.name, l.variation)) === norm(displayName));
    const lastRecord  = lastEx ? `${lastEx.weight}kg · ${lastEx.reps.join(', ')}회` : null;
    return {
      id: i+1,
      name:        ex.name,
      variation:   ex.variation || '',
      displayName: displayName,  // 🆕 화면 표시용
      sets:        ex.sets,
      tag:         ex.tag || null,
      isSuperset:  false,
      bodyPart:    ex.bodyPart || '',
      targetWeight: ex.targetWeight || 0,
      targetReps:   ex.targetReps || 0,
      lastRecord,
      lastDetail:   buildLastDetail(lastEx),
    };
  });

  programName  = missionData.routineName.includes(':') ? missionData.routineName.split(':').slice(1).join(':').trim() : missionData.routineName;
  skipped = {}; editingCards = {}; showAddForm = false; introText = null; collapsedCards = {};
  doneCards = {}; completedCards = {};
  repsData = {}; memoData = {}; restData = {}; weightData = {}; isFreeWorkout = false;
  pushPage('dashboard');
  renderMain();
}

/* ── Start Free Workout ───────────────────────────────── */
async function startFreeWorkout() {
  const now = new Date();
  const dayNames = ['일','월','화','수','목','금','토'];
  missionData = {
    date: toIso(now), day: dayNames[now.getDay()],
    routineName: '자유운동', exercises: [], lastWeekLog: [],
  };
  exercises = [];
  programName = '자유운동';
  isFreeWorkout = true;
  skipped = {}; editingCards = {}; showAddForm = false; introText = null; collapsedCards = {};
  doneCards = {}; completedCards = {};
  repsData = {}; memoData = {}; restData = {}; weightData = {};
  pushPage('dashboard');
  renderMain();
  (async () => {
    try {
      const res = await apiGet({ action: 'searchHistory', subAction: 'getExerciseList' });
      // 🆕 name만 뽑던 걸 name+variation 객체로 보관 (세부종목 자동완성용)
      freeExerciseNames = (res.exercises || []).map(ex =>
        (typeof ex === 'string') ? { name: ex, variation: '' } : { name: ex.name, variation: ex.variation || '' }
      );
    } catch { freeExerciseNames = []; }
  })();
}

/* ── Render utilities ──────────────────────────────────────── */
function renderError(msg) {
  document.getElementById('app').innerHTML = `<div class="error-card"><h3>오류가 발생했어요</h3><p>${msg}</p></div>`;
}
function renderRestDay() {
  document.getElementById('app').innerHTML = `<div class="rest-day"><h2>💤 오늘은 쉬는 날</h2><p>회복도 훈련이에요. 잘 쉬어요.</p></div>`;
}

/* ── Program badge ─────────────────────────────────────────── */
function renderProgramBadge() {
  const wrap = document.getElementById('programWrap');
  if (!wrap) return;
  wrap.innerHTML = `<span class="program-badge" onclick="openRoutineNameSheet()">${programName}</span>`;
}

/* ── 루틴명 수정 팝업 ───────────────────────────────────────── */
let routineNameSelected = '';   // 목록에서 선택된 루틴명 (없으면 '')

async function openRoutineNameSheet() {
  routineNameSelected = '';
  openBottomSheet(`
    <div class="popup-header">
      <span class="popup-label">루틴명 수정</span>
      <button class="popup-close" onclick="closeBottomSheet()">닫기</button>
    </div>
    <div id="routineNameBody" class="sheet-scroll-body">
      <div class="loading" style="height:auto;padding:24px 0;"><div class="spinner"></div></div>
    </div>
    <button class="rn-confirm-btn" onclick="confirmRoutineName()">확인</button>
  `);
  try {
    const res = await apiGet({ action: 'searchHistory', subAction: 'getRecentRoutineNames' });
    renderRoutineNameSheet(res.names || []);
  } catch (err) {
    const body = document.getElementById('routineNameBody');
    if (body) body.innerHTML = '<div class="error-card"><h3>오류</h3><p>' + err.message + '</p></div>';
  }
}

function renderRoutineNameSheet(names) {
  const body = document.getElementById('routineNameBody');
  if (!body) return;

  let html = '';
  if (names.length) {
    html += `<div class="search-section-label">최근에 쓴 루틴명</div>`;
    html += `<div class="rn-list">`;
    names.forEach(name => {
      const safe = name.replace(/'/g, '&#39;');
      html += `<button class="rn-item" data-name="${safe}" onclick="selectRoutineName(this)">
                 <span>${name}</span><span class="rn-check">✓</span>
               </button>`;
    });
    html += `</div>`;
  }
  html += `<div class="search-section-label">직접 입력</div>`;
  html += `<input class="rn-direct-input" id="rnDirectInput" placeholder="새 루틴명을 입력하세요" maxlength="20" oninput="onRoutineDirectInput()">`;
  html += `<div class="rn-hint">목록에서 고르거나 직접 입력한 뒤 확인을 누르세요</div>`;
  body.innerHTML = html;
}

// 목록 항목 선택 → 선택 표시 + 직접 입력칸 비움 (A안)
function selectRoutineName(btn) {
  routineNameSelected = btn.getAttribute('data-name') || '';
  document.querySelectorAll('#routineNameBody .rn-item').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const input = document.getElementById('rnDirectInput');
  if (input) input.value = '';
}

// 직접 입력 시작 → 목록 선택 자동 해제 (A안)
function onRoutineDirectInput() {
  routineNameSelected = '';
  document.querySelectorAll('#routineNameBody .rn-item').forEach(b => b.classList.remove('selected'));
}

// 확인 → 마지막에 건드린 값으로 적용
function confirmRoutineName() {
  const input = document.getElementById('rnDirectInput');
  const typed = input ? input.value.trim() : '';
  const finalName = typed || routineNameSelected;
  if (!finalName) { alert('루틴명을 선택하거나 입력해 주세요.'); return; }
  programName = finalName;
  closeBottomSheet();
  renderProgramBadge();
}

/* ── Intro card ────────────────────────────────────────────── */
function toggleIntroCard() {
  const card = document.getElementById('introCard');
  const btn  = document.getElementById('introBtn');
  if (!card) return;
  const isOpen = card.style.display !== 'none';
  card.style.display = isOpen ? 'none' : 'block';
  if (btn) btn.classList.toggle('active', !isOpen);
  if (!isOpen) {
    if (!isFreeWorkout && !introText) {
      fetchRoutineIntro();
    } else {
      updateIntroCardContent();
    }
  }
}
async function fetchRoutineIntro() {
  const textEl = document.getElementById('introCardText');
  if (!textEl) return;
  textEl.innerHTML = '<div class="popup-loading">코치 메시지 불러오는 중...</div>';
  introError = null; // 🆕 재시도 시 이전 에러 초기화
  const condition = document.getElementById('condition')?.value?.trim() || '';
  try {
    const r = await apiPost({ action: 'getCoaching', type: 'intro', missionData: { mission: missionData, condition } });
    introText = r.text || null;
    if (!introText) introError = '코치 메시지를 받지 못했어요.'; // 🆕
  } catch (err) {
    introText = null;
    introError = err.message || '코치 메시지를 불러오는 중 오류가 발생했어요.'; // 🆕 에러 메시지 보존
  }
  updateIntroCardContent();
}
function updateIntroCardContent() {
  const textEl = document.getElementById('introCardText');
  if (!textEl) return;
  if (introText) {
    textEl.innerHTML = introText.replace(/\n/g, '<br>');
  } else if (introError) {
    // 🆕 에러 상태를 "로딩 중"과 구분해서 명확히 보여줌 + 재시도 버튼
    textEl.innerHTML = `
      <div style="color:#ef4444;font-size:14px;line-height:1.6;">
        ⚠️ ${introError}
      </div>
      <button class="free-chat-send-btn" style="margin-top:10px;" onclick="fetchRoutineIntro()">다시 시도</button>`;
  } else if (isFreeWorkout) {
    textEl.innerHTML = `
      <div class="free-chat-area">
        <textarea class="free-chat-textarea" id="freeChatInput" placeholder="오늘 할 운동, 컨디션, 궁금한 것 등 자유롭게 말해줘!"></textarea>
        <button class="free-chat-send-btn" onclick="sendFreeChat()">코치에게 보내기 →</button>
      </div>`;
  } else {
    textEl.innerHTML = '<div class="popup-loading">코치 메시지 불러오는 중...</div>';
  }
}

function onCardDone(id) {
  const idx = exercises.findIndex(ex => ex.id === id);
  if (idx !== -1) {
    const cardEl = document.getElementById('card-' + idx);
    if (cardEl) {
      triggerDoneAnimation(cardEl, () => { completedCards[id] = true; collapsedCards[id] = true; renderCards(); });
      return;
    }
  }
  completedCards[id] = true; collapsedCards[id] = true; renderCards();
}

async function sendFreeChat() {
  const input = document.getElementById('freeChatInput');
  const msg = input?.value?.trim();
  if (!msg) return;
  const condition = document.getElementById('condition')?.value?.trim() || '';
  const btn = document.querySelector('.free-chat-send-btn');
  if (btn) { btn.disabled = true; btn.textContent = '전송 중...'; }
  const textEl = document.getElementById('introCardText');
  if (textEl) textEl.innerHTML = '<div class="popup-loading">코치 메시지 불러오는 중...</div>';
  try {
    const r = await apiPost({ action: 'getCoaching', type: 'freeIntro', missionData: { userMessage: msg, condition } });
    introText = r.text || '(응답 없음)';
    updateIntroCardContent();
  } catch(err) {
    introText = null;
    if (textEl) textEl.innerHTML = `<div style="color:#ef4444;font-size:14px">오류: ${err.message}</div>`;
    if (btn) { btn.disabled = false; btn.textContent = '코치에게 보내기 →'; }
  }
}

