import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FieldBinding } from '../../../../../../hooks/useForm/useForm';
import ProductEditForm from './ProductEditForm';

const field = (): FieldBinding => ({
  value: '',
  onChange: vi.fn(),
  onBlur: vi.fn(),
  hasError: false,
});

const renderForm = ({
  isSubmitting = false,
  isSubmitDisabled = false,
  onCancel = vi.fn(),
} = {}) =>
  render(
    <ProductEditForm
      field={field}
      onSubmit={(event) => event.preventDefault()}
      onCancel={onCancel}
      isSubmitDisabled={isSubmitDisabled}
      isSubmitting={isSubmitting}
      feedback={<p>Something to know</p>}
    />,
  );

describe('ProductEditForm', () => {
  it('shows the product fields, the feedback and the buttons', () => {
    renderForm();
    expect(screen.getByLabelText('Name*')).toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
    expect(screen.getByText('Something to know')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save Changes' }),
    ).toBeInTheDocument();
  });

  it('cancels from Cancel', async () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('says it is saving, and cannot be cancelled meanwhile', () => {
    renderForm({ isSubmitting: true });
    const saving = screen.getByRole('button', { name: 'Saving…' });
    expect(saving).toHaveAttribute('aria-disabled', 'true');
    expect(saving).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
