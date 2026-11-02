import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DrawerForm from './DrawerForm';

const renderForm = ({
  onSubmit = vi.fn(),
  onCancel = vi.fn(),
  isSubmitDisabled = false,
  isCancelDisabled = false,
} = {}) =>
  render(
    <DrawerForm
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onCancel={onCancel}
      submitLabel="Save Changes"
      isSubmitDisabled={isSubmitDisabled}
      isCancelDisabled={isCancelDisabled}
      feedback={<p>Something to know</p>}
    >
      <label>
        Name
        <input />
      </label>
    </DrawerForm>,
  );

describe('DrawerForm', () => {
  it('shows the fields, the feedback and the buttons', () => {
    renderForm();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByText('Something to know')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save Changes' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('submits from the button and cancels from Cancel', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    renderForm({ onSubmit, onCancel });

    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('marks the submit button as disabled while sending, without disabling it', () => {
    render(
      <DrawerForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="Saving…"
        isSubmitDisabled={false}
        isSubmitting
      >
        <input aria-label="Name" />
      </DrawerForm>,
    );
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeEnabled();
  });

  it('can disable Cancel while the form is being sent', () => {
    renderForm({ isCancelDisabled: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('disables the submit button but not Cancel', () => {
    renderForm({ isSubmitDisabled: true });
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });
});
