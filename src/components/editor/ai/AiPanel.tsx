"use client";

import { useState } from "react";
import {
  ArrowUp,
  Check,
  CaretDown,
  Key,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { useEditorStore } from "@/store/editor-store";
import {
  DEFAULT_PROVIDER_CONFIG,
  type AiProviderConfig,
} from "@/core/ai/config";
import { editPlanSchema, type EditPlan } from "@/core/schema/edit-plan";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
}

const suggestions = [
  "Add a clean title for the first 3 seconds",
  "Make this a 9:16 short",
  "Split the selected clip at the playhead",
  "Trim the opening to start at 2 seconds",
];

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function AiPanel() {
  const project = useEditorStore((state) => state.project);
  const currentTime = useEditorStore((state) => state.currentTime);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const pendingPlan = useEditorStore((state) => state.pendingPlan);
  const setPendingPlan = useEditorStore((state) => state.setPendingPlan);
  const applyPlan = useEditorStore((state) => state.applyPlan);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Describe the cut you want. I will turn it into a reviewable timeline plan before changing anything.",
    },
  ]);
  const [config, setConfig] = useState<AiProviderConfig>({
    ...DEFAULT_PROVIDER_CONFIG,
    apiKey: "",
  });

  const addMessage = (role: ChatMessage["role"], text: string) =>
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role, text },
    ]);

  const requestPlan = async () => {
    const request = prompt.trim();
    if (!request || loading) {
      return;
    }
    if (!config.apiKey.trim()) {
      addMessage("error", "Add an API key in Model settings first.");
      return;
    }
    setPrompt("");
    addMessage("user", request);
    setLoading(true);
    try {
      const response = await fetch(`${appBasePath}/api/ai/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request,
          project,
          context: { currentTime, selectedClipIds },
          config,
        }),
      });
      const payload = (await response.json()) as {
        plan?: unknown;
        error?: string;
      };
      if (!response.ok || !payload.plan) {
        throw new Error(payload.error ?? "Planning failed.");
      }
      const plan = editPlanSchema.parse(payload.plan);
      setPendingPlan(plan);
      addMessage("assistant", plan.explanation);
    } catch (error) {
      addMessage(
        "error",
        error instanceof Error ? error.message : "Planning failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!config.apiKey.trim()) {
      setTestResult("Enter an API key first.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${appBasePath}/api/ai/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        latencyMs?: number;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Connection test failed.");
      }
      setTestResult(`Connected in ${result.latencyMs ?? 0} ms`);
    } catch (error) {
      setTestResult(
        error instanceof Error ? error.message : "Connection test failed.",
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="ai-panel">
      <details className="ai-config">
        <summary>
          <CaretDown size={13} aria-hidden="true" />
          <Key size={14} aria-hidden="true" />
          Model settings
        </summary>
        <div className="ai-config-fields">
          <div className="field">
            <label htmlFor="ai-provider">Provider API</label>
            <select
              id="ai-provider"
              className="select-input"
              value={config.provider}
              onChange={(event) => {
                const provider = event.currentTarget.value as AiProviderConfig["provider"];
                setConfig((current) => ({
                  ...current,
                  provider,
                  baseUrl:
                    provider === "anthropic"
                      ? "https://api.anthropic.com"
                      : "https://api.openai.com/v1",
                }));
              }}
            >
              <option value="openai-compatible">OpenAI compatible</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ai-base-url">Base URL</label>
            <input
              id="ai-base-url"
              className="text-input"
              value={config.baseUrl}
              spellCheck={false}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setConfig((current) => ({
                  ...current,
                  baseUrl: value,
                }))
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="ai-model">Model</label>
            <input
              id="ai-model"
              className="text-input"
              value={config.model}
              spellCheck={false}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setConfig((current) => ({
                  ...current,
                  model: value,
                }))
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="ai-key">API key</label>
            <input
              id="ai-key"
              className="text-input"
              type="password"
              value={config.apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder="Stored in this tab only"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setConfig((current) => ({
                  ...current,
                  apiKey: value,
                }))
              }}
            />
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={testing}
            onClick={() => void testConnection()}
          >
            {testing ? (
              <SpinnerGap size={15} className="spin" aria-hidden="true" />
            ) : (
              <Check size={15} aria-hidden="true" />
            )}
            Test connection
          </button>
          {testResult ? (
            <span className="field-label" role="status">
              {testResult}
            </span>
          ) : null}
        </div>
      </details>

      <div className="ai-messages" aria-live="polite">
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            {message.text}
          </div>
        ))}
        {!messages.some((message) => message.role === "user") ? (
          <div className="ai-suggestions">
            {suggestions.map((suggestion) => (
              <button
                type="button"
                className="suggestion"
                key={suggestion}
                onClick={() => setPrompt(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        {pendingPlan ? (
          <PlanCard
            plan={pendingPlan}
            onApply={() => {
              try {
                applyPlan(pendingPlan);
                addMessage(
                  "assistant",
                  `Applied ${pendingPlan.operations.length} timeline changes. You can undo them as one step.`,
                );
              } catch (error) {
                addMessage(
                  "error",
                  error instanceof Error ? error.message : "Could not apply plan.",
                );
              }
            }}
            onReject={() => setPendingPlan(null)}
          />
        ) : null}
        {loading ? (
          <div className="message assistant">
            <SpinnerGap size={15} className="spin" aria-hidden="true" />{" "}
            Reading the timeline and building a plan
          </div>
        ) : null}
      </div>

      <div className="ai-composer">
        <div className="composer-wrap">
          <label className="sr-only" htmlFor="vibe-prompt">
            Describe a video edit
          </label>
          <textarea
            id="vibe-prompt"
            className="text-area"
            value={prompt}
            placeholder="Cut the first 2 seconds, then add a centered title..."
            onChange={(event) => {
              const value = event.currentTarget.value;
              setPrompt(value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void requestPlan();
              }
            }}
          />
          <button
            type="button"
            className="icon-button composer-send"
            aria-label="Create edit plan"
            title="Create edit plan"
            disabled={!prompt.trim() || loading}
            onClick={() => void requestPlan()}
          >
            <ArrowUp size={17} weight="bold" aria-hidden="true" />
          </button>
        </div>
        <div className="composer-hint">
          <span>Enter to plan, Shift+Enter for a new line</span>
          <span>Review before apply</span>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  onApply,
  onReject,
}: {
  plan: EditPlan;
  onApply: () => void;
  onReject: () => void;
}) {
  return (
    <section className="plan-card" aria-label="Proposed edit plan">
      <h3>{plan.title}</h3>
      <p>{plan.explanation}</p>
      <ol className="plan-operations">
        {plan.operations.map((operation, index) => (
          <li key={`${operation.op}-${index}`}>{operation.op}</li>
        ))}
      </ol>
      {plan.warnings.map((warning) => (
        <p key={warning}>Warning: {warning}</p>
      ))}
      <div className="plan-actions">
        <button type="button" className="primary-button" onClick={onApply}>
          <Check size={15} aria-hidden="true" />
          Apply
        </button>
        <button type="button" className="secondary-button" onClick={onReject}>
          <X size={15} aria-hidden="true" />
          Dismiss
        </button>
      </div>
    </section>
  );
}
