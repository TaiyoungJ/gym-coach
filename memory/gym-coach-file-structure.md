---
name: gym-coach-file-structure
description: gym-coach index.html was split into css/style.css + 12 js/*.js files (2026-07-16) — no longer a single 2539-line file
metadata: 
  node_type: memory
  type: project
  originSessionId: 1047b63d-60dd-4841-9789-0da75014aee1
---

2026-07-16에 `index.html`(당시 144KB, 2539줄)을 CSS/JS로 분리함. 클라이언트는 여전히 하나의 SPA(단일 페이지 앱)로 동작하며, 로직/동작 변화 없이 순수하게 파일만 나눈 것.

- `css/style.css` — 기존 `<style>` 블록 전체
- `js/state.js`, `api.js`, `landing.js`, `settings.js`, `routine-doc.js`, `workout-start.js`, `cards.js`, `add-exercise.js`, `import.js`, `complete.js`, `dashboard.js`, `search-history.js`, `init.js` — 기존 하나였던 `<script>` 블록을 화면/기능별로 분리. `index.html`에 `<script defer src="...">` 순서로 로드되며 **`init.js`가 반드시 마지막**(앱 시작 코드가 다른 모든 파일의 함수/전역변수를 참조하기 때문).
- 전역 변수(`exercises`, `GAS_URL`, `missionData` 등, [[app-launch-speed-swr-caching]] 참고)는 여전히 모든 js 파일이 공유하는 구조 — ES 모듈이 아니라 plain `<script>` 태그로, 빌드 도구 없음.
- `gas/Code.js`(GAS 백엔드)는 이번 리팩터 대상 아님, 그대로 유지.
- 로컬 정적 서버 테스트용 `.claude/launch.json` 추가함 (`python -m http.server 8420`).
- **배포 완료**: origin(`github.com/TaiyoungJ/gym-coach`) main에 커밋 2개(CSS 분리 / JS 분리) 푸시함. GitHub Pages(`https://taiyoungj.github.io/gym-coach/`)에 반영되어 PC·휴대폰 모두 정상 작동 확인함(2026-07-16).

**Why:** 사용자가 다른 프로젝트(도서 신청 앱)를 여러 페이지로 나눈 것을 보고 gym-coach도 검토 요청. 도서 앱과 달리 gym-coach는 SPA+공유 상태 구조라 실제 다중 페이지로는 쪼개지 않고, CSS/JS 파일만 분리하는 방식으로 진행함(계획 파일: `C:\Users\admin\.claude\plans\resilient-marinating-grove.md`).
**How to apply:** 앞으로 gym-coach의 특정 화면/기능(예: 카드 렌더링, 검색 기록, 설정)을 수정할 때는 2539줄짜리 `index.html`이 아니라 위 목록에서 해당 파일만 열어서 작업할 것. 새 전역 상태를 추가할 땐 `js/state.js`에 넣고, `init.js`가 항상 스크립트 목록 마지막에 와야 한다는 제약을 깨지 말 것.
