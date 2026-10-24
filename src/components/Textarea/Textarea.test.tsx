import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Textarea from './Textarea';

describe('Textarea', () => {
  it('names the textarea with its label', () => {
    render(<Textarea label="Notes" />);
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('links the helper text as the accessible description', () => {
    render(<Textarea label="Notes" helperText="Keep it short" />);
    expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription(
      'Keep it short',
    );
  });

  it('marks the textarea as invalid only with error status', () => {
    const { rerender } = render(<Textarea label="Notes" />);
    expect(screen.getByLabelText('Notes')).not.toHaveAttribute('aria-invalid');

    rerender(<Textarea label="Notes" status="error" />);
    expect(screen.getByLabelText('Notes')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('can be disabled', () => {
    render(<Textarea label="Notes" disabled />);
    expect(screen.getByLabelText('Notes')).toBeDisabled();
  });

  it('forwards typing to onChange', async () => {
    const onChange = vi.fn();
    render(<Textarea label="Notes" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Notes'), 'a');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
