import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  Link,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { describe, expect, it } from 'vitest';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

const Home = ({ isActive }: { isActive: boolean }) => {
  const { isBlocked, proceed, stay } = useUnsavedChangesGuard(isActive);
  return (
    <>
      <Link to="/other">Other</Link>
      <Link to="/login">Login</Link>
      {isBlocked && (
        <>
          <p>Blocked</p>
          <button onClick={proceed}>Leave</button>
          <button onClick={stay}>Stay</button>
        </>
      )}
    </>
  );
};

const renderGuard = (isActive: boolean) => {
  const routes: RouteObject[] = [
    { path: '/', element: <Home isActive={isActive} /> },
    { path: '/other', element: <p>Other page</p> },
    { path: '/login', element: <p>Login page</p> },
  ];
  render(<RouterProvider router={createMemoryRouter(routes)} />);
};

const dispatchBeforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe('useUnsavedChangesGuard', () => {
  it('lets the user navigate when there is nothing to lose', async () => {
    renderGuard(false);
    await userEvent.click(screen.getByRole('link', { name: 'Other' }));
    expect(screen.getByText('Other page')).toBeInTheDocument();
  });

  it('holds a navigation until the user answers', async () => {
    renderGuard(true);
    await userEvent.click(screen.getByRole('link', { name: 'Other' }));
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.queryByText('Other page')).not.toBeInTheDocument();
  });

  it('goes on to the page when the user leaves', async () => {
    renderGuard(true);
    await userEvent.click(screen.getByRole('link', { name: 'Other' }));
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByText('Other page')).toBeInTheDocument();
  });

  it('stays on the page when the user stays', async () => {
    renderGuard(true);
    await userEvent.click(screen.getByRole('link', { name: 'Other' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Other' })).toBeInTheDocument();
  });

  it('never holds the way to /login, where the session ends', async () => {
    renderGuard(true);
    await userEvent.click(screen.getByRole('link', { name: 'Login' }));
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('asks the browser to warn on reload only while there are changes', () => {
    renderGuard(true);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
  });

  it('does not warn on reload when there is nothing to lose', () => {
    renderGuard(false);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
  });
});
