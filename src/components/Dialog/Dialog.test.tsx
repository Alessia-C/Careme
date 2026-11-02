import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Dialog from './Dialog';

interface DialogElementOptions {
  open: boolean;
  onClose?: () => void;
  closeOnBackdropClick?: boolean;
  description?: string;
}

const dialogElement = ({
  open,
  onClose = vi.fn(),
  closeOnBackdropClick,
  description,
}: DialogElementOptions) => (
  <Dialog
    open={open}
    title="Remove product"
    description={description}
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

  it('describes the dialog with the description when provided', () => {
    render(
      dialogElement({ open: true, description: 'This cannot be undone.' }),
    );
    expect(getDialog()).toHaveAccessibleDescription('This cannot be undone.');
  });

  it('has no accessible description when no description is provided', () => {
    render(dialogElement({ open: true }));
    expect(getDialog()).not.toHaveAccessibleDescription();
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

  it('asks to close on Esc without closing the dialog by itself', () => {
    const onClose = vi.fn();
    render(dialogElement({ open: true, onClose }));
    const cancel = new Event('cancel', { cancelable: true });

    getDialog().dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getDialog()).toHaveAttribute('open');
  });

  it('moves the focus to the element marked data-autofocus when it opens', () => {
    render(
      <Dialog open title="Remove product" onClose={vi.fn()}>
        <button>First</button>
        <button data-autofocus>Safe choice</button>
      </Dialog>,
    );

    expect(screen.getByRole('button', { name: 'Safe choice' })).toHaveFocus();
  });

  it('opens again if the browser closes it while open is still true', () => {
    const { rerender } = render(dialogElement({ open: true }));

    getDialog().close();
    expect(getDialog()).not.toHaveAttribute('open');

    rerender(dialogElement({ open: true }));
    expect(getDialog()).toHaveAttribute('open');
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
  describe('side layout', () => {
    const sideDialog = (onClose = vi.fn()) => (
      <Dialog open title="Add Product" onClose={onClose} layout="side">
        <p>Body text</p>
      </Dialog>
    );

    it('has no close button in the default layout', () => {
      render(dialogElement({ open: true }));
      expect(
        screen.queryByRole('button', { name: 'Close' }),
      ).not.toBeInTheDocument();
    });

    it('shows the title and a close button', () => {
      render(sideDialog());
      expect(
        screen.getByRole('heading', { name: 'Add Product' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('calls onClose when the close button is activated', async () => {
      const onClose = vi.fn();
      render(sideDialog(onClose));

      await userEvent.click(screen.getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows the subtitle and describes the dialog with it', () => {
      render(
        <Dialog
          open
          title="Eye Palette"
          subtitle="MAC"
          onClose={vi.fn()}
          layout="side"
        >
          <p>Body text</p>
        </Dialog>,
      );

      expect(screen.getByText('MAC')).toBeInTheDocument();
      expect(getDialog()).toHaveAccessibleDescription('MAC');
    });

    it('describes the dialog with the subtitle and then the description', () => {
      render(
        <Dialog
          open
          title="Eye Palette"
          subtitle="MAC"
          description="Read only"
          onClose={vi.fn()}
          layout="side"
        >
          <p>Body text</p>
        </Dialog>,
      );

      expect(getDialog()).toHaveAccessibleDescription('MAC Read only');
    });

    it('ignores the subtitle in the default layout', () => {
      render(
        <Dialog open title="Remove product" subtitle="MAC" onClose={vi.fn()}>
          <p>Body text</p>
        </Dialog>,
      );

      expect(screen.queryByText('MAC')).not.toBeInTheDocument();
    });

    it('keeps the close button on phones only when asked to', () => {
      const { rerender } = render(sideDialog());
      const closeButton = () => screen.getByRole('button', { name: 'Close' });
      expect(closeButton().className).not.toMatch(/closeOnMobile/);

      rerender(
        <Dialog
          open
          title="Add Product"
          onClose={vi.fn()}
          layout="side"
          showCloseOnMobile
        >
          <p>Body text</p>
        </Dialog>,
      );
      expect(closeButton().className).toMatch(/closeOnMobile/);
    });
  });
});
