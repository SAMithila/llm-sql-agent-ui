"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Database, Send, Sun, Moon, Plug, PlugZap,
  ChevronDown, ChevronRight, Loader2, AlertCircle,
  CheckCircle2, Table2, Copy, Check,
  Sparkles, Clock, Rows3, BarChart3, TableIcon, Upload
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CHART_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

interface Message {
  id: string;
  type: "user" | "answer" | "error" | "clarification";
  question?: string;
  answer?: string;
  insights?: string[];
  sql?: string;
  rows?: number;
  ms?: number;
  columns?: string[];
  data?: any[][];
  error?: string;
  clarification?: {
    clarification_message: string;
    questions: { question: string; options: string[] }[];
  };
  timestamp: string;
}

interface ConnectionState {
  connected: boolean;
  db_type?: string;
  table_count?: number;
}

// ── localStorage helpers ──────────────────────────────────────────

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
}

// ─────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2);
}

function detectChartType(columns: string[], rows: any[][]): {
  type: "bar" | "pie" | "line" | "none";
  labelCol: number;
  valueCol: number;
} {
  if (!columns || !rows || rows.length < 2 || columns.length < 2) {
    return { type: "none", labelCol: 0, valueCol: 1 };
  }

  let labelCol = -1;
  let valueCol = -1;

  for (let i = 0; i < columns.length; i++) {
    const sampleVal = rows[0][i];
    if (labelCol === -1 && typeof sampleVal === "string") labelCol = i;
    if (valueCol === -1 && typeof sampleVal === "number") valueCol = i;
  }

  if (labelCol === -1) labelCol = 0;
  if (valueCol === -1) valueCol = columns.length > 1 ? 1 : 0;

  if (rows.length <= 6) return { type: "pie", labelCol, valueCol };

  const firstLabel = String(rows[0][labelCol]).toLowerCase();
  const isTimeSeries = /^\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/.test(firstLabel);
  if (isTimeSeries) return { type: "line", labelCol, valueCol };

  return { type: "bar", labelCol, valueCol };
}

