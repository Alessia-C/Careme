import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FieldBinding } from '../../hooks/useForm';
import ValidatedInput from './ValidatedInput';

const makeField = (overrides: Partial<FieldBinding> = {}): FieldBinding => ({
  value: '',
  onChange: vi.fn(),
  onBlur: vi.fn(),
  hasError: false,
  ...overrides,
});

describe('ValidatedInput', () => {
  it('renders the label and the field value', () => {
    render(
      <ValidatedInput label="Email" field={makeField({ value: 'a@b.c' })} />,
    );
    expect(screen.getByLabelText('Email')).toHaveValue('a@b.c');
  });

  it('forwards change and blur events to the field', async () => {
    const user = userEvent.setup();
    const field = makeField();
    render(<ValidatedInput label="Email" field={field} />);

    await user.type(screen.getByLabelText('Email'), 'a');
    await user.tab();

    expect(field.onChange).toHaveBeenCalledTimes(1);
    expect(field.onBlur).toHaveBeenCalledTimes(1);
  });

  it('shows the error message and marks the input invalid', () => {
    render(
      <ValidatedInput
        label="Email"
        field={makeField({ hasError: true, error: 'Enter a valid email' })}
      />,
    );
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows no error when the field is valid', () => {
    render(<ValidatedInput label="Email" field={makeField()} />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });
});
