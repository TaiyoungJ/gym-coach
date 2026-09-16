/* ── Body Record (신체 기록 / 계체) ─────────────────────────── */
// 환경설정에서 고른 계체 요일이 되면 랜딩에 입력 카드가 보이고,
// 저장하면 GAS → 스프레드시트 "(연도) 신체기록" 시트에 한 줄 쌓인다.
// 마지막 기록은 localStorage(gc_body_last)에 캐싱해 앱을 켤 때 즉시 판단하고,
// 백그라운드에서 GAS(getBodyLast)로 최신값을 받아 갱신한다(미션 캐시와 같은 방식).

let bodyForceOpen = false;   // 환경설정 "지금 기록하기"로 들어왔을 때 true → 예정일이 아니어도 입력 카드 열기

const BODY_DAY_KOR = ['일','월','화','수','목','금','토'];

/* ── Cache ─────────────────────────────────────────────────── */
// { last: {date,day,weight,waist,fat,memo} | null, prev: {...} | null }
function readBodyCache() {
  try {
    const raw = localStorage.getItem('gc_body_last');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeBodyCache(data) {
  try { localStorage.setItem('gc_body_last', JSON.stringify(data || { last: null, prev: null })); } catch {}
}

/* ── 날짜 헬퍼 ─────────────────────────────────────────────── */
// 오늘 이전 7일 안에서 가장 최근 계체 요일의 날짜(ISO). 없으면 null.
function getLastScheduledDate(bodyDays) {
  if (!bodyDays || !bodyDays.length) return null;
  const d = new Date();
  for (let i = 1; i <= 7; i++) {
    d.setDate(d.getDate() - 1);
    if (bodyDays.includes(d.getDay())) return toIso(d);
  }
  return null;
}
function shortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const day = BODY_DAY_KOR[new Date(y, m - 1, d).getDay()];
  return `${m}/${d} (${day})`;
}
function fmtNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? '' : String(Math.round(n * 10) / 10);
}
// 변화량 배지: ▼0.3 / ▲0.3 / ±0
function diffLabel(cur, prev, unit) {
  const a = parseFloat(cur), b = parseFloat(prev);
  if (isNaN(a) || isNaN(b)) return '';
  const diff = Math.round((a - b) * 10) / 10;
  if (diff === 0) return `±0${unit}`;
  return (diff > 0 ? '▲' : '▼') + Math.abs(diff) + unit;
}

/* ── 카드 상태 결정 ────────────────────────────────────────── */
// 'hidden' | 'form' | 'missed' | 'done'
function getBodyCardState() {
  const { bodyDays } = getSettings();
  const cache = readBodyCache();
  const last  = cache?.last || null;
  const today = toIso(new Date());

  if (!bodyDays.length && !bodyForceOpen) return 'hidden';
  if (bodyForceOpen) return 'form';
  if (last && last.date === today) return 'done';
  if (bodyDays.includes(new Date().getDay())) return 'form';

  // 직전 예정일을 넘겼는지: 기록이 하나도 없으면(처음 설정 직후) 잔소리하지 않는다
  const missedDate = getLastScheduledDate(bodyDays);
  if (missedDate && last && last.date < missedDate) {
    const dismissed = localStorage.getItem('gc_body_dismissed');
    if (dismissed !== missedDate) return 'missed';
  }
  return 'hidden';
}

/* ── Render ────────────────────────────────────────────────── */
function renderBodyCard() {
  const el = document.getElementById('body-card');
  if (!el) return;
  const state = getBodyCardState();
  el.className = 'body-card';
  if (state === 'hidden') { el.innerHTML = ''; return; }

  const cache = readBodyCache();
  const last  = cache?.last || null;
  const prev  = cache?.prev || null;
  const today = toIso(new Date());

  if (state === 'done') {
    const diffs = prev ? [diffLabel(last.weight, prev.weight, 'kg'), diffLabel(last.waist, prev.waist, 'cm')].filter(Boolean) : [];
    const fat = last.fat !== '' && last.fat != null ? ` · ${fmtNum(last.fat)}%` : '';
    el.classList.add('show', 'done');
    el.innerHTML = `
      <div class="body-card-eyebrow">✅ 기록 완료</div>
      <div class="body-card-body">${fmtNum(last.weight)}kg · ${fmtNum(last.waist)}cm${fat}</div>
      <div class="body-card-sub">${diffs.length ? '지난 대비 ' + diffs.join(' · ') : shortDate(last.date) + ' 기록'}</div>`;
    return;
  }

  const formOpen = state === 'form';
  const missedDate = getLastScheduledDate(getSettings().bodyDays);
  const lastLine = last
    ? `지난 기록 ${shortDate(last.date)} · ${fmtNum(last.weight)}kg · ${fmtNum(last.waist)}cm`
    : '첫 기록이에요 🎉';

  el.classList.add('show', formOpen ? 'form' : 'missed');
  el.innerHTML = `
    <div id="body-missed-head"${formOpen ? ' style="display:none"' : ''}>
      <div class="body-card-eyebrow">⚠️ 계체 미기록</div>
      <div class="body-card-body">최근 계체 결과가 기록되지 않았어요</div>
      <div class="body-card-sub">예정일: ${shortDate(missedDate)}</div>
      <div class="body-card-btns">
        <button class="body-btn-ghost" onclick="onBodyDismiss('${missedDate}')">알겠어</button>
        <button class="body-btn-accent" onclick="openBodyForm()">입력</button>
      </div>
    </div>
    <div class="body-form-wrap${formOpen ? ' open' : ''}" id="body-form-wrap">
      <div class="body-form-inner">
        <div class="body-card-eyebrow">📏 계체하는 날</div>
        <div class="body-card-body">오늘의 신체 기록 <span class="body-card-date">${shortDate(today)}</span></div>
        <div class="body-card-sub">${lastLine}</div>
        <div class="add-grid body-grid">
          <div class="add-field"><label>체중 (kg) <span class="body-req">*</span></label>
            <input id="bodyWeight" type="number" inputmode="decimal" step="0.1" placeholder="${last ? fmtNum(last.weight) : '0.0'}" oninput="updateBodySaveBtn()"></div>
          <div class="add-field"><label>허리둘레 (cm) <span class="body-req">*</span></label>
            <input id="bodyWaist" type="number" inputmode="decimal" step="0.1" placeholder="${last ? fmtNum(last.waist) : '0.0'}" oninput="updateBodySaveBtn()"></div>
        </div>
        <button class="body-extra-toggle" id="bodyExtraToggle" onclick="toggleBodyExtra()">＋ 체지방률 · 메모</button>
        <div class="add-grid body-grid" id="bodyExtra" style="display:none">
          <div class="add-field"><label>체지방률 (%)</label>
            <input id="bodyFat" type="number" inputmode="decimal" step="0.1" placeholder="선택"></div>
          <div class="add-field"><label>메모</label>
            <input id="bodyMemo" type="text" placeholder="선택" autocomplete="off"></div>
        </div>
        <button class="body-btn-accent body-save-btn" id="bodySaveBtn" onclick="onBodySave()" disabled>기록 저장</button>
      </div>
    </div>`;
}

