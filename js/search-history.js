/* ── Search History ────────────────────────────────────────── */
async function renderSearchHistory(skipPush) {
  // skipPush: 회전 등으로 레이아웃만 다시 그릴 때 히스토리 항목을 중복 추가하지 않기 위함
  if (skipPush) setPageClass('search'); else pushPage('search');
  searchDaySelected  = null;
  searchDates        = [];
  searchDateSelected = null;
  searchExSelected   = null;
  searchExVariation  = '';
  searchExWeeks      = 4;
  searchExMetric     = 'maxWeight';
  searchExView       = 'chart';
  searchExResults    = [];

  getRenderRoot().innerHTML = `
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
  searchExVariation  = '';
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
// 3단 구조(요일 → 날짜 목록 → 기록 상세)를 형제 요소로 배치한다.
// 폰에서는 세로로 쌓여 기존과 동일하게 보이고, 태블릿에서는 CSS 그리드가 좌우로 펼친다.
function renderSearchDayTab(body) {
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  let dayBtns = '';
  days.forEach(d => {
    dayBtns += `<button class="search-day-btn${searchDaySelected===d?' active':''}" onclick="onSelectDay('${d}')">${d}요일</button>`;
  });
  body.innerHTML = `
    <div class="search-layout search-layout-day">
      <div class="search-pane search-pane-nav">
        <div class="search-day-picker">${dayBtns}</div>
      </div>
      <div class="search-pane search-pane-list" id="search-day-result"></div>
      <div class="search-pane search-pane-detail" id="search-date-result"></div>
    </div>`;
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
  const detailEl = document.getElementById('search-date-result');
  if (detailEl) detailEl.innerHTML = ''; // 요일이 바뀌면 이전 날짜 상세는 비운다
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
  resultEl.innerHTML = html; // 상세는 형제 패널(#search-date-result)이 담당

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
  searchExListCache = exList;
  // 태블릿에서는 오른쪽 패널에 결과를 펼치고, 폰에서는 이 패널이 비어 있는 채로 바텀시트를 쓴다.
  // 왼쪽 단은 아코디언 토글 시 혼자만 다시 그려야 오른쪽 패널이 날아가지 않으므로 buildExNavHtml 로 분리.
  body.innerHTML = `
    <div class="search-layout search-layout-ex">
      <div class="search-pane search-pane-nav" id="search-ex-nav">${buildExNavHtml()}</div>
      <div class="search-pane search-pane-detail" id="search-ex-panel"></div>
    </div>`;
}

// 왼쪽 종목 아코디언 HTML. searchExListCache 를 부위별로 묶어 부위 헤더 + 접이식 하위 목록으로 만든다.
function buildExNavHtml() {
  const groups = {}, order = [];
  let activePart = null;
  searchExListCache.forEach(ex => {
    const part = (typeof ex === 'string') ? '기타' : (ex.bodyPart || '기타');
    const name = (typeof ex === 'string') ? ex : ex.name;
    const variation = (typeof ex === 'string') ? '' : (ex.variation || '');
    if (!groups[part]) { groups[part] = []; order.push(part); }
    groups[part].push({ name, variation });
    if (searchExSelected === name && searchExVariation === (variation || '')) activePart = part;
  });

  // 어떤 부위를 펼칠지: 사용자가 명시적으로 접었으면(__none__) 모두 닫고,
  // 특정 부위를 지정했으면 그 부위, 아니면 활성 종목이 속한 부위(없으면 첫 부위)를 연다.
  let openPart;
  if (searchExOpenPart === '__none__') openPart = null;
  else if (searchExOpenPart && order.includes(searchExOpenPart)) openPart = searchExOpenPart;
  else openPart = activePart || order[0];

  let html = `<div class="search-section-label">최근 ${searchExWeeks}주 종목</div>`;
  order.forEach(part => {
    const isOpen = part === openPart;
    let btns = '';
    groups[part].forEach(({ name, variation }) => {
      const displayName = buildDisplayName(name, variation);
      const safeName = name.replace(/"/g, '&quot;');
      const safeVar  = (variation || '').replace(/"/g, '&quot;');
      const isActive = searchExSelected === name && searchExVariation === (variation || '');
      btns += `<button class="search-ex-btn${isActive?' active':''}" data-name="${safeName}" data-variation="${safeVar}" onclick="onSelectExercise(this.dataset.name, this, this.dataset.variation)">${displayName}</button>`;
    });
    const safePart = part.replace(/"/g, '&quot;');
    html += `<div class="ex-acc${isOpen?' open':''}" data-part="${safePart}">
      <button class="ex-acc-head" onclick="toggleExPart('${safePart}')"><span class="ex-acc-title">${part}</span><span class="ex-acc-caret">▾</span></button>
      <div class="ex-acc-body"><div class="search-ex-group">${btns}</div></div>
    </div>`;
  });
  return html;
}

// 부위 헤더 클릭 → 아코디언 토글. 이미 열린 부위면 접고, 아니면 그 부위만 연다(한 번에 하나).
// 왼쪽 단만 다시 그려 오른쪽 상세 패널을 보존한다.
function toggleExPart(part) {
  const nav = document.getElementById('search-ex-nav');
  const curOpen = nav ? nav.querySelector('.ex-acc.open')?.dataset.part : null;
  searchExOpenPart = (curOpen === part) ? '__none__' : part;
  if (nav) nav.innerHTML = buildExNavHtml();
}

async function onSelectExercise(exerciseName, btn, variation) {
  searchExSelected  = exerciseName;
  searchExVariation = variation || '';
  document.querySelectorAll('.search-ex-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const safeTitle = String(buildDisplayName(exerciseName, searchExVariation)).replace(/</g, '&lt;');
  const bodyShell = `<div id="search-ex-sheet-body" class="sheet-scroll-body"><div class="loading" style="height:auto;padding:24px 0;"><div class="spinner"></div></div></div>`;

  // 태블릿: 팝업 대신 오른쪽 패널에 인라인으로 펼침 (본문 id를 그대로 써서 하위 로직 공유)
  const panel = isTablet() ? document.getElementById('search-ex-panel') : null;
  if (panel) {
    panel.innerHTML = `<div class="search-ex-inline">
      <div class="popup-header"><span class="popup-label">${safeTitle}</span></div>
      ${bodyShell}
    </div>`;
  } else {
    openBottomSheet(`
      <div class="popup-header">
        <span class="popup-label">${safeTitle}</span>
        <button class="popup-close" onclick="closeBottomSheet()">닫기</button>
      </div>
      ${bodyShell}
    `);
  }
  await loadAndRenderExerciseResult(exerciseName);
}

async function loadAndRenderExerciseResult(exerciseName) {
  const resultEl = document.getElementById('search-ex-sheet-body');
  if (!resultEl) return;
  try {
    const res = await apiGet({ action: 'searchHistory', subAction: 'getByExercise', exerciseName, variation: searchExVariation, weeks: searchExWeeks });
    renderExerciseResult(resultEl, res);
  } catch(err) {
    resultEl.innerHTML = `<div class="error-card"><h3>오류</h3><p>${err.message}</p></div>`;
  }
}

// 기간 프리셋 변경 → 서버 재조회
async function onSelectExWeeks(weeks) {
  searchExWeeks = weeks;
  const resultEl = document.getElementById('search-ex-sheet-body');
  if (resultEl) resultEl.innerHTML = '<div class="loading" style="height:auto;padding:24px 0;"><div class="spinner"></div></div>';
  await loadAndRenderExerciseResult(searchExSelected);
}

// 차트/목록 뷰 전환 → 재조회 없이 캐시로 재렌더 (지표 토글 행 노출 여부가 뷰에 따라 달라져 전체 셸 재렌더)
function onSelectExView(view) {
  searchExView = view;
  renderExerciseResult(document.getElementById('search-ex-sheet-body'), { results: searchExResults });
}

// 지표(최고중량/볼륨) 전환 → 재조회 없이 콘텐츠 영역만 재렌더
function onSelectExMetric(metric) {
  searchExMetric = metric;
  // 지표 칩은 #search-ex-content 바깥에 있어 콘텐츠 재렌더로는 갱신되지 않는다
  document.querySelectorAll('.day-chip[onclick*="onSelectExMetric"]').forEach(b => {
    b.classList.toggle('on', (b.getAttribute('onclick') || '').includes(`'${metric}'`));
  });
  renderExerciseResultContent();
}

function renderExerciseResult(el, res) {
  if (!el) return;
  searchExResults = res.results || [];

  // 태블릿: 기간/지표 토글이 차트 카드 내부 헤더로 들어가므로 위쪽 컨트롤 행이 없다.
  // 결과가 비어도 차트 카드(+헤더 토글)는 렌더해 기간을 바꿔볼 수 있게 한다.
  if (isTablet()) {
    el.innerHTML = `<div id="search-ex-content"></div>`;
    renderExerciseResultContent();
    return;
  }

  // ── 폰 경로 (기존 유지) ──
  if (searchExResults.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--text2);font-size:14px;">최근 ${searchExWeeks}주 기록이 없어요</div>`;
    // 결과가 없어도 기간은 바꿔볼 수 있도록 기간 버튼 행은 위에 유지
    el.insertAdjacentHTML('afterbegin', buildWeeksRowHtml());
    return;
  }
  const viewRow = `
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      <button class="search-tab-btn${searchExView==='chart'?' active':''}" onclick="onSelectExView('chart')">📈 차트</button>
      <button class="search-tab-btn${searchExView==='list'?' active':''}" onclick="onSelectExView('list')">📋 목록</button>
    </div>`;
  const metricRow = (searchExView === 'chart') ? `<div class="day-chips" style="margin-bottom:12px;">
      <button class="day-chip${searchExMetric==='maxWeight'?' on':''}" onclick="onSelectExMetric('maxWeight')">최고 중량</button>
      <button class="day-chip${searchExMetric==='volume'?' on':''}" onclick="onSelectExMetric('volume')">총 볼륨</button>
    </div>` : '';

  el.innerHTML = `
    ${buildWeeksRowHtml()}
    ${viewRow}
    ${metricRow}
    <div id="search-ex-content"></div>`;
  renderExerciseResultContent();
}

