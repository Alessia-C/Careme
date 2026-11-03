import { useQueryClient } from '@tanstack/react-query';
import Feedback from '../../../../components/Feedback/Feedback';
import FormDrawer from '../../../../components/FormDrawer/FormDrawer';
import { useForm } from '../../../../hooks/useForm/useForm';
import { useSubmit } from '../../../../hooks/useSubmit/useSubmit';
import {
  PRODUCT_FORM_RULES,
  toProductInput,
} from '../../../../lib/productForm';
import {
  createProduct,
  PRODUCTS_LIST_QUERY_KEY,
  type CreateProductResult,
} from '../../../../lib/productsApi';
import ProductFields from '../ProductFields/ProductFields';

const ERROR_DESCRIPTIONS = {
  failed: 'We couldn’t add the product. Please try again.',
  'rate-limited': 'Too many attempts. Please wait a moment and try again.',
};

interface AddProductDrawerProps {
  open: boolean;
  onClose: () => void;
}

// The form state lives here, so the page remounts this component (key) each
// time the drawer opens: what the user typed before is never shown again.
const AddProductDrawer = ({ open, onClose }: AddProductDrawerProps) => {
  const queryClient = useQueryClient();
  const { values, isValid, field } = useForm(PRODUCT_FORM_RULES, {
    category: 'makeup',
    status: 'new',
  });
  const { isSubmitting, errorReason, handleSubmit } = useSubmit({
    isValid,
    action: async (): Promise<CreateProductResult> => {
      const input = toProductInput(values);
      return input ? createProduct(input) : { ok: false, reason: 'failed' };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: PRODUCTS_LIST_QUERY_KEY,
      });
      onClose();
    },
  });

  const feedback = errorReason && (
    <Feedback
      status="error"
      title="Something went wrong"
      description={ERROR_DESCRIPTIONS[errorReason]}
    />
  );

  return (
    <FormDrawer
      open={open}
      title="Add Product"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isSubmitting ? 'Adding…' : 'Add Product'}
      isSubmitDisabled={!isValid || isSubmitting}
      feedback={feedback}
    >
      <ProductFields field={field} />
    </FormDrawer>
  );
};

export default AddProductDrawer;
