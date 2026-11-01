import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddProductDrawer from './AddProductDrawer';

type Handler = (url: string, init?: RequestInit) => Response;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const noDuplicate = () => json({ products: [], total: 0 });
const created = () => json({ product: { id: '1' } }, 201);

// Answers by method: the drawer first asks the list (GET), then creates (POST).
const mockApi = (handlers: { get?: Handler; post?: Handler }) => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const handler = init?.method === 'POST' ? handlers.post : handlers.get;
    return Promise.resolve(handler ? handler(url, init) : noDuplicate());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const postCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

const renderDrawer = (onClose = vi.fn()) => {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <AddProductDrawer open onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose, invalidate };
};

const submitButton = () => screen.getByRole('button', { name: 'Add Product' });

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name*'), 'Eye Palette');
  await user.type(screen.getByLabelText('Brand*'), 'MAC');
}

describe('AddProductDrawer', () => {
  beforeEach(() => {
    mockApi({ post: created });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the fields with Makeup and New selected', () => {
    renderDrawer();
    expect(
      screen.getByRole('dialog', { name: 'Add Product' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name*')).toHaveValue('');
    expect(screen.getByLabelText('Brand*')).toHaveValue('');
    expect(screen.getByLabelText('Category*')).toHaveValue('makeup');
    expect(screen.getByLabelText('Status*')).toHaveValue('new');
    expect(screen.getByLabelText('Note')).toHaveValue('');
  });

  it('offers every category and status', () => {
    renderDrawer();
    const options = (label: string) =>
      Array.from(
        (screen.getByLabelText(label) as HTMLSelectElement).options,
      ).map((option) => option.value);

    expect(options('Category*')).toEqual(['makeup', 'skincare']);
    expect(options('Status*')).toEqual(['new', 'used', 'finished']);
  });

  it('keeps the submit button disabled until name and brand are filled', async () => {
    const user = userEvent.setup();
    renderDrawer();
    expect(submitButton()).toBeDisabled();

    await user.type(screen.getByLabelText('Name*'), 'Eye Palette');
    expect(submitButton()).toBeDisabled();

    await user.type(screen.getByLabelText('Brand*'), 'MAC');
    expect(submitButton()).toBeEnabled();
  });

  it('shows an inline error next to each missing required field', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByLabelText('Name*'));
    await user.click(screen.getByLabelText('Brand*'));
    await user.click(screen.getByLabelText('Note'));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Name*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Name*')).toHaveAccessibleDescription(
      'Name is required',
    );
    expect(screen.getByLabelText('Brand*')).toHaveAccessibleDescription(
      'Brand is required',
    );
  });

  it('treats a name made of spaces as missing', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.type(screen.getByLabelText('Name*'), '   ');
    await user.type(screen.getByLabelText('Brand*'), 'MAC');

    expect(submitButton()).toBeDisabled();
  });

  it('limits the length of name, brand and note', async () => {
    const user = userEvent.setup();
    renderDrawer();

    expect(screen.getByLabelText('Name*')).toHaveAttribute('maxlength', '100');
    expect(screen.getByLabelText('Brand*')).toHaveAttribute('maxlength', '100');

    await user.click(screen.getByLabelText('Note'));
    await user.paste('a'.repeat(501));
    await user.tab();

    expect(
      screen.getByText('Note must be at most 500 characters'),
    ).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('checks for a duplicate and then creates the product', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ post: created });
    const { onClose, invalidate } = renderDrawer();

    await fillValidForm(user);
    await user.selectOptions(screen.getByLabelText('Category*'), 'skincare');
    await user.selectOptions(screen.getByLabelText('Status*'), 'used');
    await user.type(screen.getByLabelText('Note'), 'Warm neutrals');
    await user.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/products?name=Eye+Palette&brand=MAC&limit=1',
    );
    expect(fetchMock.mock.calls[1][0]).toBe('/api/products');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      name: 'Eye Palette',
      brand: 'MAC',
      category: 'skincare',
      status: 'used',
      note: 'Warm neutrals',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['products'] });
  });

  it('can be submitted with the Enter key', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    await fillValidForm(user);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows the duplicate warning and creates nothing', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      get: () =>
        json({
          products: [{ id: '1', name: 'Eye Palette', brand: 'MAC' }],
          total: 1,
        }),
    });
    const { onClose, invalidate } = renderDrawer();

    await fillValidForm(user);
    await user.click(submitButton());

    expect(await screen.findByText('Duplicate product found')).toBeVisible();
    expect(
      screen.getByText(/already exists in your catalog/),
    ).toHaveTextContent(
      'A product named Eye Palette by MAC already exists in your catalog.',
    );
    expect(screen.getByLabelText('Name*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Brand*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(submitButton()).toBeDisabled();
    expect(postCalls(fetchMock)).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it.each([
    ['Name', ' 2'],
    ['Brand', ' Pro'],
  ])('lets the user retry once the %s is changed', async (label, extra) => {
    const user = userEvent.setup();
    mockApi({
      get: (url) =>
        url.includes('Eye+Palette&brand=MAC')
          ? json({
              products: [{ id: '1', name: 'Eye Palette', brand: 'MAC' }],
              total: 1,
            })
          : noDuplicate(),
      post: created,
    });
    const { onClose } = renderDrawer();

    await fillValidForm(user);
    await user.click(submitButton());
    await screen.findByText('Duplicate product found');

    await user.type(screen.getByLabelText(`${label}*`), extra);

    expect(
      screen.queryByText('Duplicate product found'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name*')).not.toHaveAttribute('aria-invalid');
    expect(submitButton()).toBeEnabled();

    await user.click(submitButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('does not take an unrelated product for a duplicate', async () => {
    const user = userEvent.setup();
    // What the API answers when it ignores the name and brand filters.
    mockApi({
      get: () =>
        json({
          products: [{ id: '2', name: 'Cleansing Oil', brand: 'Shiseido' }],
          total: 4,
        }),
      post: created,
    });
    const { onClose } = renderDrawer();

    await fillValidForm(user);
    await user.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText('Duplicate product found'),
    ).not.toBeInTheDocument();
  });

  it('shows a generic error, keeps the values and allows a retry', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const fetchMock = mockApi({
      post: () =>
        ++attempts === 1 ? new Response(null, { status: 500 }) : created(),
    });
    const { onClose, invalidate } = renderDrawer();

    await fillValidForm(user);
    await user.type(screen.getByLabelText('Note'), 'Warm neutrals');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t add the product. Please try again.',
    );
    expect(screen.getByLabelText('Name*')).toHaveValue('Eye Palette');
    expect(screen.getByLabelText('Brand*')).toHaveValue('MAC');
    expect(screen.getByLabelText('Note')).toHaveValue('Warm neutrals');
    expect(onClose).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(submitButton()).toBeEnabled();

    await user.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(postCalls(fetchMock)).toHaveLength(2);
  });

  it('shows the same error when the network fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const { onClose } = renderDrawer();

    await fillValidForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t add the product',
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks the user to wait when the rate limit is hit', async () => {
    const user = userEvent.setup();
    mockApi({ post: () => new Response(null, { status: 429 }) });
    renderDrawer();

    await fillValidForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Please wait a moment and try again.',
    );
  });

  it('disables the button and ignores a second submit while sending', async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? pending : Promise.resolve(noDuplicate()),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderDrawer();

    await fillValidForm(user);
    await user.click(submitButton());

    const sending = await screen.findByRole('button', { name: 'Adding…' });
    expect(sending).toBeDisabled();
    await user.keyboard('{Enter}');
    expect(postCalls(fetchMock)).toHaveLength(1);

    release(created());
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Adding…' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('closes without sending anything from Cancel', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({});
    const { onClose, invalidate } = renderDrawer();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('closes without sending anything from the close button', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({});
    const { onClose } = renderDrawer();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
