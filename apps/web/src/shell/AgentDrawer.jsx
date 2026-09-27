import { useEffect, useRef, useState } from "react";
import { askAgent } from "../api/agent";
import { compactConversationHistory } from "../api/agentHistory";
import { loadProjects, loadTasks } from "../store/session";
import { refreshWorkspace } from "../store/projects";
import { Button } from "../ui/Button";
import { SidePanel } from "../ui/Dialog";

const INITIAL_MESSAGE = {
  role: "assistant",
  content: "Ask about your work, or tell me to create or update a task.",
  actions: [],
};

const canRetryAgentError = (error) =>
  ![401, 403, 503].includes(error?.status) &&
  !/not configured|credentials are invalid|api key/i.test(error?.message || "");

const renderInline = (text) => text.split(/(\*\*[^*]+\*\*)/u).map((part, index) =>
  part.startsWith("**") && part.endsWith("**")
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : part
);

function MessageContent({ content }) {
  const blocks = [];
  let bullets = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(<ul key={`list-${blocks.length}`}>{bullets.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</ul>);
    bullets = [];
  };

  String(content).split("\n").forEach((line) => {
    const bullet = line.match(/^\s*(?:[-*]|•)\s+(.+)$/u);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flushBullets();
    if (line.trim()) blocks.push(<p key={`line-${blocks.length}`}>{renderInline(line)}</p>);
  });
  flushBullets();
  return blocks;
}

export function AgentDrawer({ open, onClose, project }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const retryRef = useRef(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading]);

  const run = async ({ content, history, appendUser, confirmedDeleteTask }) => {
    if (!content || loading) return;
    retryRef.current = { content, history, appendUser: false, confirmedDeleteTask };
    if (appendUser) setMessages((current) => [...current, { role: "user", content, actions: [] }]);
    setError("");
    setLoading(true);
    try {
      const result = await askAgent(content, history, {
        projectId: project?.id || null,
        workspaceId: null,
      });
      setMessages((current) => [...current, {
        role: "assistant",
        content: result.message,
        actions: result.actions,
        confirmation: result.confirmation || null,
      }]);
      retryRef.current = null;
      const mutationNames = new Set(["create_task", "add_task_dependency", "update_task", "delete_task", "bulk_update_tasks", "generate_subtasks"]);
      const mutations = result.actions.filter((action) => action.status === "completed" && mutationNames.has(action.name));
      if (mutations.length) {
        void Promise.allSettled([loadProjects({ silent: true }), loadTasks({ silent: true })]);
        const projectIds = [...new Set([project?.id, ...mutations.flatMap((action) => {
          const tasks = [action.result?.task, ...(Array.isArray(action.result?.tasks) ? action.result.tasks : [])];
          return tasks.map((task) => task?.project_id).filter(Boolean);
        })].filter(Boolean))];
        projectIds.forEach((projectId) => void refreshWorkspace(projectId));
      }
    } catch (value) {
      const message = value instanceof Error ? value.message : "TaskFlow Agent is unavailable.";
      setError({ message, retryable: canRetryAgentError(value) });
    } finally {
      setLoading(false);
    }
  };

  const send = () => {
    const content = draft.trim();
    if (!content || loading) return;
    const history = compactConversationHistory(messages);
    const pendingDelete = [...messages].reverse().find((message) => message.confirmation?.type === "delete_task")?.confirmation;
    setDraft("");
    void run({ content, history, appendUser: true, confirmedDeleteTask: pendingDelete });
  };

  const retry = () => {
    if (retryRef.current) void run(retryRef.current);
  };

  const confirmDelete = (messageIndex, confirmation) => {
    const history = compactConversationHistory(messages);
    setMessages((current) => current.map((message, index) => index === messageIndex
      ? { ...message, confirmation: null }
      : message));
    void run({ content: "Yes, delete it.", history, appendUser: true, confirmedDeleteTask: confirmation });
  };

  const cancelDelete = (messageIndex) => {
    setMessages((current) => [
      ...current.map((message, index) => index === messageIndex ? { ...message, confirmation: null } : message),
      { role: "user", content: "Cancel deletion.", actions: [] },
      { role: "assistant", content: "Okay, I won’t delete it.", actions: [] },
    ]);
  };

  const header = (
    <>
      <div className="agent-heading" aria-label="AI Assistant">
        <span className="agent-heading-spark" aria-hidden="true">✦</span>
        <strong>AI Assistant</strong>
      </div>
      <button className="agent-close" type="button" aria-label="Close AI Assistant" onClick={onClose}>×</button>
    </>
  );
  const footer = (
    <form className="agent-compose" onSubmit={(event) => { event.preventDefault(); send(); }}>
      <textarea
        ref={inputRef}
        className="agent-input"
        rows={1}
        value={draft}
        disabled={loading}
        placeholder="Ask a question or create a task..."
        aria-label="Message AI Assistant"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
      />
      <button className="agent-submit" type="submit" aria-label="Send message" disabled={!draft.trim() || loading}>
        {loading ? <span className="spinner spinner-sm" /> : <span aria-hidden="true">↑</span>}
      </button>
    </form>
  );

  return (
    <SidePanel open={open} onClose={onClose} ariaLabel="TaskFlow Agent" className="agent-panel" header={header} footer={footer}>
      <div className="agent-thread" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`agent-message is-${message.role}`}>
            <div className="agent-message-row">
              {message.role === "assistant" ? <span className="agent-avatar" aria-hidden="true">✦</span> : null}
              <div>
                <div className="agent-bubble"><MessageContent content={message.content} /></div>
                {message.confirmation?.type === "delete_task" ? (
                  <div className="agent-confirmation" aria-label="Confirm task deletion">
                    <button type="button" className="agent-confirm" disabled={loading} onClick={() => confirmDelete(index, message.confirmation)}>Confirm</button>
                    <button type="button" className="agent-cancel" disabled={loading} onClick={() => cancelDelete(index)}>Cancel</button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {loading ? <div className="agent-thinking"><span className="spinner spinner-sm" /> Thinking and checking TaskFlow…</div> : null}
        {error ? <div className="agent-error" role="alert"><span>{error.message}</span>{error.retryable ? <Button size="sm" variant="ghost" onClick={retry}>Retry</Button> : null}</div> : null}
        <div ref={endRef} />
      </div>
    </SidePanel>
  );
}
