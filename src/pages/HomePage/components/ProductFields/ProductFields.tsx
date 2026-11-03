import type { Ref } from 'react';
import Select from '../../../../components/Select/Select';
import Textarea from '../../../../components/Textarea/Textarea';
import ValidatedInput from '../../../../components/ValidatedInput/ValidatedInput';
import type { FieldBinding } from '../../../../hooks/useForm/useForm';
import type { ProductFieldName } from '../../../../lib/productForm';
import {
  PRODUCT_BRAND_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NOTE_MAX_LENGTH,
} from '../../../../../shared/products';

interface ProductFieldsProps {
  // From `useForm().field`, with the rules of PRODUCT_FORM_RULES.
  field: (name: ProductFieldName) => FieldBinding;
  // To move the focus to the first field when the form appears.
  nameRef?: Ref<HTMLInputElement>;
}

// The fields of a product, shared by the forms that add and update one.
const ProductFields = ({ field, nameRef }: ProductFieldsProps) => {
  const category = field('category');
  const status = field('status');
  const note = field('note');

  return (
    <>
      <ValidatedInput
        ref={nameRef}
        label="Name*"
        placeholder="Enter product name"
        autoComplete="off"
        maxLength={PRODUCT_NAME_MAX_LENGTH}
        required
        field={field('name')}
      />
      <ValidatedInput
        label="Brand*"
        placeholder="Enter brand name"
        autoComplete="off"
        maxLength={PRODUCT_BRAND_MAX_LENGTH}
        required
        field={field('brand')}
      />
      <Select
        label="Category*"
        value={category.value}
        onChange={category.onChange}
        required
      >
        <option value="makeup">Makeup</option>
        <option value="skincare">Skincare</option>
      </Select>
      <Select
        label="Status*"
        value={status.value}
        onChange={status.onChange}
        required
      >
        <option value="new">New</option>
        <option value="used">Used</option>
        <option value="finished">Finished</option>
      </Select>
      <Textarea
        label="Note"
        placeholder="Enter notes…"
        maxLength={PRODUCT_NOTE_MAX_LENGTH}
        value={note.value}
        onChange={note.onChange}
        onBlur={note.onBlur}
        status={note.hasError ? 'error' : 'default'}
        helperText={note.error}
      />
    </>
  );
};

export default ProductFields;
