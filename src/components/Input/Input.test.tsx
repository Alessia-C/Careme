import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Input from './Input';

describe('Input', () => {
  it('names the input with its label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('links the helper text as the accessible description', () => {
    render(<Input label="Email" helperText="We never share it" />);
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'We never share it',
    );
  });

  it('has no description when there is no helper text', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it('marks the input as invalid only with error status', () => {
    const { rerender } = render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');

    rerender(<Input label="Email" status="error" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('can be disabled', () => {
    render(<Input label="Email" disabled />);
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });

  it('forwards typing to onChange', async () => {
    const onChange = vi.fn();
    render(<Input label="Email" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Email'), 'a');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
