import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import FormDrawer from './FormDrawer';

interface RenderOptions {
  onClose?: () => void;
  onSubmit?: () => void;
  isSubmitDisabled?: boolean;
  feedback?: boolean;
  isDirty?: boolean;
  isSubmitting?: boolean;
}

const renderDrawer = ({
  onClose = vi.fn(),
  onSubmit = vi.fn(),
  isSubmitDisabled = false,
  feedback = false,
  isDirty = false,
  isSubmitting = false,
}: RenderOptions = {}) => {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <>
          <Link to="/other">Go elsewhere</Link>
          <FormDrawer
            open
            title="Add Product"
            onClose={onClose}
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
            submitLabel="Save"
            isSubmitDisabled={isSubmitDisabled}
            isDirty={isDirty}
            isSubmitting={isSubmitting}
            feedback={feedback ? <p>Something to know</p> : undefined}
          >
            <label>
              Name
              <input />
            </label>
          </FormDrawer>
        </>
      ),
    },
    { path: '/other', element: <p>Other page</p> },
  ]);
  return { router, ...render(<RouterProvider router={router} />) };
};

describe('FormDrawer', () => {
  it('shows the title, the fields and the buttons', () => {
    renderDrawer();
    expect(
      screen.getByRole('dialog', { name: 'Add Product' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows the feedback only when there is one', () => {
    const { unmount } = renderDrawer();
    expect(screen.queryByText('Something to know')).not.toBeInTheDocument();
    unmount();

    renderDrawer({ feedback: true });
    expect(screen.getByText('Something to know')).toBeInTheDocument();
  });

  it('submits from the button', async () => {
    const onSubmit = vi.fn();
    renderDrawer({ onSubmit });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submits with the Enter key from a field', async () => {
    const onSubmit = vi.fn();
    renderDrawer({ onSubmit });

    await userEvent.type(screen.getByLabelText('Name'), 'x{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables the submit button but not Cancel', () => {
    renderDrawer({ isSubmitDisabled: true });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('does not submit when the submit button is disabled', async () => {
    const onSubmit = vi.fn();
    renderDrawer({ onSubmit, isSubmitDisabled: true });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes from Cancel without submitting', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    renderDrawer({ onClose, onSubmit });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  describe('with unsaved changes', () => {
    const modal = () => screen.queryByRole('alertdialog');

    it('closes without asking when nothing changed', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose });

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(modal()).not.toBeInTheDocument();
    });

    it('asks before closing from Cancel and from the X', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose, isDirty: true });

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(modal()).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Continue editing' }),
      );
      expect(modal()).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(modal()).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('asks before closing with Esc', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose, isDirty: true });

      // jsdom does not turn Esc into the dialog's cancel event.
      fireEvent(
        screen.getByRole('dialog', { name: 'Add Product' }),
        new Event('cancel', { cancelable: true }),
      );

      expect(modal()).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes on Discard', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose, isDirty: true });

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await userEvent.click(screen.getByRole('button', { name: 'Discard' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(modal()).not.toBeInTheDocument();
    });

    it('ignores Cancel and Esc while it is being sent', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose, isDirty: true, isSubmitting: true });

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      fireEvent(
        screen.getByRole('dialog', { name: 'Add Product' }),
        new Event('cancel', { cancelable: true }),
      );

      expect(modal()).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('holds a navigation inside the app and lets it go on Discard', async () => {
      const { router } = renderDrawer({ isDirty: true });

      await act(() => router.navigate('/other'));
      expect(router.state.location.pathname).toBe('/');
      expect(modal()).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(router.state.location.pathname).toBe('/other');
    });

    it('cancels the navigation on Continue editing', async () => {
      const { router } = renderDrawer({ isDirty: true });

      await act(() => router.navigate('/other'));
      await userEvent.click(
        screen.getByRole('button', { name: 'Continue editing' }),
      );

      expect(router.state.location.pathname).toBe('/');
      expect(modal()).not.toBeInTheDocument();
    });

    it('does not hold a navigation when nothing changed', async () => {
      const { router } = renderDrawer();

      await act(() => router.navigate('/other'));

      expect(router.state.location.pathname).toBe('/other');
    });

    it('warns on reload or tab close only while it has changes', () => {
      const clean = renderDrawer();
      const cleanEvent = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(cleanEvent);
      expect(cleanEvent.defaultPrevented).toBe(false);
      clean.unmount();

      const dirty = renderDrawer({ isDirty: true });
      const dirtyEvent = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(dirtyEvent);
      expect(dirtyEvent.defaultPrevented).toBe(true);
      dirty.unmount();

      const afterEvent = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(afterEvent);
      expect(afterEvent.defaultPrevented).toBe(false);
    });
  });
});
