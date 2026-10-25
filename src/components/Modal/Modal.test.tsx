import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import Modal from './Modal';

const renderModal = (overrides: Partial<ComponentProps<typeof Modal>> = {}) => {
  const props: ComponentProps<typeof Modal> = {
    open: true,
    title: 'Remove product',
    description: 'Are you sure you want to remove this product?',
    confirmLabel: 'Remove',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<Modal {...props} />);
  return props;
};

// A closed <dialog> is hidden from the accessibility tree, hence hidden: true.
// getByRole returns HTMLElement, so we narrow to HTMLDialogElement to use close().
const getDialog = () => {
  const dialog = screen.getByRole('alertdialog', { hidden: true });
  if (!(dialog instanceof HTMLDialogElement)) {
    throw new Error('Expected a <dialog> element');
  }
  return dialog;
};

describe('Modal', () => {
  it('shows the title, the description and both buttons', () => {
    renderModal();

    expect(
      screen.getByRole('alertdialog', { name: 'Remove product' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to remove this product?'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('describes the dialog with the description text', () => {
    renderModal();

    expect(getDialog()).toHaveAccessibleDescription(
      'Are you sure you want to remove this product?',
    );
  });

  it('uses the custom cancel label when provided', () => {
    renderModal({ cancelLabel: 'Keep it' });

    expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const props = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const props = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when the user closes it (Esc)', () => {
    const props = renderModal();

    getDialog().close();

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('does not close on a backdrop click', () => {
    const props = renderModal();

    fireEvent.click(getDialog());

    expect(props.onCancel).not.toHaveBeenCalled();
  });
});
