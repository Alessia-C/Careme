import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useAuthStore from './stores/authStore';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, role: null, restoreStatus: 'pending' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects an unauthenticated visitor to the login page', async () => {
    render(<App />);
    expect(
      await screen.findByText('Sign in to your account'),
    ).toBeInTheDocument();
  });
});
