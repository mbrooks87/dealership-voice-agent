import Fastify from "fastify";
import { z } from "zod";
import { handlers } from "./tools.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const VAPI_WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

// Vapi sends tool calls in a couple of shapes depending on API version —
// normalize both `{ id, name, arguments }` and OpenAI-style
// `{ id, function: { name, arguments } }`, with arguments as object or JSON string.
const toolCallSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    arguments: z.unknown().optional(),
    function: z
      .object({
        name: z.string(),
        arguments: z.unknown().optional(),
      })
      .optional(),
  })
  .transform((tc) => {
    const rawArgs = tc.function?.arguments ?? tc.arguments;
    let args: unknown = rawArgs;
    if (typeof rawArgs === "string") {
      try {
        args = JSON.parse(rawArgs);
      } catch {
        args = {};
      }
    }
    return { id: tc.id, name: tc.function?.name ?? tc.name ?? "", args };
  });

const toolsPayloadSchema = z.object({
  message: z.object({
    type: z.string(),
    toolCallList: z.array(toolCallSchema).optional(),
    toolCalls: z.array(toolCallSchema).optional(),
    call: z.object({ id: z.string().optional() }).optional(),
  }),
});

app.post("/vapi/tools", async (request, reply) => {
  if (VAPI_WEBHOOK_SECRET && request.headers["x-vapi-secret"] !== VAPI_WEBHOOK_SECRET) {
    request.log.warn("rejected tool call: bad webhook secret");
    return reply.code(401).send({ error: "unauthorized" });
  }

  const parsed = toolsPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    request.log.warn({ issues: parsed.error.issues }, "unrecognized tool payload");
    return reply.code(400).send({ error: "bad payload" });
  }

  const { message } = parsed.data;
  const callId = message.call?.id;
  const toolCalls = message.toolCallList ?? message.toolCalls ?? [];

  const results = await Promise.all(
    toolCalls.map(async (tc) => {
      const started = Date.now();
      const handler = handlers[tc.name];
      let result: string;
      try {
        if (!handler) {
          result = `Unknown tool ${tc.name}. Apologize and offer to transfer the caller to a team member.`;
          request.log.warn({ callId, tool: tc.name }, "unknown tool requested");
        } else {
          result = await handler(tc.args, callId);
        }
      } catch (err) {
        request.log.error({ callId, tool: tc.name, err }, "tool handler failed");
        result =
          "Something went wrong looking that up. Apologize and offer to transfer the caller to a team member who can help.";
      }
      request.log.info(
        {
          callId,
          tool: tc.name,
          args: tc.args,
          latencyMs: Date.now() - started,
        },
        "tool invocation"
      );
      return { toolCallId: tc.id, result };
    })
  );

  return { results };
});

app.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

app
  .listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`dealership voice agent listening on ${HOST}:${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
