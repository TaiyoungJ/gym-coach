/**
 * gym-coach Apps Script v2.0.0
 * ──────────────────────────────────────────────────────────
 * v2.0.0 변경사항:
 * - parseRoutineForDay(): [세부종목] 파싱 추가
 *   · 운동명 [세부종목] (세트수) 형식 지원
 *   · 슈퍼세트 서브 종목도 동일 형식 지원
 * - findTarget(): 운동명 + 세부종목 정확 매칭으로 단순화
 *   · 1단계: 운동명 + 세부종목 정확 매칭
 *   · 2단계: 운동명만 매칭 (세부종목 없는 종목 폴백)
 * - getMission(): findTarget() 호출 시 variation 인자 추가
 */

// ── 설정값 로드 ─────────────────────────────────────────────
function getProps() {
  const p = PropertiesService.getScriptProperties();
  return {
    token:           p.getProperty('SECRET_TOKEN'),
    spreadsheetId:   p.getProperty('SPREADSHEET_ID'),
    routineFileId:   p.getProperty('ROUTINE_FILE_ID'),
    claudeApiKey:    p.getProperty('CLAUDE_API_KEY'),
    workoutLogDocId: p.getProperty('WORKOUT_LOG_DOC_ID'),
  };
}

// ── JSON 응답 헬퍼 ──────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 연도별 시트 헬퍼 ────────────────────────────────────────
function yearSheetName(base, year) {
  return `(${year}) ${base}`;
}
function getYearSheet(ss, base, year) {
  return ss.getSheetByName(yearSheetName(base, year));
}
function getOrCreateYearSheet(ss, base, year) {
  const name = yearSheetName(base, year);
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// ── 이번 주 월~일 범위 계산 ─────────────────────────────────
function getThisWeekRange() {
  const today = new Date();
  const day   = today.getDay();
  const diffToMonday = (day === 0) ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const start = formatDate(monday);
  const end   = formatDate(sunday);
  return { start, end, range: `${start} ~ ${end}` };
}

// ── normDate ─────────────────────────────────────────────────
function normDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).trim();
}

