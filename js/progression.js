/* ── 이중 진행 판정 (단계식 + 혼합형) ─────────────────────── */
// 루틴 문서의 {8~10, 메인} 표기(GAS → repRange, isMain)가 있는 종목만 판정한다.
// 세트를 앞쪽 "목표 세트"(단계 목표를 전부 채워야 함)와 뒤쪽 "방지턱 세트"(바닥만 지키면 됨)로 나눈다.
//   · 단계 목표 = 목표치 시트의 목표 횟수(targetReps), 바닥 = 목표 × 80% 반올림
//   · 목표 세트 수: 메인 = 세트수 − 1, 보조 = 세트수 / 2 내림 (둘 다 최소 1)
//   · 목표 무게보다 낮춘 세트는 횟수와 상관없이 미달
//
// item = { sets, isMain, repRange: {low, high}, targetReps, targetWeight }
//   슈퍼세트 서브 종목은 sets 가 없으므로 상위 카드의 sets 를 넣어서 넘긴다.
//
// localStorage
//   gc_judge_<날짜> = [{ name, icon, text }]  — 메인 화면 "오늘 운동 완료!" 카드에 그날 하루만 표시

function isJudged(item) {
  return !!(item && item.repRange && item.targetReps > 0 && item.sets > 0);
}
function floorReps(target) {
  return Math.round(target * 0.8);
}
function goalSetCount(sets, isMain) {
  return Math.max(1, isMain ? sets - 1 : Math.floor(sets / 2));
}
function isFloorSet(item, setNum) {
  return setNum > goalSetCount(item.sets, item.isMain);
}

// 세트 입력칸 placeholder — 목표 세트 "9", 방지턱 세트 "7~9"
function setPlaceholder(item, setNum) {
  if (!isJudged(item)) return item.targetReps || '-';
  return isFloorSet(item, setNum) ? `${floorReps(item.targetReps)}~${item.targetReps}` : item.targetReps;
}

// 세트 하나의 통과 여부 — 'pass' | 'short' | null(판정 안 함/미입력)
function setStatus(item, setNum, repsVal, weightVal) {
  if (!isJudged(item) || repsVal === '' || repsVal === undefined || repsVal === null) return null;
  const reps   = parseInt(repsVal) || 0;
  const weight = (weightVal === '' || weightVal === undefined || weightVal === null) ? item.targetWeight : parseFloat(weightVal);
  if ((item.targetWeight || 0) > 0 && weight < item.targetWeight) return 'short';
  const need = isFloorSet(item, setNum) ? floorReps(item.targetReps) : item.targetReps;
  return reps >= need ? 'pass' : 'short';
}

// 카드 상단 "범위 8~10 · 2단계 / 3단계"
function stageLabel(item) {
  if (!isJudged(item)) return '';
  const { low, high } = item.repRange;
  const total = high - low + 1;
  const stage = Math.min(total, Math.max(1, item.targetReps - low + 1));
  if (item.targetReps >= high) return `범위 ${low}~${high} · 이번 주 다 채우면 증량 🔥`;
  return `범위 ${low}~${high} · ${stage}단계 / ${total}단계`;
}

// 종목 판정 — reps/weights 는 세트 순서대로 (미입력 = 0). 판정 대상이 아니면 null.
// 미달 이유는 ① 목표 세트 → ② 방지턱 세트 순서로 첫 번째 것만 보여준다.
function judgeExercise(item, reps, weights) {
  if (!isJudged(item)) return null;
  const target = item.targetReps;
  const goalN  = goalSetCount(item.sets, item.isMain);
  const keep   = `→ ${target}회 유지`;

  const check = (from, to, need, label) => {
    const lowW = [], shortR = [];
    for (let s = from; s <= to; s++) {
      const w = weights[s - 1];
      if ((item.targetWeight || 0) > 0 && w !== undefined && w < item.targetWeight) lowW.push(s);
      else if ((reps[s - 1] || 0) < need) shortR.push(s);
    }
    if (lowW.length) return `${lowW.join('·')}세트 무게 낮춤(${weights[lowW[0] - 1]}kg)`;
    if (shortR.length) return `${shortR.join('·')}세트 ${label} 미달`;
    return null;
  };

  const fail = check(1, goalN, target, '목표') || check(goalN + 1, item.sets, floorReps(target), '바닥');
  if (fail) return { icon: '❌', text: `${fail} ${keep}` };
  if (target >= item.repRange.high) return { icon: '🎉', text: `상단 도달 → 무게 한 칸↑, ${item.repRange.low}회로 리셋` };
  return { icon: '✅', text: `통과 → 다음 주 ${target + 1}회` };
}

// 메모 맨 윗줄에 판정을 넣는다. 직접 쓴 메모는 그 아래로.
function prependJudgeMemo(judge, memo) {
  if (!judge) return memo;
  const line = `[판정] ${judge.icon} ${judge.text}`;
  return memo ? `${line}\n${memo}` : line;
}

function saveJudgements(dateIso, list) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gc_judge_') && k !== 'gc_judge_' + dateIso) localStorage.removeItem(k);
    }
    if (list.length) localStorage.setItem('gc_judge_' + dateIso, JSON.stringify(list));
    else localStorage.removeItem('gc_judge_' + dateIso);
  } catch {}
}
function readJudgements(dateIso = toIso(new Date())) {
  try {
    const raw = localStorage.getItem('gc_judge_' + dateIso);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
