"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Database, Send, Sun, Moon, Plug, PlugZap,
  ChevronDown, ChevronRight, Loader2, AlertCircle,
  CheckCircle2, Table2, BarChart3, Copy, Check,
  Sparkles, Clock, Rows3
} from "lucide-react";

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface Message {
  id: string;
  type: "user" | "answer" | "error" | "clarification";
  question?: string;
  answer?: string;
  insights?: string[];
  sql?: string;
  rows?: number;
  ms?: number;
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
  message?: string;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function generateId() {
  return Math.random().toString(36).slice(2);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "6px 10px",
        cursor: "pointer",
        color: "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
      }}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "6px",
      }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Generated SQL
        </span>
        <button
          onClick={copy}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px",
          }}
        >
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre><code>{sql}</code></pre>
    </div>
  );
}

function MetaRow({ rows, ms }: { rows: number; ms: number }) {
  return (
    <div style={{
      display: "flex", gap: "16px", marginTop: "10px",
      fontSize: "12px", color: "var(--text-muted)",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <Rows3 size={12} /> {rows} row{rows !== 1 ? "s" : ""}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <Clock size={12} /> {ms}ms
      </span>
    </div>
  );
}

function MessageBubble({ msg, onOptionClick }: {
  msg: Message;
  onOptionClick: (q: string) => void;
}) {
  const [showSql, setShowSql] = useState(false);

  if (msg.type === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <div style={{
          background: "var(--accent)",
          color: "#fff",
          borderRadius: "16px 16px 4px 16px",
          padding: "10px 16px",
          maxWidth: "70%",
          fontSize: "14px",
          lineHeight: 1.5,
        }}>
          {msg.question}
        </div>
      </div>
    );
  }

  if (msg.type === "error") {
    return (
      <div style={{
        background: "var(--error-subtle)",
        border: "1px solid var(--error)",
        borderRadius: "var(--radius)",
        padding: "12px 16px",
        marginBottom: "16px",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
      }}>
        <AlertCircle size={16} color="var(--error)" style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontSize: "14px", color: "var(--error)" }}>{msg.error}</span>
      </div>
    );
  }

  if (msg.type === "clarification") {
    return (
      <div style={{
        background: "var(--warning-subtle)",
        border: "1px solid var(--warning)",
        borderRadius: "var(--radius)",
        padding: "16px",
        marginBottom: "16px",
      }}>
        <p style={{ fontSize: "14px", marginBottom: "12px", color: "var(--text-primary)" }}>
          {msg.clarification?.clarification_message}
        </p>
        {msg.clarification?.questions.map((q, i) => (
          <div key={i} style={{ marginBottom: "10px" }}>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}>{q.question}</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => onOptionClick(`${msg.question} (${opt})`)}
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    borderRadius: "20px",
                    padding: "4px 12px",
                    fontSize: "13px",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Answer
  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "16px",
      marginBottom: "16px",
    }}>
      {/* Answer */}
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
        <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--text-primary)" }}>{msg.answer}</p>
      </div>

      {/* Insights */}
      {msg.insights && msg.insights.length > 0 && (
        <div style={{ marginTop: "12px", paddingLeft: "26px" }}>
          {msg.insights.map((ins, i) => (
            <div key={i} style={{
              display: "flex", gap: "8px", alignItems: "flex-start",
              marginBottom: "4px",
            }}>
              <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: "12px", marginTop: "2px" }}>•</span>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{ins}</span>
            </div>
          ))}
        </div>
      )}

      {/* Metadata */}
      {msg.rows !== undefined && <MetaRow rows={msg.rows} ms={msg.ms || 0} />}

      {/* SQL toggle */}
      {msg.sql && (
        <div style={{ marginTop: "12px", paddingLeft: "0" }}>
          <button
            onClick={() => setShowSql(!showSql)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: "12px",
              display: "flex", alignItems: "center", gap: "4px",
            }}
          >
            {showSql ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            View SQL
          </button>
          {showSql && <SqlBlock sql={msg.sql} />}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Connect Panel
// ------------------------------------------------------------------

function ConnectPanel({
  onConnect,
  connection,
}: {
  onConnect: (cs: string) => Promise<void>;
  connection: ConnectionState;
}) {
  const [cs, setCs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const examples = [
    { label: "SQLite demo", value: "sqlite:///db/dev.db" },
    { label: "PostgreSQL", value: "postgresql://user:pass@host:5432/dbname" },
    { label: "MySQL", value: "mysql+pymysql://user:pass@host:3306/dbname" },
  ];

  const submit = async () => {
    if (!cs.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onConnect(cs.trim());
    } catch (e: any) {
      setError(e.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Database size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: "14px" }}>Connect a database</span>
      </div>

      {connection.connected ? (
        <div style={{
          background: "var(--success-subtle)",
          border: "1px solid var(--success)",
          borderRadius: "var(--radius-sm)",
          padding: "10px 12px",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <CheckCircle2 size={14} color="var(--success)" />
          <span style={{ fontSize: "13px", color: "var(--success)" }}>
            {connection.db_type} — {connection.table_count} tables
          </span>
        </div>
      ) : (
        <>
          <textarea
            value={cs}
            onChange={(e) => setCs(e.target.value)}
            placeholder="postgresql://user:pass@host:5432/dbname"
            rows={2}
            style={{
              width: "100%",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontSize: "12px",
              fontFamily: "monospace",
              color: "var(--text-primary)",
              resize: "none",
              outline: "none",
              marginBottom: "10px",
            }}
          />

          {error && (
            <p style={{ fontSize: "12px", color: "var(--error)", marginBottom: "8px" }}>{error}</p>
          )}

          <button
            onClick={submit}
            disabled={loading || !cs.trim()}
            style={{
              width: "100%",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading || !cs.trim() ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginBottom: "12px",
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
            {loading ? "Connecting..." : "Connect"}
          </button>

          <div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Examples
            </p>
            {examples.map((ex) => (
              <button
                key={ex.label}
                onClick={() => setCs(ex.value)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: "none", border: "none", cursor: "pointer",
                  padding: "4px 0", fontSize: "12px",
                  color: "var(--accent)",
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Example Questions
// ------------------------------------------------------------------

function ExampleQuestions({ onSelect }: { onSelect: (q: string) => void }) {
  const examples = [
    "How many orders do we have in total?",
    "Who are the top 5 customers by revenue?",
    "What is the total revenue by product category?",
    "How many orders were placed in 2024?",
    "Which products have never been ordered?",
    "What percentage of orders were cancelled?",
  ];

  return (
    <div style={{ padding: "20px" }}>
      <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Example questions
      </p>
      {examples.map((q) => (
        <button
          key={q}
          onClick={() => onSelect(q)}
          style={{
            display: "block", width: "100%", textAlign: "left",
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 10px",
            fontSize: "12px",
            color: "var(--text-secondary)",
            cursor: "pointer",
            marginBottom: "6px",
            lineHeight: 1.4,
          }}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// Main App
// ------------------------------------------------------------------

export default function Home() {
  const [dark, setDark] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>({ connected: false });
  const [sessionId] = useState(() => generateId());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, [dark]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleConnect = async (cs: string) => {
    const res = await axios.post(`${API_URL}/connect`, {
      connection_string: cs,
      session_id: sessionId,
    });
    setConnection({
      connected: true,
      db_type: res.data.db_type,
      table_count: res.data.table_count,
    });
  };

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: Message = {
      id: generateId(), type: "user",
      question, timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/query`, {
        question,
        user_id: "default_user",
        session_id: sessionId,
      });

      const data = res.data;

      if (data.needs_clarification) {
        setMessages((prev) => [...prev, {
          id: generateId(), type: "clarification",
          question,
          clarification: data.clarification,
          timestamp: new Date().toISOString(),
        }]);
      } else if (!data.success) {
        setMessages((prev) => [...prev, {
          id: generateId(), type: "error",
          error: data.error || "Something went wrong",
          timestamp: new Date().toISOString(),
        }]);
      } else {
        setMessages((prev) => [...prev, {
          id: generateId(),
          type: "answer",
          answer: data.answer,
          insights: data.key_insights,
          sql: data.sql,
          rows: data.row_count,
          ms: data.execution_ms,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, {
        id: generateId(), type: "error",
        error: e.response?.data?.detail || "API connection failed",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: "var(--bg-primary)",
      overflow: "hidden",
    }}>
      {/* Sidebar */}
      <div style={{
        width: "280px",
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <div style={{
            width: 32, height: 32,
            background: "var(--accent)",
            borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "14px" }}>LLM SQL Agent</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Ask your database anything</div>
          </div>
        </div>

        {/* Connect */}
        <div style={{ borderBottom: "1px solid var(--border)" }}>
          <ConnectPanel onConnect={handleConnect} connection={connection} />
        </div>

        {/* Examples */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <ExampleQuestions onSelect={(q) => { setInput(q); sendMessage(q); }} />
        </div>

        {/* Theme toggle */}
        <div style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "flex-end",
        }}>
          <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
        </div>
      </div>

      {/* Main */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--bg-primary)",
        }}>
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: 600 }}>Chat</h1>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {connection.connected
                ? `Connected to ${connection.db_type} — ${connection.table_count} tables`
                : "Using demo database (Northwind)"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {connection.connected
              ? <PlugZap size={14} color="var(--success)" />
              : <Database size={14} color="var(--text-muted)" />}
            <span style={{ fontSize: "12px", color: connection.connected ? "var(--success)" : "var(--text-muted)" }}>
              {connection.connected ? "Live database" : "Demo mode"}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
        }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              gap: "12px",
            }}>
              <div style={{
                width: 56, height: 56,
                background: "var(--bg-tertiary)",
                borderRadius: "16px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Table2 size={24} color="var(--accent)" />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontWeight: 600, marginBottom: "4px", color: "var(--text-primary)" }}>
                  Ask anything about your data
                </p>
                <p style={{ fontSize: "13px" }}>
                  Connect your database or use the demo — then ask in plain English.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onOptionClick={(q) => sendMessage(q)}
            />
          ))}

          {loading && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              color: "var(--text-muted)", fontSize: "13px",
              marginBottom: "16px",
            }}>
              <Loader2 size={14} className="animate-spin" />
              Thinking...
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-primary)",
        }}>
          <div style={{
            display: "flex",
            gap: "10px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "10px 14px",
            alignItems: "flex-end",
          }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your data..."
              rows={1}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: "14px",
                color: "var(--text-primary)",
                lineHeight: 1.5,
                fontFamily: "inherit",
                maxHeight: "120px",
                overflowY: "auto",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "6px 10px",
                cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                opacity: !input.trim() || loading ? 0.5 : 1,
                display: "flex", alignItems: "center",
                flexShrink: 0,
              }}
            >
              <Send size={14} />
            </button>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", textAlign: "center" }}>
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
