import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AddProductDrawer from './AddProductDrawer';

const created = () =>
  new Response(JSON.stringify({ product: { id: '1' } }), { status: 201 });

const mockApi = (answer: () => Response = created) => {
  const fetchMock = vi.fn(() => Promise.resolve(answer()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

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

  it('suggests what to type in the text fields', () => {
    renderDrawer();
    expect(screen.getByLabelText('Name*')).toHaveAttribute(
      'placeholder',
      'Enter product name',
    );
    expect(screen.getByLabelText('Brand*')).toHaveAttribute(
      'placeholder',
      'Enter brand name',
    );
    expect(screen.getByLabelText('Note')).toHaveAttribute(
      'placeholder',
      'Enter notes…',
    );
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

  it('creates the product and closes the drawer', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    const { onClose, invalidate } = renderDrawer();

    await fillValidForm(user);
    await user.selectOptions(screen.getByLabelText('Category*'), 'skincare');
    await user.selectOptions(screen.getByLabelText('Status*'), 'used');
    await user.type(screen.getByLabelText('Note'), 'Warm neutrals');
    await user.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/products');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Eye Palette',
      brand: 'MAC',
      category: 'skincare',
      status: 'used',
      note: 'Warm neutrals',
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['products', 'list'],
    });
  });

  it('can be submitted with the Enter key', async () => {
    const user = userEvent.setup();
    mockApi();
    const { onClose } = renderDrawer();

    await fillValidForm(user);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows a generic error, keeps the values and allows a retry', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const fetchMock = mockApi(() =>
      ++attempts === 1 ? new Response(null, { status: 500 }) : created(),
    );
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    mockApi(() => new Response(null, { status: 429 }));
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
    const fetchMock = vi.fn(() => pending);
    vi.stubGlobal('fetch', fetchMock);
    renderDrawer();

    await fillValidForm(user);
    await user.click(submitButton());

    const sending = await screen.findByRole('button', { name: 'Adding…' });
    expect(sending).toBeDisabled();
    await user.keyboard('{Enter}');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(created());
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Adding…' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('closes without sending anything from Cancel', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    const { onClose, invalidate } = renderDrawer();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('closes without sending anything from the close button', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    const { onClose } = renderDrawer();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
