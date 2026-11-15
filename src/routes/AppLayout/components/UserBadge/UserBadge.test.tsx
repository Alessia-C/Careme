import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UserBadge from './UserBadge';

describe('UserBadge', () => {
  it('shows the initials of the user', () => {
    render(
      <UserBadge firstName="Jane" lastName="Doe" email="jane@example.com" />,
    );
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('is named after the full name, not after the initials', () => {
    render(
      <UserBadge firstName="Jane" lastName="Doe" email="jane@example.com" />,
    );
    expect(screen.getByRole('img', { name: 'Jane Doe' })).toBeInTheDocument();
  });

  it('hides the initials from assistive technology', () => {
    render(
      <UserBadge firstName="Jane" lastName="Doe" email="jane@example.com" />,
    );
    expect(screen.getByText('JD')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the email as name when both names are empty', () => {
    render(<UserBadge firstName="" lastName="" email="jane@example.com" />);
    expect(
      screen.getByRole('img', { name: 'jane@example.com' }),
    ).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('is not interactive', () => {
    render(
      <UserBadge firstName="Jane" lastName="Doe" email="jane@example.com" />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
