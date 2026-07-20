/* ── Android Back Button ───────────────────────────────────── */
let currentPage = 'landing';
let _reloadAfterNav = false;

function pushPage(pageId) {
  currentPage = pageId;
  setPageClass(pageId);
  history.pushState({ page: pageId }, '');
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
    // (시트가 쌓아둔 히스토리 항목 하나가 남지만, 그 뒤로가기는 어차피
    //  검색 → 랜딩으로 가야 할 자리라 동작이 달라지지 않는다)
    const popup = document.getElementById('popup-container');
    if (popup) popup.innerHTML = '';
    if (currentPage === 'search') renderSearchHistory(true); // 히스토리 재푸시 없이 다시 그리기
  }, 150);
});

window.addEventListener('popstate', function() {
  const container = document.getElementById('popup-container');
  if (container && container.innerHTML.trim()) {
    container.innerHTML = '';
    return;
  }
  if (currentPage !== 'landing') {
    currentPage = 'landing';
    renderLanding(); updateLandingStatus(); updateWeekAlert();
    if (_reloadAfterNav) { _reloadAfterNav = false; loadBackgroundData(); }
  }
});

/* ── Init ──────────────────────────────────────────────────── */
renderLanding();
history.replaceState(null, '');
history.pushState({ page: 'landing' }, '');
loadBackgroundData();
