/* ── Search History ────────────────────────────────────────── */
async function renderSearchHistory(skipPush) {
  // skipPush: 회전 등으로 레이아웃만 다시 그릴 때 히스토리 항목을 중복 추가하지 않기 위함
  if (skipPush) setPageClass('search'); else pushPage('search');
  searchDaySelected  = null;
  searchDates        = [];
  searchDateSelected = null;
  searchExSelected   = null;
  searchExWeeks      = 4;
  searchExMetric     = 'maxWeight';
  searchExView       = 'chart';
  searchExResults    = [];

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
    html += `<div class="search-ex-group">`;
    groups[part].forEach(({ name, variation }) => {
      // 🆕 조합된 이름으로 버튼 표시
      const displayName = buildDisplayName(name, variation);
      const safeName = name.replace(/'/g, '&#39;');
      html += `<button class="search-ex-btn${searchExSelected===name?' active':''}" data-name="${safeName}" onclick="onSelectExercise(this.dataset.name, this)">${displayName}</button>`;
    });
    html += `</div></div>`;
  });
  // 태블릿에서는 오른쪽 패널에 결과를 펼치고, 폰에서는 이 패널이 비어 있는 채로 바텀시트를 쓴다
  body.innerHTML = `
    <div class="search-layout search-layout-ex">
      <div class="search-pane search-pane-nav">${html}</div>
      <div class="search-pane search-pane-detail" id="search-ex-panel"></div>
    </div>`;
}

async function onSelectExercise(exerciseName, btn) {
  searchExSelected = exerciseName;
  document.querySelectorAll('.search-ex-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const safeTitle = String(exerciseName).replace(/</g, '&lt;');
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
    const res = await apiGet({ action: 'searchHistory', subAction: 'getByExercise', exerciseName, weeks: searchExWeeks });
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
  if (searchExResults.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--text2);font-size:14px;">최근 ${searchExWeeks}주 기록이 없어요</div>`;
    // 결과가 없어도 기간은 바꿔볼 수 있도록 기간 버튼 행은 위에 유지
    el.insertAdjacentHTML('afterbegin', buildWeeksRowHtml());
    return;
  }
  // 태블릿은 차트와 목록을 나란히 띄우므로 뷰 전환 버튼 자체가 필요 없다
  const tablet = isTablet();
  const viewRow = tablet ? '' : `
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      <button class="search-tab-btn${searchExView==='chart'?' active':''}" onclick="onSelectExView('chart')">📈 차트</button>
      <button class="search-tab-btn${searchExView==='list'?' active':''}" onclick="onSelectExView('list')">📋 목록</button>
    </div>`;
  const metricRow = (tablet || searchExView === 'chart') ? `<div class="day-chips" style="margin-bottom:12px;">
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

  // 태블릿: 차트(위/좌)와 목록(아래/우)을 동시에
  if (isTablet()) {
    contentEl.innerHTML = `<div class="ex-dual">
      <div class="ex-dual-chart">${chartHtml()}</div>
      <div class="ex-dual-list">${buildExerciseListHtml(searchExResults)}</div>
    </div>`;
    return;
  }
  contentEl.innerHTML = searchExView === 'chart' ? chartHtml() : buildExerciseListHtml(searchExResults);
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
  let html = `<div class="search-section-label">최근 ${searchExWeeks}주 기록</div>`;
  results.forEach(r => {
    const weights = r.weights ? String(r.weights).split(',') : [];
    const reps    = r.reps    ? String(r.reps).split(',')    : [];
    html += `
      <div class="search-result-card">
        <div class="search-result-date">📅 ${fmtKorDate(r.date)} (${r.day})</div>
        <div class="search-result-target">🎯 ${r.targetWeight||'-'}kg × ${r.targetReps||'-'}회 × ${r.targetSets||'-'}세트</div>
        ${formatSetsHtml(weights, reps)}
        ${r.memo ? `<div style="margin-top:8px;font-size:12px;color:var(--text2);white-space:pre-wrap;">📝 ${r.memo}</div>` : ''}
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

  const yLabels =
    `<text class="chart-axis-label" x="${PAD_L - 4}" y="${(PAD_T + 4).toFixed(1)}" text-anchor="end">${fmtVal(maxV)}</text>` +
    `<text class="chart-axis-label" x="${PAD_L - 4}" y="${(PAD_T + plotH).toFixed(1)}" text-anchor="end">${fmtVal(minV)}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;">
    <line class="chart-axis-line" x1="${PAD_L}" y1="${PAD_T + plotH}" x2="${W - PAD_R}" y2="${PAD_T + plotH}"/>
    <path class="chart-line" d="${linePath}"/>
    ${circles}
    ${xLabels}
    ${yLabels}
  </svg>`;
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

