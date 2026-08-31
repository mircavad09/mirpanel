import crypto from "node:crypto";
import { normalizeGmail } from "./netflix-verification-policy.mjs";

// Storage-neutral repository. The caller supplies a durable store in production;
// this default is an empty in-memory pilot store and is never exposed publicly.
export function createNetflixAccountRepository(supabase) {
  if (supabase instanceof Map) {
    const store = supabase;
    return { get: async (email) => { const key = normalizeGmail(email); return key ? store.get(key) || null : null; }, add: async (email) => { const key = normalizeGmail(email); if (!key) throw new Error("INVALID_GMAIL"); if (store.has(key)) return { duplicate: true, account: store.get(key) }; const account = { id: crypto.randomUUID(), email: key, active: true, deletedAt: null, version: 1, createdAt: new Date().toISOString() }; store.set(key, account); return { duplicate: false, account }; }, setActive: async (email, active) => { const account = store.get(normalizeGmail(email)); if (!account) return null; account.active = Boolean(active); account.version += 1; return account; }, remove: async (email) => { const account = store.get(normalizeGmail(email)); if (!account) return null; account.active = false; account.deletedAt = new Date().toISOString(); account.version += 1; return account; }, list: async () => [...store.values()] };
  }
  if (!supabase?.from) throw new Error("SUPABASE_REPOSITORY_REQUIRED");
  return Object.freeze({
    get: async (email) => { const key = normalizeGmail(email); if (!key) return null; const { data, error } = await supabase.from("netflix_accounts").select("id,email,active,deleted_at,version,created_at,last_valid_message_at").eq("email", key).is("deleted_at", null).maybeSingle(); if (error) throw error; return data ? { ...data, deletedAt: data.deleted_at } : null; },
    add: async (email) => { const key = normalizeGmail(email); if (!key) throw new Error("INVALID_GMAIL"); const { data, error } = await supabase.from("netflix_accounts").insert({ email: key }).select("id,email,active,deleted_at,version,created_at,last_valid_message_at").single(); if (error?.code === "23505") { const existing = await supabase.from("netflix_accounts").select("id,email,active,deleted_at,version,created_at,last_valid_message_at").eq("email", key).maybeSingle(); return { duplicate: true, account: existing.data || null }; } if (error) throw error; return { duplicate: false, account: data }; },
    setActive: async (email, active) => { const key = normalizeGmail(email); if (!key) return null; const { data, error } = await supabase.from("netflix_accounts").update({ active: Boolean(active) }).eq("email", key).is("deleted_at", null).select("id,email,active,deleted_at,version,created_at,last_valid_message_at").maybeSingle(); if (error) throw error; return data; },
    remove: async (email) => { const key = normalizeGmail(email); if (!key) return null; const { data, error } = await supabase.from("netflix_accounts").update({ active: false, deleted_at: new Date().toISOString() }).eq("email", key).is("deleted_at", null).select("id,email,active,deleted_at,version,created_at,last_valid_message_at").maybeSingle(); if (error) throw error; return data; },
    list: async ({ search = "", active } = {}) => { let query = supabase.from("netflix_accounts").select("id,email,active,deleted_at,version,created_at,last_valid_message_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(100); if (search) query = query.ilike("email", `%${search.replace(/[%_]/g, "")}%`); if (typeof active === "boolean") query = query.eq("active", active); const { data, error } = await query; if (error) throw error; return data || []; }
  });
}