// ── GET 핸들러 ──────────────────────────────────────────────
function doGet(e) {
  const props = getProps();
  if (e.parameter.token !== props.token) {
    return jsonResponse({ error: 'Unauthorized' });
  }
  try {
    const action = e.parameter.action;
    if (action === 'getMission') {
      // 🆕 테스트용 가짜 날짜 (예: &testDate=2026-07-03)
      const testDate = e.parameter.testDate || null;
      return jsonResponse(getMission(props, testDate));
    }
    if (action === 'getCoaching') {
      const type        = e.parameter.type;
      const rawData     = e.parameter.missionData;
      const missionData = rawData ? JSON.parse(decodeURIComponent(rawData)) : null;
      return jsonResponse(getCoaching(type, missionData, props));
    }
    if (action === 'checkWeekStatus') return jsonResponse(checkWeekStatus(props));
    if (action === 'getRoutineDoc')   return jsonResponse(getRoutineDoc(props));
    if (action === 'searchHistory') {
      const params = {
        subAction:    e.parameter.subAction,
        day:          e.parameter.day,
        date:         e.parameter.date,
        exerciseName: e.parameter.exerciseName,
      };
      return jsonResponse(searchHistory(params, props));
    }
    return jsonResponse({ error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ── POST 핸들러 ─────────────────────────────────────────────
function doPost(e) {
  try {
    const body  = JSON.parse(e.postData.contents);
    const props = getProps();
    if (body.token !== props.token) return jsonResponse({ error: 'Unauthorized' });
    if (body.action === 'saveResult')      return jsonResponse(saveResult(body.data, props));
    if (body.action === 'getCoaching')     return jsonResponse(getCoaching(body.type, body.missionData, props));
    if (body.action === 'registerWeek')    return jsonResponse(registerWeek(props));
    if (body.action === 'saveWorkoutLog')  return jsonResponse(saveWorkoutLog(body.data, props));
    return jsonResponse({ error: 'Unknown action: ' + body.action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ── getMission ──────────────────────────────────────────────
// 🆕 testDate 인자 추가: 값이 있으면 "오늘"인 척 그 날짜를 사용
function getMission(props, testDate) {
  const today    = testDate ? new Date(testDate) : new Date();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayKor   = dayNames[today.getDay()];
  const todayStr = testDate || formatDate(today);

  const mdContent = DriveApp.getFileById(props.routineFileId)
                            .getBlob()
                            .getDataAsString('UTF-8');
  const { routineName, exercises } = parseRoutineForDay(mdContent, todayStr, dayKor);

  if (exercises.length === 0) {
    return { date: todayStr, day: dayKor, routineName: '오늘은 쉬는 날', exercises: [], lastWeekLog: [] };
  }

  const ss         = SpreadsheetApp.openById(props.spreadsheetId);
  const targetRows = getThisWeekTargets(ss, todayStr);

  const enriched = exercises.map(ex => {
    if (ex.isSuperset) {
      return {
        name:         ex.name,
        variation:    ex.variation || '',
        sets:         ex.sets,
        tag:          ex.tag || null,
        isSuperset:   true,
        subExercises: ex.subExercises.map(sub => {
          const match = findTarget(targetRows, sub.name, sub.variation);
          return {
            name:         sub.name,
            variation:    sub.variation || '',
            bodyPart:     match ? String(match[2]).trim() : '',
            targetWeight: match ? Number(match[5]) : null,
            targetReps:   match ? Number(match[6]) : null,
            memo:         match ? String(match[7]).trim() : '',
          };
        }),
      };
    }
    const match = findTarget(targetRows, ex.name, ex.variation);
    return {
      name:         ex.name,
      variation:    ex.variation || '',
      sets:         ex.sets,
      tag:          ex.tag || null,
      isSuperset:   false,
      bodyPart:     match ? String(match[2]).trim() : '',
      targetWeight: match ? Number(match[5]) : null,
      targetReps:   match ? Number(match[6]) : null,
      memo:         match ? String(match[7]).trim() : '',
    };
  });

  const lastWeekLog = getLastSessionLog(ss, routineName);
  return { date: todayStr, day: dayKor, routineName, exercises: enriched, lastWeekLog };
}

// ── saveResult ──────────────────────────────────────────────
function saveResult(data, props) {
  const ss       = SpreadsheetApp.openById(props.spreadsheetId);
  const year     = new Date().getFullYear();
  const logSheet = getOrCreateYearSheet(ss, '운동결과', year);

  const { date, day, routineName, results } = data;

  results.forEach(r => {
    if (r.isSuperset && r.subResults) {
      r.subResults.forEach(sub => {
        logSheet.appendRow([
          date, day, routineName,
          sub.name,
          sub.variation || '',
          sub.weight    || 0,
          r.sets        || 0,
          sub.targetReps || 0,
          r.rest        || '',
          Array.isArray(sub.weights) ? sub.weights.join(',') : '',
          countActualSets(sub.reps),
          Array.isArray(sub.reps) ? sub.reps.join(',') : String(sub.reps || ''),
          r.memo || '',
        ]);
      });
    } else {
      logSheet.appendRow([
        date, day, routineName,
        r.name,
        r.variation || '',
        r.weight    || 0,
        r.sets      || 0,
        r.targetReps || 0,
        r.rest      || '',
        Array.isArray(r.weights) ? r.weights.join(',') : '',
        countActualSets(r.reps),
        Array.isArray(r.reps) ? r.reps.join(',') : String(r.reps || ''),
        r.memo || '',
      ]);
    }
  });

  return { success: true, saved: results.length };
}

// ── countActualSets ─────────────────────────────────────────
function countActualSets(repsArray) {
  if (!Array.isArray(repsArray)) return 0;
  return repsArray.filter(v => v !== null && v !== undefined && v !== 0 && v !== '0' && v !== '').length;
}

// ── searchHistory ───────────────────────────────────────────
function searchHistory(params, props) {
  const ss = SpreadsheetApp.openById(props.spreadsheetId);
  const { subAction } = params;

  if (subAction === 'getDayList')      return getHistoryDayList(ss, params.day);
  if (subAction === 'getByDate')       return getHistoryByDate(ss, params.date);
  if (subAction === 'getExerciseList') return getHistoryExerciseList(ss);
  if (subAction === 'getByExercise')   return getHistoryByExercise(ss, params.exerciseName);

  return { error: 'Unknown subAction: ' + subAction };
}

// ── getAllLogData ────────────────────────────────────────────
function getAllLogData(ss) {
  const year = new Date().getFullYear();
  let data = [];
  [year, year - 1].forEach(y => {
    const sheet = getYearSheet(ss, '운동결과', y);
    if (sheet && sheet.getLastRow() > 2) {
      data = data.concat(sheet.getDataRange().getValues().slice(2));
    }
  });
  return data;
}

// ── getRecentLogData ─────────────────────────────────────────
function getRecentLogData(ss, weeks) {
  const today   = new Date();
  const cutoff  = new Date(today);
  cutoff.setDate(today.getDate() - (weeks * 7));
  const cutoffStr = formatDate(cutoff);
  const todayStr  = formatDate(today);
  return getAllLogData(ss).filter(row => {
    const d = normDate(row[0]);
    return d >= cutoffStr && d <= todayStr;
  });
}

// ── getHistoryDayList ────────────────────────────────────────
function getHistoryDayList(ss, day) {
  const data  = getAllLogData(ss);
  const dates = [...new Set(
    data
      .filter(row => String(row[1]).trim() === day)
      .map(row => normDate(row[0]))
      .filter(Boolean)
  )].sort().reverse();
  return { day, dates };
}

// ── getHistoryByDate ─────────────────────────────────────────
function getHistoryByDate(ss, date) {
  const year  = parseInt(date.substring(0, 4));
  const sheet = getYearSheet(ss, '운동결과', year);
  if (!sheet || sheet.getLastRow() <= 2) return { date, exercises: [] };

  const rows = sheet.getDataRange().getValues().slice(2);
  const exercises = rows
    .filter(row => normDate(row[0]) === date)
    .map(row => ({
      name:         String(row[3]).trim(),
      variation:    String(row[4]).trim(),
      targetWeight: Number(row[5]) || 0,
      targetSets:   Number(row[6]) || 0,
      targetReps:   Number(row[7]) || 0,
      rest:         String(row[8]).trim(),
      weights:      String(row[9]).trim(),
      actualSets:   Number(row[10]) || 0,
      reps:         String(row[11]).trim(),
      memo:         String(row[12]).trim(),
    }));

  return { date, exercises };
}

// ── getHistoryExerciseList ───────────────────────────────────
function getHistoryExerciseList(ss) {
  const data = getRecentLogData(ss, 12);

  const year = new Date().getFullYear();
  let allTargetRows = [];
  [year, year - 1].forEach(y => {
    const sheet = getYearSheet(ss, '중량 목표치', y);
    if (!sheet || sheet.getLastRow() === 0) return;
    const rows = sheet.getDataRange().getValues().filter(row =>
      row[0] && /\d{4}-\d{2}-\d{2}/.test(String(row[0]))
    );
    allTargetRows = allTargetRows.concat(rows);
  });

  const seen   = new Set();
  const result = [];
  data.forEach(row => {
    const name      = String(row[3]).trim();
    const variation = String(row[4]).trim();
    const key       = name + '|' + variation;
    if (!name || seen.has(key)) return;
    seen.add(key);
    const match    = findTarget(allTargetRows, name, variation);
    const bodyPart = match ? String(match[2]).trim() : '';
    result.push({ name, variation, bodyPart });
  });

  result.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return { exercises: result };
}

// ── getHistoryByExercise ─────────────────────────────────────
function getHistoryByExercise(ss, exerciseName) {
  const data = getRecentLogData(ss, 4);
  const norm = s => s.replace(/[\s·\-_,]/g, '').toLowerCase();
  const exNorm = norm(exerciseName);

  const matchingRows = data.filter(row => norm(String(row[3])) === exNorm);

  const dateMap = {};
  matchingRows.forEach(row => {
    const date = normDate(row[0]);
    if (!dateMap[date]) {
      dateMap[date] = {
        date,
        day:          String(row[1]).trim(),
        targetWeight: Number(row[5]) || 0,
        targetSets:   Number(row[6]) || 0,
        targetReps:   Number(row[7]) || 0,
        weights:      String(row[9]).trim(),
        actualSets:   Number(row[10]) || 0,
        reps:         String(row[11]).trim(),
        memo:         String(row[12]).trim(),
      };
    }
  });

  const results = Object.values(dateMap).sort((a, b) => b.date.localeCompare(a.date));
  return { exerciseName, results };
}

// ── getCoaching ─────────────────────────────────────────────
function getCoaching(type, missionData, props) {
  const systemPrompt =
    `당신은 정태영(1994년생, 목표: 베어 모드)의 웨이트 트레이닝 코치입니다.
호칭: 태영아 (이름 직접 호명)
자기 지칭: 형
톤: 친근한 동네 형, 단호하지만 따뜻한 말투

[중량 보정 규칙 — 피드백 시 활용]
- 바벨류: 설정중량 + 20kg (예: 40kg 설정 → 실제 60kg)
- 플레이트 로드 머신: 설정중량 × 2 (예: 35kg → 실제 70kg)
- 원 플레이트 로드 티바 머신 / 핀 로드 머신 / 케이블 / 덤벨: 보정 없음`;

  const summaryInstruction =
    `\n\n위 피드백을 다 쓴 다음, 반드시 아래 형식으로 일지용 한 줄 요약을 추가해줘. 피드백 본문과 빈 줄 하나로 구분해줘.
[SUMMARY]오늘 운동 핵심 한 줄 요약[/SUMMARY]
(예: [SUMMARY]전체 볼륨 상향, 벤치 최고 중량 100kg 달성[/SUMMARY])`;

  let userPrompt;
  let isOutroType = false;

  if (type === 'intro') {
    const mission   = missionData?.mission || missionData;
    const condition = missionData?.condition
      ? `\n컨디션·특이사항: ${missionData.condition}` : '';
    userPrompt =
      `오늘 운동 시작 전 인트로 코멘트를 써줘.
아래 세 단락으로 나눠서 써줘. 각 단락 사이에 빈 줄 하나씩 넣어줘.

1. 지난 기록 간단히 언급 (1-2문장)
2. 오늘 운동에서 집중할 포인트 (1-2문장)
3. 짧은 응원 한마디 (1문장)

오늘 미션 데이터: ${JSON.stringify(mission, null, 2)}${condition}`;

  } else if (type === 'freeIntro') {
    const userMessage = missionData?.userMessage || '';
    const condition   = missionData?.condition   || '';
    const combined    = [condition, userMessage].filter(Boolean).join('\n');
    userPrompt =
      `자유 운동 시작 전 코치 메시지를 써줘.
사용자 메시지: ${combined || '(없음)'}

사용자가 말한 내용을 바탕으로 짧고 실질적인 조언과 응원을 해줘 (3-4문장).`;

  } else if (type === 'outro') {
    isOutroType = true;
    const conditionRaw = missionData?.condition || '';
    const condition = conditionRaw ? `\n컨디션·특이사항: ${conditionRaw}` : '';
    const conditionSummaryInstruction = conditionRaw
      ? `\n[CONDITION_SUMMARY]컨디션 및 특이사항 한 줄 요약[/CONDITION_SUMMARY]\n(예: [CONDITION_SUMMARY]왼쪽 승모근 뭉침, 전반 컨디션 저조[/CONDITION_SUMMARY])`
      : '';
    userPrompt =
      `오늘 운동 완료 후 아웃트로 피드백을 써줘.
아래 세 단락으로 나눠서 써줘. 각 단락 사이에 빈 줄 하나씩 넣어줘.

1. 오늘 수행 결과 총평 (1-2문장)
2. 잘한 점 또는 개선 점 구체적으로 (1-2문장)
3. 오늘 마무리 한마디 (1문장)

오늘 결과 데이터: ${JSON.stringify(missionData, null, 2)}${condition}` + summaryInstruction + conditionSummaryInstruction;

  } else if (type === 'freeOutro') {
    isOutroType = true;
    const conditionRaw = missionData?.condition || '';
    const condition = conditionRaw || '(없음)';
    const conditionSummaryInstruction = conditionRaw
      ? `\n[CONDITION_SUMMARY]컨디션 및 특이사항 한 줄 요약[/CONDITION_SUMMARY]\n(예: [CONDITION_SUMMARY]왼쪽 승모근 뭉침, 전반 컨디션 저조[/CONDITION_SUMMARY])`
      : '';
    userPrompt =
      `자유 운동 완료 후 피드백을 써줘.
오늘은 루틴 없이 자유롭게 구성한 운동이야. 목표 중량 비교 대신 오늘 한 운동 자체에 집중해서 피드백해줘.
아래 세 단락으로 나눠서 써줘. 각 단락 사이에 빈 줄 하나씩 넣어줘.

1. 오늘 선택한 종목 구성이나 볼륨에 대한 총평 (1-2문장)
2. 컨디션·특이사항을 반영한 코멘트 또는 다음에 참고할 점 (1-2문장)
3. 마무리 한마디 (1문장)

컨디션·특이사항: ${condition}
오늘 결과 데이터: ${JSON.stringify(missionData?.results || [], null, 2)}` + summaryInstruction + conditionSummaryInstruction;

  } else {
    return { text: '알 수 없는 코칭 타입입니다.' };
  }

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method:  'post',
    headers: {
      'x-api-key':         props.claudeApiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    payload: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: isOutroType ? 500 : 400,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(response.getContentText());
  if (result.error) throw new Error('Claude API error: ' + result.error.message);

  if (isOutroType) {
    return parseOutroText(result.content[0].text);
  }
  return { text: result.content[0].text };
}

// ── parseOutroText ────────────────────────────────────────
function parseOutroText(rawText) {
  const summaryMatch    = rawText.match(/\[SUMMARY\]([\s\S]*?)\[\/SUMMARY\]/);
  const summary         = summaryMatch ? summaryMatch[1].trim() : '';
  const conditionMatch  = rawText.match(/\[CONDITION_SUMMARY\]([\s\S]*?)\[\/CONDITION_SUMMARY\]/);
  const conditionSummary = conditionMatch ? conditionMatch[1].trim() : '';
  const text = rawText
    .replace(/\[SUMMARY\][\s\S]*?\[\/SUMMARY\]/, '')
    .replace(/\[CONDITION_SUMMARY\][\s\S]*?\[\/CONDITION_SUMMARY\]/, '')
    .trim();
  return { text, summary, conditionSummary };
}

// ── saveWorkoutLog ─────────────────────────────────────────
function saveWorkoutLog(data, props) {
  const { date, day, routineName, results, outroSummary, conditionSummary } = data;

  const doc  = DocumentApp.openById(props.workoutLogDocId);
  const body = doc.getBody();
  let idx = 0;

  // 루틴명에서 "목요일: " 같은 앞부분 제거
  const cleanRoutineName = routineName.replace(/^[가-힣]+요일:\s*/, '');

  // 제목 텍스트: 날짜 (요) — 루틴명
  const datePart = `${date} (${day})`;
  const titleText = `${datePart} — ${cleanRoutineName}`;
  const heading = body.insertParagraph(idx++, titleText);
  heading.setHeading(DocumentApp.ParagraphHeading.HEADING1);

  // 날짜+요일 부분만 볼드, 나머지는 볼드 해제
  heading.editAsText()
    .setBold(0, titleText.length - 1, false)
    .setBold(0, datePart.length - 1, true);

  // ✅ 제목 다음 빈 줄 추가
  body.insertParagraph(idx++, '');

  // ✅ 컨디션 요약: 🩺 이모지, 볼드, 이탤릭 제거
  if (conditionSummary) {
    const condText = `🩺 ${conditionSummary}`;
    const condPara = body.insertParagraph(idx++, condText);
    condPara.editAsText().setBold(0, condText.length - 1, true);
  }

  const lines = buildExerciseSummary(results);
  lines.forEach(line => {
    const para = body.insertParagraph(idx++, line.text);
    if (line.boldEnd >= 0) {
      para.editAsText().setBold(0, line.boldEnd, true);
    }
  });

  if (outroSummary) {
    // 운동 목록과 코치 요약 사이 빈 줄
    body.insertParagraph(idx++, '');
    // ✅ 아웃트로 요약: 이모지 앞 공백 두 칸
    const summaryText = `  💬 ${outroSummary}`;
    const commentPara = body.insertParagraph(idx++, summaryText);
    commentPara.editAsText().setItalic(0, summaryText.length - 1, true);
  }

  body.insertHorizontalRule(idx);

  doc.saveAndClose();
  return { success: true };
}

// ── buildExerciseSummary ──────────────────────────────────
function buildExerciseSummary(results) {
  const lines = [];
  (results || []).forEach(r => {
    if (r.isSuperset && r.subResults) {
      r.subResults.forEach(sub => {
        lines.push(formatExerciseLine(sub.name, sub.variation, sub.weights, sub.reps));
      });
    } else {
      lines.push(formatExerciseLine(r.name, r.variation, r.weights, r.reps));
    }
  });
  return lines;
}

// ── formatExerciseLine ────────────────────────────────────
function formatExerciseLine(name, variation, weights, reps) {
  const wArr = Array.isArray(weights)
    ? weights.map(String)
    : String(weights || '').split(',').map(s => s.trim());
  const rArr = Array.isArray(reps)
    ? reps.map(String)
    : String(reps || '').split(',').map(s => s.trim());

  const pairs = wArr
    .map((w, i) => ({ w: w.trim(), r: (rArr[i] || '').trim() }))
    .filter(p => p.w && p.w !== '0' && p.r && p.r !== '0');

  const displayName = variation ? `${variation} ${name}` : name;

  if (pairs.length === 0) {
    return { text: displayName, boldEnd: displayName.length - 1 };
  }

  const detail = pairs.map(p => `${p.w}×${p.r}`).join(' → ');
  const text = `${displayName} — ${pairs.length}세트 / ${detail}`;
  return { text, boldEnd: displayName.length - 1 };
}

// ── checkWeekStatus ─────────────────────────────────────────
function checkWeekStatus(props) {
  const { range, start } = getThisWeekRange();
  const ss   = SpreadsheetApp.openById(props.spreadsheetId);
  const year = parseInt(start.substring(0, 4));
  const sheet = getYearSheet(ss, '중량 목표치', year);
  if (!sheet || sheet.getLastRow() === 0) return { registered: false, weekRange: range };
  const colA = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  const registered = colA.some(row => String(row[0]).trim() === range);
  return { registered, weekRange: range };
}

// ── registerWeek ────────────────────────────────────────────
function registerWeek(props) {
  const { range, start } = getThisWeekRange();
  const ss   = SpreadsheetApp.openById(props.spreadsheetId);
  const year = parseInt(start.substring(0, 4));
  const sheet = getOrCreateYearSheet(ss, '중량 목표치', year);
  if (sheet.getLastRow() > 0) {
    const colA = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
    if (colA.some(row => String(row[0]).trim() === range)) {
      return { success: true, weekRange: range, alreadyExisted: true };
    }
  }
  sheet.appendRow([range]);
  return { success: true, weekRange: range, alreadyExisted: false };
}

// ── getRoutineDoc ───────────────────────────────────────────
function getRoutineDoc(props) {
  const content = DriveApp.getFileById(props.routineFileId)
                          .getBlob()
                          .getDataAsString('UTF-8');
  return { content };
}

// ── 헬퍼 함수들 ────────────────────────────────────────────
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseRoutineForDay(md, todayStr, dayKor) {
  const lines = md.split('\n');
  let inActiveRoutine = false;
  let inTodaySection  = false;
  let routineName     = '';
  const exercises     = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (/^#{1,2}\s+\d+\./.test(line)) {
      inActiveRoutine = false;
      inTodaySection  = false;
      continue;
    }

    if (line.includes('기간') && line.includes('~')) {
      const m = line.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
      if (m) {
        inActiveRoutine = todayStr >= m[1] && todayStr <= m[2];
      }
      continue;
    }

    if (!inActiveRoutine) continue;

    if (line.startsWith('###')) {
      const sectionTitle = line.replace(/^###\s*/, '').trim();
      if (sectionTitle.includes('⚠️') || sectionTitle.includes('특이사항')
          || sectionTitle.includes('라이프사이클') || sectionTitle.includes('Timeline')) {
        if (inTodaySection) break;
        inTodaySection = false;
        continue;
      }
      const prevSection = inTodaySection;
      inTodaySection = sectionTitle.startsWith(dayKor + '요일');
      if (prevSection && !inTodaySection) break;
      if (inTodaySection) routineName = sectionTitle;
      continue;
    }

    if (inTodaySection && /^\d+\./.test(line)) {
      // 🆕 [세부종목] 파싱 포함한 정규식
      const m = line.match(/^\d+\.\s*(.+?)\s*\((\d+)\)(?:\s*\*\*\[(.+?)\]\*\*)?(?:\s*:\s*(.+))?/);
      if (m) {
        // 운동명에서 [세부종목] 추출
        const rawName   = m[1].trim();
        const varMatch  = rawName.match(/^(.+?)\s*\[(.+?)\]$/);
        const exName    = varMatch ? varMatch[1].trim() : rawName;
        const variation = varMatch ? varMatch[2].trim() : '';

        if (m[4]) {
          // 슈퍼세트: 서브 종목들도 [세부종목] 파싱
          const subNames = m[4].split('+').map(s => s.trim()).filter(Boolean);
          exercises.push({
            name:         exName,
            variation:    variation,
            sets:         parseInt(m[2]),
            tag:          m[3] || null,
            isSuperset:   true,
            subExercises: subNames.map(n => {
              const subVarMatch = n.match(/^(.+?)\s*\[(.+?)\]$/);
              return {
                name:      subVarMatch ? subVarMatch[1].trim() : n,
                variation: subVarMatch ? subVarMatch[2].trim() : '',
              };
            }),
          });
        } else {
          exercises.push({
            name:       exName,
            variation:  variation,
            sets:       parseInt(m[2]),
            tag:        m[3] || null,
            isSuperset: false,
          });
        }
      }
    }
  }

  return { routineName, exercises };
}

function getThisWeekTargets(ss, todayStr) {
  const d   = new Date(todayStr);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  const year = mon.getFullYear();

  const sheet = getYearSheet(ss, '중량 목표치', year);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const validRows = data.filter(row => {
    if (!row[0] || String(row[0]) === '주간 정보') return false;
    return /\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}/.test(String(row[0]));
  });

  const thisWeek = validRows.filter(row => {
    const m = String(row[0]).match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
    return m && todayStr >= m[1] && todayStr <= m[2];
  });
  if (thisWeek.length > 0) return thisWeek;

  const sorted = validRows.slice().sort((a, b) => {
    const ma = String(a[0]).match(/(\d{4}-\d{2}-\d{2})/);
    const mb = String(b[0]).match(/(\d{4}-\d{2}-\d{2})/);
    return ma && mb ? mb[1].localeCompare(ma[1]) : 0;
  });
  if (sorted.length === 0) return [];
  const latestRange = sorted[0][0];
  return sorted.filter(row => String(row[0]) === latestRange);
}

// 🆕 variation 인자 추가, 정확 매칭 우선
function findTarget(targetRows, exerciseName, variation) {
  const norm    = s => s.replace(/[\s·\-_,]/g, '').toLowerCase();
  const exNorm  = norm(exerciseName);
  const varNorm = variation ? norm(variation) : '';

  // 1단계: 운동명 + 세부종목 정확 매칭
  if (varNorm) {
    const found = targetRows.find(row =>
      norm(String(row[3])) === exNorm && norm(String(row[4])) === varNorm
    );
    if (found) return found;
  }

  // 2단계: 운동명만 매칭 (세부종목 없는 종목 폴백)
  const found = targetRows.find(row => norm(String(row[3])) === exNorm);
  return found || null;
}

// ── getLastSessionLog ────────────────────────────────────────
function getLastSessionLog(ss, routineName) {
  const year = new Date().getFullYear();
  const data = _getLogData(ss, year) || _getLogData(ss, year - 1);
  if (!data) return [];

  const routineKey   = routineName.split(':')[0].trim();
  const matchingRows = data.slice(2).filter(row =>
    String(row[2]).includes(routineKey) || routineKey.includes(String(row[2]).split(':')[0].trim())
  );
  if (matchingRows.length === 0) return [];

  const dates    = [...new Set(matchingRows.map(r => normDate(r[0])))].sort().reverse();
  const lastDate = dates[0];

  return matchingRows
    .filter(row => normDate(row[0]) === lastDate)
    .map(row => {
      const weightRaw   = String(row[9]).split(',')[0].trim();
      const weightValue = weightRaw ? Number(weightRaw) : Number(row[5]);
      return {
        name:         row[3],
        variation:    row[4],
        sets:         row[10],
        reps:         String(row[11]).split(','),
        weight:       weightValue,
        targetWeight: Number(row[5]),
        targetReps:   Number(row[7]),
        memo:         String(row[12]).trim(),
      };
    });
}

// ── _getLogData ──────────────────────────────────────────────
function _getLogData(ss, year) {
  const sheet = getYearSheet(ss, '운동결과', year);
  if (!sheet || sheet.getLastRow() <= 2) return null;
  return sheet.getDataRange().getValues();
}