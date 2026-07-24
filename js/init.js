/* ── Page Stack (레이어 네비게이션) ─────────────────────────── */
// #app = 랜딩(뿌리). 그 위에 .layer 를 쌓아 화면을 전환한다.
// 중간 레이어는 DOM 을 유지(재렌더 X)해 입력·스크롤·컨디션을 보존하고,
// 뒤로가기로 뿌리(랜딩)가 드러날 때만 새로 그린다.
let currentPage = 'landing';
let _reloadAfterNav = false;
const pageStack = [];   // [{ pageId, el }]  el = .layer 요소

// 렌더 함수가 그려야 할 컨테이너: 최상단 레이어의 inner, 없으면 #app(랜딩)
function getRenderRoot() {
  if (pageStack.length) return pageStack[pageStack.length - 1].el.querySelector('.layer-inner');
  return document.getElementById('app');
}

// 새 화면을 레이어로 쌓는다. 호출 뒤 렌더 함수가 getRenderRoot() 에 그린다.
function pushPage(pageId) {
  currentPage = pageId;
  const layer = document.createElement('div');
  layer.className = 'layer';
  layer.innerHTML = '<div class="layer-inner page-' + pageId + '"></div>';
  document.body.appendChild(layer);
  pageStack.push({ pageId, el: layer });
  history.pushState({ page: pageId }, '');
}

// 최상단 레이어를 제거하고 그 아래(레이어 또는 랜딩)를 드러낸다.
// 아래가 레이어면 유지(재렌더 X), 랜딩이면 상태까지 새로 그린다.
function popPage() {
  const top = pageStack.pop();
  if (top) top.el.remove();
  if (pageStack.length) {
    currentPage = pageStack[pageStack.length - 1].pageId;
  } else {
    currentPage = 'landing';
    renderLanding(); updateLandingStatus(); updateWeekAlert();
    if (_reloadAfterNav) { _reloadAfterNav = false; loadBackgroundData(); }
  }
}

/* ── 태블릿 ↔ 폰 레이아웃 전환 ─────────────────────────────── */
// 회전이나 창 크기 변경으로 브레이크포인트를 넘어갈 때만 다시 그린다.
// (기록 검색은 다단/단일 구조가 아예 달라 CSS만으로는 전환이 안 됨)
let _wasTablet = isTablet();
let _resizeTimer = null;
window.addEventListener('resize', function() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(function() {
    const nowTablet = isTablet();
    if (nowTablet === _wasTablet) return;
    _wasTablet = nowTablet;
    // 아래 화면을 다시 그리므로, 열려 있던 시트는 내용이 어긋나기 전에 닫는다.
    const popup = document.getElementById('popup-container');
    if (popup) popup.innerHTML = '';
    if (currentPage === 'search') renderSearchHistory(true); // 최상단 검색 레이어만 재푸시 없이 다시 그리기
  }, 150);
});

window.addEventListener('popstate', function() {
  // 바텀시트가 열려 있으면 그것만 닫고, 페이지 스택은 건드리지 않는다.
  const container = document.getElementById('popup-container');
  if (container && container.innerHTML.trim()) {
    container.innerHTML = '';
    return;
  }
  if (pageStack.length) popPage();
});

/* ── Init ──────────────────────────────────────────────────── */
renderLanding();
history.replaceState(null, '');
history.pushState({ page: 'landing' }, '');
loadBackgroundData();
