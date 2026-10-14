"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "simple-todo-list";
const MAX_LENGTH = 100;

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
    return data.filter(
      (t) => t && typeof t.id === "string" && typeof t.text === "string"
    );
  } catch {
    return [];
  }
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
  const [filter, setFilter] = useState("all");
  const [saveError, setSaveError] = useState(false);
  const inputRef = useRef(null);

  // 初回表示時に読み込み（サーバー側では localStorage が使えないため useEffect 内で行う）
  useEffect(() => {
    setTodos(loadTodos());
    setLoaded(true);
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
    setTodos((prev) => [
      { id: createId(), text: value, done: false, createdAt: Date.now() },
      ...prev,
    ]);
    setText("");
    setError("");
    inputRef.current?.focus();
  }

  function toggleTodo(id) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function deleteTodo(todo) {
    if (!window.confirm(`「${todo.text}」を削除しますか？`)) return;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
  }

  function clearDone() {
    const count = todos.filter((t) => t.done).length;
    if (!window.confirm(`完了したタスク ${count} 件をまとめて削除しますか？`)) return;
    setTodos((prev) => prev.filter((t) => !t.done));
  }

  const visibleTodos = todos.filter((t) =>
    filter === "active" ? !t.done : filter === "done" ? t.done : true
  );
  const activeCount = todos.filter((t) => !t.done).length;
  const doneCount = todos.length - activeCount;
  const remaining = MAX_LENGTH - text.length;

  return (
    <main className="container">
      <header className="header">
        <h1>かんたんToDoリスト</h1>
        <p className="summary">
          未完了 <strong>{activeCount}</strong> 件 ／ 完了 <strong>{doneCount}</strong> 件
        </p>
      </header>

      <form className="add-form" onSubmit={handleAdd} noValidate>
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
      </form>
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
          {visibleTodos.map((todo) => (
            <li key={todo.id} className={todo.done ? "done" : ""}>
              <label className="todo-label">
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleTodo(todo.id)}
                />
                <span className="todo-text">{todo.text}</span>
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
          ))}
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
