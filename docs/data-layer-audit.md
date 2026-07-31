# Аудит слоя данных Pathy

UI больше не читает ответы серверных функций напрямую. Между ними — Repository Layer
(`src/lib/repositories/*`), который прогоняет любой ответ через Zod
(`src/lib/query/parse.ts`) и всегда отдаёт предсказуемый тип.

## Контракты

| Репозиторий | Метод | Транспорт (server fn) | Старый контракт | Новый контракт |
| --- | --- | --- | --- | --- |
| analytics | overview | getStudentOverview | объект без гарантий | `StudentOverview` |
| analytics | weakTopics | listWeakTopics | `any[]` / envelope | `WeakTopic[]` |
| analytics | recommendations | getRecommendations | `any[]` / envelope | `Recommendation[]` |
| student | profile | getMyStudentProfile | `any` | `StudentProfile \| null` |
| student | subjects | listMyStudentSubjects | `any[]` | `StudentSubject[]` |
| student | subjectCatalog | listSubjects | `any[]` | `Subject[]` |
| student | programs | listSubjectPrograms | `any[]` | `SubjectProgram[]` |
| student | topicProgress | listTopicProgressBySubject | `any[]` | `TopicProgressRow[]` |
| student | weakTopics | listMyWeakTopics | `any[]` | `TopicProgressRow[]` |
| student | recentMistakes | listMyRecentMistakes | `any[]` | `MistakeRow[]` |
| student | profileAnalytics | getStudentProfileAnalytics | объект | `ProfileAnalytics` (с fallback) |
| learningPath | calendarEvents | listCalendarEvents | `{events}` / `any[]` | `CalendarEvent[]` |
| learningPath | paths | listMyLearningPaths | `{paths}` | `LearningPath[]` |
| learningPath | detail | getLearningPath | `{path, items}` c `any` | `{path: LearningPath \| null, items: LearningPathItem[]}` |
| diagnostic | available | listAvailableDiagnostics | `any[]` | `DiagnosticTest[]` |
| diagnostic | history | listMyDiagnosticHistory | `any[]` | `DiagnosticHistoryRow[]` |
| community | myCandidates | listMyCandidates | `{candidates}` | `Candidate[]` |
| community | subjects | listSubjectsForLibrary | `any[]` | `Subject[]` |
| community | adminQueue | adminListCandidates | `{candidates, counts}` c `any` | `{candidates: AdminCandidate[], counts}` |
| teacher | students | listMyTeacherStudents | `{teacher, students}` | `TeacherStudent[]` |

## Правила

- `parseList` / `parseOne` никогда не бросают: при рассинхроне схемы логируют
  предупреждение и возвращают `[]` / `null`.
- Envelope-объекты (`{data}`, `{items}`, `{candidates}`, `{students}`, `{paths}`)
  разворачиваются автоматически.
- React Query везде через `listQuery` / `itemQuery` — списки имеют `initialData: []`,
  поэтому `.map` безопасен без защит.
- Ошибки рендера изолируются `SectionBoundary` по блокам.
- Мониторинг фактических форм ответов: `/dev/data-health`.

## Регрессии

`tests/routes-smoke.spec.ts` открывает ключевые экраны student/teacher/admin и падает,
если в DOM или консоли появляется `is not a function`.
