# Стабилизация слоя данных Pathy

Цель — устранить архитектурную причину повторяющихся ошибок `.map/.filter/.reduce is not a function`: UI перестанет напрямую зависеть от формата RPC-ответов Supabase. Работаем в 5 итераций, каждая закрывается typecheck + Playwright smoke.

## Итерация 1 — Аудит и контракты

- Пройти по всем `src/lib/*.functions.ts` и собрать таблицу: функция → фактический return-shape (из кода + `supabase--read_query` при сомнениях) → целевой контракт (`Promise<T[]>` или `Promise<T | null>`).
- Сохранить отчёт в `docs/data-layer-audit.md` (таблица по разделам: student, teacher, admin, community, diagnostics, content, learning-path, analytics, assistant).
- Определить единый набор доменных моделей в `src/lib/models/` (StudentProfile, StudentSubject, Lesson, CalendarEvent, WeakTopic, Recommendation, DiagnosticSession, Material, CommunityCandidate, ...).

## Итерация 2 — Zod-схемы и модели

- `src/lib/models/schemas.ts` — Zod-схемы для каждой модели, экспорт типов через `z.infer`.
- Хелперы `parseList(schema, raw)` и `parseOne(schema, raw)`:
  - принимают `unknown`;
  - разворачивают `{ data }` / `{ items }` / одиночный объект → массив, где применимо;
  - при провале валидации логируют через `logger.warn` и возвращают `[]` / `null` (не бросают).

## Итерация 3 — Repository Layer

- `src/lib/repositories/` с файлами по доменам: `student.repository.ts`, `teacher.repository.ts`, `content.repository.ts`, `diagnostic.repository.ts`, `community.repository.ts`, `analytics.repository.ts`, `learning-path.repository.ts`, `assistant.repository.ts`, `materials.repository.ts`.
- Каждый метод:
  - вызывает существующий `createServerFn` через `useServerFn`-совместимый вызов (обёртка `callFn`);
  - прогоняет ответ через Zod;
  - возвращает строго `Promise<T[]>` или `Promise<T | null>`.
- Существующие `*.functions.ts` остаются как транспорт; репозиторий — единственный публичный API для UI.
- Убрать `any`/`as any` из репозиториев и сигнатур серверных функций (где это не требует правки RLS-логики).

## Итерация 4 — Переход UI и унификация React Query

- Единый `src/lib/query/defaults.ts`:
  - `listQuery(key, fn)` → `{ queryKey, queryFn, initialData: [], placeholderData: keepPreviousData }`;
  - `itemQuery(key, fn)` → `{ ..., initialData: null }`.
- Пройти по всем экранам student/teacher/admin, заменить прямые `useServerFn(...)` на репозитории + `listQuery`/`itemQuery`.
- Удалить локальные защиты: `Array.isArray`, `?? []`, ручные `normalizeList`, `as any` в компонентах.
- Ввести `src/components/section-boundary.tsx` — переиспользуемый локальный ErrorBoundary с loading/empty/error slot-ами. Обернуть блоки: profile, progress, path, lessons, calendar, library, recommendations, weak topics.

## Итерация 5 — Диагностика и регрессии

- Страница `/dev/data-health` (dev + admin): таблица репозиториев со статусом последнего запроса, типом, числом элементов, ошибками Zod (данные из in-memory реестра, куда `parseList/parseOne` пишут метаданные).
- Playwright: расширить `tests/student-home.spec.ts` до полного smoke (Student: home/profile/lessons/calendar/path/library/diagnostic; Teacher: dashboard/students/lessons/advisor/analytics/profile/library; Admin: studio/import/programs/community). Проверка: страница не в `role="alert"`-fallback, нет в консоли `is not a function`.
- Финальный отчёт в `docs/data-layer-audit.md`: старый контракт → новый контракт для каждой функции.

## Технические детали

- Логгер: тонкая обёртка `src/lib/logger.ts` (dev — `console.debug`, prod — no-op) для сообщений Zod.
- Реестр data-health: `src/lib/query/registry.ts` — Map с последней записью на ключ (без утечек, ограничение по размеру).
- Серверные функции остаются на `createServerFn` + `requireSupabaseAuth`; в контрактах фиксируем возвращаемый DTO (плоские объекты).
- Порядок правок в UI: student → teacher → admin → community/diagnostic — чтобы регрессии ловились по частям.

## Definition of Done

- Repository Layer покрывает 100% чтений/записей UI.
- Все внешние данные проходят Zod.
- В `src/routes/**` нет `Array.isArray`, `?? []` для массивов из RPC, `as any` на данных.
- Локальные Section Boundaries на всех крупных блоках.
- Playwright smoke зелёный, включая проверку отсутствия `is not a function` в консоли.
- `docs/data-layer-audit.md` содержит финальную таблицу.

## Что вне scope

- Изменения RLS/схемы БД (кроме случаев, где текущая функция возвращает откровенно неверный тип и это чинится на стороне SQL — фиксируем отдельным пунктом в аудите, не трогаем в этой задаче).
- Редизайн экранов и новый функционал.
- Замена React Query на другую библиотеку.
