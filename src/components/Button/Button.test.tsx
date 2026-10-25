import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it('shows the label as accessible name', () => {
    render(<Button label="Save" />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('is type="button" by default to avoid accidental form submits', () => {
    render(<Button label="Save" />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('accepts type="submit"', () => {
    render(<Button label="Sign in" type="submit" />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('uses primary and solid as default style', () => {
    render(<Button label="Save" />);
    const { className } = screen.getByRole('button');
    expect(className).toContain('primary');
    expect(className).toContain('solid');
  });

  it('applies the requested variant and appearance', () => {
    render(<Button label="Save" variant="secondary" appearance="outline" />);
    const { className } = screen.getByRole('button');
    expect(className).toContain('secondary');
    expect(className).toContain('outline');
    expect(className).not.toContain('primary');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button label="Save" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<Button label="Save" onClick={onClick} disabled />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('receives focus with the Tab key', async () => {
    render(<Button label="Save" />);
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
  });

  it('calls onClick with Enter and Space when focused', async () => {
    const onClick = vi.fn();
    render(<Button label="Save" onClick={onClick} />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('is skipped by the Tab key when disabled', async () => {
    render(<Button label="Save" disabled />);
    await userEvent.tab();
    expect(screen.getByRole('button')).not.toHaveFocus();
  });

  it('forwards extra attributes to the button element', () => {
    render(
      <Button label="Save" aria-describedby="hint" data-testid="save-button" />,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-describedby', 'hint');
    expect(button).toBe(screen.getByTestId('save-button'));
  });

  it('renders the icon before the label', () => {
    render(<Button label="Logout" icon={<span data-testid="icon" />} />);
    const button = screen.getByRole('button');
    const icon = screen.getByTestId('icon');
    const label = screen.getByText('Logout');

    expect(button.firstChild).toBe(icon);
    expect(icon.compareDocumentPosition(label)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('keeps the label as accessible name when an icon is set', () => {
    render(<Button label="Logout" icon={<span aria-hidden="true" />} />);
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });
});
