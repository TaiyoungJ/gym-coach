function formatRest(data) {
  if (!data) return '';
  const min = data.min ? parseInt(data.min) : 0;
  const sec = data.sec ? parseInt(data.sec) : 0;
  if (!min && !sec) return '';
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/* ── Done Animation ────────────────────────────────────────── */
function triggerDoneAnimation(cardEl, callback) {
  cardEl.classList.add('card-glow');
  const rect   = cardEl.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.top  + rect.height / 2;
  const colors = ['#FF8C42','#22C55E','#60A5FA','#F59E0B','#EC4899','#A78BFA','#fff'];
  for (let i = 0; i < 28; i++) {
    const el    = document.createElement('div');
    el.className = 'confetti-piece';
    const angle = Math.random() * Math.PI * 2;
    const dist  = 60 + Math.random() * 110;
    const dx    = Math.cos(angle) * dist;
    const dy    = Math.sin(angle) * dist - 80;
    const size  = 5 + Math.random() * 7;
    const dur   = 450 + Math.random() * 500;
    el.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;width:' + size + 'px;height:' + size + 'px;background:' + colors[Math.floor(Math.random() * colors.length)] + ';';
    document.body.appendChild(el);
    el.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) rotate(' + (Math.random()*720 - 360) + 'deg)', opacity: 0 }
      ],
      { duration: dur, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => el.remove();
  }
  setTimeout(() => {
    cardEl.classList.remove('card-glow');
    if (callback) callback();
  }, 620);
}

/* ── Slide Complete Button ────────────────────────────────── */
function updateSlideBtn() {
  const wrap  = document.getElementById('slideWrap');
  const label = document.getElementById('slideLabel');
  if (!wrap) return;
  const allDone = exercises.length > 0 && exercises.every(ex => completedCards[ex.id] || skipped[ex.id]);
  wrap.classList.toggle('ready', allDone);
  if (label) label.textContent = allDone ? '밀어서 운동 완료 →' : '모든 운동을 완료해주세요';
}

function initSlideBtn() {
  const wrap   = document.getElementById('slideWrap');
  const handle = document.getElementById('slideHandle');
  if (!wrap || !handle) return;
  let startX = 0, offsetX = 0, dragging = false;
  const getMax = () => wrap.offsetWidth - handle.offsetWidth - 8;

  function dragStart(x) {
    if (!wrap.classList.contains('ready')) return;
    dragging = true;
    startX = x - offsetX;
  }
  function dragMove(x) {
    if (!dragging) return;
    const nx = Math.max(0, Math.min(x - startX, getMax()));
    offsetX = nx;
    handle.style.transform = 'translateX(' + nx + 'px)';
    if (nx >= getMax() * 0.85) {
      dragging = false; offsetX = 0;
      handle.style.transform = '';
      onComplete();
    }
  }
  function dragEnd() {
    if (!dragging) return;
    dragging = false; offsetX = 0;
    handle.style.transition = 'transform 0.2s';
    handle.style.transform = '';
    setTimeout(() => { handle.style.transition = ''; }, 220);
  }

  handle.addEventListener('touchstart', e => dragStart(e.touches[0].clientX), { passive: true });
  handle.addEventListener('touchmove',  e => { e.preventDefault(); dragMove(e.touches[0].clientX); }, { passive: false });
  handle.addEventListener('touchend', dragEnd);
  handle.addEventListener('mousedown', e => dragStart(e.clientX));
  document.addEventListener('mousemove', e => { if (dragging) dragMove(e.clientX); });
  document.addEventListener('mouseup', dragEnd);
}

