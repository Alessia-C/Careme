import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductListItem } from '../../../../lib/productsApi';
import ProductDetailDrawer from './ProductDetailDrawer';

const product = {
  id: 'p1',
  name: 'Eye Palette',
  brand: 'MAC',
  category: 'makeup',
  status: 'new',
  note: 'Warm Neutrals, best seller palette with warm tones',
};

// What the list shows of the product, without the note.
const selectedProduct: ProductListItem = {
  id: 'p1',
  name: 'Eye Palette',
  brand: 'MAC',
  category: 'makeup',
  status: 'new',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

// Answers in order, and repeats the last one if the drawer asks again.
const mockFetch = (...responses: Array<() => Response>) => {
  const fetchMock = vi.fn();
  responses.forEach((respond, index) => {
    const answer = () => Promise.resolve(respond());
    if (index === responses.length - 1) {
      fetchMock.mockImplementation(answer);
    } else {
      fetchMock.mockImplementationOnce(answer);
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const renderDrawer = ({
  selected = selectedProduct,
  onClose = vi.fn(),
}: { selected?: ProductListItem | null; onClose?: () => void } = {}) =>
  render(
    // No wait between the attempts, so a retry does not slow the test down.
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
      }
    >
      <ProductDetailDrawer open selected={selected} onClose={onClose} />
    </QueryClientProvider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductDetailDrawer', () => {
  it('shows the name and the brand of the list while it loads', () => {
    mockFetch(() => jsonResponse({ product }));
    renderDrawer();

    const dialog = screen.getByRole('dialog', { name: 'Eye Palette' });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveAccessibleDescription('MAC');
    expect(screen.getByText('Loading product…')).toHaveAttribute(
      'role',
      'status',
    );
    expect(
      screen.queryByRole('button', { name: 'Update' }),
    ).not.toBeInTheDocument();
  });

  it('shows the name, the brand, the category, the status and the note', async () => {
    mockFetch(() => jsonResponse({ product }));
    renderDrawer();

    expect(await screen.findByText('Category')).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Eye Palette' }),
    ).toHaveAccessibleDescription('MAC');
    expect(screen.getByText('Category').nextElementSibling).toHaveTextContent(
      'Makeup',
    );
    expect(screen.getByText('Status').nextElementSibling).toHaveTextContent(
      'New',
    );
    expect(screen.getByText('Note').nextElementSibling).toHaveTextContent(
      'Warm Neutrals, best seller palette with warm tones',
    );
  });

  it.each([
    ['null', null],
    ['empty', ''],
  ])('says there is no note when it is %s', async (_label, note) => {
    mockFetch(() => jsonResponse({ product: { ...product, note } }));
    renderDrawer();

    expect(await screen.findByText('No note')).toBeInTheDocument();
    expect(screen.getByText('Note').nextElementSibling).toHaveTextContent(
      'No note',
    );
  });

  it('shows the Update and Delete buttons disabled', async () => {
    mockFetch(() => jsonResponse({ product }));
    renderDrawer();

    expect(
      await screen.findByRole('button', { name: 'Update' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('shows a product that is not found, without a way to try again', async () => {
    mockFetch(() => new Response(null, { status: 404 }));
    renderDrawer();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Product not found',
    );
    expect(screen.getByRole('dialog', { name: 'Eye Palette' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Update' }),
    ).not.toBeInTheDocument();
  });

  it('shows the same message for a product of another user', async () => {
    mockFetch(() => new Response(null, { status: 403 }));
    renderDrawer();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Product not found',
    );
  });

  it('shows a server error and loads the product from Try again', async () => {
    let fail = true;
    const fetchMock = mockFetch(() =>
      fail ? new Response(null, { status: 500 }) : jsonResponse({ product }),
    );
    const user = userEvent.setup();
    renderDrawer();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t load the product',
    );
    fetchMock.mockClear();

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Category')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('keeps the focus in the drawer after Try again', async () => {
    let fail = true;
    mockFetch(() =>
      fail ? new Response(null, { status: 500 }) : jsonResponse({ product }),
    );
    const user = userEvent.setup();
    renderDrawer();
    const tryAgain = await screen.findByRole('button', { name: 'Try again' });
    fail = false;
    await user.click(tryAgain);

    // The button is gone once the request starts: the focus must not fall to
    // the page.
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(dialog);
    expect(document.activeElement?.tagName).not.toBe('BUTTON');

    await screen.findByText('Category');
  });

  it('announces the product when it is loaded, in a region that was already there', async () => {
    mockFetch(() => jsonResponse({ product }));
    renderDrawer();
    const region = screen
      .getAllByRole('status')
      .find((status) => status.textContent === '');
    expect(region).toBeDefined();

    await screen.findByText('Category');

    expect(region).toHaveTextContent('Eye Palette, MAC, loaded');
  });

  it('shows the error for a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    renderDrawer();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t load the product',
    );
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });

  it('asks for nothing without a product', () => {
    const fetchMock = mockFetch(() => jsonResponse({ product }));
    renderDrawer({ selected: null });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls onClose from the close button', async () => {
    mockFetch(() => jsonResponse({ product }));
    const onClose = vi.fn();
    renderDrawer({ onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the close button on phones, where it has no Cancel', () => {
    mockFetch(() => jsonResponse({ product }));
    renderDrawer();

    expect(screen.getByRole('button', { name: 'Close' }).className).toMatch(
      /closeOnMobile/,
    );
  });
});
