/* ── Render cards ──────────────────────────────────────────── */
function renderCards() {
  const container = document.getElementById('cards');
  if (!container) return;
  container.innerHTML = '';
  exercises.forEach((ex, idx) => {
    const isCollapsed = !!collapsedCards[ex.id];
    const isEditing   = !!editingCards[ex.id];
    const isSkipped   = !!skipped[ex.id];

    if (isCollapsed) {
      const card = document.createElement('div');
      card.id = `card-${idx}`;
      card.className = 'ex-card completed collapsed';
      card.onclick = () => { collapsedCards[ex.id] = false; renderCards(); };
      card.innerHTML = `
        <div class="card-top-row" style="align-items:center">
          <div class="card-info">
            <div class="ex-name" style="margin-bottom:0">${ex.displayName || ex.name}</div>
          </div>
          <span style="font-size:22px;color:var(--green);flex-shrink:0">✓</span>
        </div>`;
      container.appendChild(card);
      return;
    }

    if (ex.isSuperset) {
      const subLabels = ['🅐', '🅑', '🅒'];
      let sectionsHTML = '';
      (ex.subExercises || []).forEach((sub, subIdx) => {
        const tgt = `${sub.targetWeight||0}kg × ${sub.targetReps||'-'}회`;
        const lastBadge = sub.lastRecord
          ? `<span class="meta-tag last" style="font-size:11px">지난: ${sub.lastRecord}</span>` : '';
        let setsHTML = '';
        for (let s = 1; s <= ex.sets; s++) {
          const key = `${ex.id}_${subIdx}`;
          const sv = repsData[key]?.[s] || '';
          const wStored = weightData[key]?.[s];
          const wVal = (wStored !== undefined && wStored !== '') ? wStored : (sub.targetWeight || 0);
          const wMod = (wStored !== undefined && wStored !== '' && parseFloat(wStored) !== (sub.targetWeight || 0));
          setsHTML += `<div class="set-col${sv?' done':''}" id="sc${ex.id}_${subIdx}s${s}"><div class="set-num">${s}세트</div><input class="set-weight-input${wMod?' modified':''}" id="ew${ex.id}_${subIdx}s${s}" type="number" min="0" max="999" placeholder="${sub.targetWeight||0}" inputmode="decimal" value="${wVal}" oninput="onSupersetWeightInput(${idx},${subIdx},${s})"><input class="set-input${sv?' has-value':''}" id="e${ex.id}_${subIdx}s${s}" type="number" min="0" max="999" placeholder="${sub.targetReps||'-'}" inputmode="numeric" value="${sv}" oninput="onSupersetInput(${idx},${subIdx})"></div>`;
        }
        const subPartTag = sub.bodyPart ? `<span class="body-part-tag" style="margin-right:6px;vertical-align:middle">${sub.bodyPart}</span>` : '';
        // 🆕 displayName 사용
        sectionsHTML += `
          <div class="superset-section">
            <div class="superset-section-header">
              <span class="superset-section-label">${subLabels[subIdx]||''} ${subPartTag}${sub.displayName || sub.name}</span>
              <span style="color:var(--accent);font-size:12px;font-weight:800;">🎯 ${tgt}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span class="sec-label" style="margin-bottom:0;">수행 결과</span>${lastBadge}
            </div>
            <div class="sets-row">${setsHTML}</div>
          </div>`;
      });
      const sharedBody = !isSkipped ? `
        <div class="sec-label" style="margin-top:14px;">휴식시간</div>
        <div class="rest-row">
          <div class="rest-col"><div class="rest-wrap"><input class="rest-num" id="e${ex.id}min" type="number" min="0" max="60" placeholder="-" inputmode="numeric" value="${restData[ex.id]?.min||''}" oninput="onRestInput(${ex.id},'min',this.value)"><span class="rest-unit-abs">분</span></div></div>
          <div class="rest-col"><div class="rest-wrap"><input class="rest-num" id="e${ex.id}sec" type="number" min="0" max="59" placeholder="-" inputmode="numeric" value="${restData[ex.id]?.sec||''}" oninput="onRestInput(${ex.id},'sec',this.value)"><span class="rest-unit-abs">초</span></div></div>
        </div>
        <div class="sec-label">메모</div>
        <textarea class="memo-textarea" id="e${ex.id}memo" placeholder="특이사항, 느낌 등…" oninput="memoData[${ex.id}]=this.value">${memoData[ex.id]||''}</textarea>` : '';
      const ssEditFieldsHTML = isEditing ? `
        <div class="edit-fields">
          <div class="edit-row"><span class="edit-label">이름</span><input class="edit-input" style="font-size:15px" value="${ex.displayName || ex.name}" oninput="exercises[${idx}].name=this.value;exercises[${idx}].displayName=this.value"></div>
          <div class="edit-row"><span class="edit-label">세트</span><input class="edit-input" type="number" value="${ex.sets}" style="max-width:60px" oninput="exercises[${idx}].sets=Number(this.value);renderCards()" inputmode="numeric"><span class="edit-unit">세트</span></div>
          ${(ex.subExercises||[]).map((sub,si) => `
          <div style="background:#1c1c1e;border:1.5px solid #48484a;border-radius:10px;padding:10px;margin-top:8px;">
            <div style="font-size:10px;font-weight:800;color:var(--accent);margin-bottom:8px;">${['🅐','🅑','🅒'][si]||''} 종목 ${si+1}</div>
            <div class="edit-row"><span class="edit-label">이름</span><input class="edit-input" style="font-size:14px" value="${sub.displayName || sub.name}" oninput="exercises[${idx}].subExercises[${si}].name=this.value;exercises[${idx}].subExercises[${si}].displayName=this.value"></div>
            <div class="edit-row"><span class="edit-label">중량</span><input class="edit-input" type="number" value="${sub.targetWeight||0}" style="max-width:80px" oninput="exercises[${idx}].subExercises[${si}].targetWeight=Number(this.value)" inputmode="numeric"><span class="edit-unit">kg</span></div>
            <div class="edit-row"><span class="edit-label">목표</span><input class="edit-input" type="number" value="${sub.targetReps||0}" style="max-width:60px" oninput="exercises[${idx}].subExercises[${si}].targetReps=Number(this.value)" inputmode="numeric"><span class="edit-unit">회</span></div>
          </div>`).join('')}
        </div>` : '';
      const ssRightBtns = isEditing
        ? `<div class="card-btn-row"><button class="card-btn delete" onclick="deleteEx(${idx})">× 삭제</button><button class="card-btn edit-on" onclick="toggleCardEdit(${ex.id});renderCards()">✓ 완료</button></div>`
        : `<div class="card-btn-row">
            <button class="card-btn${isSkipped?' skip-on':''}" onclick="toggleSkip(${ex.id})">${isSkipped?'생략됨':'생략'}</button>
            <div class="skip-arrow-row">
              <button class="arrow-btn" onclick="moveEx(${idx},-1)">↑</button>
              <button class="arrow-btn" onclick="moveEx(${idx},1)">↓</button>
            </div>
            <button class="card-btn" onclick="toggleCardEdit(${ex.id});renderCards()">✏️ 편집</button>
           </div>`;
      const card = document.createElement('div');
      card.id = `card-${idx}`;
      card.className = `ex-card${isSkipped?' skipped':''}`;
      const ssDoneBtn = !isSkipped && (doneCards[ex.id] || completedCards[ex.id])
        ? `<button class="done-btn" onclick="onCardDone(${ex.id})">${completedCards[ex.id] ? '✓ 수정 완료' : '✓ 운동 완료'}</button>` : '';
      // 🆕 displayName 사용
      card.innerHTML = `<div class="card-top"><div class="card-top-row"><div class="card-info"><div class="ex-name">${ex.displayName || ex.name}</div><div style="font-size:11px;color:var(--accent);margin-top:3px;font-weight:700;">⚡ 슈퍼세트 · ${ex.sets}세트</div></div></div>${ssRightBtns}</div>${ssEditFieldsHTML}${!isEditing ? sectionsHTML : ''}${!isEditing ? sharedBody : ''}${ssDoneBtn}`;
      container.appendChild(card);
      return;
    }

    const hasTarget = ex.targetWeight > 0 && ex.targetReps > 0;
    const targetText = hasTarget
      ? `${ex.targetWeight}kg × ${ex.targetReps}회 × ${ex.sets}세트`
      : `${ex.targetWeight||0}kg × ${ex.targetReps||'-'}회 × ${ex.sets}세트`;

    let metaHTML = `
      <div style="display: flex; align-items: center; width: 100%;">
        <span style="color: var(--accent); font-size: 16px; font-weight: 800;">🎯 ${targetText}</span>
      </div>
    `;
    if (ex.tag) {
      metaHTML += `<div class="meta-tag" style="margin-top: 6px; display: inline-block;">${ex.tag}</div>`;
    }

    const editFieldsHTML = isEditing ? `
      <div class="edit-fields">
        <div class="edit-row"><span class="edit-label">이름</span><input class="edit-input" style="font-size:15px" value="${ex.displayName || ex.name}" oninput="exercises[${idx}].name=this.value;exercises[${idx}].displayName=this.value;document.getElementById('exname-${idx}').textContent=this.value"></div>
        <div class="edit-row"><span class="edit-label">중량</span><input class="edit-input" type="number" value="${ex.targetWeight||0}" style="max-width:80px" oninput="exercises[${idx}].targetWeight=Number(this.value)" inputmode="numeric"><span class="edit-unit">kg</span></div>
        <div class="edit-row"><span class="edit-label">세트</span><input class="edit-input" type="number" value="${ex.sets}" style="max-width:60px" oninput="exercises[${idx}].sets=Number(this.value);renderCards()" inputmode="numeric"><span class="edit-unit">세트</span></div>
        <div class="edit-row"><span class="edit-label">목표</span><input class="edit-input" type="number" value="${ex.targetReps||0}" style="max-width:60px" oninput="exercises[${idx}].targetReps=Number(this.value)" inputmode="numeric"><span class="edit-unit">회</span></div>
      </div>` : '';

    let setsHTML = '';
    for (let s = 1; s <= ex.sets; s++) {
      const sv = repsData[ex.id]?.[s] || '';
      const wStored = weightData[ex.id]?.[s];
      const wVal = (wStored !== undefined && wStored !== '') ? wStored : (ex.targetWeight || 0);
      const wMod = (wStored !== undefined && wStored !== '' && parseFloat(wStored) !== (ex.targetWeight || 0));
      setsHTML += `<div class="set-col${sv?' done':''}" id="sc${ex.id}s${s}"><div class="set-num">${s}세트</div><input class="set-weight-input${wMod?' modified':''}" id="ew${ex.id}s${s}" type="number" min="0" max="999" placeholder="${ex.targetWeight||0}" inputmode="decimal" value="${wVal}" oninput="onWeightInput(${idx},${s})"><input class="set-input${sv?' has-value':''}" id="e${ex.id}s${s}" type="number" min="0" max="999" placeholder="${ex.targetReps||'-'}" inputmode="numeric" value="${sv}" oninput="onSetInput(${idx})"></div>`;
    }
    const lastRecordBadge = ex.lastRecord ? `<span class="meta-tag last" style="font-size:11px">지난: ${ex.lastRecord}</span>` : '';
    const bodyHTML = !isEditing && !isSkipped ? `
      <div class="sec-label" style="margin-top: 10px;">휴식시간</div>
      <div class="rest-row">
        <div class="rest-col"><div class="rest-wrap"><input class="rest-num" id="e${ex.id}min" type="number" min="0" max="60" placeholder="-" inputmode="numeric" value="${restData[ex.id]?.min||''}" oninput="onRestInput(${ex.id},'min',this.value)"><span class="rest-unit-abs">분</span></div></div>
        <div class="rest-col"><div class="rest-wrap"><input class="rest-num" id="e${ex.id}sec" type="number" min="0" max="59" placeholder="-" inputmode="numeric" value="${restData[ex.id]?.sec||''}" oninput="onRestInput(${ex.id},'sec',this.value)"><span class="rest-unit-abs">초</span></div></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div class="sec-label" style="margin-bottom:0;">수행 결과</div>
        ${lastRecordBadge}
      </div>
      <div class="sets-row">${setsHTML}</div>
      <div class="sec-label">메모</div>
      <textarea class="memo-textarea" id="e${ex.id}memo" placeholder="특이사항, 느낌 등…" oninput="memoData[${ex.id}]=this.value">${memoData[ex.id]||''}</textarea>` : '';

    const rightBtns = isEditing
      ? `<div class="card-btn-row"><button class="card-btn delete" onclick="deleteEx(${idx})">× 삭제</button><button class="card-btn edit-on" onclick="toggleCardEdit(${ex.id})">✓ 완료</button></div>`
      : `<div class="card-btn-row">
          <button class="card-btn${isSkipped?' skip-on':''}" onclick="toggleSkip(${ex.id})">${isSkipped?'생략됨':'생략'}</button>
          <div class="skip-arrow-row">
            <button class="arrow-btn" onclick="moveEx(${idx},-1)">↑</button>
            <button class="arrow-btn" onclick="moveEx(${idx},1)">↓</button>
          </div>
          <button class="card-btn" onclick="toggleCardEdit(${ex.id})">✏️ 편집</button>
         </div>`;

    const card = document.createElement('div');
    card.id = `card-${idx}`;
    card.className = `ex-card${isEditing?' editing':''}${isSkipped?' skipped':''}`;
    const normalDoneBtn = !isEditing && !isSkipped && (doneCards[ex.id] || completedCards[ex.id])
      ? `<button class="done-btn" onclick="onCardDone(${ex.id})">${completedCards[ex.id] ? '✓ 수정 완료' : '✓ 운동 완료'}</button>` : '';
    const bpBadge = ex.bodyPart ? `<span class="body-part-tag" style="margin-top:0;margin-right:8px;vertical-align:middle">${ex.bodyPart}</span>` : '';
    // 🆕 displayName 사용
    card.innerHTML = `<div class="card-top"><div class="card-top-row"><div class="card-info">${bpBadge}<div class="ex-name" id="exname-${idx}" style="display:inline-block;vertical-align:middle">${ex.displayName || ex.name}</div></div></div>${rightBtns}<div style="margin-top:4px">${metaHTML}</div></div>${editFieldsHTML}${bodyHTML}${normalDoneBtn}`;
    container.appendChild(card);
  });
  updateSlideBtn();
}

