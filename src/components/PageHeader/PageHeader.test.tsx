import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('shows the title as the level 1 heading', () => {
    render(
      <PageHeader
        title="Your products"
        actionLabel="Add product"
        onAction={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your products' }),
    ).toBeInTheDocument();
  });

  it('calls onAction when the action button is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <PageHeader
        title="Your products"
        actionLabel="Add product"
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Add product' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
