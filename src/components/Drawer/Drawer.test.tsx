import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Drawer from './Drawer';

const renderDrawer = (props: { open?: boolean; onClose?: () => void } = {}) =>
  render(
    <Drawer
      open={props.open ?? true}
      title="Add Product"
      onClose={props.onClose ?? vi.fn()}
    >
      <p>Body text</p>
    </Drawer>,
  );

describe('Drawer', () => {
  it('shows the title and the body', () => {
    renderDrawer();
    expect(
      screen.getByRole('dialog', { name: 'Add Product' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });

  it('opens the native dialog only when open is true', () => {
    const { rerender } = renderDrawer({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <Drawer open title="Add Product" onClose={vi.fn()}>
        <p>Body text</p>
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the user presses Esc', () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    fireEvent(screen.getByRole('dialog'), new Event('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the subtitle', () => {
    render(
      <Drawer open title="Eye Palette" subtitle="MAC" onClose={vi.fn()}>
        <p>Body text</p>
      </Drawer>,
    );
    expect(screen.getByText('MAC')).toBeInTheDocument();
  });

  it('shows the footer after the children', () => {
    render(
      <Drawer
        open
        title="Eye Palette"
        onClose={vi.fn()}
        footer={<button type="button">Update</button>}
      >
        <p>Body text</p>
      </Drawer>,
    );

    const body = screen.getByText('Body text');
    const footer = screen.getByRole('button', { name: 'Update' });
    expect(
      body.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('passes showCloseOnMobile to the close button', () => {
    render(
      <Drawer open title="Eye Palette" onClose={vi.fn()} showCloseOnMobile>
        <p>Body text</p>
      </Drawer>,
    );
    expect(screen.getByRole('button', { name: 'Close' }).className).toMatch(
      /closeOnMobile/,
    );
  });

  it('closes on a click outside by default', () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a click outside when closeOnBackdropClick is false', () => {
    const onClose = vi.fn();
    render(
      <Drawer
        open
        title="Eye Palette"
        onClose={onClose}
        closeOnBackdropClick={false}
      >
        <p>Body text</p>
      </Drawer>,
    );

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
