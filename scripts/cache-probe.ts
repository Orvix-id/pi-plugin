/**
 * Cache probe: how cache-friendly is Pi + this extension?
 *
 * Starts a mock `/coding/v1` server, runs real `pi --print` turns against it
 * through the extension (isolated agent dir), and reports for each request:
 *   - whether `session_id` reached the body, and stayed the same across turns
 *   - how many leading bytes match the previous agent request
 *     (an upstream prompt cache can only hit on an identical prefix)
 *
 * The mock answers the first request of a turn with one `read` tool call and
 * the follow-up with text, so each turn also grows the in-turn prefix.
 *
 *   bun scripts/cache-probe.ts [turns=3]
 *   PROBE_CLI=omp bun scripts/cache-probe.ts   # same probe, different host
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const turns = Number(process.argv[2] ?? 3);
const pluginDir = resolve(import.meta.dir, "..");
const MODEL = "glm-5.3-flash";
const cli = (process.env.PROBE_CLI ?? "pi").split(" ");

type Logged = { n: number; kind: string; bodySession?: string; headers: Record<string, string>; prefixText: string; messages: number };
const log: Logged[] = [];

function sse(chunks: unknown[]): Response {
  const text = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(text, { headers: { "content-type": "text/event-stream" } });
}

function chunk(delta: Record<string, unknown>, finish: string | null = null, usage?: unknown) {
  return {
    id: "chatcmpl-probe",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: `orvix/${MODEL}`,
    choices: [{ index: 0, delta, finish_reason: finish }],
    ...(usage ? { usage } : {}),
  };
}

function argsFor(tool: any, value: string): string {
  const params = tool?.function?.parameters ?? {};
  const required: string[] = params.required ?? Object.keys(params.properties ?? {});
  const key = required.find((k) => params.properties?.[k]?.type === "string") ?? required[0];
  return JSON.stringify(key ? { [key]: value } : {});
}

const workdir = mkdtempSync(join(tmpdir(), "orvix-probe-work-"));
writeFileSync(join(workdir, "hello.txt"), "hello from the cache probe\n");

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname.endsWith("/models")) {
      return Response.json({ object: "list", data: [{ id: `orvix/${MODEL}`, object: "model", owned_by: "orvix" }] });
    }
    if (req.method !== "POST" || !url.pathname.endsWith("/chat/completions")) {
      return new Response("not found", { status: 404 });
    }
    const body = (await req.json()) as any;
    const headers: Record<string, string> = {};
    for (const [k, v] of req.headers) {
      if (k === "authorization") headers[k] = v.startsWith("Bearer ") ? "Bearer <redacted>" : "<redacted>";
      else if (k.startsWith("x-") || k === "session_id") headers[k] = v;
    }
    const tools: any[] = body.tools ?? [];
    const messages: any[] = body.messages ?? [];
    const kind = tools.length === 0 ? "aux" : "agent";
    log.push({
      n: log.length + 1,
      kind,
      bodySession: typeof body.session_id === "string" ? body.session_id : undefined,
      headers,
      // What a provider cache keys on: tools + messages, in send order.
      prefixText: JSON.stringify({ tools: body.tools, messages: body.messages }),
      messages: messages.length,
    });

    const usage = { prompt_tokens: 100, completion_tokens: 5, total_tokens: 105 };
    const read = tools.find((t) => t?.function?.name === "read");
    if (kind === "agent" && messages.at(-1)?.role !== "tool" && read) {
      return sse([
        chunk({ role: "assistant", tool_calls: [{ index: 0, id: `call_${log.length}`, type: "function", function: { name: "read", arguments: argsFor(read, join(workdir, "hello.txt")) } }] }),
        chunk({}, "tool_calls", usage),
      ]);
    }
    return sse([chunk({ role: "assistant", content: kind === "aux" ? "Probe title" : "Done." }), chunk({}, "stop", usage)]);
  },
});

const home = mkdtempSync(join(tmpdir(), "orvix-probe-home-"));
const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  PI_CODING_AGENT_DIR: join(home, "agent"),
  ORVIX_CODING_BASE_URL: `http://127.0.0.1:${server.port}/coding/v1`,
  ORVIX_CODING_API_KEY: "probe-test-key",
};

async function run(args: string[]) {
  const proc = Bun.spawn([...cli, "--print", "-e", pluginDir, "--model", `orvix-coding/${MODEL}`, ...args], {
    cwd: workdir,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) {
    console.error(`${cli.join(" ")} exited ${code}\n${out}\n${err}`);
    server.stop(true);
    process.exit(1);
  }
}

const prompts = ["Read hello.txt and tell me what it says.", "Read it again please.", "One more time, read hello.txt."];
for (let i = 0; i < turns; i++) {
  await run([...(i === 0 ? [] : ["--continue"]), prompts[i % prompts.length]!]);
}
server.stop(true);

function common(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

const sessions = new Set(log.filter((r) => r.kind === "agent").map((r) => r.bodySession ?? "<none>"));
console.log(`\nhost: ${cli.join(" ")}   requests: ${log.length}   distinct body session_id values: ${[...sessions].join(", ")}\n`);
console.log("  #  kind   msgs  session_id in body   prefix reused from previous agent request");
let prev: Logged | undefined;
let reused = 0;
let total = 0;
for (const r of log) {
  let note = "-";
  if (r.kind === "agent") {
    if (prev) {
      const same = common(prev.prefixText, r.prefixText);
      // The previous body minus its closing `]}` is the most a follow-up can share.
      note = `${same}/${prev.prefixText.length} bytes ${same >= prev.prefixText.length - 2 ? "(full prefix)" : "(BROKEN)"}`;
      reused += same;
      total += r.prefixText.length;
    }
    prev = r;
  }
  console.log(`${String(r.n).padStart(3)}  ${r.kind.padEnd(5)}  ${String(r.messages).padStart(4)}  ${(r.bodySession ? "yes" : "no").padEnd(19)}  ${note}`);
}
if (total) console.log(`\nbyte-level prefix reuse across follow-up agent requests: ${((100 * reused) / total).toFixed(1)}%`);
console.log("\nheaders seen on the first agent request:");
console.log(log.find((r) => r.kind === "agent")?.headers);
