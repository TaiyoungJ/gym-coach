/* ── Routine Import ────────────────────────────────────────── */
function extractRoutineExercises(md) {
  const lines = md.split('\n');
  const periods = [];
  let currentPeriod = null;
  let currentGroup  = null;

  for (const line of lines) {
    // ## 기간 헤딩 파싱
    const periodMatch = line.match(/^## (.+)/);
    if (periodMatch) {
      currentGroup  = null;
      currentPeriod = { period: periodMatch[1].trim(), groups: [] };
      periods.push(currentPeriod);
      continue;
    }

    // ### 요일 헤딩 파싱
    const dayMatch = line.match(/^### (월요일|화요일|수요일|목요일|금요일|토요일|일요일)/);
    if (dayMatch) {
      if (!currentPeriod) {
        currentPeriod = { period: '', groups: [] };
        periods.push(currentPeriod);
      }
      currentGroup = { day: dayMatch[1], exercises: [] };
      currentPeriod.groups.push(currentGroup);
      continue;
    }

    if (!currentGroup || !/^\d+\. /.test(line)) continue;

    const content = line.replace(/^\d+\. /, '').trim();

    if (content.includes(': ') && content.includes(' + ')) {
      // 슈퍼세트: 콜론 뒤를 + 로 쪼개서 개별 종목 추출
      const afterColon = content.split(': ').slice(1).join(': ');
      afterColon.split(' + ').forEach(sub => {
        const ex = parseRoutineExName(sub.trim());   // 🆕 {name, variation}
        if (ex && !currentGroup.exercises.some(e => e.name === ex.name && e.variation === ex.variation)) currentGroup.exercises.push(ex);
      });
    } else {
      // 일반 종목: (N) 또는 (N세트), **[태그]** 제거
      const cleaned = content
        .replace(/\s*\(\d+(?:세트)?\).*$/, '')
        .replace(/\s*\*\*\[.*?\]\*\*/, '')
        .trim();
      const ex = parseRoutineExName(cleaned);   // 🆕 {name, variation}
      if (ex && !currentGroup.exercises.some(e => e.name === ex.name && e.variation === ex.variation)) currentGroup.exercises.push(ex);
    }
  }
  return periods;
}

function parseRoutineExName(raw) {
  // 🆕 "운동명 [세부종목]" → { name, variation } 로 분리 보관 (합치지 않음)
  const match = raw.match(/^(.+?)\s*\[(.+?)\]$/);
  if (match) return { name: match[1].trim(), variation: match[2].trim() };
  const name = raw.trim();
  return name ? { name, variation: '' } : null;
}

async function openRoutineImportSheet() {
  openBottomSheet(`
    <div class="popup-header">
      <span class="popup-label">루틴 운동 가져오기</span>
      <button class="popup-close" onclick="closeBottomSheet()">닫기</button>
    </div>
    <div id="routineImportBody" class="sheet-scroll-body"><div class="loading" style="height:auto;padding:24px 0;"><div class="spinner"></div></div></div>
  `);
  try {
    const res = await apiGet({ action: 'getRoutineDoc' });
    const groups = extractRoutineExercises(res.content || '');
    renderRoutineImportList(groups);
  } catch(err) {
    const body = document.getElementById('routineImportBody');
    if (body) body.innerHTML = '<div class="error-card"><h3>오류</h3><p>' + err.message + '</p></div>';
  }
}

function renderRoutineImportList(periods) {
  const body = document.getElementById('routineImportBody');
  if (!body) return;
  const validPeriods = periods.filter(p => p.groups.some(g => g.exercises.length > 0));
  if (!validPeriods.length) {
    body.innerHTML = '<div style="text-align:center;padding:24px 0;color:var(--text2);font-size:14px;">루틴 운동을 찾을 수 없어요</div>';
    return;
  }
  let html = '';
  validPeriods.forEach((p, pi) => {
    html += `<div class="import-period-card">`;
    html += `<button class="import-period-header" onclick="toggleRoutineImportPeriod(${pi})">
               <span class="import-period-title">${p.period}</span>
               <span class="import-period-icon" id="rip-icon-${pi}">›</span>
             </button>`;
    html += `<div class="import-period-body" id="rip-body-${pi}" style="display:none;">`;
    p.groups.filter(g => g.exercises.length > 0).forEach(g => {
      html += `<div style="margin-bottom:14px;margin-top:12px;">`;
      html += `<div style="font-size:11px;font-weight:800;color:var(--text2);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">${g.day}</div>`;
      html += `<div style="display:flex;flex-wrap:wrap;gap:8px;">`;
      g.exercises.forEach(ex => {
        // 🆕 화면엔 풀네임 표시, 클릭 시 운동명·세부종목 따로 전달
        const displayName = buildDisplayName(ex.name, ex.variation);
        const safeName = ex.name.replace(/'/g, '&#39;');
        const safeVar  = (ex.variation || '').replace(/'/g, '&#39;');
        html += `<button class="search-ex-btn" onclick="applyRoutineImport('${safeName}','${safeVar}')">${displayName}</button>`;
      });
      html += `</div></div>`;
    });
    html += `</div></div>`;
  });
  body.innerHTML = html;
}

function toggleRoutineImportPeriod(idx) {
  const body = document.getElementById('rip-body-' + idx);
  const icon = document.getElementById('rip-icon-' + idx);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (icon) icon.style.transform = isOpen ? '' : 'rotate(90deg)';
}

function applyRoutineImport(name, variation) {
  variation = variation || '';
  if (importTarget && typeof importTarget === 'object' && importTarget.type === 'ss') {
    const nameInput = document.getElementById('ssSubName' + importTarget.subIdx);
    const varInput  = document.getElementById('ssSubVar'  + importTarget.subIdx);
    if (nameInput) nameInput.value = name;
    if (varInput)  varInput.value  = variation;   // 🆕 세부종목 칸 채움
  } else {
    const nameInput = document.getElementById('newName');
    const varInput  = document.getElementById('newVariation');
    if (nameInput) nameInput.value = name;
    if (varInput)  varInput.value  = variation;   // 🆕 세부종목 칸 채움
  }
  importTarget = null;
  closeBottomSheet();
}

/* ── Import Sheet ──────────────────────────────────────────── */
function openImportForNormal() { importTarget = 'normal'; _openImportSheet(); }
function openImportForSub(idx)  { importTarget = { type: 'ss', subIdx: idx }; _openImportSheet(); }
function openRoutineImportForSub(idx) { importTarget = { type: 'ss', subIdx: idx }; openRoutineImportSheet(); }
async function openImportSheet(type, subIdx) {
  if (type === 'normal') { importTarget = 'normal'; } else { importTarget = { type: 'ss', subIdx }; }
  await _openImportSheet();
}

async function _openImportSheet() {
  openBottomSheet(`
    <div class="popup-header">
      <button id="importBackBtn" class="back-btn" style="display:none;margin-right:8px;" onclick="goBackToImportList()">← 뒤로</button>
      <span class="popup-label" style="flex:1;">기존 운동 가져오기</span>
      <button class="popup-close" onclick="closeBottomSheet()">닫기</button>
    </div>
    <div id="importBody" class="sheet-scroll-body"><div class="loading" style="height:auto;padding:24px 0;"><div class="spinner"></div></div></div>
  `);
  try {
    const res = await apiGet({ action: 'searchHistory', subAction: 'getExerciseList' });
    renderImportExList(res.exercises || []);
  } catch(err) {
    const body = document.getElementById('importBody');
    if (body) body.innerHTML = '<div class="error-card"><h3>오류</h3><p>' + err.message + '</p></div>';
  }
}

function renderImportExList(exList) {
  const body = document.getElementById('importBody');
  if (!body) return;
  if (exList.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:24px 0;color:var(--text2);font-size:14px;">최근 4주 운동 기록이 없어요</div>';
    return;
  }
  // 🆕 부위(bodyPart)별로 그룹 나누기 — 데이터 등장 순서 그대로, 고정 순서표 없음
  const groups = {}, order = [];
  exList.forEach(ex => {
    const part = (typeof ex === 'string') ? '기타' : (ex.bodyPart || '기타');
    const name = (typeof ex === 'string') ? ex : ex.name;
    const variation = (typeof ex === 'string') ? '' : (ex.variation || '');
    if (!groups[part]) { groups[part] = []; order.push(part); }
    groups[part].push({ name, variation });
  });
  let html = '<div id="importExListSection">';
  html += '<div class="search-section-label" style="margin-bottom:10px;">최근 4주 종목</div>';
  order.forEach(part => {
    html += '<div class="import-ex-group" data-part-group="' + part + '" style="margin-bottom:14px;">';
    html += '<div class="import-ex-group-title" style="font-size:11px;font-weight:800;color:var(--text2);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">' + part + '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    groups[part].forEach(({ name, variation }) => {
      // 🆕 조합된 이름(세부종목+운동명)으로 표시, 클릭 시 운동명+세부종목 함께 전달
      const displayName = buildDisplayName(name, variation);
      const safeName = name.replace(/"/g, '&quot;');
      const safeVar  = (variation || '').replace(/"/g, '&quot;');   // 🆕 세부종목도 버튼에 실어줌
      html += '<button class="search-ex-btn" data-name="' + safeName + '" data-variation="' + safeVar + '" onclick="onImportSelectEx(this.dataset.name,this,this.dataset.variation)">' + displayName + '</button>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  html += '<div id="importExResult"></div>';
  body.innerHTML = html;
}

async function onImportSelectEx(exerciseName, btn, variation) {
  document.querySelectorAll('#importBody .search-ex-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // 🆕 선택 안 한 종목 버튼 숨기고, 선택한 종목 하나만 남기기
  document.querySelectorAll('#importExListSection .search-ex-btn').forEach(b => {
    b.style.display = (b === btn) ? '' : 'none';
  });
  // 버튼이 모두 숨겨진 그룹(부위 타이틀)도 함께 숨기기
  document.querySelectorAll('#importExListSection .import-ex-group').forEach(group => {
    const hasVisible = Array.from(group.querySelectorAll('.search-ex-btn')).some(b => b.style.display !== 'none');
    group.style.display = hasVisible ? '' : 'none';
  });

  // 🆕 뒤로가기 버튼 표시
  const backBtn = document.getElementById('importBackBtn');
  if (backBtn) backBtn.style.display = 'inline-block';

  const resultEl = document.getElementById('importExResult');
  if (!resultEl) return;
  resultEl.innerHTML = '<div class="loading" style="height:auto;padding:20px 0;"><div class="spinner"></div></div>';
  try {
    // 🆕 세부종목까지 보내서 정확히 그 종목 기록만 조회
    const res = await apiGet({ action: 'searchHistory', subAction: 'getByExercise', exerciseName, variation: variation || '' });
    renderImportRecords(exerciseName, res.results || [], variation || '');
  } catch(err) {
    resultEl.innerHTML = '<div class="error-card"><h3>오류</h3><p>' + err.message + '</p></div>';
  }
}

function goBackToImportList() {
  // 🆕 숨겼던 종목 버튼·그룹 전부 복원
  document.querySelectorAll('#importExListSection .search-ex-btn').forEach(b => {
    b.style.display = '';
    b.classList.remove('active');
  });
  document.querySelectorAll('#importExListSection .import-ex-group').forEach(group => {
    group.style.display = '';
  });
  // 날짜 목록 비우기
  const resultEl = document.getElementById('importExResult');
  if (resultEl) resultEl.innerHTML = '';
  // 뒤로가기 버튼 숨기기
  const backBtn = document.getElementById('importBackBtn');
  if (backBtn) backBtn.style.display = 'none';
}

function renderImportRecords(exerciseName, results, variation) {
  const resultEl = document.getElementById('importExResult');
  if (!resultEl) return;
  if (results.length === 0) {
    resultEl.innerHTML = '<div style="text-align:center;padding:24px 0;color:var(--text2);font-size:14px;">최근 4주 기록이 없어요</div>';
    return;
  }
  const fmtKor = iso => { const d = new Date(iso + 'T00:00:00'); return (d.getMonth()+1) + '월 ' + d.getDate() + '일'; };
  let html = '<div class="search-section-label" style="margin:10px 0 8px;">날짜 선택</div>';
  results.forEach(r => {
    html +=
      '<button class="search-date-item"' +
        ' style="display:flex;justify-content:space-between;align-items:center;"' +
        ' data-name="' + exerciseName.replace(/"/g,'&quot;') + '"' +
        ' data-variation="' + (variation || '').replace(/"/g,'&quot;') + '"' +   // 🆕 세부종목 실어줌
        ' data-weight="' + (r.targetWeight||0) + '"' +
        ' data-sets="'  + (r.targetSets||3)    + '"' +
        ' data-reps="'  + (r.targetReps||10)   + '"' +
        ' onclick="applyImport(this)">' +
        '<span>' + fmtKor(r.date) + ' (' + r.day + ')</span>' +
        '<span style="color:var(--accent);font-weight:800;font-size:13px;">' +
          (r.targetWeight||0) + 'kg × ' + (r.targetReps||'-') + '회 × ' + (r.targetSets||'-') + '세트' +
        '</span>' +
      '</button>';
  });
  resultEl.innerHTML = html;
}

function applyImport(btn) {
  const name   = btn.dataset.name;
  const variation = btn.dataset.variation || '';   // 🆕 세부종목 읽기
  const weight = Number(btn.dataset.weight);
  const sets   = Number(btn.dataset.sets);
  const reps   = Number(btn.dataset.reps);
  if (importTarget === 'normal') {
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    set('newName', name); set('newVariation', variation); set('newKg', weight); set('newSets', sets); set('newTarget', reps);   // 🆕 세부종목 칸 채움
  } else {
    const idx = importTarget.subIdx;
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    set('ssSubName' + idx, name);
    set('ssSubVar'  + idx, variation);   // 🆕 세부종목 칸 채움
    set('ssSubKg'   + idx, weight);
    set('ssSubTarget' + idx, reps);
    const setsEl = document.getElementById('ssSets');
    if (setsEl && !setsEl.value) setsEl.value = sets;
  }
  closeBottomSheet();
}

