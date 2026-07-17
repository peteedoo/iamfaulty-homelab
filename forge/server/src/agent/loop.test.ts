import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentLoop, type AgentEvent } from "./loop.js";
import type {
  LLMProvider,
  Message,
  StreamEvent,
  ToolDefinition,
} from "../providers/types.js";
import { getWorkspaceRoot, setWorkspaceRoot } from "../utils/paths.js";

type TurnFn = (onEvent: (e: StreamEvent) => void) => Message;

class ScriptedProvider implements LLMProvider {
  public calls: Message[][] = [];
  constructor(private turns: TurnFn[]) {}

  async streamChat(
    messages: Message[],
    _tools: ToolDefinition[],
    onEvent: (event: StreamEvent) => void
  ): Promise<Message> {
    this.calls.push(messages.map((m) => ({ ...m })));
    const turn = this.turns.shift();
    if (!turn) throw new Error("ScriptedProvider ran out of turns");
    return turn(onEvent);
  }
}

let workspace: string;
let originalRoot: string;

beforeEach(async () => {
  originalRoot = getWorkspaceRoot();
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), "forge-loop-"));
  setWorkspaceRoot(workspace);
});

afterEach(async () => {
  setWorkspaceRoot(originalRoot);
  await fs.rm(workspace, { recursive: true, force: true });
});

describe("runAgentLoop", () => {
  it("completes in one turn when the assistant replies with plain text", async () => {
    const provider = new ScriptedProvider([
      (onEvent) => {
        onEvent({ type: "text_delta", text: "all done" });
        onEvent({ type: "done" });
        return { role: "assistant", content: [{ type: "text", text: "all done" }] };
      },
    ]);

    const events: AgentEvent[] = [];
    const newMessages = await runAgentLoop(provider, "hi", [], (e) => events.push(e));

    expect(events.map((e) => e.type)).toEqual([
      "thinking",
      "text_delta",
      "turn_complete",
    ]);
    expect(newMessages[0]).toEqual({ role: "user", content: "hi" });
    expect(newMessages).toHaveLength(2);
  });

  it("prepends the system prompt and history but returns only new messages", async () => {
    const provider = new ScriptedProvider([
      (onEvent) => {
        onEvent({ type: "done" });
        return { role: "assistant", content: [{ type: "text", text: "ok" }] };
      },
    ]);
    const history: Message[] = [
      { role: "user", content: "earlier" },
      { role: "assistant", content: "earlier reply" },
    ];

    const newMessages = await runAgentLoop(provider, "now", history, () => {});

    const sentToProvider = provider.calls[0];
    expect(sentToProvider[0].role).toBe("system");
    expect(sentToProvider.slice(1, 3)).toEqual(history);
    expect(sentToProvider.at(-1)).toEqual({ role: "user", content: "now" });
    // Returned history excludes system prompt and prior history.
    expect(newMessages[0]).toEqual({ role: "user", content: "now" });
  });

  it("executes a requested tool then finishes on the next turn", async () => {
    await fs.writeFile(path.join(workspace, "hello.txt"), "hi there");

    const provider = new ScriptedProvider([
      (onEvent) => {
        const toolUse = {
          type: "tool_use" as const,
          id: "call_1",
          name: "read_file",
          input: { path: "hello.txt" },
        };
        onEvent({ type: "tool_use", tool_use: toolUse });
        onEvent({ type: "done" });
        return { role: "assistant", content: [toolUse] };
      },
      (onEvent) => {
        onEvent({ type: "text_delta", text: "read it" });
        onEvent({ type: "done" });
        return { role: "assistant", content: [{ type: "text", text: "read it" }] };
      },
    ]);

    const events: AgentEvent[] = [];
    const newMessages = await runAgentLoop(provider, "read hello", [], (e) =>
      events.push(e)
    );

    const start = events.find((e) => e.type === "tool_start");
    const result = events.find((e) => e.type === "tool_result");
    expect(start?.tool).toEqual({ name: "read_file", input: { path: "hello.txt" } });
    expect(result?.isError).toBe(false);
    expect(result?.result).toBe("1|hi there");

    // user + assistant(tool_use) + user(tool_result) + assistant(final)
    expect(newMessages).toHaveLength(4);
    const toolResultMsg = newMessages[2];
    expect(Array.isArray(toolResultMsg.content)).toBe(true);
    expect((toolResultMsg.content as unknown[])[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "call_1",
      is_error: false,
    });
  });

  it("continues when a text reply contains a code fence but no tools, then stops", async () => {
    const provider = new ScriptedProvider([
      (onEvent) => {
        onEvent({ type: "text_delta", text: "```ts\ncode\n```" });
        onEvent({ type: "done" });
        return { role: "assistant", content: [{ type: "text", text: "```ts\ncode\n```" }] };
      },
    ]);

    const events: AgentEvent[] = [];
    await runAgentLoop(provider, "write code", [], (e) => events.push(e));

    // With a fence but no tool calls, the loop reaches the "no tools to run" guard.
    expect(events.at(-1)?.type).toBe("turn_complete");
  });

  it("emits an error event when max turns is exceeded", async () => {
    const alwaysToolTurn: TurnFn = (onEvent) => {
      const toolUse = {
        type: "tool_use" as const,
        id: "c",
        name: "run_command",
        input: { command: "echo loop" },
      };
      onEvent({ type: "tool_use", tool_use: toolUse });
      onEvent({ type: "done" });
      return { role: "assistant", content: [toolUse] };
    };
    const provider = new ScriptedProvider(Array.from({ length: 30 }, () => alwaysToolTurn));

    const events: AgentEvent[] = [];
    await runAgentLoop(provider, "loop forever", [], (e) => events.push(e));

    const last = events.at(-1);
    expect(last?.type).toBe("error");
    expect(last?.text).toBe("Max agent turns reached");
    expect(events.filter((e) => e.type === "thinking")).toHaveLength(25);
  });

  it("propagates provider errors", async () => {
    const failing: LLMProvider = {
      streamChat: vi.fn().mockRejectedValue(new Error("provider boom")),
    };
    await expect(runAgentLoop(failing, "hi", [], () => {})).rejects.toThrow(
      "provider boom"
    );
  });
});
