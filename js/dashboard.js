/* ── Render Main (Dashboard) ───────────────────────────────── */
function renderMain() {
  getRenderRoot().innerHTML = `
    <div class="header">
      <div style="margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
        <button class="back-btn" onclick="history.back()">← 뒤로</button>
        <div style="display:flex;gap:8px;">
          <button class="routine-nav-btn" onclick="renderRoutineDoc()">📄</button>
          <button class="routine-nav-btn" onclick="renderSearchHistory()">🔍</button>
        </div>
      </div>
      <div style="margin-bottom: 10px;">
        <span class="logo" style="font-size:22px;letter-spacing:0.05em;text-transform:none;">🏋️핸니의 체육관🏋️</span>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
        <span id="programWrap"></span>
      </div>
      <div class="field-label">컨디션 및 특이사항</div>
      <textarea class="condition-input" id="condition" placeholder="예: 왼쪽 승모근 뭉침&#10;늦게 시작해서 시간 봐가며 진행"></textarea>
      <button class="intro-btn" id="introBtn" onclick="toggleIntroCard()" style="margin-top:12px;">${isFreeWorkout ? '💬 코치에게 말하기' : '💬 코치 메시지 보기'}</button>
      <div id="introCard" style="display:none;margin-top:10px">
        <div class="intro-card-inner">
          <div class="intro-card-label">💬 코치 메시지</div>
          <div class="intro-card-text" id="introCardText"><div class="popup-loading">코치 메시지 불러오는 중...</div></div>
        </div>
      </div>
    </div>
    <div id="cards"></div>
    <button class="add-ex-btn" onclick="toggleAddForm()">+ 운동 추가</button>
    <div class="add-form" id="addForm">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div class="add-form-title" style="font-size:15px;margin-bottom:0;">새 운동 추가</div>
        <div style="display:flex;gap:6px;">
          <button class="import-btn" style="margin-top:0;display:inline-block;width:auto;text-align:center;" onclick="openImportForNormal()">📂 과거 운동</button>
          <button class="import-btn" style="margin-top:0;display:inline-block;width:auto;text-align:center;" onclick="openRoutineImportSheet()">📄 루틴 운동</button>
        </div>
      </div>
      <div id="normalFields">
        <div class="add-grid">
          <div class="add-field full">
            <label>운동명</label>
            <div class="ex-name-wrap">
              <input id="newName" type="text" placeholder="예: 레그 컬" oninput="onExNameInput()" autocomplete="off">
              <div id="exNameDropdown" class="autocomplete-dropdown"></div>
            </div>
          </div>
          <div class="add-field full">
            <label>세부종목 <span style="color:var(--text3);font-weight:400;">(선택)</span></label>
            <input id="newVariation" type="text" placeholder="예: 바벨" autocomplete="off">
          </div>
          <div class="add-field"><label>중량 (kg)</label><input id="newKg" type="number" placeholder="0" inputmode="numeric"></div>
          <div class="add-field"><label>세트 수</label><input id="newSets" type="number" placeholder="3" inputmode="numeric"></div>
          <div class="add-field"><label>목표 횟수</label><input id="newTarget" type="number" placeholder="10" inputmode="numeric"></div>
        </div>
      </div>
      <div class="add-ss-toggle-row">
        <span class="add-ss-toggle-label">⚡ 슈퍼세트로 만들기</span>
        <label class="toggle-wrap"><input type="checkbox" id="ssToggle" onchange="onSsToggle()"><span class="toggle-slider"></span></label>
      </div>
      <div id="ssFields" style="display:none">
        <div class="add-ss-body">
          <div class="add-ss-name-row">
            <div class="add-field full" style="margin-bottom:10px;"><label>슈퍼세트 이름</label><input id="ssName" type="text" placeholder="예: 상체 슈퍼세트"></div>
          </div>
          <div class="add-field" style="margin-bottom:12px;"><label>세트 수 (공유)</label><input id="ssSets" type="number" placeholder="3" inputmode="numeric"></div>
          <div id="ssSubList"></div>
          <button class="add-ss-add-btn" id="ssAddSubBtn" onclick="addSsSub()" style="display:none">+ 종목 추가</button>
        </div>
      </div>
      <div class="add-btns" style="margin-top:12px;"><button class="add-cancel" onclick="toggleAddForm()">취소</button><button class="add-confirm" onclick="confirmAdd()">추가하기</button></div>
    </div>
    <div id="completeArea"><div class="slide-wrap" id="slideWrap"><div class="slide-handle" id="slideHandle">›</div><span class="slide-label" id="slideLabel">모든 운동을 완료해주세요</span></div></div>`;
  renderProgramBadge();
  renderCards();
  initSlideBtn();
}