/* ── Complete ──────────────────────────────────────────────── */
async function onComplete() {
  const results = exercises.map(ex => {
    if (ex.isSuperset) {
      return {
        // 🆕 name은 원래 운동명, variation 분리 유지
        name: ex.name, variation: ex.variation||'', isSuperset: true, sets: ex.sets,
        memo:    skipped[ex.id] ? '(생략)' : (memoData[ex.id]?.trim()||''),
        rest:    skipped[ex.id] ? '' : formatRest(restData[ex.id]),
        skipped: !!skipped[ex.id],
        subResults: (ex.subExercises || []).map((sub, si) => ({
          name:      sub.name,
          variation: sub.variation || '',
          weight:    sub.targetWeight || 0,
          targetReps: sub.targetReps || 0,
          weights: Array.from({ length: ex.sets }, (_, s) => { const v = weightData[`${ex.id}_${si}`]?.[s+1]; return (v !== undefined && v !== '') ? parseFloat(v) : (sub.targetWeight||0); }),
          reps:    Array.from({ length: ex.sets }, (_, s) => { const v = repsData[`${ex.id}_${si}`]?.[s+1]; return v ? parseInt(v) : 0; }),
        })),
      };
    }
    return {
      // 🆕 name은 원래 운동명, variation 분리 유지
      name:      ex.name,
      variation: ex.variation || '',
      sets:      ex.sets,
      weight:    ex.targetWeight || 0,
      targetReps: ex.targetReps || 0,
      weights: Array.from({ length: ex.sets }, (_, s) => { const v = weightData[ex.id]?.[s+1]; return (v !== undefined && v !== '') ? parseFloat(v) : (ex.targetWeight||0); }),
      reps:    Array.from({ length: ex.sets }, (_, s) => { const v = repsData[ex.id]?.[s+1]; return v ? parseInt(v) : 0; }),
      memo:    skipped[ex.id] ? '(생략)' : (memoData[ex.id]?.trim()||''),
      rest:    skipped[ex.id] ? '' : formatRest(restData[ex.id]),
      skipped: !!skipped[ex.id],
    };
  });
  const condition = document.getElementById('condition')?.value?.trim() || '';
  const completeArea = document.getElementById('completeArea');
  if (completeArea) completeArea.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);font-size:14px;font-weight:700;">저장 중...</div>';

  // 1단계: 운동 결과 저장 — 실패 시 슬라이드 버튼 복구 후 중단
  try {
    await apiPost({ action: 'saveResult', data: { date: missionData.date, day: missionData.day, routineName: programName, results } });
    localStorage.setItem('gc_done_' + missionData.date, '1');
  } catch(err) {
    if (completeArea) { completeArea.innerHTML = '<div class="slide-wrap ready" id="slideWrap"><div class="slide-handle" id="slideHandle">›</div><span class="slide-label" id="slideLabel">밀어서 운동 완료 →</span></div>'; initSlideBtn(); }
    alert('오류: ' + err.message);
    return;
  }

  // 2단계: AI 피드백 — 실패해도 일지 저장은 가능
  if (completeArea) completeArea.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2);font-size:14px;font-weight:700;">피드백 받는 중...</div>';
  let outroText = '오늘도 수고했어! 💪';
  let outroSummary = '';

  try {
    const outroType = isFreeWorkout ? 'freeOutro' : 'outro';
    const outroPayload = isFreeWorkout
      ? { results, condition }
      : { mission: missionData, results, condition };
    const outro = await apiPost({ action: 'getCoaching', type: outroType, missionData: outroPayload });
    outroText = outro.text || '오늘도 수고했어! 💪';
    outroSummary = outro.summary || '';
  } catch(err) {
    // AI 호출 실패 — 기본값으로 계속 진행
  }

  outroWorkoutData = {
    date:             missionData.date,
    day:              missionData.day,
    routineName:      programName,
    results,
    condition,
    outroSummary,
    conditionSummary: condition
  };
  const outroEl = document.createElement('div');
  outroEl.className = 'outro-card';
  outroEl.innerHTML = `
      <div class="outro-label">🔥 오늘의 피드백</div>
      <div class="outro-text">${outroText}</div>
      <button id="logSaveBtn" class="done-btn" style="margin-top:14px;" onclick="onSaveWorkoutLog()">📝 운동일지 저장</button>
      <button class="complete-btn" style="margin-top: 14px; background: linear-gradient(135deg, #22C55E, #15803D); color: #000;" onclick="history.back()">끝</button>
    `;
  completeArea.replaceWith(outroEl);
  outroEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Save Workout Log ──────────────────────────────────────── */
async function onSaveWorkoutLog() {
  const btn = document.getElementById('logSaveBtn');
  if (!btn || !outroWorkoutData) return;
  btn.disabled = true;
  btn.textContent = '저장 중...';
  try {
    const res = await apiPost({ action: 'saveWorkoutLog', data: outroWorkoutData });
    if (res.error) throw new Error(res.error);
    btn.textContent = '✅ 저장 완료!';
    btn.style.borderColor = 'rgba(34,197,94,0.5)';
    btn.style.color = 'var(--green)';
  } catch(err) {
    btn.disabled = false;
    btn.textContent = '📝 운동일지 저장';
    alert('오류: ' + err.message);
  }
}

