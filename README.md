# @orvix-id/pi

[Pi](https://pi.dev) extension for the **Orvix Coding Plan**. Pi runs the agent; this extension connects it to
`https://api.orvix.id/coding/v1` and keeps every session on the prompt cache.

Pi is the lightest of the supported harnesses: in our measurements a Pi session sent about a third of the prompt
tokens of the same task in OpenCode, so your Coding quota lasts longest here.

Using OpenCode or Oh My Pi instead? See [@orvix-id/opencode](https://github.com/Orvix-id/opencode-plugin) and
[@orvix-id/omp](https://github.com/Orvix-id/omp-plugin).

## Setup

1. **Create a Coding key.** In [platform.orvix.id/api-keys](https://platform.orvix.id/api-keys), create a key and
   tick **Orvix Coding** (`coding:invoke`). The default AI Router scope (`ai:invoke`) is not enough; Coding
   endpoints answer `401 coding:invoke scope required`.
2. **Expose the key** to Pi:

   ```bash
   export ORVIX_CODING_API_KEY="orv-sk_live_..."
   ```

   Put it in your shell profile or secret manager rather than typing it into commands you share.
3. **Install the extension**, then restart Pi or run `/reload`:

   ```bash
   pi install npm:@orvix-id/pi
   ```

   To try it once without installing: `pi -e npm:@orvix-id/pi`.
4. **Pick a model:** `pi --model orvix-coding/deepseek-v4-flash`, or `/model` inside Pi.

## Models

The model list comes from `GET /coding/v1/models` when the key is available, so it always matches your plan.
Without network access the extension falls back to the lineup it shipped with. Model ids drop the `orvix/`
prefix: `orvix-coding/glm-5.2` calls `orvix/glm-5.2`. Pi's thinking levels map to `reasoning_effort`; levels a
model does not support are clamped instead of sent.

## What the extension does

| Piece | Why |
| --- | --- |
| Provider `orvix-coding` on Pi's built-in `openai-completions` API | Message conversion, tools, and usage accounting stay Pi's own. |
| `session_id` added in `before_provider_request` | Orvix keeps a session on the same upstream route and prompt cache only when the request body carries `session_id`. Pi's session id is stable across `--continue`. |
| `x-orvix-coding-client` header | Reports the client name and extension version. Used for diagnostics only. |

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `No models available` | The extension is not installed, or `ORVIX_CODING_API_KEY` is not set in Pi's environment. |
| `401 coding:invoke scope required` | The key was created without the **Orvix Coding** scope. |
| `429 coding_concurrency_exceeded` | Too many Coding requests in flight at once. Pi retries; `retry_after` is a few seconds. |
| `429 coding_quota_exceeded` | A 5-hour, weekly, or monthly window is used up. `resets_at` says when. |

## Development

```bash
bun install
bun run check
bun run probe        # 3 real Pi turns against a local mock, reports prefix reuse per request
```

## License

MIT
