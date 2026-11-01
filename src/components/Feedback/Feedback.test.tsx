import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Feedback, { type FeedbackStatus } from './Feedback';

describe('Feedback', () => {
  it('shows the title and the description', () => {
    render(
      <Feedback
        title="Saved"
        description="Your changes were saved."
        status="success"
      />,
    );
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Your changes were saved.')).toBeInTheDocument();
  });

  it('announces errors right away with role="alert"', () => {
    render(<Feedback title="Failed" description="Try again." status="error" />);
    expect(screen.getByRole('alert')).toHaveAttribute('data-status', 'error');
  });

  it.each<FeedbackStatus>(['success', 'info'])(
    'uses a polite role="status" for %s',
    (status) => {
      render(<Feedback title="Note" description="Details." status={status} />);
      expect(screen.getByRole('status')).toHaveAttribute('data-status', status);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('has no close button unless onClose is given', () => {
    render(<Feedback title="Note" status="info" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is activated', async () => {
    const onClose = vi.fn();
    render(<Feedback title="Note" status="info" onClose={onClose} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Close message' }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('can be closed with the keyboard', async () => {
    const onClose = vi.fn();
    render(<Feedback title="Note" status="info" onClose={onClose} />);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close message' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('puts the given id on the message so it can be referenced', () => {
    render(<Feedback title="Note" status="info" id="note" />);
    expect(screen.getByRole('status')).toHaveAttribute('id', 'note');
  });
});
