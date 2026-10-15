"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "simple-todo-list";
const SORT_STORAGE_KEY = "simple-todo-list-sort";
const MAX_LENGTH = 100;

const PRIORITIES = [
  { key: "high", label: "高", rank: 0 },
  { key: "medium", label: "中", rank: 1 },
  { key: "low", label: "低", rank: 2 },
];
const DEFAULT_PRIORITY = "medium";
const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((p) => [p.key, p]));

const SORTS = [
  { key: "created", label: "追加順" },
  { key: "priority", label: "優先順位順" },
  { key: "due", label: "期限が近い順" },
];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FILTERS = [
  { key: "all", label: "すべて" },
  { key: "active", label: "未完了" },
  { key: "done", label: "完了" },
];

// LocalStorage からタスクを読み込む（壊れたデータや使用不可の環境でも落ちないようにする）
function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (t) => t && typeof t.id === "string" && typeof t.text === "string",
      )
      .map(normalizeTodo);
  } catch {
    return [];
  }
}

// 期限・優先順位が無い以前のデータも、項目を補って引き継ぐ
function normalizeTodo(t) {
  return {
    ...t,
    done: Boolean(t.done),
    dueDate:
      typeof t.dueDate === "string" && DATE_PATTERN.test(t.dueDate)
        ? t.dueDate
        : null,
    priority: PRIORITY_MAP[t.priority] ? t.priority : DEFAULT_PRIORITY,
  };
}

function loadSort() {
  try {
    const value = localStorage.getItem(SORT_STORAGE_KEY);
    return SORTS.some((s) => s.key === value) ? value : "created";
  } catch {
    return "created";
  }
}

// 端末のローカル日付で "YYYY-MM-DD" を作る（toISOString は UTC になり日付がずれるため使わない）
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / 86400000);
}

