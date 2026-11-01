import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FormDrawer from './FormDrawer';

interface RenderOptions {
  onClose?: () => void;
  onSubmit?: () => void;
  isSubmitDisabled?: boolean;
  feedback?: boolean;
}

const renderDrawer = ({
  onClose = vi.fn(),
  onSubmit = vi.fn(),
  isSubmitDisabled = false,
  feedback = false,
}: RenderOptions = {}) =>
  render(
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
      feedback={feedback ? <p>Something to know</p> : undefined}
    >
      <label>
        Name
        <input />
      </label>
    </FormDrawer>,
  );

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
});
