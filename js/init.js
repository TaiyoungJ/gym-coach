/* ── Android Back Button ───────────────────────────────────── */
let currentPage = 'landing';
let _reloadAfterNav = false;

function pushPage(pageId) {
  currentPage = pageId;
  history.pushState({ page: pageId }, '');
}

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
