import { useEffect, useRef, useState } from "react";
import { askAgent } from "../api/agent";
import { loadTasks } from "../store/session";
import { refreshWorkspace } from "../store/projects";
import { openTask, openTaskInProject } from "../store/ui";
import { Button, IconButton } from "../ui/Button";
import { SidePanel } from "../ui/Dialog";
import { Icon } from "../ui/icons";

const INITIAL_MESSAGE = {
  role: "assistant",
  content: "Ask about your work, or tell me to create or update a task.",
  actions: [],
};

const toolLabels = {
  list_projects: "Found projects",
  query_tasks: "Checked tasks",
  create_task: "Created task",
  update_task: "Updated task",
};

const timezone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
};

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

  const run = async ({ content, history, appendUser }) => {
    if (!content || loading) return;
    retryRef.current = { content, history, appendUser: false };
    if (appendUser) setMessages((current) => [...current, { role: "user", content, actions: [] }]);
    setError("");
    setLoading(true);
    try {
      const result = await askAgent(content, history, {
        timezone: timezone(),
        currentProjectId: project?.id || null,
        currentProjectName: project?.name || null,
      });
      setMessages((current) => [...current, { role: "assistant", content: result.message, actions: result.actions }]);
      retryRef.current = null;
      const mutations = result.actions.filter((action) => action.status === "completed" && (action.name === "create_task" || action.name === "update_task"));
      if (mutations.length) {
        void loadTasks({ silent: true });
        const projectIds = [...new Set(mutations.map((action) => action.result?.task?.project_id).filter(Boolean))];
        projectIds.forEach((projectId) => void refreshWorkspace(projectId));
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "TaskFlow Agent is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const send = () => {
    const content = draft.trim();
    if (!content || loading) return;
    const history = messages.map(({ role, content: text }) => ({ role, content: text }));
    setDraft("");
    void run({ content, history, appendUser: true });
  };

  const retry = () => {
    if (retryRef.current) void run(retryRef.current);
  };

  const openActionTask = async (action) => {
    const task = action.result?.task;
    if (!task?.id) return;
    const mapped = { id: task.id, projectId: task.project_id || null };
    if (mapped.projectId) {
      await refreshWorkspace(mapped.projectId);
      openTaskInProject(mapped);
    } else {
      await loadTasks({ silent: true });
      openTask(mapped.id);
    }
    onClose();
  };

  const header = <><div className="agent-heading"><span className="agent-mark"><Icon name="sparkles" size={15} /></span><div><strong>TaskFlow Agent</strong><span>Actions grounded in your workspace</span></div></div><IconButton label="Close agent" size="sm" onClick={onClose}><Icon name="x" /></IconButton></>;
  const footer = <form className="agent-compose" onSubmit={(event) => { event.preventDefault(); send(); }}><textarea ref={inputRef} className="agent-input" rows={2} value={draft} disabled={loading} placeholder="Ask about tasks or create an action…" aria-label="Message TaskFlow Agent" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} /><Button variant="primary" type="submit" disabled={!draft.trim()} loading={loading}>Send</Button></form>;

  return (
    <SidePanel open={open} onClose={onClose} ariaLabel="TaskFlow Agent" className="agent-panel" header={header} footer={footer}>
      <div className="agent-thread" aria-live="polite">
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`agent-message is-${message.role}`}><div className="agent-bubble">{message.content}</div>{message.actions?.map((action) => <button key={action.id} type="button" className={`agent-action is-${action.status}`} disabled={!action.result?.task?.id} onClick={() => openActionTask(action)}><span><strong>{toolLabels[action.name] || action.name}</strong><small>{action.status === "failed" ? action.error : action.result?.task?.title || `${action.result?.tasks?.length ?? action.result?.projects?.length ?? 0} results`}</small></span>{action.result?.task?.id ? <Icon name="chevron-right" /> : null}</button>)}</div>)}
        {loading ? <div className="agent-thinking"><span className="spinner spinner-sm" /> Thinking and checking TaskFlow…</div> : null}
        {error ? <div className="agent-error" role="alert"><span>{error}</span><Button size="sm" variant="ghost" onClick={retry}>Retry</Button></div> : null}
        <div ref={endRef} />
      </div>
    </SidePanel>
  );
}
