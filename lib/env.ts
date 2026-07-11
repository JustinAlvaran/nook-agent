import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

const serverSchema = publicSchema.extend({
  OPENAI_API_KEY: z.string().min(20).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  GOOGLE_WORKSPACE_CLIENT_ID: z.string().min(10).optional(),
  GOOGLE_WORKSPACE_CLIENT_SECRET: z.string().min(10).optional(),
  CONNECTOR_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  STRIPE_SECRET_KEY: z.string().min(10).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(10).optional(),
});

export type ServerEnvironment = z.infer<typeof serverSchema>;

export function getPublicEnvironment() {
  return publicSchema.safeParse(process.env);
}

export function getServerEnvironment(): ServerEnvironment {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Nook environment is missing or invalid: ${names}`);
  }
  return parsed.data;
}

export function getCapabilityReadiness() {
  const parsed = serverSchema.safeParse(process.env);
  const env = parsed.success ? parsed.data : null;
  return {
    supabase: Boolean(env),
    agent: Boolean(env?.OPENAI_API_KEY),
    workflowAdmin: Boolean(env?.SUPABASE_SERVICE_ROLE_KEY),
    googleWorkspace: Boolean(env?.GOOGLE_WORKSPACE_CLIENT_ID && env?.GOOGLE_WORKSPACE_CLIENT_SECRET && env?.CONNECTOR_TOKEN_ENCRYPTION_KEY),
    payments: Boolean(env?.STRIPE_SECRET_KEY && env?.STRIPE_WEBHOOK_SECRET),
  };
}
