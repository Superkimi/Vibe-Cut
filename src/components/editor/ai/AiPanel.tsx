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
import { useI18n } from "@/i18n";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
}

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function AiPanel() {
  const project = useEditorStore((state) => state.project);
  const currentTime = useEditorStore((state) => state.currentTime);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const pendingPlan = useEditorStore((state) => state.pendingPlan);
  const setPendingPlan = useEditorStore((state) => state.setPendingPlan);
  const applyPlan = useEditorStore((state) => state.applyPlan);
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: t("ai.welcome"),
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
      addMessage("error", t("ai.addKeyFirst"));
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
        throw new Error(payload.error ?? t("ai.planningFailed"));
      }
      const plan = editPlanSchema.parse(payload.plan);
      setPendingPlan(plan);
      addMessage("assistant", plan.explanation);
    } catch (error) {
      addMessage(
        "error",
        error instanceof Error ? error.message : t("ai.planningFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!config.apiKey.trim()) {
      setTestResult(t("ai.enterKey"));
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
        throw new Error(result.error ?? t("ai.connectionFailed"));
      }
      setTestResult(t("ai.connected", { latency: result.latencyMs ?? 0 }));
    } catch (error) {
      setTestResult(
        error instanceof Error ? error.message : t("ai.connectionFailed"),
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
          {t("ai.modelSettings")}
        </summary>
        <div className="ai-config-fields">
          <div className="field">
            <label htmlFor="ai-provider">{t("ai.providerApi")}</label>
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
              <option value="openai-compatible">{t("ai.openaiCompatible")}</option>
              <option value="anthropic">{t("ai.anthropic")}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ai-base-url">{t("ai.baseUrl")}</label>
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
            <label htmlFor="ai-model">{t("ai.model")}</label>
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
            <label htmlFor="ai-key">{t("ai.apiKey")}</label>
            <input
              id="ai-key"
              className="text-input"
              type="password"
              value={config.apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder={t("ai.keyPlaceholder")}
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
            {t("action.testConnection")}
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
            {message.id === "welcome" ? t("ai.welcome") : message.text}
          </div>
        ))}
        {!messages.some((message) => message.role === "user") ? (
          <div className="ai-suggestions">
            {[
              t("ai.suggestionTitle"),
              t("ai.suggestionShort"),
              t("ai.suggestionSplit"),
              t("ai.suggestionTrim"),
            ].map((suggestion) => (
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
                  t("ai.applied", { count: pendingPlan.operations.length }),
                );
              } catch (error) {
                addMessage(
                  "error",
                  error instanceof Error ? error.message : t("ai.planningFailed"),
                );
              }
            }}
            onReject={() => setPendingPlan(null)}
          />
        ) : null}
        {loading ? (
          <div className="message assistant">
            <SpinnerGap size={15} className="spin" aria-hidden="true" />{" "}
            {t("ai.readingTimeline")}
          </div>
        ) : null}
      </div>

      <div className="ai-composer">
        <div className="composer-wrap">
          <label className="sr-only" htmlFor="vibe-prompt">
            {t("ai.promptLabel")}
          </label>
          <textarea
            id="vibe-prompt"
            className="text-area"
            value={prompt}
            placeholder={t("ai.promptPlaceholder")}
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
            aria-label={t("action.createPlan")}
            title={t("action.createPlan")}
            disabled={!prompt.trim() || loading}
            onClick={() => void requestPlan()}
          >
            <ArrowUp size={17} weight="bold" aria-hidden="true" />
          </button>
        </div>
        <div className="composer-hint">
          <span>{t("ai.enterHint")}</span>
          <span>{t("ai.reviewHint")}</span>
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
  const { t } = useI18n();
  return (
    <section className="plan-card" aria-label={t("ai.proposedPlan")}>
      <h3>{plan.title}</h3>
      <p>{plan.explanation}</p>
      <ol className="plan-operations">
        {plan.operations.map((operation, index) => (
          <li key={`${operation.op}-${index}`}>{operation.op}</li>
        ))}
      </ol>
      {plan.warnings.map((warning) => (
        <p key={warning}>{t("ai.warning", { warning })}</p>
      ))}
      <div className="plan-actions">
        <button type="button" className="primary-button" onClick={onApply}>
          <Check size={15} aria-hidden="true" />
          {t("action.apply")}
        </button>
        <button type="button" className="secondary-button" onClick={onReject}>
          <X size={15} aria-hidden="true" />
          {t("action.dismiss")}
        </button>
      </div>
    </section>
  );
}
