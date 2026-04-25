import { useEffect, useMemo, useState } from "react";
import { Clock3, Plus, Trash2, TimerReset, Upload, X } from "lucide-react";

import {
  loadSubjectDiagnostic,
  searchTasksForSubject,
  saveDiagnosticSession,
  saveExternalDiagnostic,
  deleteExternalDiagnostic,
  listDiagnosticHistory,
  listSubjects,
  type DiagnosticTaskRow,
  type DiagnosticHistoryItem,
} from "@/lib/oge-diagnostic.functions";
import type { PlanItem } from "@/lib/oge-mvp-data";

const SUBJECT_DURATION_SECONDS = 30 * 60;

type SubjectInfo = { id: string; name: string; slug: string };

type SubjectState = {
  loading: boolean;
  tasks: DiagnosticTaskRow[];
  answers: Record<string, string | string[]>;
  started: boolean;
  submitted: boolean;
  remaining: number;
  result: ReturnType<typeof evaluate> | null;
};

function evaluate(tasks: DiagnosticTaskRow[], answers: Record<string, string | string[]>) {
  const evaluated = tasks.map((t) => {
    const ans = answers[t.id];
    const userNorm = Array.isArray(ans)
      ? [...ans].map((s) => s.trim().toLowerCase()).sort().join("|")
      : (typeof ans === "string" ? ans.trim().toLowerCase() : "");
    const correctNorm = Array.isArray(t.correctAnswer)
      ? [...t.correctAnswer].map((s) => s.trim().toLowerCase()).sort().join("|")
      : t.correctAnswer.trim().toLowerCase();
    return { task: t, isCorrect: userNorm === correctNorm };
  });
  const correctCount = evaluated.filter((e) => e.isCorrect).length;
  const scorePercent = Math.round((correctCount / Math.max(evaluated.length, 1)) * 100);
  const topicMap = new Map<string, { topic: string; total: number; correct: number }>();
  for (const e of evaluated) {
    const key = e.task.topicTitle ?? "Без темы";
    const cur = topicMap.get(key) ?? { topic: key, total: 0, correct: 0 };
    cur.total += 1;
    if (e.isCorrect) cur.correct += 1;
    topicMap.set(key, cur);
  }
  const topicStats = [...topicMap.values()].map((s) => ({
    ...s,
    percent: Math.round((s.correct / Math.max(s.total, 1)) * 100),
  }));
  const weakTopics = topicStats.filter((s) => s.percent < 70).map((s) => s.topic);
  const strongTopics = topicStats.filter((s) => s.percent >= 80).map((s) => s.topic);
  return { evaluated, correctCount, scorePercent, topicStats, weakTopics, strongTopics };
}

