---
name: app-launch-speed-swr-caching
description: gym-coach app-launch slowness comes from GAS backend round-trips; fixed launch path with parallel calls + localStorage SWR mission cache
metadata: 
  node_type: memory
  type: project
  originSessionId: 26309237-1949-4744-a4ff-8defd926c3b0
---

핸니의 체육관 앱의 "켤 때 느림"은 UI가 아니라 Google Apps Script 백엔드 왕복 대기(콜드스타트+시트 접근, 호출당 2~5초)가 원인.

2026-07-15에 `loadBackgroundData()`(index.html)를 개선: (1) `checkWeekStatus`와 `getMission`을 순차 await → 병렬 발사, (2) 오늘 미션을 `gc_mission_<날짜>` localStorage에 stale-while-revalidate 캐싱해 재실행 시 즉시 렌더 후 백그라운드 갱신. 캐시 헬퍼 `readMissionCache`/`writeMissionCache` 추가. testMode는 캐시 미사용.

**Why:** 사용자가 매일 앱 켤 때 로딩 대기를 줄이고 싶어 함. 취미 바이브 코더라 GAS 재배포 없는 클라이언트-only 변경을 선호.
**How to apply:** 추가 속도 개선이 필요하면 다음 후보 — 백엔드 CacheService(GAS 재배포 필요), 서비스 워커(앱 셸 캐싱+오프라인), 아이콘 5.9MB 리사이즈. 백엔드 시트 전체읽기(`getDataRange().getValues()`)도 데이터 누적 시 병목.

관련: [[exercise-trend-chart-idea]]
