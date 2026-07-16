/* ── Landing Page ──────────────────────────────────────────── */
function renderLanding() {
  const now  = new Date();
  const y    = now.getFullYear(), m = now.getMonth()+1, d = now.getDate();

  document.getElementById('app').innerHTML = `
    <div class="landing-nav">
      <div class="landing-logo-wrap">
        <span class="landing-logo" style="font-size:28px;letter-spacing:0.05em;text-transform:none;">🏋️핸니의 체육관🏋️</span>
      </div>
      <button class="settings-icon-btn" onclick="renderSettings()" aria-label="설정">⚙️</button>
    </div>
    <div class="landing-date-block" style="margin-bottom: 24px;">
      <div class="landing-date-big">${y}년 ${m}월 ${d}일</div>
    </div>
    <div style="margin-bottom: 10px; display:flex; gap:8px;">
      <button class="routine-nav-btn" onclick="renderRoutineDoc()">📄 운동 루틴</button>
      <button class="routine-nav-btn" onclick="renderSearchHistory()">🔍 기록 검색</button>
    </div>
    <div class="week-alert" id="week-alert">
      <div class="week-alert-eyebrow">📋 주차 미등록</div>
      <div class="week-alert-body">이번 주차 중량 계획이 등록되지 않았어요</div>
      <div class="week-alert-range" id="week-alert-range">-</div>
      <button class="week-alert-btn" id="week-alert-btn" onclick="onRegisterWeek()">스프레드시트에서 등록하기 →</button>
    </div>
    <div class="today-card">
      <div class="today-card-header"><span class="today-card-title">오늘의 운동</span><span id="program-badge-slot"></span></div>
      <div id="today-status-body">
        <div class="skel-wrap">
          <div class="skel" style="width:32%;height:22px"></div>
          <div class="skel" style="width:54%;height:14px;margin-top:4px"></div>
        </div>
      </div>
    </div>
    <div id="start-btn-area">
      <button class="landing-start-btn" id="start-btn" onclick="startWorkout()">운동 시작하기 →</button>
      <button class="landing-ghost-btn" onclick="startFreeWorkout()">🏃 자유 운동하기</button>
    </div>`;
}

function updateLandingStatus() {
  const bodyEl    = document.getElementById('today-status-body');
  const startArea = document.getElementById('start-btn-area');
  if (!bodyEl) return;

  const todayIso = toIso(new Date());
  if (localStorage.getItem('gc_done_' + todayIso)) {
    const rName   = missionCache?.routineName || '';
    const display = rName.includes(':') ? rName.split(':').slice(1).join(':').trim() : rName;
    bodyEl.innerHTML = `
      <div class="status-rest-emoji">✅</div>
      <div class="status-rest-title" style="color:var(--green);">오늘 운동 완료!</div>
      <div class="status-rest-sub">${display || '수고했어요'} · 오늘도 잘 해냈어요 💪</div>`;
    if (startArea) startArea.innerHTML =
      `<button class="landing-ghost-btn" onclick="startWorkout()">다시 시작하기</button>
       <button class="landing-ghost-btn" onclick="startFreeWorkout()">🏃 자유 운동하기</button>`;
    return;
  }

  if (isRestDayToday()) {
    const s = getSettings(), w = getThisWeekRange();
    const isCustom = s.restDays.weekRange === w.range && s.restDays.days.includes(toIso(new Date()));
    bodyEl.innerHTML = `
      <div class="status-rest-emoji">💤</div>
      <div class="status-rest-title">오늘은 쉬는 날</div>
      <div class="status-rest-sub">${isCustom ? '일정으로 지정한 휴식일이에요' : '회복도 훈련이에요'}</div>`;
    if (startArea) startArea.innerHTML =
      `<button class="landing-ghost-btn" onclick="startWorkout()">그래도 시작하기</button>`;
    return;
  }

  if (!missionCache || missionCache.error) return;

  const count  = missionCache.exercises?.length || 0;
  const rName  = missionCache.routineName || '';
  const display = rName.includes(':') ? rName.split(':').slice(1).join(':').trim() : rName;
  const slot = document.getElementById('program-badge-slot');
  if (slot) slot.innerHTML = `<span class="status-badge">${display}</span>`;
  bodyEl.innerHTML = buildBodyPartSummary(missionCache.exercises);
}

function buildBodyPartSummary(exercises) {
  if (!exercises || exercises.length === 0) return '';

  const partEmoji = {
    '가슴': '🫁', '등': '🔙', '등/전신': '🔙', '하체': '🦵',
    '어깨': '🏋️', '팔': '💪', '이두': '💪', '삼두': '💪',
    '전신': '🔥', '슈퍼세트': '⚡'
  };

  const groups = {}, order = [];
  exercises.forEach(ex => {
    const key = ex.isSuperset ? '슈퍼세트' : (ex.bodyPart || '기타');
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(ex);
  });

  let html = '<div class="summary-wrap">';
  order.forEach(part => {
    const emoji = partEmoji[part] || '🏋️';
    html += `<div class="summary-group"><div class="summary-part-title">${emoji} ${part}</div>`;
    groups[part].forEach(ex => {
      if (ex.isSuperset) {
        (ex.subExercises || []).forEach(sub => {
          const partTag = sub.bodyPart ? `<span class="summary-item-part">[${sub.bodyPart}]</span> ` : '';
          // 🆕 조합된 이름으로 표시
          const displayName = buildDisplayName(sub.name, sub.variation);
          const info = (sub.targetWeight > 0 && sub.targetReps > 0)
            ? `${ex.sets}세트 × ${sub.targetWeight}kg × ${sub.targetReps}회` : `${ex.sets}세트`;
          html += `<div class="summary-item">• ${partTag}${displayName}: ${info}</div>`;
        });
      } else {
        // 🆕 조합된 이름으로 표시
        const displayName = buildDisplayName(ex.name, ex.variation);
        const info = (ex.targetWeight > 0 && ex.targetReps > 0)
          ? `${ex.sets}세트 × ${ex.targetWeight}kg × ${ex.targetReps}회` : `${ex.sets}세트`;
        html += `<div class="summary-item">• ${displayName}: ${info}</div>`;
      }
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function updateWeekAlert() {
  const alertEl = document.getElementById('week-alert');
  if (!alertEl || !weekStatus) return;
  if (!weekStatus.registered) {
    alertEl.classList.add('show');
    const rangeEl = document.getElementById('week-alert-range');
    if (rangeEl) rangeEl.textContent = weekStatus.weekRange;
  }
}

async function onRegisterWeek() {
  const btn = document.getElementById('week-alert-btn');
  if (btn) { btn.disabled = true; btn.textContent = '등록 중...'; }
  try {
    const result = await apiPost({ action: 'registerWeek' });
    if (result.success) {
      const { sheetUrl } = getSettings();
      if (sheetUrl && btn) {
        btn.outerHTML = `<a href="${sheetUrl}" target="_blank" class="week-alert-btn" style="display:block;text-align:center;text-decoration:none;">✓ 등록됐어요! 스프레드시트 열기 →</a>`;
      } else if (btn) {
        btn.textContent = '✓ 등록됐어요!';
        btn.disabled = true;
        setTimeout(() => {
          const el = document.getElementById('week-alert');
          if (el) el.classList.remove('show');
        }, 1800);
      }
    }
  } catch(err) {
    if (btn) { btn.disabled = false; btn.textContent = '스프레드시트에서 등록하기 →'; }
    alert('오류: ' + err.message);
  }
}

