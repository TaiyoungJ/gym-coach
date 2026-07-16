/* ── API ───────────────────────────────────────────────────── */
async function apiGet(params) {
  const url = new URL(GAS_URL);
  url.searchParams.set('token', TOKEN);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, typeof v === 'object' ? encodeURIComponent(JSON.stringify(v)) : v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Network error: ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
async function apiPost(body) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    
    body: JSON.stringify({ ...body, token: TOKEN }),
  });
  if (!res.ok) throw new Error('Network error: ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.text || data.error); // 🆕 실제 에러 메시지 우선 사용
  return data;
}

/* ── Mission Cache (stale-while-revalidate) ────────────────── */
// 오늘 날짜별로 미션을 localStorage에 보관해 재실행 시 즉시 렌더
function readMissionCache() {
  try {
    const raw = localStorage.getItem('gc_mission_' + toIso(new Date()));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeMissionCache(data) {
  try {
    const todayKey = 'gc_mission_' + toIso(new Date());
    // 오늘이 아닌 오래된 미션 캐시는 제거 (localStorage 누적 방지)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gc_mission_') && k !== todayKey) localStorage.removeItem(k);
    }
    localStorage.setItem(todayKey, JSON.stringify(data));
  } catch {}
}

/* ── Mock ──────────────────────────────────────────────────── */
function getMockMission() {
  return {
    date: toIso(new Date()), day: '월', routineName: '월요일: 가슴/어깨 스트렝스 (PUSH A)',
    exercises: [
      {
        id: 1, name: '벤치 프레스', variation: '바벨', sets: 4, tag: null, isSuperset: false,
        bodyPart: '가슴', targetWeight: 40, targetReps: 7, memo: '',
      },
      {
        id: 2, name: 'O.H.P', variation: '바벨', sets: 4, tag: null, isSuperset: false,
        bodyPart: '어깨', targetWeight: 20, targetReps: 7, memo: '',
      },
      {
        id: 3, name: '슈퍼세트', variation: '', sets: 3, tag: '펌핑/자극', isSuperset: true,
        subExercises: [
          { name: '시티드 체스트 프레스 머신', variation: '', bodyPart: '가슴', targetWeight: 50, targetReps: 12, memo: '' },
          { name: '라잉 트라이셉스 익스텐션', variation: '', bodyPart: '삼두', targetWeight: 30, targetReps: 12, memo: '팔꿈치 각도 신경쓸 것' },
        ],
      },
    ],
    lastWeekLog: [
      { name: '벤치 프레스', variation: '바벨', sets: 3, reps: ['7', '7', '6'], weight: 42.5, targetWeight: 40, targetReps: 7, memo: '마지막 세트 힘들었음' },
      { name: 'O.H.P', variation: '바벨', sets: 4, reps: ['7', '6', '6', '5'], weight: 20, targetWeight: 20, targetReps: 7, memo: '' },
      { name: '시티드 체스트 프레스 머신', variation: '', sets: 3, reps: ['12', '10', '10'], weight: 50, targetWeight: 50, targetReps: 12, memo: '' },
      { name: '라잉 트라이셉스 익스텐션', variation: '', sets: 3, reps: ['12', '12', '10'], weight: 30, targetWeight: 30, targetReps: 12, memo: '팔꿈치 각도 신경쓸 것' },
    ],
  };
}

/* ── 🆕 세부종목 + 운동명 조합 헬퍼 ───────────────────────── */
function buildDisplayName(name, variation) {
  return variation ? `${variation} ${name}` : name;
}

