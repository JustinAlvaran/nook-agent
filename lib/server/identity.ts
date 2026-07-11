import { createSupabaseServerClient } from "../supabase/server";

export async function getServerIdentity() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const metadata = user.user_metadata as Record<string, unknown>;
  const displayName = typeof metadata.full_name === "string"
    ? metadata.full_name
    : typeof metadata.name === "string" ? metadata.name : user.email.split("@")[0];
  return {
    email: user.email,
    displayName,
    imageUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
    userId: user.id,
    provider: typeof user.app_metadata.provider === "string" ? user.app_metadata.provider : "unknown",
  };
}

export async function ensureProfileAndNook(identity: NonNullable<Awaited<ReturnType<typeof getServerIdentity>>>, nookName = "Orbit") {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: identity.userId,
    display_name: identity.displayName,
    avatar_url: identity.imageUrl,
    onboarding_state: "active",
  }, { onConflict: "id" });
  if (profileError) throw profileError;

  const { data: existing, error: existingError } = await supabase
    .from("nooks")
    .select("*")
    .eq("owner_id", identity.userId)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("nooks")
    .insert({ owner_id: identity.userId, name: nookName })
    .select("*")
    .single();
  if (createError) throw createError;
  return created;
}
