function applyInline(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
}
function renderMarkdown(md) {
  const lines = md.split('\n');
  let html = '', inList = false;
  for (const line of lines) {
    if (/^---+$/.test(line.trim())) {
      if (inList) { html += '</ul>'; inList = false; } html += '<hr>';
    } else if (/^### (.+)/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; } html += `<h3>${applyInline(line.replace(/^### /,''))}</h3>`;
    } else if (/^## (.+)/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; } html += `<h2>${applyInline(line.replace(/^## /,''))}</h2>`;
    } else if (/^# (.+)/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; } html += `<h1>${applyInline(line.replace(/^# /,''))}</h1>`;
    } else if (/^[-*] (.+)/.test(line) || /^\d+\. (.+)/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${applyInline(line.replace(/^[-*] /,'').replace(/^\d+\. /,''))}</li>`;
    } else if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; } html += '<br>';
    } else {
      if (inList) { html += '</ul>'; inList = false; } html += `<p>${applyInline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

/* ── Routine Doc Page ─────────────────────────────────────────── */
async function renderRoutineDoc() {
  pushPage('routine');
  document.getElementById('app').innerHTML = `
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <button class="back-btn" onclick="history.back()">← 뒤로</button>
        <span class="page-title">운동 루틴</span>
      </div>
      <span class="logo" style="font-size:16px;font-weight:900;letter-spacing:0.03em;text-transform:none;">🏋️핸니의 체육관🏋️</span>
    </div>
    <div id="routine-doc-body">
      <div class="loading"><div class="spinner"></div><div class="loading-text">루틴 불러오는 중...</div></div>
    </div>`;
  try {
    const res = await apiGet({ action: 'getRoutineDoc' });
    const html = renderCollapsibleMarkdown(res.content || '');
    const body = document.getElementById('routine-doc-body');
    if (body) body.innerHTML = html || '<p style="color:var(--text2);text-align:center;padding:40px 0">루틴 내용이 없어요</p>';
  } catch(err) {
    const body = document.getElementById('routine-doc-body');
    if (body) body.innerHTML = `<div class="error-card"><h3>불러오기 실패</h3><p>${err.message}</p></div>`;
  }
}

function toggleRoutineSection(idx) {
  const body = document.getElementById('rs-body-' + idx);
  const icon = document.getElementById('rs-icon-' + idx);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (icon) icon.classList.toggle('open', !isOpen);
}

function renderCollapsibleMarkdown(md) {
  const lines = md.split('\n');
  let sections = [], currentSection = null;

  for (const line of lines) {
    if (/^## (.+)/.test(line)) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: line.replace(/^## /, ''), lines: [] };
    } else if (currentSection) {
      currentSection.lines.push(line);
    }
  }
  if (currentSection) sections.push(currentSection);
  sections = sections.slice().reverse();

  let html = '';
  sections.forEach((sec, idx) => {
    const bodyHtml = renderRoutineBody(sec.lines.join('\n'));
    html += `<div class="routine-section">
        <button class="routine-section-header" onclick="toggleRoutineSection(${idx})">
          <span class="routine-section-title">${applyInline(sec.title)}</span>
          <span class="routine-section-icon" id="rs-icon-${idx}">›</span>
        </button>
        <div class="routine-section-body" id="rs-body-${idx}" style="display:none">${bodyHtml}</div>
      </div>`;
  });
  return html;
}

function renderRoutineBody(md) {
  const lines = md.split('\n');
  let html = '';
  let inMeta = true, metaItems = [];
  let inOL = false, inUL = false;
  let firstH3 = true;

  const flushLists = () => {
    if (inOL) { html += '</ol>'; inOL = false; }
    if (inUL) { html += '</ul>'; inUL = false; }
  };
  const flushMeta = () => {
    if (metaItems.length) {
      html += '<div class="rs-meta-block"><ul class="rs-meta-list">' +
        metaItems.map(m => '<li>' + m + '</li>').join('') +
        '</ul></div>';
      metaItems = [];
    }
    inMeta = false;
  };

  for (const line of lines) {
    if (/^---+$/.test(line.trim())) continue;
    if (/^### (.+)/.test(line)) {
      if (inMeta) flushMeta();
      flushLists();
      html += '<div class="rs-h3' + (firstH3 ? ' first' : '') + '">' + applyInline(line.replace(/^### /, '')) + '</div>';
      firstH3 = false;
    } else if (inMeta) {
      if (/^[-*] (.+)/.test(line)) {
        metaItems.push(applyInline(line.replace(/^[-*] /, '')));
      } else if (line.trim() && !/^#/.test(line)) {
        metaItems.push(applyInline(line));
      }
    } else if (/^\d+\. (.+)/.test(line)) {
      if (inUL) { html += '</ul>'; inUL = false; }
      if (!inOL) { html += '<ol class="rs-ex-list">'; inOL = true; }
      html += '<li>' + applyInline(line.replace(/^\d+\. /, '')) + '</li>';
    } else if (/^[-*] (.+)/.test(line)) {
      if (inOL) { html += '</ol>'; inOL = false; }
      if (!inUL) { html += '<ul class="rs-ex-list">'; inUL = true; }
      html += '<li>' + applyInline(line.replace(/^[-*] /, '')) + '</li>';
    } else if (line.trim() === '') {
      flushLists();
    } else if (line.trim()) {
      flushLists();
      html += '<p>' + applyInline(line) + '</p>';
    }
  }
  flushLists();
  return html;
}

