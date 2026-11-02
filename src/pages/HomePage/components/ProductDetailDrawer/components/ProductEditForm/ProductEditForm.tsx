import type { Ref, ReactNode, SubmitEvent } from 'react';
import DrawerForm from '../../../../../../components/DrawerForm/DrawerForm';
import type { FieldBinding } from '../../../../../../hooks/useForm/useForm';
import type { ProductFieldName } from '../../../../../../lib/productForm';
import ProductFields from '../../../ProductFields/ProductFields';

interface ProductEditFormProps {
  field: (name: ProductFieldName) => FieldBinding;
  nameRef?: Ref<HTMLInputElement>;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  feedback?: ReactNode;
}

// The fields of a product with the buttons that save or leave them. The form
// state stays in the drawer, which also needs to know when it has changes.
const ProductEditForm = ({
  field,
  nameRef,
  onSubmit,
  onCancel,
  isSubmitDisabled,
  isSubmitting,
  feedback,
}: ProductEditFormProps) => (
  <DrawerForm
    onSubmit={onSubmit}
    onCancel={onCancel}
    submitLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
    isSubmitDisabled={isSubmitDisabled}
    isCancelDisabled={isSubmitting}
    feedback={feedback}
  >
    <ProductFields field={field} nameRef={nameRef} />
  </DrawerForm>
);

export default ProductEditForm;