function buildWeeksRowHtml() {
  return `<div class="day-chips" style="margin-top:0;margin-bottom:12px;">
    ${[4,8,12,24].map(w => `<button class="day-chip${searchExWeeks===w?' on':''}" onclick="onSelectExWeeks(${w})">${w}주</button>`).join('')}
  </div>`;
}

function renderExerciseResultContent() {
  const contentEl = document.getElementById('search-ex-content');
  if (!contentEl) return;

  const chartHtml = () => buildTrendChartHtml(computeChartPoints(searchExResults, searchExMetric), searchExMetric);

  // 태블릿: 차트(위)와 기록 목록(아래)을 한 열로 스택. 기간/지표 토글은 차트 카드 내부 헤더에.
  if (isTablet()) {
    contentEl.innerHTML = `<div class="ex-dual">
      <div class="ex-dual-chart">
        <div class="chart-card">
          <div class="chart-head">
            ${buildChartToggle('metric')}
            ${buildChartToggle('week')}
          </div>
          ${chartHtml()}
        </div>
      </div>
      <div class="ex-dual-list">${buildExerciseListHtml(searchExResults)}</div>
    </div>`;
    return;
  }
  contentEl.innerHTML = searchExView === 'chart' ? chartHtml() : buildExerciseListHtml(searchExResults);
}

