import React, { useState } from "react";
import "./App.css";
import centerData from "./data/centerData.json";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function flattenPolicies(obj, prefix = "") {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { ...acc, ...flattenPolicies(value, nextKey) };
    }
    return { ...acc, [nextKey]: String(value) };
  }, {});
}

function unflattenPolicies(flatObj) {
  const result = {};
  Object.entries(flatObj).forEach(([compoundKey, value]) => {
    const parts = compoundKey.split(".");
    let cursor = result;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        cursor[part] = value;
      } else {
        cursor[part] = cursor[part] || {};
        cursor = cursor[part];
      }
    });
  });
  return result;
}

function buildSystemContext(policies) {
  return `You are the AI Front Desk for Pioneers Learning Center in Raleigh NC. Answer questions ONLY based on these policies: ${JSON.stringify(
    {
      center: centerData.center,
      policies
    },
    null,
    2
  )}. If you don't know the answer say I'll connect you with our staff and flag it.`;
}

function getFallbackReply(userText, policies) {
  const text = userText.toLowerCase();
  if (text.includes("hour")) return `Our hours are ${centerData.center.hours}.`;
  if (text.includes("tour")) return policies.tours;
  if (text.includes("lunch")) return policies.lunch;
  if (text.includes("sick") || text.includes("fever")) return policies.sick_child;
  if (text.includes("late") || text.includes("pickup")) return policies.late_pickup;
  if (text.includes("holiday")) return policies.holidays;
  if (text.includes("tuition") || text.includes("price") || text.includes("cost")) {
    return `Tuition is ${policies.tuition.infant} for infants, ${policies.tuition.toddler} for toddlers, and ${policies.tuition.preschool} for preschool.`;
  }
  return "I'll connect you with our staff and flag it.";
}

function shouldEscalateReply(replyText) {
  const normalizedReply = replyText
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const escalationPatterns = [
    /connect .* (staff|team|operator|specialist)/,
    /\b(escalate|handoff|human agent)\b/,
    /\b(i don't know|i do not know|not sure|unable to|can't answer|cannot answer)\b/,
    /\bflag\b/
  ];

  return escalationPatterns.some((pattern) => pattern.test(normalizedReply));
}

async function fetchClaudeReply(messages, policies) {
  const response = await fetch("/api/claude/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: buildSystemContext(policies),
      messages
    })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `AI request failed (${response.status})`);
  }

  const data = await response.json();
  return data.reply || "I'll connect you with our staff and flag it.";
}

