import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { user, loading, authError, loginWithGoogle, devLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();
  const devLoginEnabled =
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true';

  const oauthError = useMemo(() => {
    const code = new URLSearchParams(location.search).get('error');
    if (code === 'sso_failed') {
      return 'Google sign-in was not approved. Use an active company account added by Admin.';
    }
    return '';
  }, [location.search]);

  const submitDevLogin = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await devLogin(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Development login failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && user) return <Navigate to="/" replace />;

  const visibleError = error || oauthError || authError;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-6">
          <p className="text-xs font-semibold uppercase text-emerald-700">Conekt Ads</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Internal Platform</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Access is limited to active company users approved by an administrator.
          </p>
        </div>

        <div className="px-6 py-6">
          {visibleError ? (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {visibleError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={loginWithGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <GoogleMark />
            Continue with Google
          </button>

          <p className="mt-3 text-center text-xs text-slate-500">
            Use your approved Google Workspace account.
          </p>

          {devLoginEnabled ? (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Development login</h2>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  Local only
                </span>
              </div>
              <form className="mt-3" onSubmit={submitDevLogin}>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Whitelisted user email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-3 w-full rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-400"
                >
                  {submitting ? 'Signing in...' : 'Sign in for Development'}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
};

const GoogleMark = () => (
  <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-200 text-xs font-bold text-blue-600">
    G
  </span>
);

export default Login;
