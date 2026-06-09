## Роли пользователей: Ученик и Преподаватель

Большая фича — разделение MVP на два режима. Предлагаю поэтапный план; начнём с фундамента (БД + выбор роли + роутинг), затем кабинет ученика, затем кабинет преподавателя.

### Этап 1. Фундамент (этот заход)

**База данных (миграция)**
- В `profiles` добавить:
  - `role` — `'student' | 'teacher' | null` (enum `user_role`)
  - `onboarding_completed boolean default false`
- Новая таблица `students` (ученики преподавателя):
  - `id`, `teacher_id` (→ auth.users), `first_name`, `last_name`, `grade int`, `subjects text[]`, `notes text`, `created_at`, `updated_at`
  - RLS: преподаватель видит/правит только своих учеников (`teacher_id = auth.uid()` + проверка роли через `has_role`-стиль или прямой select из `profiles`).
  - GRANT `authenticated`, `service_role`.
- Триггер `set_updated_at` на обе таблицы.

**Серверные функции** (`src/lib/role.functions.ts`)
- `getMyRole()` → `{ role, onboarding_completed }`
- `setMyRole({ role })` → сохраняет роль + `onboarding_completed = true`

**Маршрутизация**
- Новый экран `src/routes/_authenticated/onboarding.tsx` — выбор роли (две карточки: Ученик / Преподаватель).
- В `_authenticated/route.tsx` (или в `_authenticated.index`) — если `role` пустая → редирект на `/onboarding`.
- `_authenticated.index.tsx` становится «диспетчером»: если `student` → редирект на `/student`, если `teacher` → на `/teacher`.
- Календарь (текущая главная) переезжает на `/student/calendar`, чтобы не ломать ученический сценарий.

**Навигация / UserMenu**
- Добавить в `UserMenu` пункт «Сменить роль» (сбрасывает `onboarding_completed`).

### Этап 2. Кабинет ученика (`/student/*`)

Маршруты под layout `_authenticated/student`:
- `/student` — главная: приветствие, сегодняшние занятия, прогресс по предметам, слабые темы, CTA «Пройти диагностику» / «План на сегодня».
- `/student/calendar` — текущий календарь (`OgeMvpApp`).
- `/student/diagnostic`, `/student/lessons`, `/student/materials`, `/student/progress`, `/student/assistant` — переиспользовать существующие компоненты (diagnostic-panel, assistant-panel, profile-прогресс).

Боковая/верхняя навигация ученика с 7 разделами.

### Этап 3. Кабинет преподавателя (`/teacher/*`)

Маршруты под layout `_authenticated/teacher`:
- `/teacher` — главная: список учеников, ближайшие занятия (mock), рекомендации, кнопки «Добавить ученика» / «Составить план».
- `/teacher/students` — список + диалог «Добавить ученика» (создаёт строку в `students`).
- `/teacher/students/$studentId` — профиль ученика: общая инфа, карта слабых тем (mock), план занятий (mock), AI-рекомендации (mock), история (mock).
- `/teacher/diagnostic`, `/teacher/plans`, `/teacher/materials`, `/teacher/analytics`, `/teacher/assistant` — заглушки с описанием и mock-карточками; реальная логика — в следующих заходах.

Серверные функции для `students`: `listMyStudents`, `getStudent`, `createStudent`, `updateStudent`, `deleteStudent` — все через `requireSupabaseAuth` + проверка `role = 'teacher'`.

### Этап 4 и далее (не входит в этот заход)

Карта слабых тем на реальных данных, индивидуальные планы, AI-рекомендации преподавателю, аналитика, привязка `student` к `auth.users` (приглашения учеников).

---

### Технические детали

- `role` храним в `profiles`, не в `auth.users` (правило безопасности проекта). Отдельная таблица `user_roles` для админских ролей здесь не нужна — это бизнес-роль, не привилегия.
- Все защищённые роуты остаются под `_authenticated/`. SSR — как настроено интеграцией.
- Существующие маршруты (`/`, `/profile`, `/lesson/$id`) — `/` редиректит по роли; `/profile` остаётся общим; `/lesson/$id` доступен ученику.
- В MVP студенты у преподавателя — самостоятельные записи (mock-данные ввода руками), не привязаны к реальным `auth.users`. Это разблокирует UI без сложной системы приглашений.

### Вопрос перед стартом

Подтверждаете план поэтапно (сначала Этап 1: миграция + выбор роли + роутинг, потом отдельными заходами кабинеты)? Или сделать всё одним большим заходом (дольше, выше риск регрессий)?