function formatDate(value, today) {
  const date = parseDate(value);
  const md = `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
  return value.slice(0, 4) === today.slice(0, 4)
    ? md
    : `${date.getFullYear()}/${md}`;
}

// 期限の状態（期限切れ・今日・明日・それ以外）
function getDueStatus(todo, today) {
  if (!todo.dueDate || todo.done) return null;
  const diff = daysBetween(today, todo.dueDate);
  if (diff < 0) return { type: "overdue", label: `期限切れ（${-diff}日超過）` };
  if (diff === 0) return { type: "today", label: "今日まで" };
  if (diff === 1) return { type: "soon", label: "明日まで" };
  return null;
}

function compareDue(a, b) {
  if (a.dueDate === b.dueDate) return 0;
  if (!a.dueDate) return 1; // 期限なしは後ろ
  if (!b.dueDate) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

function comparePriority(a, b) {
  return PRIORITY_MAP[a.priority].rank - PRIORITY_MAP[b.priority].rank;
}

// 並び替え。優先順位順・期限順では未完了を上に寄せる
function sortTodos(list, sort) {
  if (sort === "created") return list;
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const primary =
      sort === "priority"
        ? comparePriority(a, b) || compareDue(a, b)
        : compareDue(a, b) || comparePriority(a, b);
    return primary || (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Home() {
  const [todos, setTodos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("created");
  const [today, setToday] = useState("");
  const [saveError, setSaveError] = useState(false);
  const inputRef = useRef(null);

  // 初回表示時に読み込み（サーバー側では localStorage が使えないため useEffect 内で行う）
  useEffect(() => {
    setTodos(loadTodos());
    setSort(loadSort());
    setToday(toDateString(new Date()));
    setLoaded(true);
  }, []);

  // 日付をまたいで開きっぱなしにしても期限切れ表示が更新されるようにする
  useEffect(() => {
    const update = () => setToday(toDateString(new Date()));
    const timer = setInterval(update, 60 * 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // 変更があるたびに保存
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [todos, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(SORT_STORAGE_KEY, sort);
    } catch {
      // 並び順の保存失敗は動作に影響しないため無視する
    }
  }, [sort, loaded]);

  function handleAdd(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) {
      setError("タスクの内容を入力してください。");
      inputRef.current?.focus();
      return;
    }
    if (value.length > MAX_LENGTH) {
      setError(`${MAX_LENGTH}文字以内で入力してください。`);
      return;
    }
    if (todos.some((t) => t.text === value && !t.done)) {
      setError("同じ内容の未完了タスクがすでにあります。");
      return;
    }
    if (dueDate && !DATE_PATTERN.test(dueDate)) {
      setError("期限の日付が正しくありません。");
      return;
    }
    if (dueDate && today && dueDate < today) {
      setError("期限に過去の日付は指定できません。");
      return;
    }
    setTodos((prev) => [
      {
        id: createId(),
        text: value,
        done: false,
        createdAt: Date.now(),
        dueDate: dueDate || null,
        priority,
      },
      ...prev,
    ]);
    setText("");
    setDueDate("");
    setPriority(DEFAULT_PRIORITY);
    setError("");
    inputRef.current?.focus();
  }

  function toggleTodo(id) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }

  function deleteTodo(todo) {
    if (!window.confirm(`「${todo.text}」を削除しますか？`)) return;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
  }

  function clearDone() {
    const count = todos.filter((t) => t.done).length;
    if (!window.confirm(`完了したタスク ${count} 件をまとめて削除しますか？`))
      return;
    setTodos((prev) => prev.filter((t) => !t.done));
  }

  const visibleTodos = sortTodos(
    todos.filter((t) =>
      filter === "active" ? !t.done : filter === "done" ? t.done : true,
    ),
    sort,
  );
  const activeCount = todos.filter((t) => !t.done).length;
  const doneCount = todos.length - activeCount;
  const overdueCount = today
    ? todos.filter((t) => getDueStatus(t, today)?.type === "overdue").length
    : 0;
  const progress =
    todos.length === 0 ? 0 : Math.round((doneCount / todos.length) * 100);
  const remaining = MAX_LENGTH - text.length;

  return (
    <main className="container">
      <header className="header">
        <h1>かんたんToDoリスト</h1>
        <p className="summary">
          未完了 <strong>{activeCount}</strong> 件 ／ 完了{" "}
          <strong>{doneCount}</strong> 件
          {overdueCount > 0 && (
            <span className="summary-overdue">
              {" "}／ 期限切れ <strong>{overdueCount}</strong> 件
            </span>
          )}
        </p>
        <section className="progress" aria-label="達成率">
          <div className="progress-head">
            <span className="progress-title">達成率</span>
            <span className="progress-value">{progress}%</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="達成率"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className={`progress-bar${progress === 100 ? " complete" : ""}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="progress-note">
            {todos.length === 0
              ? "タスクを追加すると達成率が表示されます"
              : progress === 100
                ? "すべて完了しました！🎉"
                : `全 ${todos.length} 件中 ${doneCount} 件完了`}
          </p>
        </section>
      </header>

      <form className="add-form" onSubmit={handleAdd} noValidate>
        <div className="add-row">
          <label htmlFor="todo-input" className="sr-only">
            新しいタスク
          </label>
          <input
            id="todo-input"
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              // 日本語入力の変換確定の Enter で送信されないようにする
              if (e.key === "Enter" && e.nativeEvent.isComposing) {
                e.preventDefault();
              }
            }}
            placeholder="例：牛乳を買う"
            maxLength={MAX_LENGTH}
            autoComplete="off"
            aria-invalid={error ? "true" : "false"}
            aria-describedby="input-help"
          />
          <button type="submit" className="btn-add" disabled={!text.trim()}>
            追加
          </button>
        </div>
        <div id="input-help" className="input-help">
          {error ? (
            <span className="error" role="alert">
              {error}
            </span>
          ) : (
            <span className={remaining <= 10 ? "warn" : ""}>
              あと {remaining} 文字入力できます
            </span>
          )}
        </div>

        <div className="add-options">
          <div className="option">
            <label htmlFor="due-input" className="option-label">
              期限（任意）
            </label>
            <div className="due-field">
              <input
                id="due-input"
                type="date"
                value={dueDate}
                min={today || undefined}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (error) setError("");
                }}
              />
              {dueDate && (
                <button
                  type="button"
                  className="btn-sub"
                  onClick={() => setDueDate("")}
                  aria-label="期限をクリア"
                >
                  クリア
                </button>
              )}
            </div>
          </div>

          <fieldset className="option">
            <legend className="option-label">優先順位</legend>
            <div className="priority-picker">
              {PRIORITIES.map((p) => (
                <label
                  key={p.key}
                  className={`priority-choice priority-${p.key}${
                    priority === p.key ? " selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p.key}
                    checked={priority === p.key}
                    onChange={() => setPriority(p.key)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </form>

      {saveError && (
        <p className="error banner" role="alert">
          データを保存できませんでした。ブラウザのプライベートモードや容量制限を確認してください。
        </p>
      )}

      <nav className="filters" aria-label="表示の切り替え">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={filter === f.key ? "active" : ""}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </nav>

      <div className="sort-bar">
        <label htmlFor="sort-select">並び替え</label>
        <select
          id="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {!loaded ? (
        <p className="empty">読み込み中…</p>
      ) : visibleTodos.length === 0 ? (
        <p className="empty">
          {todos.length === 0
            ? "タスクはまだありません。上の入力欄から追加してみましょう！"
            : filter === "active"
              ? "未完了のタスクはありません。お疲れさまでした！"
              : "完了したタスクはありません。"}
        </p>
      ) : (
        <ul className="todo-list">
          {visibleTodos.map((todo) => {
            const status = getDueStatus(todo, today);
            const prio = PRIORITY_MAP[todo.priority];
            return (
              <li
                key={todo.id}
                className={[
                  todo.done ? "done" : "",
                  status?.type === "overdue" ? "overdue" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <label className="todo-label">
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => toggleTodo(todo.id)}
                  />
                  <span className="todo-body">
                    <span className="todo-text">{todo.text}</span>
                    <span className="todo-meta">
                      <span
                        className={`priority-badge priority-${todo.priority}`}
                      >
                        優先度：{prio.label}
                      </span>
                      {todo.dueDate ? (
                        <span
                          className={`due${status ? ` due-${status.type}` : ""}`}
                        >
                          期限 {formatDate(todo.dueDate, today)}
                          {status && (
                            <span className="due-status">{status.label}</span>
                          )}
                        </span>
                      ) : (
                        <span className="due due-none">期限なし</span>
                      )}
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  className="btn-delete"
                  onClick={() => deleteTodo(todo)}
                  aria-label={`「${todo.text}」を削除`}
                >
                  削除
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {doneCount > 0 && (
        <div className="footer">
          <button type="button" className="btn-clear" onClick={clearDone}>
            完了したタスクをまとめて削除
          </button>
        </div>
      )}

      <p className="note">※ データはこのブラウザ内に保存されます。</p>
    </main>
  );
}
