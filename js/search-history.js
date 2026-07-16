/* ── Search History ────────────────────────────────────────── */
async function renderSearchHistory() {
  pushPage('search');
  searchDaySelected  = null;
  searchDates        = [];
  searchDateSelected = null;
  searchExSelected   = null;

  document.getElementById('app').innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;width:100%;">
      <div style="display:flex;align-items:center;gap:14px;">
        <button class="back-btn" onclick="history.back()">← 뒤로</button>
        <span class="page-title">기록 검색</span>
      </div>
      <span class="logo" style="font-size:16px;font-weight:900;letter-spacing:0.03em;text-transform:none;">🏋️핸니의 체육관🏋️</span>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button class="search-tab-btn${searchTab==='day'?' active':''}" id="tab-day" onclick="switchSearchTab('day')">📅 요일별</button>
      <button class="search-tab-btn${searchTab==='exercise'?' active':''}" id="tab-exercise" onclick="switchSearchTab('exercise')">🏋️ 종목별</button>
    </div>
    <div id="search-body"></div>`;

  await renderSearchBody();
}

async function switchSearchTab(tab) {
  searchTab          = tab;
  searchDaySelected  = null;
  searchDates        = [];
  searchDateSelected = null;
  searchExSelected   = null;
  document.querySelectorAll('.search-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  await renderSearchBody();
}

async function renderSearchBody() {
  const body = document.getElementById('search-body');
  if (!body) return;
  if (searchTab === 'day') {
    renderSearchDayTab(body);
  } else {
    await loadSearchExerciseTab(body);
  }
}

/* ── 요일별 탭 ─────────────────────────────────────────────── */
function renderSearchDayTab(body) {
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  let html = `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">`;
  days.forEach(d => {
    html += `<button class="search-day-btn${searchDaySelected===d?' active':''}" onclick="onSelectDay('${d}')">${d}요일</button>`;
  });
  html += `</div><div id="search-day-result"></div>`;
  body.innerHTML = html;
  if (searchDaySelected) renderSearchDayResult();
}

async function onSelectDay(day) {
  searchDaySelected  = day;
  searchDateSelected = null;
  searchDates        = [];
  document.querySelectorAll('.search-day-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === day + '요일');
  });
  const resultEl = document.getElementById('search-day-result');
  if (!resultEl) return;
  resultEl.innerHTML = '<div class="loading" style="height:auto;padding:24px 0;"><div class="spinner"></div></div>';
  try {
    const res = await apiGet({ action: 'searchHistory', subAction: 'getDayList', day });
    searchDates = res.dates || [];
    renderSearchDayResult();
  } catch(err) {
    resultEl.innerHTML = `<div class="error-card"><h3>오류</h3><p>${err.message}</p></div>`;
  }
}

function renderSearchDayResult() {
  const resultEl = document.getElementById('search-day-result');
  if (!resultEl) return;

  if (searchDates.length === 0) {
    resultEl.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--text2);font-size:14px;">${searchDaySelected}요일 운동 기록이 없어요</div>`;
    return;
  }

  const fmtKor = iso => {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getMonth()+1}월 ${d.getDate()}일`;
  };

  let html = `<div class="search-section-label">${searchDaySelected}요일 기록</div>`;
  searchDates.forEach(date => {
    html += `<button class="search-date-item${searchDateSelected===date?' active':''}" onclick="onSelectDate('${date}')">${fmtKor(date)} <span style="color:var(--text3);font-size:12px;margin-left:6px;">${date}</span></button>`;
  });
  html += `<div id="search-date-result" style="margin-top:4px;"></div>`;
  resultEl.innerHTML = html;

  if (searchDateSelected) loadAndRenderDateResult(searchDateSelected);
}

async function onSelectDate(date) {
  searchDateSelected = date;
  document.querySelectorAll('.search-date-item').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${date}'`));
  });
  const resultEl = document.getElementById('search-date-result');
  if (!resultEl) { renderSearchDayResult(); return; }
  await loadAndRenderDateResult(date);
}

async function loadAndRenderDateResult(date) {
  const resultEl = document.getElementById('search-date-result');
  if (!resultEl) return;
  resultEl.innerHTML = '<div class="loading" style="height:auto;padding:20px 0;"><div class="spinner"></div></div>';
  try {
    const res = await apiGet({ action: 'searchHistory', subAction: 'getByDate', date });
    renderDateResult(resultEl, res);
  } catch(err) {
    resultEl.innerHTML = `<div class="error-card"><h3>오류</h3><p>${err.message}</p></div>`;
  }
}

