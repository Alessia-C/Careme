import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ProductSearch from './ProductSearch';

const getSearchbox = () => screen.getByRole('searchbox', { name: 'Search' });

describe('ProductSearch', () => {
  it('is a search landmark with the placeholder of the design', () => {
    render(<ProductSearch onSearch={vi.fn()} />);
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(getSearchbox()).toHaveAttribute(
      'placeholder',
      'Search by name or brand',
    );
  });

  it('can be disabled', () => {
    render(<ProductSearch onSearch={vi.fn()} disabled />);
    expect(getSearchbox()).toBeDisabled();
  });

  it('does not search while typing', async () => {
    const onSearch = vi.fn();
    render(<ProductSearch onSearch={onSearch} />);

    await userEvent.type(getSearchbox(), 'serum');

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('searches the trimmed term on Enter', async () => {
    const onSearch = vi.fn();
    render(<ProductSearch onSearch={onSearch} />);

    await userEvent.type(getSearchbox(), '  serum {Enter}');

    expect(onSearch).toHaveBeenCalledExactlyOnceWith('serum');
  });

  it('restores the full list when the field is cleared', async () => {
    const onSearch = vi.fn();
    render(<ProductSearch onSearch={onSearch} />);
    await userEvent.type(getSearchbox(), 'serum{Enter}');
    onSearch.mockClear();

    await userEvent.clear(getSearchbox());

    expect(onSearch).toHaveBeenCalledExactlyOnceWith('');
  });

  it('shows an inline error and does not search forbidden characters', async () => {
    const onSearch = vi.fn();
    render(<ProductSearch onSearch={onSearch} />);

    await userEvent.type(getSearchbox(), 'Serum (30ml){Enter}');

    expect(onSearch).not.toHaveBeenCalled();
    expect(getSearchbox()).toBeInvalid();
    expect(getSearchbox()).toHaveAccessibleDescription(
      'Search contains invalid characters',
    );
  });

  it('dismisses the error when the user types again', async () => {
    const user = userEvent.setup();
    render(<ProductSearch onSearch={vi.fn()} />);
    await user.type(getSearchbox(), 'a%{Enter}');

    await user.type(getSearchbox(), 'b');

    expect(getSearchbox()).toBeValid();
  });
});
