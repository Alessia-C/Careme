import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
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

// The drawer holds back a navigation while there are changes to lose, which
// needs a data router.
const renderDrawer = ({
  selected = selectedProduct,
  onClose = vi.fn(),
}: { selected?: ProductListItem | null; onClose?: () => void } = {}) => {
  const queryClient = new QueryClient({
    // No wait between the attempts, so a retry does not slow the test down.
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <ProductDetailDrawer open selected={selected} onClose={onClose} />
      ),
    },
    { path: '/other', element: <p>Other page</p> },
  ]);
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { onClose, invalidate, queryClient, router };
};

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

  it('puts the details in a region that the keyboard can reach and scroll', async () => {
    mockFetch(() => jsonResponse({ product }));
    renderDrawer();

    const region = await screen.findByRole('region', {
      name: 'Product details',
    });

    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toContainElement(screen.getByText('Category'));
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

  it('shows Update enabled and Delete disabled', async () => {
    mockFetch(() => jsonResponse({ product }));
    renderDrawer();

    expect(await screen.findByRole('button', { name: 'Update' })).toBeEnabled();
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

describe('ProductDetailDrawer: update', () => {
  const updatedProduct = { ...product, name: 'Lip Gloss', brand: 'Kiko' };

  // Answers the GET of the detail with the product, and the PUT with what
  // `update` returns.
  const mockApi = (
    update: () => Response = () => jsonResponse({ product }),
  ) => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'PUT' ? update() : jsonResponse({ product }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  const putCalls = (fetchMock: ReturnType<typeof mockApi>) =>
    fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');

  const startEdit = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Update' }));
  };

  const saveButton = () => screen.getByRole('button', { name: 'Save Changes' });

  const confirmModal = () =>
    screen.queryByRole('alertdialog', { name: 'Unsaved changes' });

  const retype = async (
    user: ReturnType<typeof userEvent.setup>,
    label: string,
    text: string,
  ) => {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    if (text) await user.type(input, text);
  };

  it('opens the form with the product, and no Delete', async () => {
    mockApi();
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);

    expect(
      screen.getByRole('dialog', { name: 'Update Product' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name*')).toHaveValue('Eye Palette');
    expect(screen.getByLabelText('Brand*')).toHaveValue('MAC');
    expect(screen.getByLabelText('Category*')).toHaveValue('makeup');
    expect(screen.getByLabelText('Status*')).toHaveValue('new');
    expect(screen.getByLabelText('Note')).toHaveValue(
      'Warm Neutrals, best seller palette with warm tones',
    );
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(saveButton()).toBeEnabled();
  });

  it('puts the focus on the name when the form opens', async () => {
    mockApi();
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);

    expect(screen.getByLabelText('Name*')).toHaveFocus();
  });

  it('shows an empty text for a product without a note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(jsonResponse({ product: { ...product, note: null } })),
      ),
    );
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);

    expect(screen.getByLabelText('Note')).toHaveValue('');
  });

  it('saves every field, and goes back to the details of the updated product', async () => {
    const fetchMock = mockApi(() =>
      jsonResponse({
        product: { ...updatedProduct, category: 'skincare', status: 'used' },
      }),
    );
    const user = userEvent.setup();
    const { invalidate, queryClient } = renderDrawer();
    await startEdit(user);

    await retype(user, 'Name*', 'Lip Gloss');
    await retype(user, 'Brand*', 'Kiko');
    await user.selectOptions(screen.getByLabelText('Category*'), 'skincare');
    await user.selectOptions(screen.getByLabelText('Status*'), 'used');
    await user.click(saveButton());

    expect(
      await screen.findByText('Product updated successfully'),
    ).toBeInTheDocument();
    const [url, init] = putCalls(fetchMock)[0];
    expect(url).toBe('/api/products/p1');
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Lip Gloss',
      brand: 'Kiko',
      category: 'skincare',
      status: 'used',
      note: 'Warm Neutrals, best seller palette with warm tones',
    });
    expect(
      screen.getByRole('dialog', { name: 'Lip Gloss' }),
    ).toHaveAccessibleDescription('Kiko');
    expect(screen.getByText('Category').nextElementSibling).toHaveTextContent(
      'Skincare',
    );
    expect(screen.getByText('Status').nextElementSibling).toHaveTextContent(
      'Used',
    );
    expect(
      queryClient.getQueryData(['products', 'detail', 'p1']),
    ).toMatchObject({ name: 'Lip Gloss' });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['products', 'list'],
    });
  });

  it('sends the note as an empty text when it is cleared', async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);

    await retype(user, 'Note', '');
    await user.click(saveButton());

    await screen.findByText('Product updated successfully');
    expect(JSON.parse(String(putCalls(fetchMock)[0][1]?.body)).note).toBe('');
  });

  it('puts the focus on Update after saving, and says it once', async () => {
    mockApi();
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);

    await user.click(saveButton());

    // The success message is the only one that speaks: the region of the
    // product does not say "loaded" again, nor "updated".
    await screen.findByText('Product updated successfully');
    expect(screen.getByRole('button', { name: 'Update' })).toHaveFocus();
    const spoken = screen
      .getAllByRole('status')
      .map((status) => status.textContent)
      .filter(Boolean);
    expect(spoken.sort()).toEqual([
      'Eye Palette, MAC, loaded',
      'Product updated successfully',
    ]);
  });

  it('does not say the product is loaded again when the edit ends', async () => {
    mockApi();
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);
    const hidden = screen
      .getAllByRole('status')
      .find((status) => /loaded$/.test(status.textContent ?? ''));
    expect(hidden).toHaveTextContent('Eye Palette, MAC, loaded');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(hidden).toHaveTextContent('Eye Palette, MAC, loaded');
  });

  it('shows the success message with no way to close it, and not again in the next edit', async () => {
    mockApi();
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);
    await user.click(saveButton());

    await screen.findByText('Product updated successfully');
    expect(screen.queryByRole('button', { name: 'Close message' })).toBeNull();

    await startEdit(user);
    expect(screen.queryByText('Product updated successfully')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Product updated successfully')).toBeNull();
  });

  it('asks for the name and blocks saving while it is empty', async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);

    await retype(user, 'Name*', '');
    await user.tab();

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Validation Error');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please fix the errors',
    );
    expect(saveButton()).toBeDisabled();
    expect(putCalls(fetchMock)).toHaveLength(0);
  });

  it('does not accept a name of only spaces', async () => {
    mockApi();
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);

    await retype(user, 'Brand*', '   ');

    expect(saveButton()).toBeDisabled();
  });

  it('shows a server error, keeping the form and what was typed', async () => {
    mockApi(() => new Response(null, { status: 500 }));
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);
    await retype(user, 'Name*', 'Lip Gloss');

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Server Error');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something went wrong — We couldn’t save your product. Please try again.',
    );
    expect(screen.getByLabelText('Name*')).toHaveValue('Lip Gloss');
    expect(saveButton()).toBeEnabled();
  });

  it('shows the rate limit', async () => {
    mockApi(() => new Response(null, { status: 429 }));
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts',
    );
  });

  it('shows the same error for a product that is gone, and asks for the products again', async () => {
    mockApi(() => new Response(null, { status: 404 }));
    const user = userEvent.setup();
    const { invalidate } = renderDrawer();
    await startEdit(user);

    await user.click(saveButton());

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['products'] }),
    );
  });

  it('can be saved again after an error', async () => {
    let fail = true;
    mockApi(() =>
      fail ? new Response(null, { status: 500 }) : jsonResponse({ product }),
    );
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);
    await user.click(saveButton());
    await screen.findByRole('alert');

    fail = false;
    await user.click(saveButton());

    expect(
      await screen.findByText('Product updated successfully'),
    ).toBeInTheDocument();
  });

  it('shows no error from the last try when the form opens again', async () => {
    let fail = true;
    mockApi(() =>
      fail ? new Response(null, { status: 500 }) : jsonResponse({ product }),
    );
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);
    await user.click(saveButton());
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    fail = false;
    await startEdit(user);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not close on a click outside, in the details or in the form', async () => {
    mockApi();
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await startEdit(user);
    await retype(user, 'Name*', 'Lip Gloss');

    fireEvent.click(screen.getByRole('dialog', { name: 'Update Product' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(confirmModal()).toBeNull();
    expect(screen.getByLabelText('Name*')).toHaveValue('Lip Gloss');
  });

  it('cannot be cancelled while it is saving, and keeps the focus on Save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) =>
        init?.method === 'PUT'
          ? new Promise<Response>(() => undefined)
          : Promise.resolve(jsonResponse({ product })),
      ),
    );
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);

    await user.click(saveButton());

    const saving = screen.getByRole('button', { name: 'Saving…' });
    expect(saving).toHaveAttribute('aria-disabled', 'true');
    expect(saving).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('sends only one request when Save is pressed twice while saving', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'PUT'
        ? new Promise<Response>(() => undefined)
        : Promise.resolve(jsonResponse({ product })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderDrawer();
    await startEdit(user);

    await user.click(saveButton());
    await user.click(screen.getByRole('button', { name: 'Saving…' }));

    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT'),
    ).toHaveLength(1);
  });

  it('keeps the form when the product fails to load again while editing', async () => {
    let fail = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          fail
            ? new Response(null, { status: 500 })
            : jsonResponse({ product }),
        ),
      ),
    );
    const user = userEvent.setup();
    const { queryClient, onClose } = renderDrawer();
    await startEdit(user);
    await retype(user, 'Name*', 'Lip Gloss');

    fail = true;
    await act(() =>
      queryClient.invalidateQueries({ queryKey: ['products', 'detail', 'p1'] }),
    );

    expect(screen.getByLabelText('Name*')).toHaveValue('Lip Gloss');
    expect(screen.queryByText('We couldn’t load the product')).toBeNull();

    // What was typed is still protected.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(confirmModal()).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('leaving with changes', () => {
    it('goes back to the details on Cancel when nothing changed', async () => {
      mockApi();
      const user = userEvent.setup();
      renderDrawer();
      await startEdit(user);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(confirmModal()).toBeNull();
      expect(screen.getByRole('button', { name: 'Update' })).toHaveFocus();
    });

    it('does not count the spaces around a value as a change', async () => {
      mockApi();
      const user = userEvent.setup();
      renderDrawer();
      await startEdit(user);
      await user.type(screen.getByLabelText('Name*'), '  ');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(confirmModal()).toBeNull();
    });

    it('asks first on Cancel when something changed', async () => {
      mockApi();
      const user = userEvent.setup();
      renderDrawer();
      await startEdit(user);
      await retype(user, 'Name*', 'Lip Gloss');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(confirmModal()).toHaveAccessibleDescription(
        'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
      );
      expect(screen.getByLabelText('Name*')).toHaveValue('Lip Gloss');
    });

    it('goes on editing from Continue editing', async () => {
      mockApi();
      const user = userEvent.setup();
      renderDrawer();
      await startEdit(user);
      await retype(user, 'Name*', 'Lip Gloss');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await user.click(
        screen.getByRole('button', { name: 'Continue editing' }),
      );

      expect(confirmModal()).toBeNull();
      expect(screen.getByLabelText('Name*')).toHaveValue('Lip Gloss');
    });

    it('throws the changes away from Discard, and shows the product as it was', async () => {
      mockApi();
      const user = userEvent.setup();
      const { onClose } = renderDrawer();
      await startEdit(user);
      await retype(user, 'Name*', 'Lip Gloss');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await user.click(screen.getByRole('button', { name: 'Discard' }));

      expect(confirmModal()).toBeNull();
      expect(
        screen.getByRole('dialog', { name: 'Eye Palette' }),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Update' })).toHaveFocus();

      await startEdit(user);
      expect(screen.getByLabelText('Name*')).toHaveValue('Eye Palette');
    });

    it('closes the drawer from the X when nothing changed', async () => {
      mockApi();
      const user = userEvent.setup();
      const { onClose } = renderDrawer();
      await startEdit(user);

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(confirmModal()).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('asks first on the X when something changed, and closes on Discard', async () => {
      mockApi();
      const user = userEvent.setup();
      const { onClose } = renderDrawer();
      await startEdit(user);
      await retype(user, 'Name*', 'Lip Gloss');

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(confirmModal()).not.toBeNull();
      expect(onClose).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Discard' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('asks first on Esc, without closing the drawer', async () => {
      mockApi();
      const user = userEvent.setup();
      const { onClose } = renderDrawer();
      await startEdit(user);
      await retype(user, 'Name*', 'Lip Gloss');

      fireEvent(
        screen.getByRole('dialog', { name: 'Update Product' }),
        new Event('cancel', { cancelable: true }),
      );

      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(
        screen.getByRole('dialog', { name: 'Update Product' }),
      ).toHaveAttribute('open');
    });

    it('keeps editing on Esc in the question, without closing the drawer', async () => {
      mockApi();
      const user = userEvent.setup();
      const { onClose } = renderDrawer();
      await startEdit(user);
      await retype(user, 'Name*', 'Lip Gloss');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      fireEvent(
        screen.getByRole('alertdialog'),
        new Event('cancel', { cancelable: true }),
      );

      await waitFor(() => expect(confirmModal()).toBeNull());
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Name*')).toHaveValue('Lip Gloss');
    });

    it('closes the drawer on Esc when there are no changes to lose', async () => {
      mockApi();
      const { onClose } = renderDrawer();

      await screen.findByRole('button', { name: 'Update' });
      fireEvent(
        screen.getByRole('dialog', { name: 'Eye Palette' }),
        new Event('cancel', { cancelable: true }),
      );

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('holds a navigation until the user answers', async () => {
      mockApi();
      const user = userEvent.setup();
      const { router } = renderDrawer();
      await startEdit(user);
      await retype(user, 'Name*', 'Lip Gloss');

      await act(() => router.navigate('/other'));
      expect(confirmModal()).not.toBeNull();
      expect(screen.queryByText('Other page')).toBeNull();

      await user.click(
        screen.getByRole('button', { name: 'Continue editing' }),
      );
      expect(confirmModal()).toBeNull();
      expect(router.state.location.pathname).toBe('/');

      await act(() => router.navigate('/other'));
      await user.click(screen.getByRole('button', { name: 'Discard' }));
      expect(await screen.findByText('Other page')).toBeInTheDocument();
    });

    it('lets a navigation through when nothing changed', async () => {
      mockApi();
      const user = userEvent.setup();
      const { router } = renderDrawer();
      await startEdit(user);

      await act(() => router.navigate('/other'));

      expect(await screen.findByText('Other page')).toBeInTheDocument();
    });
  });
});
