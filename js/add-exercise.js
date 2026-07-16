/* ── Add exercise ──────────────────────────────────────────── */
/* ── 운동명 자동완성 ─────────────────────────────────────── */
function onExNameInput() {
  const input    = document.getElementById('newName');
  const dropdown = document.getElementById('exNameDropdown');
  if (!input || !dropdown) return;

  const query = input.value.trim();
  if (!query || freeExerciseNames.length === 0) {
    dropdown.classList.remove('show');
    return;
  }

  const norm    = s => s.replace(/[\s\-_]/g, '').toLowerCase();
  // 🆕 풀네임(세부종목+운동명) 기준으로 검색
  const matched = freeExerciseNames.filter(ex => norm(buildDisplayName(ex.name, ex.variation)).includes(norm(query)));

  if (matched.length === 0) {
    dropdown.classList.remove('show');
    return;
  }

  // 🆕 드롭다운엔 풀네임 표시(세부종목 강조), 선택 시 name/variation 분리 전달
  dropdown.innerHTML = matched.map(ex => {
    const esc = s => (s || '').replace(/'/g, "\\'");
    const varHtml = ex.variation ? `<span class="var">${ex.variation}</span> ` : '';
    return `<div class="autocomplete-item" ontouchstart="" onclick="selectExName('${esc(ex.name)}', '${esc(ex.variation)}')">${varHtml}${ex.name}</div>`;
  }).join('');
  dropdown.classList.add('show');
}

function selectExName(name, variation) {
  const input    = document.getElementById('newName');
  const varInput = document.getElementById('newVariation');
  const dropdown = document.getElementById('exNameDropdown');
  if (input)    input.value = name;
  if (varInput) varInput.value = variation || '';   // 🆕 세부종목 칸 자동 채움
  if (dropdown) dropdown.classList.remove('show');
}

function hideExNameDropdown() {
  const dropdown = document.getElementById('exNameDropdown');
  if (dropdown) dropdown.classList.remove('show');
}

function onSsSubNameInput(idx) {
  const input    = document.getElementById('ssSubName' + idx);
  const dropdown = document.getElementById('ssSubDropdown' + idx);
  if (!input || !dropdown) return;

  const query = input.value.trim();
  if (!query || freeExerciseNames.length === 0) {
    dropdown.classList.remove('show');
    return;
  }

  const norm    = s => s.replace(/[\s\-_]/g, '').toLowerCase();
  // 🆕 풀네임(세부종목+종목명) 기준으로 검색
  const matched = freeExerciseNames.filter(ex => norm(buildDisplayName(ex.name, ex.variation)).includes(norm(query)));

  if (matched.length === 0) {
    dropdown.classList.remove('show');
    return;
  }

  // 🆕 드롭다운엔 풀네임 표시(세부종목 강조), 선택 시 name/variation 분리 전달
  dropdown.innerHTML = matched.map(ex => {
    const esc = s => (s || '').replace(/'/g, "\\'");
    const varHtml = ex.variation ? `<span class="var">${ex.variation}</span> ` : '';
    return `<div class="autocomplete-item" ontouchstart="" onclick="selectSsSubName(${idx}, '${esc(ex.name)}', '${esc(ex.variation)}')">${varHtml}${ex.name}</div>`;
  }).join('');
  dropdown.classList.add('show');
}

function selectSsSubName(idx, name, variation) {
  const input    = document.getElementById('ssSubName' + idx);
  const varInput = document.getElementById('ssSubVar' + idx);
  const dropdown = document.getElementById('ssSubDropdown' + idx);
  if (input)    input.value = name;
  if (varInput) varInput.value = variation || '';   // 🆕 세부종목 칸 자동 채움
  if (dropdown) dropdown.classList.remove('show');
}

function hideSsSubDropdown(idx) {
  setTimeout(() => {
    const dropdown = document.getElementById('ssSubDropdown' + idx);
    if (dropdown) dropdown.classList.remove('show');
  }, 150);
}

function toggleAddForm() {
  showAddForm = !showAddForm;
  document.getElementById('addForm').classList.toggle('show', showAddForm);
  if (!showAddForm) {
    const t = document.getElementById('ssToggle');
    if (t && t.checked) { t.checked = false; onSsToggle(); }
  }
}

const SS_LABELS = ['\u{1F150}', '\u{1F151}', '\u{1F152}'];

function onSsToggle() {
  const isOn = document.getElementById('ssToggle').checked;
  document.getElementById('normalFields').style.display = isOn ? 'none' : 'block';
  document.getElementById('ssFields').style.display    = isOn ? 'block' : 'none';
  if (isOn) initSsSubList();
}

function initSsSubList() {
  ssSubCount = 2;
  const list = document.getElementById('ssSubList');
  if (!list) return;
  list.innerHTML = '';
  renderSsSub(0);
  renderSsSub(1);
  const btn = document.getElementById('ssAddSubBtn');
  if (btn) btn.style.display = 'block';
}

function renderSsSub(idx) {
  const list = document.getElementById('ssSubList');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'add-ss-sub';
  div.id = 'ss-sub-' + idx;
  div.innerHTML =
    '<div class="ss-sub-label-row">' +
      '<span class="add-ss-sub-label" style="margin-bottom:0;">' + (SS_LABELS[idx] || '\\u{1F152}') + ' 종목 ' + (idx + 1) + '</span>' +
      '<div class="ss-sub-label-btns">' +
        '<button class="import-btn-sm" onclick="openImportForSub(' + idx + ')">📂 과거 운동</button>' +
        '<button class="import-btn-sm" onclick="openRoutineImportForSub(' + idx + ')">📄 루틴 운동</button>' +
      '</div>' +
    '</div>' +
    '<div class="add-field full" style="margin-bottom:8px;">' +
      '<label>종목명</label>' +
      '<div class="ex-name-wrap">' +
        '<input id="ssSubName' + idx + '" type="text" placeholder="예: 벤치프레스" oninput="onSsSubNameInput(' + idx + ')" onblur="hideSsSubDropdown(' + idx + ')">' +
        '<div class="autocomplete-dropdown" id="ssSubDropdown' + idx + '"></div>' +
      '</div>' +
    '</div>' +
    '<div class="add-field full" style="margin-bottom:8px;">' +
      '<label>세부종목 <span style="color:var(--text3);font-weight:400;">(선택)</span></label>' +
      '<input id="ssSubVar' + idx + '" type="text" placeholder="예: 인클라인" autocomplete="off">' +
    '</div>' +
    '<div class="add-grid" style="margin-bottom:0">' +
      '<div class="add-field"><label>중량 (kg)</label><input id="ssSubKg' + idx + '" type="number" placeholder="0" inputmode="numeric"></div>' +
      '<div class="add-field"><label>목표 횟수</label><input id="ssSubTarget' + idx + '" type="number" placeholder="10" inputmode="numeric"></div>' +
    '</div>';
  list.appendChild(div);
}

function addSsSub() {
  if (ssSubCount >= 3) return;
  renderSsSub(ssSubCount);
  ssSubCount++;
  if (ssSubCount >= 3) {
    const btn = document.getElementById('ssAddSubBtn');
    if (btn) btn.style.display = 'none';
  }
}

function confirmAdd() {
  const isSS = document.getElementById('ssToggle')?.checked;
  if (isSS) {
    const ssName = document.getElementById('ssName')?.value.trim() || '슈퍼세트';
    const ssSets = Number(document.getElementById('ssSets')?.value) || 3;
    const subExercises = [];
    for (let i = 0; i < ssSubCount; i++) {
      const name = document.getElementById('ssSubName' + i)?.value.trim();
      if (!name) { alert((SS_LABELS[i] || '') + ' 종목명을 입력해주세요'); return; }
      const variation = document.getElementById('ssSubVar' + i)?.value.trim() || '';   // 🆕 세부종목 읽기
      subExercises.push({
        name, variation, displayName: buildDisplayName(name, variation),   // 🆕 variation 반영
        targetWeight: Number(document.getElementById('ssSubKg' + i)?.value) || 0,
        targetReps:   Number(document.getElementById('ssSubTarget' + i)?.value) || 10,
        lastRecord: null,
      });
    }
    exercises.push({ id: Date.now(), name: ssName, variation: '', displayName: ssName, sets: ssSets, tag: null, isSuperset: true, subExercises });
  } else {
    const name = document.getElementById('newName')?.value.trim();
    if (!name) { alert('운동명을 입력해주세요'); return; }
    const variation = document.getElementById('newVariation')?.value.trim() || '';   // 🆕 세부종목 읽기
    exercises.push({
      id: Date.now(), name, variation, displayName: buildDisplayName(name, variation),   // 🆕 variation 반영
      sets: Number(document.getElementById('newSets')?.value)||3,
      targetWeight: Number(document.getElementById('newKg')?.value)||0,
      targetReps: Number(document.getElementById('newTarget')?.value)||10,
      tag: null, lastRecord: null,
    });
    ['newName','newVariation','newKg','newSets','newTarget'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });   // 🆕 세부종목 칸도 초기화
  }
  const t = document.getElementById('ssToggle');
  if (t && t.checked) { t.checked = false; onSsToggle(); }
  showAddForm = false;
  document.getElementById('addForm').classList.remove('show');
  renderCards();
}

/* ── Bottom Sheet ──────────────────────────────────────────── */
function openBottomSheet(html) {
  const container = document.getElementById('popup-container');
  container.innerHTML =
    '<div class="popup-overlay" id="bsOverlay" onclick="if(event.target===this)closeBottomSheet()">' +
      '<div class="popup-sheet" id="bsSheet">' + html + '</div>' +
    '</div>';
  history.pushState({ page: 'bottomsheet' }, '');
}
function closeBottomSheet() {
  document.getElementById('popup-container').innerHTML = '';
}