function ResultChart({ columns, rows }: { columns: string[]; rows: any[][] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const { type, labelCol, valueCol } = detectChartType(columns, rows);

  if (type === "none") return null;

  const chartData = rows.map((row) => ({
    name: String(row[labelCol]),
    value: Number(row[valueCol]) || 0,
  }));

  const valueName = columns[valueCol] || "value";

  const renderPieLabel = (props: any) => {
    const { name, percent } = props;
    return name + " (" + (percent * 100).toFixed(0) + "%)";
  };

  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
        <button
          onClick={() => setView("chart")}
          style={{
            background: view === "chart" ? "var(--accent)" : "var(--bg-tertiary)",
            color: view === "chart" ? "#fff" : "var(--text-muted)",
            border: "none", borderRadius: "6px",
            padding: "4px 10px", fontSize: "12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "4px",
          }}
        >
          <BarChart3 size={12} /> Chart
        </button>
        <button
          onClick={() => setView("table")}
          style={{
            background: view === "table" ? "var(--accent)" : "var(--bg-tertiary)",
            color: view === "table" ? "#fff" : "var(--text-muted)",
            border: "none", borderRadius: "6px",
            padding: "4px 10px", fontSize: "12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "4px",
          }}
        >
          <TableIcon size={12} /> Table
        </button>
      </div>

      {view === "chart" && (
        <div style={{
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius)",
          padding: "16px",
          border: "1px solid var(--border)",
        }}>
          <ResponsiveContainer width="100%" height={280}>
            {type === "bar" ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px" }} />
                <Bar dataKey="value" name={valueName} radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : type === "pie" ? (
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  label={renderPieLabel}
                  labelLine={{ stroke: "var(--text-muted)" }}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px" }} />
              </PieChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px" }} />
                <Line type="monotone" dataKey="value" name={valueName} stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {view === "table" && (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col} style={{
                    padding: "8px 12px", textAlign: "left",
                    background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)",
                    color: "var(--text-secondary)", fontWeight: 600,
                    fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((val: any, j: number) => (
                    <td key={j} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      {typeof val === "number" ? val.toLocaleString() : String(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      background: "var(--bg-tertiary)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)", padding: "6px 10px", cursor: "pointer",
      color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px",
    }}>
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Generated SQL</span>
        <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre><code>{sql}</code></pre>
    </div>
  );
}

function MetaRow({ rows, ms }: { rows: number; ms: number }) {
  return (
    <div style={{ display: "flex", gap: "16px", marginTop: "10px", fontSize: "12px", color: "var(--text-muted)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Rows3 size={12} /> {rows} row{rows !== 1 ? "s" : ""}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> {ms}ms</span>
    </div>
  );
}

function MessageBubble({ msg, onOptionClick }: { msg: Message; onOptionClick: (q: string) => void }) {
  const [showSql, setShowSql] = useState(false);

  if (msg.type === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <div style={{ background: "var(--accent)", color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "10px 16px", maxWidth: "70%", fontSize: "14px", lineHeight: 1.5 }}>
          {msg.question}
        </div>
      </div>
    );
  }

  if (msg.type === "error") {
    return (
      <div style={{ background: "var(--error-subtle)", border: "1px solid var(--error)", borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
        <AlertCircle size={16} color="var(--error)" style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontSize: "14px", color: "var(--error)" }}>{msg.error}</span>
      </div>
    );
  }

  if (msg.type === "clarification") {
    return (
      <div style={{ background: "var(--warning-subtle)", border: "1px solid var(--warning)", borderRadius: "var(--radius)", padding: "16px", marginBottom: "16px" }}>
        <p style={{ fontSize: "14px", marginBottom: "12px", color: "var(--text-primary)" }}>{msg.clarification?.clarification_message}</p>
        {msg.clarification?.questions.map((q, i) => (
          <div key={i} style={{ marginBottom: "10px" }}>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}>{q.question}</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {q.options.map((opt) => (
                <button key={opt} onClick={() => onOptionClick(msg.question + " (" + opt + ")")}
                  style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "20px", padding: "4px 12px", fontSize: "13px", cursor: "pointer", color: "var(--text-primary)" }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", marginBottom: "16px" }}>
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
        <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--text-primary)" }}>{msg.answer}</p>
      </div>

      {msg.insights && msg.insights.length > 0 && (
        <div style={{ marginTop: "12px", paddingLeft: "26px" }}>
          {msg.insights.map((ins, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "4px" }}>
              <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: "12px", marginTop: "2px" }}>•</span>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{ins}</span>
            </div>
          ))}
        </div>
      )}

      {msg.columns && msg.data && msg.data.length >= 2 && (
        <ResultChart columns={msg.columns} rows={msg.data} />
      )}

      {msg.rows !== undefined && <MetaRow rows={msg.rows} ms={msg.ms || 0} />}

      {msg.sql && (
        <div style={{ marginTop: "12px" }}>
          <button onClick={() => setShowSql(!showSql)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
            {showSql ? <ChevronDown size={12} /> : <ChevronRight size={12} />} View SQL
          </button>
          {showSql && <SqlBlock sql={msg.sql} />}
        </div>
      )}
    </div>
  );
}

// ── ConnectPanel — supports both connection string AND sqlite file upload ──

function ConnectPanel({
  onConnect,
  onFileConnect,
  onDisconnect,
  connection,
}: {
  onConnect: (cs: string) => Promise<void>;
  onFileConnect: (file: File) => Promise<void>;
  onDisconnect: () => void;
  connection: ConnectionState;
}) {
  const [cs, setCs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const examples = [
    { label: "PostgreSQL", value: "postgresql://user:pass@host:5432/dbname" },
    { label: "MySQL", value: "mysql+pymysql://user:pass@host:3306/dbname" },
  ];

  const submitCs = async () => {
    if (!cs.trim()) return;
    setLoading(true); setError("");
    try { await onConnect(cs.trim()); }
    catch (e: any) { setError(e.message || "Connection failed"); }
    finally { setLoading(false); }
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".db") && !file.name.endsWith(".sqlite")) {
      setError("File must be a .db or .sqlite file");
      return;
    }
    setLoading(true); setError("");
    try { await onFileConnect(file); }
    catch (e: any) { setError(e.message || "Upload failed"); }
    finally { setLoading(false); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (connection.connected) {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Database size={16} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: "14px" }}>Connect a database</span>
        </div>
        <div style={{ background: "var(--success-subtle)", border: "1px solid var(--success)", borderRadius: "var(--radius-sm)", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={14} color="var(--success)" />
            <span style={{ fontSize: "13px", color: "var(--success)" }}>
              {connection.db_type} — {connection.table_count} table{connection.table_count !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={onDisconnect}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "var(--text-muted)", textDecoration: "underline" }}
          >
            disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Database size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: "14px" }}>Connect a database</span>
      </div>

      {/* SQLite file drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius-sm)",
          padding: "14px 12px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "var(--bg-tertiary)" : "transparent",
          marginBottom: "12px",
          transition: "all 0.15s",
        }}
      >
        <Upload size={16} color="var(--accent)" style={{ margin: "0 auto 6px" }} />
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
          Drop a <strong>.db</strong> or <strong>.sqlite</strong> file here
        </p>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "2px 0 0" }}>or click to browse</p>
        <input
          ref={fileRef}
          type="file"
          accept=".db,.sqlite"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>or connection string</span>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
      </div>

      <textarea
        value={cs}
        onChange={(e) => setCs(e.target.value)}
        placeholder="postgresql://user:pass@host:5432/dbname"
        rows={2}
        style={{
          width: "100%", background: "var(--bg-tertiary)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", padding: "10px 12px", fontSize: "12px",
          fontFamily: "monospace", color: "var(--text-primary)", resize: "none",
          outline: "none", marginBottom: "10px", boxSizing: "border-box",
        }}
      />

      {error && <p style={{ fontSize: "12px", color: "var(--error)", marginBottom: "8px" }}>{error}</p>}

      <button
        onClick={submitCs}
        disabled={loading || !cs.trim()}
        style={{
          width: "100%", background: "var(--accent)", color: "#fff", border: "none",
          borderRadius: "var(--radius-sm)", padding: "8px", fontSize: "13px", fontWeight: 600,
          cursor: loading || !cs.trim() ? "not-allowed" : "pointer",
          opacity: loading || !cs.trim() ? 0.6 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "12px",
        }}
      >
        {loading ? <Loader2 size={14} /> : <Plug size={14} />}
        {loading ? "Connecting..." : "Connect"}
      </button>

      <div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Examples</p>
        {examples.map((ex) => (
          <button key={ex.label} onClick={() => setCs(ex.value)}
            style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontSize: "12px", color: "var(--accent)" }}>
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExampleQuestions({ onSelect }: { onSelect: (q: string) => void }) {
  const examples = [
    "How many orders do we have in total?",
    "Who are the top 5 customers by revenue?",
    "What is the total revenue by product category?",
    "How many orders were placed each month in 2024?",
    "Which products have never been ordered?",
    "What percentage of orders were cancelled?",
  ];
  return (
    <div style={{ padding: "20px" }}>
      <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Example questions</p>
      {examples.map((q) => (
        <button key={q} onClick={() => onSelect(q)}
          style={{ display: "block", width: "100%", textAlign: "left", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 10px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer", marginBottom: "6px", lineHeight: 1.4 }}>
          {q}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────

export default function Home() {
  // localStorage-backed state — survives refresh
  const [dark, setDark] = useState<boolean>(() => loadFromStorage("llm_sql_dark", false));
  const [connection, setConnection] = useState<ConnectionState>(() =>
    loadFromStorage("llm_sql_connection", { connected: false })
  );
  const [sessionId] = useState<string>(() => {
    const saved = loadFromStorage<string>("llm_sql_session", "");
    if (saved) return saved;
    const id = generateId();
    saveToStorage("llm_sql_session", id);
    return id;
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sync dark mode to DOM and localStorage
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
    saveToStorage("llm_sql_dark", dark);
  }, [dark]);

  // Persist connection state to localStorage whenever it changes
  useEffect(() => {
    saveToStorage("llm_sql_connection", connection);
  }, [connection]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Connect via connection string (PostgreSQL / MySQL / SQLite path)
  const handleConnect = async (cs: string) => {
    const res = await axios.post(API_URL + "/connect", {
      connection_string: cs,
      session_id: sessionId,
    });
    setConnection({
      connected: true,
      db_type: res.data.db_type,
      table_count: res.data.table_count,
    });
  };

  // Connect via SQLite file upload
  const handleFileConnect = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", sessionId);

    const res = await axios.post(API_URL + "/connect/sqlite-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    setConnection({
      connected: true,
      db_type: "sqlite",
      table_count: res.data.table_count,
    });
  };

  // Disconnect
  const handleDisconnect = async () => {
    try {
      await axios.post(`${API_URL}/disconnect/${sessionId}`);
    } catch { }
    setConnection({ connected: false });
  };

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { id: generateId(), type: "user", question, timestamp: new Date().toISOString() }]);
    setInput("");
    setLoading(true);
    try {
      const res = await axios.post(API_URL + "/query", {
        question,
        user_id: "default_user",
        session_id: sessionId,
      });
      const data = res.data;
      if (data.needs_clarification) {
        setMessages((prev) => [...prev, { id: generateId(), type: "clarification", question, clarification: data.clarification, timestamp: new Date().toISOString() }]);
      } else if (!data.success) {
        setMessages((prev) => [...prev, { id: generateId(), type: "error", error: data.error || "Something went wrong", timestamp: new Date().toISOString() }]);
      } else {
        setMessages((prev) => [...prev, {
          id: generateId(), type: "answer",
          answer: data.answer, insights: data.key_insights,
          sql: data.sql, rows: data.row_count, ms: data.execution_ms,
          columns: data.columns || [], data: data.rows || [],
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: generateId(), type: "error", error: e.response?.data?.detail || "API connection failed", timestamp: new Date().toISOString() }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-primary)", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: "280px", flexShrink: 0, borderRight: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 32, height: 32, background: "var(--accent)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "14px" }}>LLM SQL Agent</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Ask your database anything</div>
          </div>
        </div>
        <div style={{ borderBottom: "1px solid var(--border)" }}>
          <ConnectPanel
            onConnect={handleConnect}
            onFileConnect={handleFileConnect}
            onDisconnect={handleDisconnect}
            connection={connection}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <ExampleQuestions onSelect={(q) => { setInput(q); sendMessage(q); }} />
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-primary)" }}>
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: 600 }}>Chat</h1>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {connection.connected
                ? `Connected to ${connection.db_type} — ${connection.table_count} tables`
                : "Using demo database (Northwind)"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {connection.connected ? <PlugZap size={14} color="var(--success)" /> : <Database size={14} color="var(--text-muted)" />}
            <span style={{ fontSize: "12px", color: connection.connected ? "var(--success)" : "var(--text-muted)" }}>
              {connection.connected ? "Live database" : "Demo mode"}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column" }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: "12px" }}>
              <div style={{ width: 56, height: 56, background: "var(--bg-tertiary)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Table2 size={24} color="var(--accent)" />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontWeight: 600, marginBottom: "4px", color: "var(--text-primary)" }}>Ask anything about your data</p>
                <p style={{ fontSize: "13px" }}>Connect your database or use the demo — then ask in plain English.</p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} onOptionClick={(q) => sendMessage(q)} />
          ))}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "13px", marginBottom: "16px" }}>
              <Loader2 size={14} /> Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", background: "var(--bg-primary)" }}>
          <div style={{ display: "flex", gap: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "12px", padding: "10px 14px", alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your data..."
              rows={1}
              style={{ flex: 1, background: "none", border: "none", outline: "none", resize: "none", fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.5, fontFamily: "inherit", maxHeight: "120px", overflowY: "auto" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: !input.trim() || loading ? "not-allowed" : "pointer", opacity: !input.trim() || loading ? 0.5 : 1, display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              <Send size={14} />
            </button>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", textAlign: "center" }}>Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
