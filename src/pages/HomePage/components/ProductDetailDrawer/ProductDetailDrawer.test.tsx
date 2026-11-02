import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProductDetailDrawer from './ProductDetailDrawer';

const product = {
  id: 'p1',
  name: 'Eye Palette',
  brand: 'MAC',
  category: 'makeup',
  status: 'new',
  note: 'Warm Neutrals, best seller palette with warm tones',
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
  productId = 'p1',
  onClose = vi.fn(),
}: { productId?: string | null; onClose?: () => void } = {}) =>
  render(
    // No wait between the attempts, so a retry does not slow the test down.
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
      }
    >
      <ProductDetailDrawer open productId={productId} onClose={onClose} />
    </QueryClientProvider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductDetailDrawer', () => {
  it('announces the loading state under a neutral title', () => {
    mockFetch(() => jsonResponse({ product }));
    renderDrawer();

    expect(
      screen.getByRole('dialog', { name: 'Product detail' }),
    ).toBeVisible();
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

    const dialog = await screen.findByRole('dialog', { name: 'Eye Palette' });
    expect(dialog).toHaveAccessibleDescription('MAC');
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

    expect(
      await screen.findByRole('dialog', { name: 'Eye Palette' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
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
    renderDrawer({ productId: null });

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