function renderDateResult(el, res) {
  const exList = res.exercises || [];
  if (exList.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--text2);font-size:14px;">운동 기록이 없어요</div>`;
    return;
  }
  let html = '';
  exList.forEach(ex => {
    const weights = ex.weights ? String(ex.weights).split(',') : [];
    const reps    = ex.reps    ? String(ex.reps).split(',')    : [];
    const sets    = Math.max(weights.length, reps.length);
    let setsHTML  = '';
    for (let i = 0; i < sets; i++) {
      const w = weights[i]?.trim() || '-';
      const r = reps[i]?.trim()    || '-';
      setsHTML += `<div class="search-result-set">${i+1}세트 &nbsp;&nbsp; ${w}kg × ${r}회</div>`;
    }
    // 🆕 검색 결과에서도 조합된 이름 표시
    const displayName = buildDisplayName(ex.name, ex.variation);
    html += `
      <div class="search-result-card">
        <div class="search-result-name">${displayName}</div>
        <div class="search-result-target">🎯 ${ex.targetWeight||'-'}kg × ${ex.targetReps||'-'}회 × ${ex.targetSets||'-'}세트</div>
        ${setsHTML}
        ${ex.memo ? `<div style="margin-top:8px;font-size:12px;color:var(--text2);white-space:pre-wrap;">📝 ${ex.memo}</div>` : ''}
      </div>`;
  });
  el.innerHTML = html;
}

/* ── 종목별 탭 ─────────────────────────────────────────────── */
async function loadSearchExerciseTab(body) {
  body.innerHTML = '<div class="loading" style="height:auto;padding:24px 0;"><div class="spinner"></div><div class="loading-text" style="margin-top:12px;">최근 4주 종목 불러오는 중...</div></div>';
  try {
    const res = await apiGet({ action: 'searchHistory', subAction: 'getExerciseList' });
    renderSearchExerciseTab(body, res.exercises || []);
  } catch(err) {
    body.innerHTML = `<div class="error-card"><h3>오류</h3><p>${err.message}</p></div>`;
  }
}

function renderSearchExerciseTab(body, exList) {
  if (exList.length === 0) {
    body.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--text2);font-size:14px;">최근 4주 운동 기록이 없어요</div>`;
    return;
  }
  const groups = {}, order = [];
  exList.forEach(ex => {
    const part = (typeof ex === 'string') ? '기타' : (ex.bodyPart || '기타');
    const name = (typeof ex === 'string') ? ex : ex.name;
    const variation = (typeof ex === 'string') ? '' : (ex.variation || '');
    if (!groups[part]) { groups[part] = []; order.push(part); }
    groups[part].push({ name, variation });
  });
  let html = `<div class="search-section-label">최근 4주 종목</div>`;
  order.forEach(part => {
    html += `<div style="margin-bottom:14px;">`;
    html += `<div style="font-size:11px;font-weight:800;color:var(--text2);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">${part}</div>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:8px;">`;
    groups[part].forEach(({ name, variation }) => {
      // 🆕 조합된 이름으로 버튼 표시
      const displayName = buildDisplayName(name, variation);
      const safeName = name.replace(/'/g, '&#39;');
      html += `<button class="search-ex-btn${searchExSelected===name?' active':''}" data-name="${safeName}" onclick="onSelectExercise(this.dataset.name, this)">${displayName}</button>`;
    });
    html += `</div></div>`;
  });
  html += `<div id="search-ex-result"></div>`;
  body.innerHTML = html;
  if (searchExSelected) loadAndRenderExerciseResult(searchExSelected);
}

async function onSelectExercise(exerciseName, btn) {
  searchExSelected = exerciseName;
  document.querySelectorAll('.search-ex-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const resultEl = document.getElementById('search-ex-result');
  if (!resultEl) return;
  resultEl.innerHTML = '<div class="loading" style="height:auto;padding:20px 0;"><div class="spinner"></div></div>';
  await loadAndRenderExerciseResult(exerciseName);
}

async function loadAndRenderExerciseResult(exerciseName) {
  const resultEl = document.getElementById('search-ex-result');
  if (!resultEl) return;
  try {
    const res = await apiGet({ action: 'searchHistory', subAction: 'getByExercise', exerciseName });
    renderExerciseResult(resultEl, res);
  } catch(err) {
    resultEl.innerHTML = `<div class="error-card"><h3>오류</h3><p>${err.message}</p></div>`;
  }
}

function renderExerciseResult(el, res) {
  const results = res.results || [];
  if (results.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--text2);font-size:14px;">최근 4주 기록이 없어요</div>`;
    return;
  }
  const fmtKor = iso => {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getMonth()+1}월 ${d.getDate()}일`;
  };
  let html = `<div class="search-section-label">최근 4주 기록</div>`;
  results.forEach(r => {
    const weights = r.weights ? String(r.weights).split(',') : [];
    const reps    = r.reps    ? String(r.reps).split(',')    : [];
    const sets    = Math.max(weights.length, reps.length);
    let setsHTML  = '';
    for (let i = 0; i < sets; i++) {
      const w  = weights[i]?.trim() || '-';
      const rp = reps[i]?.trim()    || '-';
      setsHTML += `<div class="search-result-set">${i+1}세트 &nbsp;&nbsp; ${w}kg × ${rp}회</div>`;
    }
    html += `
      <div class="search-result-card">
        <div class="search-result-date">📅 ${fmtKor(r.date)} (${r.day})</div>
        <div class="search-result-target">🎯 ${r.targetWeight||'-'}kg × ${r.targetReps||'-'}회 × ${r.targetSets||'-'}세트</div>
        ${setsHTML}
        ${r.memo ? `<div style="margin-top:8px;font-size:12px;color:var(--text2);white-space:pre-wrap;">📝 ${r.memo}</div>` : ''}
      </div>`;
  });
  el.innerHTML = html;
}

