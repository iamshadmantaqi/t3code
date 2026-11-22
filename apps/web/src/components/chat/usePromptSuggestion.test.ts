import {
  MessageId,
  type OrchestrationV2Run,
  ProviderInstanceId,
  RunId,
  ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { offeredPromptSuggestion } from "./usePromptSuggestion";

const now = DateTime.makeUnsafe("2026-06-20T00:00:00.000Z");
const run = (
  id: RunId,
  ordinal: number,
  status: OrchestrationV2Run["status"],
  started = true,
): OrchestrationV2Run => ({
  id,
  threadId: ThreadId.make("thread-1"),
  ordinal,
  providerInstanceId: ProviderInstanceId.make("claudeAgent"),
  modelSelection: { instanceId: ProviderInstanceId.make("claudeAgent"), model: "claude-haiku-4-5" },
  providerThreadId: null,
  userMessageId: MessageId.make(`message-${ordinal}`),
  rootNodeId: null,
  activeAttemptId: null,
  status,
  requestedAt: now,
  startedAt: started ? now : null,
  completedAt: now,
  checkpointId: null,
  contextHandoffId: null,
});
const summary = (value: OrchestrationV2Run) => ({
  runId: value.id,
  status: value.status,
  requestedAt: null,
  startedAt: value.startedAt === null ? null : "2026-06-20T00:00:00.000Z",
  completedAt: "2026-06-20T00:00:00.000Z",
  assistantMessageId: null,
});

describe("offeredPromptSuggestion", () => {
  it("offers the finished turn's suggestion after a queued message was promoted to Steer", () => {
    const turn = run(RunId.make("run-1"), 1, "completed");
    const steered = run(RunId.make("run-2"), 2, "cancelled", false);
    const suggestion = { runId: turn.id, text: "run the tests" };

    expect(offeredPromptSuggestion(suggestion, summary(steered), [turn, steered], false)).toBe(
      suggestion,
    );

    // A later run that did start still replaces the earlier turn's suggestion.
    const stopped = run(RunId.make("run-2"), 2, "cancelled");
    expect(
      offeredPromptSuggestion(suggestion, summary(stopped), [turn, stopped], false),
    ).toBeNull();

    // Several never-started runs in a row still fall back to the turn that ran.
    const removed = run(RunId.make("run-3"), 3, "cancelled", false);
    expect(
      offeredPromptSuggestion(suggestion, summary(removed), [turn, steered, removed], false),
    ).toBe(suggestion);

    // A newer turn that completed behind the cancelled run owns the suggestion slot.
    const next = run(RunId.make("run-2"), 2, "completed");
    expect(
      offeredPromptSuggestion(suggestion, summary(removed), [turn, next, removed], false),
    ).toBeNull();

    // Cached detail that predates the shell's cancelled run cannot vouch for what ran in between.
    const unseen = run(RunId.make("run-3"), 3, "cancelled", false);
    expect(offeredPromptSuggestion(suggestion, summary(unseen), [turn], false)).toBeNull();
  });

  it("offers nothing while background work will resume the thread by itself", () => {
    const turn = run(RunId.make("run-1"), 1, "completed");
    const suggestion = { runId: turn.id, text: "Continue" };

    expect(offeredPromptSuggestion(suggestion, summary(turn), [turn], true)).toBeNull();
    expect(offeredPromptSuggestion(suggestion, summary(turn), [turn], false)).toBe(suggestion);
  });
});
