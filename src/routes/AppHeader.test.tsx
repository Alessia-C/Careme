import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppHeader from './AppHeader';

describe('AppHeader', () => {
  it('exposes the logo as an image named "Careme"', () => {
    render(<AppHeader />);
    expect(screen.getByRole('img', { name: 'Careme' })).toBeInTheDocument();
  });

  it('renders the Logout action with its label as accessible name', () => {
    render(<AppHeader />);
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });

  it('renders inside the banner landmark', () => {
    render(<AppHeader />);
    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('button', { name: 'Logout' }),
    );
  });
});
