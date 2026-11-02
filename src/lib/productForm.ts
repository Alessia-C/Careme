import type { FieldRule } from '../hooks/useForm/useForm';
import {
  isCategory,
  isProductStatus,
  PRODUCT_BRAND_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NOTE_MAX_LENGTH,
} from '../../shared/products';
import { hasNulCharacter, validateInput } from '../../shared/validation';
import type { Product, ProductInput } from './productsApi';

export type ProductFieldName =
  'name' | 'brand' | 'category' | 'status' | 'note';

export type ProductFormValues = Record<ProductFieldName, string>;

// The same rules as the API (api/products/_validation.ts): the server stays
// the one that decides, these only save the user a round trip.
const isText = (maxLength: number) => (value: string) =>
  validateInput(value) &&
  !hasNulCharacter(value) &&
  value.trim().length <= maxLength;

export const PRODUCT_FORM_RULES: Record<
  ProductFieldName,
  FieldRule<ProductFieldName>
> = {
  name: {
    validate: isText(PRODUCT_NAME_MAX_LENGTH),
    error: 'Name is required',
  },
  brand: {
    validate: isText(PRODUCT_BRAND_MAX_LENGTH),
    error: 'Brand is required',
  },
  category: { validate: isCategory },
  status: { validate: isProductStatus },
  note: {
    validate: (note) =>
      !hasNulCharacter(note) && note.trim().length <= PRODUCT_NOTE_MAX_LENGTH,
    error: `Note must be at most ${PRODUCT_NOTE_MAX_LENGTH} characters`,
  },
};

// The selects only offer valid values and the form requires them, so this
// only narrows the types for the API.
export function toProductInput(values: ProductFormValues): ProductInput | null {
  const { category, status } = values;
  if (!isCategory(category) || !isProductStatus(status)) {
    return null;
  }
  return { ...values, category, status };
}

// A product without a note has null: the form field is an empty text.
export const productToFormValues = (product: Product): ProductFormValues => ({
  name: product.name,
  brand: product.brand,
  category: product.category,
  status: product.status,
  note: product.note ?? '',
});
