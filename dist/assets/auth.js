import { requireSupabase, isSupabaseConfigured } from './supabase-client.js';

export async function getSession() {
  if (!isSupabaseConfigured) {
    return null;
  }
  const supabase = requireSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function refreshAuthSession() {
  const supabase = requireSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    return session;
  }

  const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
  if (error || !refreshed) {
    return null;
  }

  return refreshed;
}

export async function ensureAuthenticatedSession() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const session = await refreshAuthSession();
  if (session) {
    return session;
  }

  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: { session: latest } } = await supabase.auth.getSession();
  return latest;
}

export async function ensureProfile(session) {
  if (!session) {
    return null;
  }

  const supabase = requireSupabase();
  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || '',
      role: 'parent',
    })
    .select('id, email, full_name, role')
    .single();

  if (insertError) {
    throw insertError;
  }

  return created;
}

export async function getProfile() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  return ensureProfile(session);
}

export async function signIn(email, password) {
  const supabase = requireSupabase();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password, fullName) {
  const supabase = requireSupabase();
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
}

export async function signOut() {
  const supabase = requireSupabase();
  return supabase.auth.signOut();
}

export function getResetPasswordRedirectUrl() {
  return new URL('reset-password.html', window.location.href).href;
}

export async function resetPasswordForEmail(email) {
  const supabase = requireSupabase();
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getResetPasswordRedirectUrl(),
  });
}

export async function updatePassword(password) {
  const supabase = requireSupabase();
  return supabase.auth.updateUser({ password });
}

export async function changePassword(newPassword) {
  const supabase = requireSupabase();
  const session = await ensureAuthenticatedSession();

  if (!session) {
    throw new Error('Your session expired. Please sign out and sign in again.');
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (!error) {
    return;
  }

  const message = error.message?.toLowerCase() || '';
  if (message.includes('different from the old') || message.includes('same as')) {
    return;
  }

  if (message.includes('session') || message.includes('jwt') || message.includes('not authenticated')) {
    throw new Error('Your session expired. Please sign out and sign in again.');
  }

  throw error;
}

export function isAdmin(profile) {
  return profile?.role === 'admin';
}
