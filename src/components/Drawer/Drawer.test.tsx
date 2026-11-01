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
});