/* ── Card interactions ─────────────────────────────────────── */
function addDoneButton(idx, id) {
  if (editingCards[id] || skipped[id]) return;
  const card = document.getElementById(`card-${idx}`);
  if (!card || card.querySelector('.done-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'done-btn';
  btn.textContent = completedCards[id] ? '✓ 수정 완료' : '✓ 운동 완료';
  btn.onclick = () => onCardDone(id);
  card.appendChild(btn);
}
function onSetInput(idx) {
  const ex = exercises[idx]; let all = true;
  if (!repsData[ex.id]) repsData[ex.id] = {};
  for (let s = 1; s <= ex.sets; s++) {
    const el    = document.getElementById(`e${ex.id}s${s}`);
    const colEl = document.getElementById(`sc${ex.id}s${s}`);
    const val = el?.value || '';
    if (val) { el.classList.add('has-value'); repsData[ex.id][s] = val; colEl?.classList.add('done'); }
    else { el?.classList.remove('has-value'); repsData[ex.id][s] = ''; all = false; colEl?.classList.remove('done'); }
  }
  if (all) { doneCards[ex.id] = true; addDoneButton(idx, ex.id); }
}
function onRestInput(id, field, val) {
  if (!restData[id]) restData[id] = {};
  restData[id][field] = val;
}
function onSupersetInput(idx, subIdx) {
  const ex  = exercises[idx];
  const key = `${ex.id}_${subIdx}`;
  if (!repsData[key]) repsData[key] = {};
  for (let s = 1; s <= ex.sets; s++) {
    const el    = document.getElementById(`e${ex.id}_${subIdx}s${s}`);
    const colEl = document.getElementById(`sc${ex.id}_${subIdx}s${s}`);
    const val = el?.value || '';
    if (val) { el.classList.add('has-value'); repsData[key][s] = val; colEl?.classList.add('done'); }
    else     { el?.classList.remove('has-value'); repsData[key][s] = ''; colEl?.classList.remove('done'); }
  }
  const numSubs = ex.subExercises?.length || 0;
  const allDone = Array.from({ length: numSubs }, (_, si) => {
    const k = `${ex.id}_${si}`;
    return Array.from({ length: ex.sets }, (_, s) => !!(repsData[k]?.[s+1])).every(Boolean);
  }).every(Boolean);
  if (allDone) { doneCards[ex.id] = true; addDoneButton(idx, ex.id); }
}
function onWeightInput(idx, setNum) {
  const ex = exercises[idx];
  const el = document.getElementById(`ew${ex.id}s${setNum}`);
  const val = el?.value ?? '';
  if (!weightData[ex.id]) weightData[ex.id] = {};
  weightData[ex.id][setNum] = val;
  const isModified = val !== '' && parseFloat(val) !== (ex.targetWeight || 0);
  el?.classList.toggle('modified', isModified);
}
function onSupersetWeightInput(idx, subIdx, setNum) {
  const ex  = exercises[idx];
  const key = `${ex.id}_${subIdx}`;
  const el  = document.getElementById(`ew${ex.id}_${subIdx}s${setNum}`);
  const val = el?.value ?? '';
  if (!weightData[key]) weightData[key] = {};
  weightData[key][setNum] = val;
  const sub = ex.subExercises[subIdx];
  const isModified = val !== '' && parseFloat(val) !== (sub.targetWeight || 0);
  el?.classList.toggle('modified', isModified);
}
function toggleCardEdit(id) { editingCards[id] = !editingCards[id]; renderCards(); }
function toggleSkip(id)     { skipped[id]      = !skipped[id];      renderCards(); }
function moveEx(idx, dir) {
  const next = idx + dir;
  if (next < 0 || next >= exercises.length) return;
  [exercises[idx], exercises[next]] = [exercises[next], exercises[idx]];
  renderCards();
}
function deleteEx(idx) {
  if (!confirm(`"${exercises[idx].displayName || exercises[idx].name}" 을(를) 삭제할까요?`)) return;
  delete editingCards[exercises[idx].id];
  exercises.splice(idx, 1);
  renderCards();
}