function ParentView({
  policies,
  onFlaggedQuestion,
  messages,
  setMessages,
  inputValue,
  setInputValue,
  isLoading,
  setIsLoading,
  error,
  setError
}) {
  const onSend = async (event) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setError("");
    setInputValue("");

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const aiReply = await fetchClaudeReply(nextMessages, policies);
      const finalReply = aiReply || getFallbackReply(trimmed, policies);
      if (shouldEscalateReply(finalReply)) {
        onFlaggedQuestion(trimmed);
      }
      setMessages((current) => [...current, { role: "assistant", content: finalReply }]);
    } catch (requestError) {
      const fallback = getFallbackReply(trimmed, policies);
      onFlaggedQuestion(trimmed);
      setMessages((current) => [...current, { role: "assistant", content: fallback }]);
      setError(`Claude endpoint unavailable, showing fallback response (${requestError.message}).`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="panel">
      <h1>Parent Chat</h1>
      <p className="subtitle">Ask about policies, hours, tuition, tours, or daily logistics.</p>

      <div className="chat-window">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`message ${message.role}`}>
            <span className="role-label">{message.role === "user" ? "You" : "Assistant"}</span>
            {message.role === "assistant" ? (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            ) : (
              <p>{message.content}</p>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <span className="role-label">Assistant</span>
            <p>Thinking...</p>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <form className="chat-input-row" onSubmit={onSend}>
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Type your question..."
          aria-label="Parent chat message"
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}

function CustomSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selected = options.find((o) => o.id === value) || options[0];

  return (
    <div className={`custom-select ${open ? "open" : ""}`} ref={ref}>
      <button
        type="button"
        className="custom-select-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
      >
        <span className="custom-select-label">{selected.label}</span>
        <span className="custom-select-caret">▾</span>
      </button>
      {open && (
        <ul className="custom-select-list" role="listbox">
          {options.map((opt) => (
            <li
              key={opt.id}
              role="option"
              aria-selected={opt.id === value}
              className={`custom-select-item ${opt.id === value ? "selected" : ""}`}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OperatorView({
  flaggedQuestions,
  policyDraft,
  onPolicyChange,
  onResolveFlaggedQuestion,
  draftResolutions,
  draftResolutionOptions,
  onDraftResolutionOptionChange,
  onDraftResolutionOtherChange,
  resolvedItems,
  knowledgeBase
}) {
  const RESOLUTION_OPTIONS = [
    { id: "STAFF", label: "Connect staff" },
    { id: "POLICY", label: "Policy clarification needed" },
    { id: "OPERATOR", label: "Escalate to operator" },
    { id: "OTHER", label: "Other" }
  ];

  return (
    <section className="panel">
      <h1>Operator Dashboard</h1>
      <p className="subtitle">Monitor escalations and manage policies used by the AI assistant.</p>

      <div className="operator-grid">
        <div className="operator-card">
          <h2>1) Flagged Questions</h2>
          {flaggedQuestions.length === 0 ? (
            <p>No flagged questions yet.</p>
          ) : (
            <ul className="flagged-list">
              {flaggedQuestions.map((item) => (
                <li key={item.id} className="unresolved-item">
                  <p className="flagged-question">{item.question}</p>
                  <span className="item-timestamp">Flagged at: {item.timestamp}</span>
                  <label className="resolution-row">
                    <span>Resolution type</span>
                    <CustomSelect
                      value={draftResolutionOptions[item.id] || "STAFF"}
                      options={RESOLUTION_OPTIONS}
                      onChange={(val) => onDraftResolutionOptionChange(item.id, val)}
                    />
                  </label>

                  {draftResolutionOptions[item.id] === "OTHER" && (
                    <label className="resolution-row">
                      <span>Other resolution text</span>
                      <textarea
                        rows={2}
                        value={draftResolutions[item.id] || ""}
                        onChange={(event) => onDraftResolutionOtherChange(item.id, event.target.value)}
                        placeholder="Add operator resolution notes..."
                      />
                    </label>
                  )}
                  {draftResolutionOptions[item.id] && (
                    <p className="saved-resolution">
                      Resolution text:{" "}
                      {draftResolutionOptions[item.id] === "OTHER"
                        ? draftResolutions[item.id] || ""
                        : RESOLUTION_OPTIONS.find((option) => option.id === draftResolutionOptions[item.id])?.label}
                    </p>
                  )}
                  <button
                    type="button"
                    className="resolve-btn"
                    onClick={() => onResolveFlaggedQuestion(item)}
                    disabled={
                      draftResolutionOptions[item.id] === "OTHER"
                        ? !(draftResolutions[item.id] || "").trim()
                        : false
                    }
                  >
                    Resolve
                  </button>
                </li>
              ))}
            </ul>
          )}

          {resolvedItems.length > 0 && (
            <div className="resolved-list-wrap">
              <h3>Resolved Questions</h3>
              <ul className="flagged-list">
                {resolvedItems.map((item) => (
                  <li key={`resolved-${item.id}`} className="resolved-item">
                    <p className="flagged-question">{item.question}</p>
                    <span className="item-timestamp">Resolved at: {item.resolvedAt}</span>
                    <p className="saved-resolution">Resolution text: {item.resolutionText}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="operator-card">
          <h2>2) Policy Editor</h2>
          <div className="policy-editor">
            {Object.entries(policyDraft).map(([key, value]) => (
              <label key={key} className="policy-row">
                <span>{key}</span>
                <textarea value={value} onChange={(event) => onPolicyChange(key, event.target.value)} rows={2} />
              </label>
            ))}
          </div>
        </div>

        <div className="operator-card">
          <h2>3) Knowledge Base (Current Policies)</h2>
          <pre className="knowledge-base">{JSON.stringify(knowledgeBase, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [view, setView] = useState("parent");
  const [flaggedQuestions, setFlaggedQuestions] = useState([]);
  const [policyDraft, setPolicyDraft] = useState(() => flattenPolicies(centerData.policies));
  const [draftResolutions, setDraftResolutions] = useState({});
  const [draftResolutionOptions, setDraftResolutionOptions] = useState({});
  const [resolvedItems, setResolvedItems] = useState([]);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content: `Hi! I am the ${centerData.center.name} virtual front desk assistant. How can I help today?`
    }
  ]);
  const [chatInputValue, setChatInputValue] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const handleFlaggedQuestion = (question) => {
    setFlaggedQuestions((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        question,
        timestamp: new Date().toLocaleString()
      },
      ...current
    ]);
  };

  const handlePolicyChange = (key, value) => {
    setPolicyDraft((current) => ({ ...current, [key]: value }));
  };

  const RESOLUTION_TEXT_BY_ID = {
    STAFF: "I'll connect you with our staff and flag it.",
    POLICY: "Policy clarification needed; please follow up with the relevant center policy.",
    OPERATOR: "Escalate to operator for manual follow-up.",
    OTHER: ""
  };

  const handleDraftResolutionOptionChange = (id, optionId) => {
    setDraftResolutionOptions((current) => ({ ...current, [id]: optionId }));
    const text = RESOLUTION_TEXT_BY_ID[optionId] || "";
    // For "Other", we clear until the operator types custom text.
    setDraftResolutions((current) => ({ ...current, [id]: optionId === "OTHER" ? "" : text }));
  };

  const handleDraftResolutionOtherChange = (id, value) => {
    setDraftResolutions((current) => ({ ...current, [id]: value }));
  };

  const handleResolveFlaggedQuestion = (item) => {
    const selected = draftResolutionOptions[item.id] || "STAFF";
    const resolutionText =
      selected === "OTHER" ? (draftResolutions[item.id] || "").trim() : RESOLUTION_TEXT_BY_ID[selected];
    if (!resolutionText) {
      return;
    }

    setResolvedItems((current) => [
      {
        ...item,
        resolvedAt: new Date().toLocaleString(),
        resolutionText
      },
      ...current
    ]);
    setFlaggedQuestions((current) => current.filter((question) => question.id !== item.id));
  };

  const currentPolicies = unflattenPolicies(policyDraft);

  return (
    <div className="App">
      <header className="app-header">
        <h1 className="brand-title">Pioneers Learning Center</h1>
      </header>
      <header className="tab-bar">
        <button onClick={() => setView("parent")} className={view === "parent" ? "active" : ""}>
          Parent View
        </button>
        <button onClick={() => setView("operator")} className={view === "operator" ? "active" : ""}>
          Operator View
          {flaggedQuestions.length > 0 && <span className="badge">{flaggedQuestions.length}</span>}
        </button>
      </header>
      {view === "parent" ? (
        <ParentView
          policies={currentPolicies}
          onFlaggedQuestion={handleFlaggedQuestion}
          messages={chatMessages}
          setMessages={setChatMessages}
          inputValue={chatInputValue}
          setInputValue={setChatInputValue}
          isLoading={chatLoading}
          setIsLoading={setChatLoading}
          error={chatError}
          setError={setChatError}
        />
      ) : (
        <OperatorView
          flaggedQuestions={flaggedQuestions}
          policyDraft={policyDraft}
          onPolicyChange={handlePolicyChange}
          draftResolutions={draftResolutions}
          draftResolutionOptions={draftResolutionOptions}
          onDraftResolutionOptionChange={handleDraftResolutionOptionChange}
          onDraftResolutionOtherChange={handleDraftResolutionOtherChange}
          resolvedItems={resolvedItems}
          onResolveFlaggedQuestion={handleResolveFlaggedQuestion}
          knowledgeBase={{ center: centerData.center, policies: currentPolicies }}
        />
      )}
    </div>
  );
}

export default App;