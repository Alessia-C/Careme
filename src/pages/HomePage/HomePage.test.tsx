import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS_PAGE_SIZE } from '../../hooks/useProducts/useProducts';
import HomePage from './HomePage';

const makeProducts = (count: number, start = 0) =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${start + index}`,
    name: `Product ${start + index}`,
    brand: 'MAC',
    category: index % 2 === 0 ? 'makeup' : 'skincare',
    status: 'new',
  }));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

// Answers every GET /api/products with what `answer` returns for its URL.
const mockProductsApi = (answer: (url: URL) => Response) => {
  const fetchMock = vi.fn((input: string) =>
    Promise.resolve(answer(new URL(input, 'http://localhost'))),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const mockProducts = (products: unknown[], total = products.length) =>
  mockProductsApi(() => jsonResponse({ products, total }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <HomePage />
    </QueryClientProvider>,
  );

const getDrawer = () => screen.getByRole('dialog', { hidden: true });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HomePage: loading', () => {
  it('announces the loading state', () => {
    mockProductsApi(() => jsonResponse({ products: [], total: 0 }));
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Loading products');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your products' }),
    ).toBeInTheDocument();
  });
});

describe('HomePage: first access', () => {
  it('invites the user to add the first product', async () => {
    mockProducts([]);
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Add your product' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your products' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Start by adding your first product to manage your catalog',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });

  it('keeps the drawer closed at first', async () => {
    mockProducts([]);
    renderPage();
    await screen.findByRole('heading', { name: 'Add your product' });

    expect(getDrawer()).not.toHaveAttribute('open');
  });

  it('opens the drawer from the Add product button', async () => {
    mockProducts([]);
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add product' }),
    );

    expect(getDrawer()).toHaveAttribute('open');
    expect(
      screen.getByRole('dialog', { name: 'Add Product' }),
    ).toBeInTheDocument();
  });

  it('closes the drawer from Cancel', async () => {
    mockProducts([]);
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add product' }),
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(getDrawer()).not.toHaveAttribute('open');
  });

  it('starts from an empty form every time the drawer opens', async () => {
    mockProducts([]);
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Add product' }),
    );
    await user.type(screen.getByLabelText('Name*'), 'Eye Palette');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(screen.getByLabelText('Name*')).toHaveValue('');
  });
});

describe('HomePage: product list', () => {
  it('shows every product with name, category, status and brand', async () => {
    mockProducts([
      {
        id: 'p1',
        name: 'Eye Palette',
        brand: 'MAC',
        category: 'makeup',
        status: 'new',
      },
      {
        id: 'p2',
        name: 'Serum',
        brand: 'Cerave',
        category: 'skincare',
        status: 'used',
      },
    ]);
    renderPage();

    const list = await screen.findByRole('list', { name: 'Products' });
    const [first, second] = within(list).getAllByRole('article');
    expect(within(first).getByText('Eye Palette')).toBeInTheDocument();
    expect(within(first).getByText('Makeup')).toBeInTheDocument();
    expect(within(first).getByText('New')).toBeInTheDocument();
    expect(within(first).getByText('MAC')).toBeInTheDocument();
    expect(within(second).getByText('Serum')).toBeInTheDocument();
    expect(within(second).getByText('Skincare')).toBeInTheDocument();
    expect(within(second).getByText('Used')).toBeInTheDocument();
    expect(within(second).getByText('Cerave')).toBeInTheDocument();
  });

  it('shows the title, the search and the Add product button', async () => {
    mockProducts(makeProducts(1));
    renderPage();

    await screen.findByRole('list', { name: 'Products' });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Your products' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add product' }),
    ).toBeInTheDocument();
  });

  it('announces how many products are shown', async () => {
    mockProducts(makeProducts(3));
    renderPage();

    expect(await screen.findByText('Showing 3 of 3 products')).toHaveAttribute(
      'role',
      'status',
    );
  });

  it('opens the drawer from the Add product button of the header', async () => {
    mockProducts(makeProducts(1));
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add product' }),
    );

    expect(getDrawer()).toHaveAttribute('open');
  });

  it('asks the first page with the page size', async () => {
    const fetchMock = mockProducts(makeProducts(1));
    renderPage();
    await screen.findByRole('list', { name: 'Products' });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/products?offset=0&limit=${PRODUCTS_PAGE_SIZE}`,
      undefined,
    );
  });

  it('has no Load more button when everything is shown', async () => {
    mockProducts(makeProducts(3));
    renderPage();
    await screen.findByRole('list', { name: 'Products' });

    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument();
  });

  it('loads the next page from Load more', async () => {
    const total = PRODUCTS_PAGE_SIZE + 2;
    mockProductsApi((url) =>
      url.searchParams.get('offset') === '0'
        ? jsonResponse({ products: makeProducts(PRODUCTS_PAGE_SIZE), total })
        : jsonResponse({
            products: makeProducts(2, PRODUCTS_PAGE_SIZE),
            total,
          }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findAllByRole('article')).toHaveLength(total);
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      `Showing ${total} of ${total} products`,
    );
  });

  it('keeps the products shown when Load more fails, and retries', async () => {
    let failNextPage = true;
    mockProductsApi((url) => {
      if (url.searchParams.get('offset') === '0') {
        return jsonResponse({
          products: makeProducts(PRODUCTS_PAGE_SIZE),
          total: PRODUCTS_PAGE_SIZE + 1,
        });
      }
      if (failNextPage) {
        return new Response(null, { status: 500 });
      }
      return jsonResponse({
        products: makeProducts(1, PRODUCTS_PAGE_SIZE),
        total: PRODUCTS_PAGE_SIZE + 1,
      });
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(
      await screen.findByText('We couldn’t load more products', undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(PRODUCTS_PAGE_SIZE);

    failNextPage = false;
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findAllByRole('article')).toHaveLength(
      PRODUCTS_PAGE_SIZE + 1,
    );
  });
});

describe('HomePage: search', () => {
  // The search has its own issue: until then the field is shown, disabled.
  it('shows the search field disabled', async () => {
    mockProducts(makeProducts(3));
    renderPage();
    await screen.findAllByRole('article');

    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeDisabled();
  });
});

describe('HomePage: errors', () => {
  it('shows the error and retries from Try again', async () => {
    let fail = true;
    const fetchMock = mockProductsApi(() =>
      fail
        ? new Response(null, { status: 500 })
        : jsonResponse({ products: makeProducts(2), total: 2 }),
    );
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole('alert', { name: '' }, { timeout: 3000 }),
    ).toHaveTextContent('We couldn’t load your products');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    fetchMock.mockClear();

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('shows the error for a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    renderPage();

    expect(
      await screen.findByRole('alert', undefined, { timeout: 3000 }),
    ).toHaveTextContent('We couldn’t load your products');
  });
});
