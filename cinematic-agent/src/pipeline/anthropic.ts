import Anthropic from "@anthropic-ai/sdk";

/**
 * anthropic.ts — shared Claude client + JSON helpers for the three model
 * touchpoints (pre-gate, director, critic).
 *
 * Server-side only. The API key comes from ANTHROPIC_API_KEY and must never end
 * up in the renderer bundle or the site/ output.
 */

export const MODEL = "claude-opus-4-8";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Export it before running the pipeline:\n" +
        "  export ANTHROPIC_API_KEY=sk-ant-...",
    );
  }
  if (!client) client = new Anthropic();
  return client;
}

export type ImageInput = { mediaType: string; dataBase64: string };

export interface CompleteOptions {
  system: string;
  /** Plain prompt text. */
  prompt: string;
  /** Optional images (screenshots / frames) attached to the user turn. */
  images?: ImageInput[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

/**
 * One streaming completion. Streaming is used because the director can emit
 * large JSON and we want to avoid HTTP timeouts. Adaptive thinking is on.
 * Returns the concatenated text content of the response.
 */
export async function complete(opts: CompleteOptions): Promise<string> {
  const c = getClient();

  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of opts.images ?? []) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType as any, data: img.dataBase64 },
    });
  }
  content.push({ type: "text", text: opts.prompt });

  const stream = c.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "high" },
    system: opts.system,
    messages: [{ role: "user", content }],
  });

  const msg = await stream.finalMessage();
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Strip Markdown code fences and parse JSON from a model response. The director
 * and critic both return strict JSON; this tolerates ```json fencing and
 * leading/trailing prose.
 */
export function extractJSON<T = unknown>(text: string): T {
  let t = text.trim();

  // Strip a fenced block if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();

  // Otherwise slice from the first { or [ to the matching last } or ].
  if (!t.startsWith("{") && !t.startsWith("[")) {
    const firstObj = t.indexOf("{");
    const firstArr = t.indexOf("[");
    const start =
      firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstObj, firstArr);
    if (start >= 0) {
      const lastObj = t.lastIndexOf("}");
      const lastArr = t.lastIndexOf("]");
      const end = Math.max(lastObj, lastArr);
      if (end > start) t = t.slice(start, end + 1);
    }
  }

  return JSON.parse(t) as T;
}
