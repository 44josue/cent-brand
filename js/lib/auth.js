import { supabase } from './supabase.js';
import { toast } from './utils.js';

// ── SESSION ───────────────────────────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const session = await getSession();
  return session?.user || null;
}

export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, avatar_url, role')
    .eq('id', userId)
    .single();
  return data;
}

export async function getCurrentProfile() {
  const user = await getUser();
  if (!user) return null;
  return getProfile(user.id);
}

// ── ROLE CHECK ────────────────────────────────────────────────────────────────

export async function requireAuth(redirectTo = '/login/') {
  const user = await getUser();
  if (!user) {
    window.location.href = `${redirectTo}?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return null;
  }
  return user;
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user) {
    window.location.href = `/login/?redirect=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }

  const profile = await getProfile(user.id);
  if (!profile || !['admin', 'ops'].includes(profile.role)) {
    window.location.href = '/login/';
    return null;
  }

  return { user, profile };
}

// ── AUTH ACTIONS ──────────────────────────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;

  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: 'customer',
    });
  }

  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  localStorage.removeItem('cent_cart');
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/account/` },
  });
  if (error) throw error;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login/?mode=reset`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function updateProfile(userId, updates) {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

// ── AUTH STATE LISTENER ───────────────────────────────────────────────────────

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// ── PENDING ORDER INDICATOR ───────────────────────────────────────────────────

export async function getPendingOrderForUser(customerId) {
  if (!customerId) return null;
  const { data } = await supabase
    .from('orders')
    .select('id, public_token')
    .eq('customer_id', customerId)
    .eq('status', 'awaiting_payment_verification')
    .limit(1)
    .maybeSingle();
  return data;
}