function fmtTime(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

type Props = { planItems: PlanItem[] };

export function DiagnosticPanel({ planItems }: Props) {
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [stateBySubject, setStateBySubject] = useState<Record<string, SubjectState>>({});
  const [history, setHistory] = useState<DiagnosticHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [searchResults, setSearchResults] = useState<DiagnosticTaskRow[]>([]);

  // Compute weekly topics per subject from plan: take last 7 days of past lessons
  const weeklyTopicsBySubject = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const map = new Map<string, Set<string>>();
    for (const p of planItems) {
      if (p.dateISO < weekAgo || p.dateISO > today) continue;
      const set = map.get(p.subject) ?? new Set<string>();
      set.add(p.topic);
      map.set(p.subject, set);
    }
    return map;
  }, [planItems]);

  useEffect(() => {
    listSubjects().then(({ subjects }) => {
      setSubjects(subjects);
      if (subjects.length && !activeSubjectId) setActiveSubjectId(subjects[0].id);
    });
    refreshHistory();
  }, []);

  async function refreshHistory() {
    setHistoryLoading(true);
    try {
      const res = await listDiagnosticHistory();
      setHistory(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      console.error(e);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) ?? null;
  const activeState: SubjectState = activeSubjectId
    ? stateBySubject[activeSubjectId] ?? {
        loading: false,
        tasks: [],
        answers: {},
        started: false,
        submitted: false,
        remaining: SUBJECT_DURATION_SECONDS,
        result: null,
      }
    : {
        loading: false,
        tasks: [],
        answers: {},
        started: false,
        submitted: false,
        remaining: SUBJECT_DURATION_SECONDS,
        result: null,
      };

  function updateState(patch: Partial<SubjectState>) {
    if (!activeSubjectId) return;
    setStateBySubject((prev) => ({
      ...prev,
      [activeSubjectId]: { ...activeState, ...patch },
    }));
  }

  // Build enriched answer payload for saving
  function buildAnswersPayload(state: SubjectState, result: ReturnType<typeof evaluate>) {
    return state.tasks.map((t, idx) => {
      const ev = result.evaluated.find((e) => e.task.id === t.id);
      const userAns = state.answers[t.id];
      return {
        taskId: t.id,
        taskNumber: idx + 1,
        isCorrect: !!ev?.isCorrect,
        topicTitle: t.topicTitle ?? null,
        prompt: t.prompt,
        answerType: t.answerType,
        userAnswer: Array.isArray(userAns) ? userAns : (typeof userAns === "string" ? userAns : ""),
        correctAnswer: t.correctAnswer,
      };
    });
  }

  async function persistSession(
    subjectId: string,
    state: SubjectState,
    result: ReturnType<typeof evaluate>,
    autoSubmitted: boolean,
  ) {
    if (state.tasks.length === 0) return;
    try {
      await saveDiagnosticSession({
        data: {
          subjectId,
          scorePercent: result.scorePercent,
          score: result.correctCount,
          maxScore: state.tasks.length,
          weakTopics: result.weakTopics,
          strongTopics: result.strongTopics,
          autoSubmitted,
          answers: buildAnswersPayload(state, result),
        },
      });
      await refreshHistory();
    } catch (e) {
      console.error("persistSession failed", e);
    }
  }

  // Timer — auto-submit on 0 and persist
  useEffect(() => {
    if (!activeState.started || activeState.submitted) return;
    const id = window.setInterval(() => {
      setStateBySubject((prev) => {
        if (!activeSubjectId) return prev;
        const cur = prev[activeSubjectId];
        if (!cur || !cur.started || cur.submitted) return prev;
        const next = cur.remaining - 1;
        if (next <= 0) {
          const result = evaluate(cur.tasks, cur.answers);
          const finished: SubjectState = { ...cur, started: false, submitted: true, remaining: 0, result };
          queueMicrotask(() => {
            void persistSession(activeSubjectId, finished, result, true);
          });
          return { ...prev, [activeSubjectId]: finished };
        }
        return { ...prev, [activeSubjectId]: { ...cur, remaining: next } };
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeState.started, activeState.submitted, activeSubjectId]);

  async function handleStart() {
    if (!activeSubject) return;
    updateState({ loading: true });
    const weekly = [...(weeklyTopicsBySubject.get(activeSubject.name) ?? new Set<string>())];
    const { tasks } = await loadSubjectDiagnostic({
      data: { subjectId: activeSubject.id, weeklyTopicTitles: weekly, limit: 10 },
    });
    updateState({
      loading: false,
      tasks,
      answers: {},
      started: true,
      submitted: false,
      remaining: SUBJECT_DURATION_SECONDS,
      result: null,
    });
  }

  async function handleSubmit() {
    if (!activeSubject) return;
    const result = evaluate(activeState.tasks, activeState.answers);
    const finished: SubjectState = { ...activeState, started: false, submitted: true, result };
    updateState({ started: false, submitted: true, result });
    await persistSession(activeSubject.id, finished, result, false);
  }

  function answerSingle(taskId: string, value: string) {
    updateState({ answers: { ...activeState.answers, [taskId]: value } });
  }
  function toggleMulti(taskId: string, option: string) {
    const cur = Array.isArray(activeState.answers[taskId]) ? (activeState.answers[taskId] as string[]) : [];
    const next = cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option];
    updateState({ answers: { ...activeState.answers, [taskId]: next } });
  }
  function removeTask(taskId: string) {
    const tasks = activeState.tasks.filter((t) => t.id !== taskId);
    const answers = { ...activeState.answers };
    delete answers[taskId];
    updateState({ tasks, answers });
  }

  async function searchTasks(q: string) {
    if (!activeSubject) return;
    setTaskSearch(q);
    const { tasks } = await searchTasksForSubject({
      data: {
        subjectId: activeSubject.id,
        query: q,
        excludeIds: activeState.tasks.map((t) => t.id),
      },
    });
    setSearchResults(tasks);
  }
  function addTaskToSession(task: DiagnosticTaskRow) {
    updateState({ tasks: [...activeState.tasks, task] });
    setSearchResults((r) => r.filter((t) => t.id !== task.id));
  }

  return (
    <div className="diagnostic-stack">
      {/* Subject tabs */}
      <section className="diagnostic-hero">
        <div className="diagnostic-hero__copy">
          <span className="focus-pill">Диагностика по предмету</span>
          <div>
            <div className="list-row__title">30 минут на предмет · задания из БД по темам недели</div>
            <div className="list-row__meta">
              Выберите предмет, начните диагностику. Можно вручную добавлять и удалять задания.
            </div>
          </div>
        </div>
        <div className="diagnostic-hero__stats">
          <article className="result-card result-card--lesson-page">
            <span className="result-card__label">Таймер</span>
            <strong className="result-card__value">{fmtTime(activeState.remaining)}</strong>
            <span className="result-card__meta">30 минут на предмет</span>
          </article>
          <article className="result-card">
            <span className="result-card__label">Заданий</span>
            <strong className="result-card__value">{activeState.tasks.length}</strong>
            <span className="result-card__meta">в текущем тесте</span>
          </article>
        </div>
      </section>

      <div className="tab-row" role="tablist" aria-label="Предметы">
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === activeSubjectId ? "tab-chip is-active" : "tab-chip"}
            onClick={() => setActiveSubjectId(s.id)}
          >
            <span>{s.name}</span>
          </button>
        ))}
      </div>

      {/* Active subject diagnostic panel */}
      <section className="diagnostic-focus-panel">
        <div className="diagnostic-focus-panel__head">
          <div>
            <div className="list-row__title">{activeSubject?.name ?? "Предмет"}</div>
            <div className="list-row__meta">
              Темы недели: {[...(weeklyTopicsBySubject.get(activeSubject?.name ?? "") ?? new Set<string>())].join(", ") || "нет данных за неделю — будут случайные темы предмета"}
            </div>
          </div>
          <div className="lesson-actions-row">
            {!activeState.started && !activeState.submitted ? (
              <button type="button" className="action-link diagnostic-primary-action" onClick={handleStart} disabled={activeState.loading}>
                {activeState.loading ? "Загрузка…" : "Начать диагностику"}
              </button>
            ) : null}
            {activeState.started ? (
              <button type="button" className="action-link diagnostic-primary-action" onClick={handleSubmit}>
                Проверить результат
              </button>
            ) : null}
            {(activeState.started || activeState.submitted) && activeState.tasks.length > 0 ? (
              <button type="button" className="action-link" onClick={handleStart}>
                <TimerReset className="h-4 w-4" />
                <span>Заново</span>
              </button>
            ) : null}
            {(activeState.started || activeState.submitted) ? (
              <button type="button" className="action-link" onClick={() => setShowAddTask((v) => !v)}>
                <Plus className="h-4 w-4" />
                <span>Добавить задание</span>
              </button>
            ) : null}
          </div>
        </div>

        {showAddTask ? (
          <div className="diagnostic-feedback-card">
            <div className="diagnostic-feedback-card__head">
              <strong>Поиск заданий по предмету</strong>
              <button type="button" className="action-link" onClick={() => setShowAddTask(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="editor-field">
              <span>Запрос</span>
              <input value={taskSearch} onChange={(e) => searchTasks(e.target.value)} placeholder="Введите слово из условия задания…" />
            </label>
            <div className="diagnostic-task-stack">
              {searchResults.length === 0 ? (
                <div className="list-row__meta">Введите запрос или нажмите пробел, чтобы увидеть задания предмета.</div>
              ) : null}
              {searchResults.map((t) => (
                <article key={t.id} className="diagnostic-task-card">
                  <div className="diagnostic-task-card__head">
                    <div>
                      <div className="list-row__meta">{t.topicTitle ?? "Без темы"} · {t.difficulty}</div>
                      <div className="diagnostic-task-card__prompt">{t.prompt}</div>
                    </div>
                    <button type="button" className="action-link" onClick={() => addTaskToSession(t)}>
                      <Plus className="h-4 w-4" /> Добавить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeState.started || activeState.submitted ? (
          <div className="diagnostic-task-stack">
            {activeState.tasks.length === 0 ? (
              <div className="diagnostic-empty-state">
                <Clock3 className="h-5 w-5" />
                <div>
                  <div className="list-row__title">Нет заданий в БД по темам недели</div>
                  <div className="list-row__meta">Добавьте задания вручную через «Добавить задание» или подождите наполнения базы.</div>
                </div>
              </div>
            ) : null}
            {activeState.tasks.map((task, index) => {
              const value = activeState.answers[task.id];
              const evaluated = activeState.result?.evaluated.find((e) => e.task.id === task.id);
              return (
                <article key={task.id} className="diagnostic-task-card">
                  <div className="diagnostic-task-card__head">
                    <div>
                      <div className="program-subject-title">
                        <span>{task.subjectName}</span>
                      </div>
                      <div className="list-row__meta">Задание {index + 1} · {task.topicTitle ?? "Без темы"}</div>
                    </div>
                    <div className="lesson-actions-row">
                      <span className="list-badge">
                        {task.answerType === "multiple" ? "Множественный выбор" : task.answerType === "text" ? "Краткий ответ" : "Один ответ"}
                      </span>
                      {!activeState.submitted ? (
                        <button type="button" className="action-link" onClick={() => removeTask(task.id)} aria-label="Удалить задание">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="diagnostic-task-card__prompt">{task.prompt}</div>

                  {task.answerType === "single" && task.options.length > 0 ? (
                    <div className="diagnostic-option-grid">
                      {task.options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={value === option ? "selection-card compact-grid is-active" : "selection-card compact-grid"}
                          onClick={() => answerSingle(task.id, option)}
                          disabled={activeState.submitted}
                        >
                          <span className="selection-card__title">{option}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {task.answerType === "multiple" ? (
                    <div className="diagnostic-option-grid">
                      {task.options.map((option) => {
                        const sel = Array.isArray(value) ? value : [];
                        return (
                          <button
                            key={option}
                            type="button"
                            className={sel.includes(option) ? "selection-card compact-grid is-active" : "selection-card compact-grid"}
                            onClick={() => toggleMulti(task.id, option)}
                            disabled={activeState.submitted}
                          >
                            <span className="selection-card__title">{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {task.answerType === "text" ? (
                    <label className="editor-field diagnostic-answer-field">
                      <span>Ответ</span>
                      <input
                        value={typeof value === "string" ? value : ""}
                        onChange={(e) => answerSingle(task.id, e.target.value)}
                        disabled={activeState.submitted}
                        placeholder="Введите краткий ответ"
                      />
                    </label>
                  ) : null}

                  {activeState.submitted && evaluated ? (
                    <div className="diagnostic-feedback-card">
                      <div className="diagnostic-feedback-card__head">
                        <span className={evaluated.isCorrect ? "status-pill status-pill--done" : "status-pill status-pill--pending"}>
                          {evaluated.isCorrect ? "Верно" : "Нужно повторить"}
                        </span>
                        <span className="list-row__meta">
                          Правильный ответ: {Array.isArray(task.correctAnswer) ? task.correctAnswer.join(", ") : task.correctAnswer}
                        </span>
                      </div>
                      {task.explanation ? <p className="status-line">{task.explanation}</p> : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="diagnostic-empty-state">
            <Clock3 className="h-5 w-5" />
            <div>
              <div className="list-row__title">Тест ещё не запущен</div>
              <div className="list-row__meta">Длительность — 30 минут. Задания подгрузятся по темам, пройденным за неделю.</div>
            </div>
          </div>
        )}
      </section>

      {/* Result */}
      {activeState.submitted && activeState.result ? (
        <section className="diagnostic-results-grid">
          <article className="analytics-surface">
            <div className="analytics-surface__head">
              <div>
                <div className="list-row__title">Результат</div>
                <div className="list-row__meta">Сводка по последней диагностике предмета.</div>
              </div>
            </div>
            <div className="diagnostic-summary-grid">
              <article className="result-card result-card--lesson-page">
                <span className="result-card__label">Итог</span>
                <strong className="result-card__value">{activeState.result.scorePercent}%</strong>
                <span className="result-card__meta">Верно {activeState.result.correctCount} из {activeState.tasks.length}</span>
              </article>
              <article className="result-card">
                <span className="result-card__label">Слабые темы</span>
                <strong className="result-card__value">{activeState.result.weakTopics.length}</strong>
                <span className="result-card__meta">для повторения</span>
              </article>
            </div>
          </article>

          <article className="analytics-surface">
            <div className="analytics-surface__head">
              <div>
                <div className="list-row__title">Разбивка по темам</div>
              </div>
            </div>
            <div className="analytics-list-stack">
              {activeState.result.topicStats.map((s) => (
                <article key={s.topic} className="analytics-list-card diagnostic-topic-card">
                  <div className="analytics-list-card__head">
                    <span className="subject-chip">{s.topic}</span>
                    <strong>{s.percent}%</strong>
                  </div>
                  <p className="status-line">{s.correct} из {s.total} верно.</p>
                </article>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {/* History */}
      <section className="analytics-surface">
        <div className="analytics-surface__head">
          <div>
            <div className="list-row__title">История диагностик</div>
            <div className="list-row__meta">Все пройденные на платформе и загруженные внешние результаты.</div>
          </div>
          <button type="button" className="action-link" onClick={() => setShowExternalForm((v) => !v)}>
            <Upload className="h-4 w-4" />
            <span>Загрузить внешнюю диагностику</span>
          </button>
        </div>

        {showExternalForm ? (
          <ExternalDiagnosticForm
            subjects={subjects}
            onSaved={async () => {
              setShowExternalForm(false);
              await refreshHistory();
            }}
          />
        ) : null}

        <div className="analytics-list-stack">
          {historyLoading ? <div className="list-row__meta">Загрузка…</div> : null}
          {!historyLoading && history.length === 0 ? (
            <div className="calendar-empty">Пока нет результатов. Пройдите диагностику или загрузите внешний результат.</div>
          ) : null}
          {history.map((h) => {
            const isOpen = expandedHistoryId === `${h.source}-${h.id}`;
            const errors = h.details.filter((d) => !d.isCorrect);
            const topics = Array.from(
              new Set(h.details.map((d) => d.topicTitle).filter((t): t is string => !!t)),
            );
            return (
              <article key={`${h.source}-${h.id}`} className="analytics-list-card">
                <div className="analytics-list-card__head">
                  <span className="subject-chip">{h.subjectName}</span>
                  <strong>
                    {h.score != null && h.maxScore != null
                      ? `${h.score} / ${h.maxScore}`
                      : h.scorePercent != null
                      ? `${h.scorePercent}%`
                      : "—"}
                  </strong>
                </div>
                <div className="list-row__meta">
                  {h.source === "external"
                    ? `Внешняя${h.sourceName ? " · " + h.sourceName : ""} · `
                    : h.autoSubmitted
                    ? "Автозавершение · "
                    : "Платформа · "}
                  {new Date(h.date).toLocaleDateString("ru-RU")}
                  {h.scorePercent != null ? ` · ${h.scorePercent}%` : ""}
                </div>
                {topics.length > 0 ? (
                  <p className="status-line">Темы: {topics.join(", ")}</p>
                ) : null}
                {(h.weakTopics?.length ?? 0) > 0 ? (
                  <p className="status-line">Слабые темы: {h.weakTopics.join(", ")}</p>
                ) : null}
                {h.notes ? <p className="status-line">{h.notes}</p> : null}
                {h.details.length > 0 ? (
                  <div className="lesson-actions-row">
                    <button
                      type="button"
                      className="action-link"
                      onClick={() =>
                        setExpandedHistoryId(isOpen ? null : `${h.source}-${h.id}`)
                      }
                    >
                      {isOpen ? "Скрыть задания" : `Показать задания (${h.details.length})`}
                    </button>
                    {errors.length > 0 ? (
                      <span className="list-badge">Ошибок: {errors.length}</span>
                    ) : null}
                  </div>
                ) : null}
                {isOpen && h.details.length > 0 ? (
                  <div className="diagnostic-task-stack">
                    {h.details.map((d) => (
                      <article key={`${h.id}-${d.taskNumber}`} className="diagnostic-task-card">
                        <div className="diagnostic-task-card__head">
                          <div>
                            <div className="list-row__meta">
                              Задание №{d.taskNumber} · {d.topicTitle ?? "Без темы"}
                            </div>
                            {d.prompt ? (
                              <div className="diagnostic-task-card__prompt">{d.prompt}</div>
                            ) : null}
                          </div>
                          <span
                            className={
                              d.isCorrect
                                ? "status-pill status-pill--done"
                                : "status-pill status-pill--pending"
                            }
                          >
                            {d.isCorrect ? "Верно" : "Ошибка"}
                          </span>
                        </div>
                        <p className="status-line">
                          Ваш ответ:{" "}
                          {Array.isArray(d.userAnswer)
                            ? d.userAnswer.join(", ") || "—"
                            : (d.userAnswer ?? "—") || "—"}
                        </p>
                        {!d.isCorrect ? (
                          <p className="status-line">
                            Правильный ответ:{" "}
                            {Array.isArray(d.correctAnswer)
                              ? d.correctAnswer.join(", ")
                              : d.correctAnswer ?? "—"}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : null}
                {h.source === "external" ? (
                  <button
                    type="button"
                    className="action-link"
                    onClick={async () => {
                      await deleteExternalDiagnostic({ data: { id: h.id } });
                      await refreshHistory();
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Удалить
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ExternalDiagnosticForm({ subjects, onSaved }: { subjects: SubjectInfo[]; onSaved: () => Promise<void> | void }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [sourceName, setSourceName] = useState("");
  const [takenOn, setTakenOn] = useState(new Date().toISOString().slice(0, 10));
  const [scorePercent, setScorePercent] = useState<string>("");
  const [weakTopicsRaw, setWeakTopicsRaw] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId && subjects[0]) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subjectId || !sourceName.trim()) {
      setError("Укажите предмет и источник.");
      return;
    }
    const pct = scorePercent.trim().length > 0 ? Number(scorePercent) : null;
    if (pct != null && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      setError("Процент должен быть от 0 до 100.");
      return;
    }
    setSaving(true);
    try {
      const res = await saveExternalDiagnostic({
        data: {
          subjectId,
          sourceName: sourceName.trim(),
          takenOn,
          scorePercent: pct,
          weakTopics: weakTopicsRaw.split(",").map((s) => s.trim()).filter(Boolean),
          strongTopics: [],
          notes: notes.trim() || null,
        },
      });
      if (!res?.ok) {
        setError(res?.error ?? "Не удалось сохранить");
        return;
      }
      setSourceName("");
      setScorePercent("");
      setWeakTopicsRaw("");
      setNotes("");
      await onSaved();
    } catch (err) {
      console.error(err);
      const status = (err as Response)?.status;
      setError(status === 401 ? "Войдите, чтобы сохранять результаты." : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="diagnostic-feedback-card" onSubmit={submit}>
      <div className="diagnostic-feedback-card__head">
        <strong>Внешний результат</strong>
        <span className="list-row__meta">Эти данные используются для корректировки плана занятий.</span>
      </div>
      <div className="diagnostic-summary-grid">
        <label className="editor-field">
          <span>Предмет</span>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="editor-field">
          <span>Источник (Решу ОГЭ, Яндекс.Репетитор…)</span>
          <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} maxLength={200} required />
        </label>
        <label className="editor-field">
          <span>Дата</span>
          <input type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />
        </label>
        <label className="editor-field">
          <span>Результат, %</span>
          <input type="number" min={0} max={100} value={scorePercent} onChange={(e) => setScorePercent(e.target.value)} placeholder="например, 72" />
        </label>
      </div>
      <label className="editor-field">
        <span>Слабые темы (через запятую)</span>
        <input value={weakTopicsRaw} onChange={(e) => setWeakTopicsRaw(e.target.value)} placeholder="Геометрия, Word formation" />
      </label>
      <label className="editor-field">
        <span>Заметки</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={2} />
      </label>
      {error ? <p className="status-line" style={{ color: "var(--destructive)" }}>{error}</p> : null}
      <div className="lesson-actions-row">
        <button type="submit" className="action-link diagnostic-primary-action" disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить результат"}
        </button>
      </div>
    </form>
  );
}