// ── 차트 헤더 접이식 토글 (지표/주차) ──────────────────────────
// 평소엔 현재값 칩만 보이고, 클릭하면 나머지 옵션이 애니메이션으로 펼쳐진다.
// metric 은 왼쪽 정렬(오른쪽으로 펼침), week 는 오른쪽 정렬(왼쪽으로 펼침).
function buildChartToggle(kind) {
  const opts = kind === 'week'
    ? [[4, '4주'], [8, '8주'], [12, '12주'], [24, '24주']]
    : [['maxWeight', '최고 중량'], ['volume', '총 볼륨']];
  const current = kind === 'week' ? searchExWeeks : searchExMetric;
  const btns = opts.map(([val, label]) => {
    const isCur = String(val) === String(current);
    const arg = (typeof val === 'number') ? val : `'${val}'`;
    return `<button class="ct-opt${isCur ? ' cur' : ''}" onclick="event.stopPropagation();onChartTogglePick('${kind}',${arg},this)">${label}</button>`;
  }).join('');
  return `<div class="chart-toggle ct-${kind}" data-open="false" onclick="onChartToggleOpen(this)">${btns}<span class="ct-caret">▾</span></div>`;
}

function onChartToggleOpen(el) {
  const willOpen = el.dataset.open !== 'true';
  closeChartToggles();               // 한 번에 하나만 열려 있게
  el.dataset.open = willOpen ? 'true' : 'false';
}

