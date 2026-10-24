import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
