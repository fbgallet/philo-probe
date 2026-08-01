// OpenRouter access: one chat call, one JSON-answering call, and the live
// price table used for the pre-flight cost estimate.

const BASE = "https://openrouter.ai/api/v1";

export interface ChatResponse {
  choices: Array<{ message: { content: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  provider?: string;
  model?: string;
}

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("\n✖ OPENROUTER_API_KEY is not set. Copy .env.example to .env and put your key in it.\n");
    process.exit(1);
  }
  return key;
}

export function openRouter() {
  const headers = {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/philoscopia/philo-probe",
    "X-Title": "philo-probe",
  };

  async function chat(opts: {
    model: string;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    temperature?: number;
    maxTokens?: number;
    json?: boolean;
  }): Promise<ChatResponse> {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 1,
        max_tokens: opts.maxTokens,
        ...(opts.json && { response_format: { type: "json_object" } }),
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as ChatResponse;
  }

  return { chat };
}

/** Live prices per token, so the estimate does not rot with a hard-coded table. */
export async function priceTable(ids: string[]): Promise<Map<string, { prompt: number; completion: number }>> {
  const res = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${apiKey()}` } });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const body = (await res.json()) as { data: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }> };
  const wanted = new Set(ids);
  const out = new Map<string, { prompt: number; completion: number }>();
  for (const m of body.data) {
    if (!wanted.has(m.id)) continue;
    out.set(m.id, {
      prompt: Number(m.pricing?.prompt ?? 0),
      completion: Number(m.pricing?.completion ?? 0),
    });
  }
  return out;
}
