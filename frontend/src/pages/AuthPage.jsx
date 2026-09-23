import { useState } from 'react';
import Logo from '../components/Logo';
import { login, register } from '../api/client';

function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response =
        mode === 'login'
          ? await login(email, password)
          : await register(email, password);

      const accessToken =
        response.accessToken || response.token || response.access_token;
      const refreshToken = response.refreshToken || response.refresh_token;

      if (!accessToken) {
        throw new Error('Authentication succeeded but no access token was returned.');
      }

      onLogin(accessToken, refreshToken);
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-background" />
      <section className="auth-card">
        <div className="auth-logo">
          <Logo />
        </div>
        <div className="auth-heading">
          <h1>
            {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
          </h1>
          <p>Translate documents while preserving their structure.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              minLength={10}
              required
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign in'
              : 'Create account'}
          </button>
        </form>
        <div className="auth-switch">
          <span>
            {mode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}
          </span>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </section>
    </main>
  );
}

export default AuthPage;
