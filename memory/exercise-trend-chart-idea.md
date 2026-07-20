---
name: exercise-trend-chart-idea
description: Backlog idea — per-exercise weight/volume trend chart (stats screen) for gym-coach
metadata: 
  node_type: memory
  type: project
  originSessionId: 26309237-1949-4744-a4ff-8defd926c3b0
---

종목별 중량·볼륨 변화를 그래프로 보여주는 통계 화면 아이디어. 현재 기록 검색은 목록/표만 있고 추이 그래프가 없음. 외부 라이브러리 없이 인라인 SVG로 구현 가능(앱은 의존성 제로 단일 index.html).

**Why:** 사용자(태영)가 2026-07-15 논의에서 "괜찮아 보이지만 급하지 않다"며 아이디어만 보관하기로 함.
**How to apply:** 속도 개선 등 우선 작업이 끝난 뒤 사용자가 요청하면 착수. 데이터는 GAS `searchHistory`/운동결과 시트에서 이미 종목별로 조회 가능하므로 클라이언트 SVG 렌더만 추가하면 됨.

관련: [[app-launch-speed-swr-caching]]
