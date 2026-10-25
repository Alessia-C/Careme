import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AuthLayout from './AuthLayout';

describe('AuthLayout', () => {
  it('renders its children inside the main landmark', () => {
    render(
      <AuthLayout>
        <p>Page content</p>
      </AuthLayout>,
    );
    expect(screen.getByRole('main')).toContainElement(
      screen.getByText('Page content'),
    );
  });

  it('renders the caption of the photo panel', () => {
    render(<AuthLayout>content</AuthLayout>);
    expect(screen.getByText('LUXURY BEAUTY')).toBeInTheDocument();
    expect(
      screen.getByText('Curated essentials for a modern routine.'),
    ).toBeInTheDocument();
  });

  it('keeps the photo decorative with an empty alt', () => {
    const { container } = render(<AuthLayout>content</AuthLayout>);
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});