function closeChartToggles() {
  document.querySelectorAll('.chart-toggle').forEach(t => { t.dataset.open = 'false'; });
}

// 옵션 클릭. 토글이 닫혀 있으면(=현재값 칩만 보임) 선택 대신 "펼치기"로 동작한다.
// 열려 있을 때만 실제 선택 → 값이 바뀌면 재조회/재렌더로 토글이 새로 그려지며 접힘.
function onChartTogglePick(kind, val, btn) {
  const tog = btn && btn.closest('.chart-toggle');
  if (tog && tog.dataset.open !== 'true') {
    closeChartToggles();          // 한 번에 하나만 열려 있게
    tog.dataset.open = 'true';
    return;
  }
  if (kind === 'week') {
    if (val === searchExWeeks) { closeChartToggles(); return; }
    onSelectExWeeks(val);
  } else {
    if (val === searchExMetric) { closeChartToggles(); return; }
    onSelectExMetric(val);
  }
}

function fmtKorDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth()+1}월 ${d.getDate()}일`;
}

// 세트 배열(무게/횟수 문자열)을 목록/상세용 HTML로 포맷
function formatSetsHtml(weights, reps) {
  const sets = Math.max(weights.length, reps.length);
  let html = '';
  for (let i = 0; i < sets; i++) {
    const w  = weights[i]?.trim() || '-';
    const rp = reps[i]?.trim()    || '-';
    html += `<div class="search-result-set">${i+1}세트 &nbsp;&nbsp; ${w}kg × ${rp}회</div>`;
  }
  return html;
}

// 세트 배열을 호버 툴팁(SVG <title>)용 여러 줄 텍스트로 포맷
function formatSetsPlain(weights, reps) {
  const sets = Math.max(weights.length, reps.length);
  const lines = [];
  for (let i = 0; i < sets; i++) {
    const w  = weights[i]?.trim() || '-';
    const rp = reps[i]?.trim()    || '-';
    lines.push(`${i+1}세트 ${w}kg × ${rp}회`);
  }
  return lines.join('\n');
}

function buildExerciseListHtml(results) {
  if (!results || results.length === 0) {
    return `<div class="search-section-label">최근 ${searchExWeeks}주 기록</div>
      <div style="text-align:center;padding:20px 0;color:var(--text2);font-size:14px;">기록이 없어요</div>`;
  }
  let html = `<div class="search-section-label">최근 ${searchExWeeks}주 기록</div>`;
  results.forEach(r => {
    const weights = r.weights ? String(r.weights).split(',') : [];
    const reps    = r.reps    ? String(r.reps).split(',')    : [];
    // 카드 좌우 2분할: 왼쪽(날짜·타깃·세트) / 오른쪽(메모). 넓은 화면에선 나란히, 폰에선 세로로 쌓임.
    html += `
      <div class="search-result-card">
        <div class="src-left">
          <div class="search-result-date">📅 ${fmtKorDate(r.date)} (${r.day})</div>
          <div class="search-result-target">🎯 ${r.targetWeight||'-'}kg × ${r.targetReps||'-'}회 × ${r.targetSets||'-'}세트</div>
          ${formatSetsHtml(weights, reps)}
        </div>
        <div class="src-right">
          ${r.memo ? `<div class="src-memo">📝 ${r.memo}</div>` : `<div class="src-memo empty">메모 없음</div>`}
        </div>
      </div>`;
  });
  return html;
}

// ── 추이 차트 ─────────────────────────────────────────────────
// 세션별 최고중량/총볼륨 + 상세(세트/메모)를 계산해 오름차순(날짜순) 배열 반환
function computeChartPoints(results, metric) {
  return results.slice().reverse().map(r => {
    const wStr = r.weights ? String(r.weights).split(',') : [];
    const rStr = r.reps    ? String(r.reps).split(',')    : [];
    const wNum = wStr.map(s => parseFloat(s.trim()));
    const rNum = rStr.map(s => parseFloat(s.trim()));
    const n = Math.max(wNum.length, rNum.length);
    let maxWeight = 0, volume = 0;
    for (let i = 0; i < n; i++) {
      const w = wNum[i], rp = rNum[i];
      if (!Number.isFinite(w) || !Number.isFinite(rp) || rp === 0) continue;
      maxWeight = Math.max(maxWeight, w);
      volume += w * rp;
    }
    return {
      date:      r.date,
      day:       r.day || '',
      memo:      r.memo || '',
      value:     metric === 'volume' ? volume : maxWeight,
      setsHtml:  formatSetsHtml(wStr, rStr),
      setsPlain: formatSetsPlain(wStr, rStr),
    };
  }).filter(p => p.value > 0);
}

function buildTrendChartHtml(points, metric) {
  searchExChartPoints = points; // 점 클릭 핸들러가 인덱스로 조회
  if (points.length === 0) {
    return `<div style="text-align:center;padding:24px 0;color:var(--text2);font-size:14px;">표시할 데이터가 없어요</div>`;
  }
  const metricLabel = metric === 'volume' ? '총 볼륨 (kg)' : '최고 중량 (kg)';
  return `<div class="search-chart-wrap"><div class="chart-legend">${metricLabel}</div>${buildTrendChartSvg(points)}<div class="chart-hint">점을 누르면 그날 세트·메모를 볼 수 있어요</div></div>`;
}

// SVG <title>/속성에 안전하게 넣기 위한 이스케이프
function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildTrendChartSvg(points) {
  const W = 320, H = 160, PAD_L = 36, PAD_R = 12, PAD_T = 16, PAD_B = 28;
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const vals = points.map(p => p.value);
  let minV = Math.min(...vals), maxV = Math.max(...vals);
  if (minV === maxV) { const pad = Math.max(minV * 0.1, 1); minV -= pad; maxV += pad; }
  else { const pad = (maxV - minV) * 0.1; minV -= pad; maxV += pad; }
  const stepX = plotW / Math.max(points.length - 1, 1);
  const x = i => PAD_L + (points.length === 1 ? plotW / 2 : i * stepX);
  const y = v => PAD_T + plotH - ((v - minV) / (maxV - minV)) * plotH;

  const fmtVal = v => (Number.isInteger(v) ? v : v.toFixed(1));
  const fmtMd  = iso => { const d = new Date(iso + 'T00:00:00'); return `${d.getMonth()+1}/${d.getDate()}`; };

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const circles = points.map((p, i) => {
    const cx = x(i).toFixed(1), cy = y(p.value).toFixed(1);
    const tip = escXml(`${fmtKorDate(p.date)}${p.day ? ` (${p.day})` : ''}\n${p.setsPlain}`);
    // 투명한 큰 원(r=12)으로 터치 타깃 확보 + 보이는 점(r=3.5)
    return `<g class="chart-point-hit" onclick="onChartPointClick(${i})">` +
             `<title>${tip}</title>` +
             `<circle cx="${cx}" cy="${cy}" r="12" fill="transparent"/>` +
             `<circle class="chart-point" cx="${cx}" cy="${cy}" r="3.5"/>` +
           `</g>`;
  }).join('');

  const labelEvery = points.length > 8 ? Math.ceil(points.length / 8) : 1;
  const xLabels = points.map((p, i) =>
    (i % labelEvery === 0 || i === points.length - 1)
      ? `<text class="chart-axis-label" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${fmtMd(p.date)}</text>`
      : ''
  ).join('');

  // Y축: 최대·최소 두 개만이 아니라 균등한 "nice" 눈금값들을 그리드 라인과 함께 표시.
  // 눈금 간격은 실제 데이터 범위 기준으로 잡고, 그 배수 중 화면에 보이는 도메인[minV,maxV]에 드는 값만 그린다.
  const yTicks = niceTicks(Math.min(...vals), Math.max(...vals), minV, maxV, 4);
  const yGrid = yTicks.map(v => {
    const yy = y(v).toFixed(1);
    return `<line class="chart-grid-line" x1="${PAD_L}" y1="${yy}" x2="${W - PAD_R}" y2="${yy}"/>` +
           `<text class="chart-axis-label" x="${PAD_L - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${fmtVal(v)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;">
    ${yGrid}
    <line class="chart-axis-line" x1="${PAD_L}" y1="${PAD_T + plotH}" x2="${W - PAD_R}" y2="${PAD_T + plotH}"/>
    <path class="chart-line" d="${linePath}"/>
    ${circles}
    ${xLabels}
  </svg>`;
}

// 데이터 범위에 맞는 보기 좋은 눈금 간격을 잡아, 표시 도메인[domMin,domMax] 안에 드는 눈금값 배열을 반환.
function niceTicks(dataMin, dataMax, domMin, domMax, targetCount) {
  const span = dataMax - dataMin;
  if (!(span > 0)) {
    // 값이 하나뿐이거나 모두 같을 때: 그 값만
    return [dataMin];
  }
  const step = niceNum(span / Math.max(targetCount - 1, 1), true);
  if (!(step > 0)) return [dataMin, dataMax];
  const first = Math.ceil(domMin / step) * step;
  const ticks = [];
  // 부동소수 오차 방지용 소량 여유
  for (let v = first; v <= domMax + step * 1e-6; v += step) {
    // -0 방지 및 자잘한 오차 정리
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks.length ? ticks : [dataMin, dataMax];
}

// "보기 좋은" 수(1·2·5·10 계열)로 반올림
function niceNum(range, round) {
  const exp = Math.floor(Math.log10(range));
  const frac = range / Math.pow(10, exp);
  let nf;
  if (round) {
    if (frac < 1.5) nf = 1; else if (frac < 3) nf = 2; else if (frac < 7) nf = 5; else nf = 10;
  } else {
    if (frac <= 1) nf = 1; else if (frac <= 2) nf = 2; else if (frac <= 5) nf = 5; else nf = 10;
  }
  return nf * Math.pow(10, exp);
}

// 차트 점 클릭 → 그날 세트 + 메모를 팝업으로 (기존 시트 위에 겹쳐 띄움)
function onChartPointClick(i) {
  const p = searchExChartPoints[i];
  if (!p) return;
  const container = document.getElementById('popup-container');
  if (!container) return;
  const memoBlock = p.memo
    ? `<div class="search-result-card" style="margin-top:12px;">
         <div class="search-result-date">📝 메모</div>
         <div style="font-size:13px;color:var(--text1);white-space:pre-wrap;line-height:1.6;">${p.memo}</div>
       </div>`
    : `<div style="text-align:center;padding:16px 0;color:var(--text3);font-size:13px;">메모 없음</div>`;
  container.insertAdjacentHTML('beforeend', `
    <div class="popup-overlay" id="memoOverlay" style="z-index:210;" onclick="if(event.target===this)closeMemoPopup()">
      <div class="popup-sheet">
        <div class="popup-header">
          <span class="popup-label">${fmtKorDate(p.date)}${p.day ? ` (${p.day})` : ''}</span>
          <button class="popup-close" onclick="closeMemoPopup()">닫기</button>
        </div>
        <div class="sheet-scroll-body">
          <div class="search-result-card">${p.setsHtml}</div>
          ${memoBlock}
        </div>
      </div>
    </div>`);
}

function closeMemoPopup() {
  const el = document.getElementById('memoOverlay');
  if (el) el.remove();
}