/* ── Interactions ──────────────────────────────────────────── */
// 미기록 카드 → 같은 카드 안에서 입력칸을 아래로 슬라이드해 펼친다
function openBodyForm() {
  const head = document.getElementById('body-missed-head');
  const wrap = document.getElementById('body-form-wrap');
  const card = document.getElementById('body-card');
  if (head) head.style.display = 'none';
  if (card) { card.classList.remove('missed'); card.classList.add('form'); }
  if (wrap) {
    wrap.classList.add('open');
    setTimeout(() => document.getElementById('bodyWeight')?.focus(), 320);
  }
}

function onBodyDismiss(missedDate) {
  try { localStorage.setItem('gc_body_dismissed', missedDate); } catch {}
  renderBodyCard();
}

function toggleBodyExtra() {
  const extra = document.getElementById('bodyExtra');
  const btn   = document.getElementById('bodyExtraToggle');
  if (!extra) return;
  const open = extra.style.display === 'none';
  extra.style.display = open ? 'grid' : 'none';
  if (btn) btn.textContent = open ? '－ 체지방률 · 메모' : '＋ 체지방률 · 메모';
}

function updateBodySaveBtn() {
  const btn = document.getElementById('bodySaveBtn');
  if (!btn) return;
  const w = parseFloat(document.getElementById('bodyWeight')?.value);
  const c = parseFloat(document.getElementById('bodyWaist')?.value);
  btn.disabled = !(w > 0 && c > 0);
}

async function onBodySave() {
  const btn = document.getElementById('bodySaveBtn');
  const weight = parseFloat(document.getElementById('bodyWeight')?.value);
  const waist  = parseFloat(document.getElementById('bodyWaist')?.value);
  const fatRaw = document.getElementById('bodyFat')?.value?.trim() || '';
  const fat    = fatRaw === '' ? '' : parseFloat(fatRaw);
  const memo   = document.getElementById('bodyMemo')?.value?.trim() || '';

  if (!(weight >= 20 && weight <= 300)) { alert('체중은 20~300kg 사이로 입력해 주세요.'); return; }
  if (!(waist >= 30 && waist <= 200))   { alert('허리둘레는 30~200cm 사이로 입력해 주세요.'); return; }
  if (fat !== '' && !(fat >= 1 && fat <= 70)) { alert('체지방률은 1~70% 사이로 입력해 주세요.'); return; }

  const now = new Date();
  const record = { date: toIso(now), day: BODY_DAY_KOR[now.getDay()], weight, waist, fat, memo };

  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    let prev;
    if (getSettings().testMode) {
      prev = readBodyCache()?.last || null;
    } else {
      const res = await apiPost({ action: 'saveBodyRecord', data: record });
      prev = res.prev || readBodyCache()?.last || null;
    }
    writeBodyCache({ last: record, prev });
    bodyForceOpen = false;
    renderBodyCard();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = '기록 저장'; }
    alert('오류: ' + err.message);
  }
}

/* ── Background load ───────────────────────────────────────── */
// loadBackgroundData()에서 호출. 계체 요일이 없고 캐시도 없으면 굳이 부르지 않는다.
async function loadBodyLast() {
  const s = getSettings();
  if (!s.bodyDays.length && !readBodyCache()) return;
  try {
    // 테스트 모드: 캐시가 없을 때만 목업으로 채운다(저장한 목업 기록이 매번 덮어써지지 않게)
    if (s.testMode) { if (!readBodyCache()) writeBodyCache(getMockBodyLast()); }
    else {
      const data = await apiGet({ action: 'getBodyLast' });
      writeBodyCache({ last: data?.last || null, prev: data?.prev || null });
    }
  } catch {
    // 네트워크 실패 시 캐시 유지
  }
  // 입력 중인 카드를 덮어쓰지 않도록, 폼에 값이 있으면 재렌더를 건너뛴다
  if (currentPage === 'landing' && !isBodyFormDirty()) renderBodyCard();
}

function isBodyFormDirty() {
  return ['bodyWeight', 'bodyWaist', 'bodyFat', 'bodyMemo'].some(id => {
    const el = document.getElementById(id);
    return el && (el.value !== '' || document.activeElement === el);
  });
}
