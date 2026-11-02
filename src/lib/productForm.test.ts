import { describe, expect, it } from 'vitest';
import {
  PRODUCT_FORM_RULES,
  productToFormValues,
  toProductInput,
  type ProductFormValues,
} from './productForm';
import type { Product } from './productsApi';

const values: ProductFormValues = {
  name: 'Eye Palette',
  brand: 'Kiko',
  category: 'makeup',
  status: 'new',
  note: 'Warm neutrals',
};

describe('PRODUCT_FORM_RULES', () => {
  it('requires a name and a brand that are not only spaces', () => {
    expect(PRODUCT_FORM_RULES.name.validate('Eye Palette', values)).toBe(true);
    expect(PRODUCT_FORM_RULES.name.validate('   ', values)).toBe(false);
    expect(PRODUCT_FORM_RULES.brand.validate('', values)).toBe(false);
  });

  it('limits name, brand and note to the length of the API', () => {
    expect(PRODUCT_FORM_RULES.name.validate('a'.repeat(100), values)).toBe(
      true,
    );
    expect(PRODUCT_FORM_RULES.name.validate('a'.repeat(101), values)).toBe(
      false,
    );
    expect(PRODUCT_FORM_RULES.brand.validate('a'.repeat(101), values)).toBe(
      false,
    );
    expect(PRODUCT_FORM_RULES.note.validate('a'.repeat(500), values)).toBe(
      true,
    );
    expect(PRODUCT_FORM_RULES.note.validate('a'.repeat(501), values)).toBe(
      false,
    );
  });

  it('accepts an empty note and refuses a NUL character', () => {
    expect(PRODUCT_FORM_RULES.note.validate('', values)).toBe(true);
    expect(PRODUCT_FORM_RULES.note.validate('a\u0000b', values)).toBe(false);
  });

  it('accepts only the known categories and statuses', () => {
    expect(PRODUCT_FORM_RULES.category.validate('skincare', values)).toBe(true);
    expect(PRODUCT_FORM_RULES.category.validate('hair', values)).toBe(false);
    expect(PRODUCT_FORM_RULES.status.validate('finished', values)).toBe(true);
    expect(PRODUCT_FORM_RULES.status.validate('old', values)).toBe(false);
  });
});

describe('toProductInput', () => {
  it('returns the values typed for the API', () => {
    expect(toProductInput(values)).toEqual(values);
  });

  it('returns null when the category or the status is not valid', () => {
    expect(toProductInput({ ...values, category: 'hair' })).toBeNull();
    expect(toProductInput({ ...values, status: 'old' })).toBeNull();
  });
});

describe('productToFormValues', () => {
  const product: Product = {
    id: '1',
    name: 'Eye Palette',
    brand: 'Kiko',
    category: 'makeup',
    status: 'new',
    note: 'Warm neutrals',
  };

  it('maps a product to the form values', () => {
    expect(productToFormValues(product)).toEqual(values);
  });

  it('turns a missing note into an empty text', () => {
    expect(productToFormValues({ ...product, note: null }).note).toBe('');
  });
});
