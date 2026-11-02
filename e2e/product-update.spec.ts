import { test, expect, type Page } from '@playwright/test';

const product = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Eye Palette',
  brand: 'MAC',
  category: 'makeup',
  status: 'new',
};

const detail = { ...product, note: 'Warm Neutrals' };

// Fake API with a logged-in user: the list and the detail hold one product,
// and `updateStatus` is the status of every PUT. It records the body of each
// PUT so a test can check what was sent.
async function mockApi(page: Page, updateStatus = 200) {
  const updated: unknown[] = [];

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        user: { id: 'user-1', email: 'jane@example.com', role: 'user' },
        // Far in the future, so the renewal timer never fires during the test.
        expires_at: 4102444800,
      },
    }),
  );
  await page.route(
    (url) => url.pathname === '/api/products',
    (route) =>
      route.fulfill({ status: 200, json: { products: [product], total: 1 } }),
  );
  await page.route(
    (url) => url.pathname === `/api/products/${product.id}`,
    (route) => {
      if (route.request().method() !== 'PUT') {
        return route.fulfill({ status: 200, json: { product: detail } });
      }
      const body = route.request().postDataJSON();
      updated.push(body);
      return route.fulfill(
        updateStatus === 200
          ? { status: 200, json: { product: { id: product.id, ...body } } }
          : { status: updateStatus, json: { message: 'Failed' } },
      );
    },
  );

  return updated;
}

// The closed Add drawer is on the page too, with fields of the same names.
const editDrawer = (page: Page) =>
  page.getByRole('dialog', { name: 'Update Product' });

async function openEdit(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Detail Eye Palette' }).click();
  await page
    .getByRole('dialog', { name: 'Eye Palette' })
    .getByRole('button', { name: 'Update' })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Update Product' }),
  ).toBeVisible();
}

test('a product is updated and the details show the new values', async ({
  page,
}) => {
  const updated = await mockApi(page);
  await openEdit(page);

  await editDrawer(page).getByLabel('Name*').fill('Lip Gloss');
  await editDrawer(page).getByLabel('Brand*').fill('Kiko');
  await editDrawer(page).getByRole('button', { name: 'Save Changes' }).click();

  const drawer = page.getByRole('dialog', { name: 'Lip Gloss' });
  await expect(drawer).toContainText('Kiko');
  await expect(drawer).toContainText('Product updated successfully');
  await expect(drawer.getByRole('button', { name: 'Update' })).toBeFocused();
  expect(updated).toEqual([
    {
      name: 'Lip Gloss',
      brand: 'Kiko',
      category: 'makeup',
      status: 'new',
      note: 'Warm Neutrals',
    },
  ]);
});

test('an empty name is refused before anything is sent', async ({ page }) => {
  const updated = await mockApi(page);
  await openEdit(page);

  await editDrawer(page).getByLabel('Name*').fill('');
  await editDrawer(page).getByLabel('Name*').blur();

  await expect(page.getByText('Name is required')).toBeVisible();
  await expect(page.getByText('Validation Error')).toBeVisible();
  await expect(
    editDrawer(page).getByRole('button', { name: 'Save Changes' }),
  ).toBeDisabled();
  expect(updated).toEqual([]);
});

test('a server error keeps the form so the user can try again', async ({
  page,
}) => {
  await mockApi(page, 500);
  await openEdit(page);

  await editDrawer(page).getByLabel('Name*').fill('Lip Gloss');
  await editDrawer(page).getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Server Error')).toBeVisible();
  await expect(editDrawer(page).getByLabel('Name*')).toHaveValue('Lip Gloss');
});

test('Cancel with changes asks first, and Discard goes back to the details', async ({
  page,
}) => {
  const updated = await mockApi(page);
  await openEdit(page);
  await editDrawer(page).getByLabel('Name*').fill('Lip Gloss');

  await editDrawer(page).getByRole('button', { name: 'Cancel' }).click();
  const question = page.getByRole('alertdialog', { name: 'Unsaved changes' });
  await expect(question).toBeVisible();

  await question.getByRole('button', { name: 'Continue editing' }).click();
  await expect(question).toBeHidden();
  await expect(editDrawer(page).getByLabel('Name*')).toHaveValue('Lip Gloss');

  await editDrawer(page).getByRole('button', { name: 'Cancel' }).click();
  await question.getByRole('button', { name: 'Discard' }).click();

  await expect(page.getByRole('dialog', { name: 'Eye Palette' })).toBeVisible();
  expect(updated).toEqual([]);
});

test('Esc and a click outside do not lose the changes', async ({ page }) => {
  await mockApi(page);
  await openEdit(page);
  await editDrawer(page).getByLabel('Name*').fill('Lip Gloss');

  // The panel is on the right: the left of the page is outside of it.
  await page.mouse.click(10, 300);
  await expect(
    page.getByRole('dialog', { name: 'Update Product' }),
  ).toBeVisible();

  await page.keyboard.press('Escape');
  const question = page.getByRole('alertdialog', { name: 'Unsaved changes' });
  await expect(question).toBeVisible();

  // Esc in the question means keep editing.
  await page.keyboard.press('Escape');
  await expect(question).toBeHidden();
  await expect(
    page.getByRole('dialog', { name: 'Update Product' }),
  ).toBeVisible();
  await expect(editDrawer(page).getByLabel('Name*')).toHaveValue('Lip Gloss');
});
