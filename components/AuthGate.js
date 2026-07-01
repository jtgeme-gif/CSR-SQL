'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import AppShell from './AppShell';

export default function AuthGate({ children }) {
  // undefined = still checking, null = signed out, object = signed in
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { scopes: 'email' },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (session === undefined) {
    return <div className="auth-loading">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Matter Tracker</h1>
          <p className="muted">Sign in with your McGraw Morris Masud Microsoft account.</p>
          <button className="btn btn-primary" onClick={signIn}>
            Sign in with Microsoft
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell session={session} onSignOut={signOut}>
      {children}
    </AppShell>
  );
}
