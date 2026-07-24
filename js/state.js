/* ── Constants & State ─────────────────────────────────────── */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzCJMLtt5RHCLMVYE_CSxJXtBEKR1p9AlriiQBFgZIbmOYXKcPs-wkr0xSA1RYS2LvemQ/exec'; // ← 새로 배포한 URL 여기에 입력
const TOKEN   = 'jty5375';   // ← 토큰 여기에 입력

let missionData    = null;
let missionCache   = null;
let missionLoading = true;
let exercises      = [];
let programName    = '';
let isFreeWorkout  = false;
let weekStatus     = null;
let introText      = null;
let introError      = null;  // 🆕 에러 상태를 로딩 상태와 구분하기 위한 변수
let outroWorkoutData = null;
let freeExerciseNames = [];
let importTarget   = null;
let ssSubCount     = 0;
let searchTab      = 'day';
let searchDaySelected  = null;
let searchDates        = [];
let searchDateSelected = null;
let searchExSelected   = null;
let searchExVariation  = '';       // 선택된 종목의 세부종목(variation) — 동명 종목(예: 데드리프트) 구분용
let searchExWeeks   = 4;           // 4 | 8 | 12 | 24 — 조회 기간
let searchExMetric  = 'maxWeight'; // 'maxWeight' | 'volume' — 차트 지표
let searchExView    = 'chart';     // 'chart' | 'list' — 차트/목록 뷰
let searchExResults = [];          // 마지막 조회 결과 캐시 (지표/뷰 토글 시 재조회 없이 재사용)
let searchExOpenPart = null;       // 왼쪽 아코디언에서 펼쳐진 부위(등/전신 등) — null이면 활성 종목이 속한 부위
let searchExListCache = [];        // 왼쪽 종목 목록 원본 캐시 — 아코디언 토글 시 왼쪽 단만 재렌더용
let searchExChartPoints = [];      // 마지막 렌더된 차트 포인트(세션 상세 포함) — 점 클릭 시 조회용

let skipped        = {};
let editingCards   = {};
let collapsedCards = {};
let doneCards      = {};
let completedCards = {};
let repsData       = {};
let memoData       = {};
let restData       = {};
let weightData     = {};
let showAddForm    = false;

/* ── Layout ────────────────────────────────────────────────── */
// 태블릿 가로(갤탭 S8 Ultra 기준 1480px)에서 다단 레이아웃으로 전환.
// CSS의 브레이크포인트(css/tablet.css)와 반드시 같은 값을 유지할 것.
const TABLET_MQ = '(min-width: 1000px)';
function isTablet() { return window.matchMedia(TABLET_MQ).matches; }

// 현재 렌더 루트(#app 또는 최상단 레이어의 inner)에 화면 클래스를 붙여
// CSS가 화면별 그리드/폭을 잡을 수 있게 함
function setPageClass(pageId) {
  const root = getRenderRoot();
  if (!root) return;
  if (root.id === 'app') root.className = 'page-' + pageId;
  else root.className = 'layer-inner page-' + pageId;
}

/* ── Helpers ───────────────────────────────────────────────── */
function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getThisWeekRange() {
  const today = new Date();
  const day   = today.getDay();
  const diff  = day === 0 ? -6 : 1 - day;
  const mon   = new Date(today); mon.setDate(today.getDate() + diff);
  const sun   = new Date(mon);   sun.setDate(mon.getDate() + 6);
  return { range: `${toIso(mon)} ~ ${toIso(sun)}` };
}
function isRestDayToday() {
  const s = getSettings(), w = getThisWeekRange();
  if (s.restDays.weekRange === w.range && s.restDays.days.includes(toIso(new Date()))) return true;
  return false;
}

/* ── Settings ──────────────────────────────────────────────── */
function getSettings() {
  try {
    const raw = localStorage.getItem('gc_settings');
    const s   = raw ? JSON.parse(raw) : {};
    return {
      startDay: s.startDay ?? 1,
      sheetUrl: s.sheetUrl || '',
      testMode: s.testMode || false,
      restDays: s.restDays || { weekRange: '', days: [] },
    };
  } catch { return { startDay: 1, sheetUrl: '', testMode: false, restDays: { weekRange: '', days: [] } }; }
}
function saveSettingsData(data) {
  localStorage.setItem('gc_settings', JSON.stringify(data));
}

