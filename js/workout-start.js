/* ── Popup helper ──────────────────────────────────────────── */
function closePopup(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('popup-container').innerHTML = '';
}

/* ── Background data loading ───────────────────────────────── */
async function loadBackgroundData() {
  const s = getSettings();

  // A) 오늘 미션 캐시가 있으면 네트워크를 기다리지 않고 즉시 렌더 (테스트 모드 제외)
  if (!s.testMode) {
    const cached = readMissionCache();
    if (cached && !cached.error) {
      missionCache   = cached;
      missionLoading = false;
      updateLandingStatus();
    }
  }

  // B) checkWeekStatus와 getMission은 서로 독립적이므로 동시에 발사 (병렬)
  const weekP    = apiGet({ action: 'checkWeekStatus' });
  const missionP = s.testMode ? Promise.resolve(getMockMission())
                              : apiGet({ action: 'getMission' });

  // 주차 상태: 도착하는 대로 반영, 실패해도 미션 흐름을 막지 않음
  weekP.then(res => { weekStatus = res; updateWeekAlert(); }).catch(() => {});

  // 미션: 최신본으로 갱신하고 캐시에 저장 (백그라운드 revalidate)
  try {
    const fresh = await missionP;
    missionCache = fresh;
    if (!s.testMode && fresh && !fresh.error) writeMissionCache(fresh);
  } catch (err) {
    // 네트워크 실패 시 이미 캐시가 있으면 그대로 유지, 없을 때만 에러 표시
    if (!missionCache) missionCache = { error: err.message, exercises: [] };
  }
  missionLoading = false;
  updateLandingStatus();
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

