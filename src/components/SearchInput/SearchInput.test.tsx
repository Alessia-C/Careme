import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  it('is a search box named "Search" (there is no visible label)', () => {
    render(<SearchInput />);
    expect(
      screen.getByRole('searchbox', { name: 'Search' }),
    ).toBeInTheDocument();
  });

  it('shows the placeholder', () => {
    render(<SearchInput />);
    expect(screen.getByRole('searchbox')).toHaveAttribute(
      'placeholder',
      'Search...',
    );
  });

  it('describes itself with the default helper text', () => {
    render(<SearchInput />);
    expect(screen.getByRole('searchbox')).toHaveAccessibleDescription(
      'Type and press Enter to search',
    );
  });

  it('accepts a custom helper text', () => {
    render(<SearchInput helperText="Search by product name" />);
    expect(screen.getByRole('searchbox')).toHaveAccessibleDescription(
      'Search by product name',
    );
  });

  it('forwards typing to onChange', async () => {
    const onChange = vi.fn();
    render(<SearchInput onChange={onChange} />);
    await userEvent.type(screen.getByRole('searchbox'), 'serum');
    expect(onChange).toHaveBeenCalledTimes(5);
  });
});
