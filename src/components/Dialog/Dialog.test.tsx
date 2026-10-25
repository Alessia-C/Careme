import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dialog from './Dialog';

interface DialogElementOptions {
  open: boolean;
  onClose?: () => void;
  closeOnBackdropClick?: boolean;
}

const dialogElement = ({
  open,
  onClose = vi.fn(),
  closeOnBackdropClick,
}: DialogElementOptions) => (
  <Dialog
    open={open}
    title="Remove product"
    onClose={onClose}
    closeOnBackdropClick={closeOnBackdropClick}
  >
    <p>Body text</p>
  </Dialog>
);

// A closed <dialog> is hidden from the accessibility tree, hence hidden: true.
// getByRole returns HTMLElement, so we narrow to HTMLDialogElement to use close().
const getDialog = () => {
  const dialog = screen.getByRole('dialog', { hidden: true });
  if (!(dialog instanceof HTMLDialogElement)) {
    throw new Error('Expected a <dialog> element');
  }
  return dialog;
};

describe('Dialog', () => {
  it('opens the native dialog when open is true', () => {
    render(dialogElement({ open: true }));
    expect(getDialog()).toHaveAttribute('open');
  });

  it('stays closed when open is false', () => {
    render(dialogElement({ open: false }));
    expect(getDialog()).not.toHaveAttribute('open');
  });

  it('labels the dialog with its title', () => {
    render(dialogElement({ open: true }));
    expect(
      screen.getByRole('dialog', { name: 'Remove product' }),
    ).toBeInTheDocument();
  });

  it('closes when open becomes false, without calling onClose', () => {
    const onClose = vi.fn();
    const { rerender } = render(dialogElement({ open: true, onClose }));

    rerender(dialogElement({ open: false, onClose }));

    expect(getDialog()).not.toHaveAttribute('open');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the user closes it (Esc)', () => {
    const onClose = vi.fn();
    render(dialogElement({ open: true, onClose }));

    getDialog().close();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(dialogElement({ open: true, onClose }));

    fireEvent.click(getDialog());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the content is clicked', () => {
    const onClose = vi.fn();
    render(dialogElement({ open: true, onClose }));

    fireEvent.click(screen.getByText('Body text'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores backdrop clicks when closeOnBackdropClick is false', () => {
    const onClose = vi.fn();
    render(dialogElement({ open: true, onClose, closeOnBackdropClick: false }));

    fireEvent.click(getDialog());

    expect(onClose).not.toHaveBeenCalled();
  });
});
