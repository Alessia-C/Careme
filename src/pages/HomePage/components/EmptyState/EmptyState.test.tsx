import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('shows the title as a heading and the text', () => {
    render(<EmptyState title="Add your product" text="Start here" />);
    expect(
      screen.getByRole('heading', { name: 'Add your product' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Start here')).toBeInTheDocument();
  });

  it('is a region named by its title', () => {
    render(<EmptyState title="Add your product" />);
    expect(
      screen.getByRole('region', { name: 'Add your product' }),
    ).toBeInTheDocument();
  });

  it('has no text paragraph when none is given', () => {
    render(<EmptyState title="Add your product" />);
    expect(document.querySelector('p')).toBeNull();
  });

  it('renders the icon and the actions it receives', () => {
    render(
      <EmptyState title="Add your product" icon={<span data-testid="icon" />}>
        <button>Add product</button>
      </EmptyState>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add product' }),
    ).toBeInTheDocument();
  });
});
