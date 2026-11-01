import { useQueryClient } from '@tanstack/react-query';
import Feedback from '../../../../components/Feedback/Feedback';
import FormDrawer from '../../../../components/FormDrawer/FormDrawer';
import Select from '../../../../components/Select/Select';
import Textarea from '../../../../components/Textarea/Textarea';
import ValidatedInput from '../../../../components/ValidatedInput/ValidatedInput';
import { useForm } from '../../../../hooks/useForm/useForm';
import { useSubmit } from '../../../../hooks/useSubmit/useSubmit';
import {
  createProduct,
  PRODUCTS_QUERY_KEY,
  type CreateProductResult,
} from '../../../../lib/productsApi';
import {
  isCategory,
  isProductStatus,
  PRODUCT_BRAND_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NOTE_MAX_LENGTH,
} from '../../../../../shared/products';
import {
  hasNulCharacter,
  validateInput,
} from '../../../../../shared/validation';

const ERROR_DESCRIPTIONS = {
  failed: 'We couldn’t add the product. Please try again.',
  'rate-limited': 'Too many attempts. Please wait a moment and try again.',
};

// The same rules as the API (api/products/_validation.ts): the server stays
// the one that decides, these only save the user a round trip.
const isText = (maxLength: number) => (value: string) =>
  validateInput(value) &&
  !hasNulCharacter(value) &&
  value.trim().length <= maxLength;

interface AddProductDrawerProps {
  open: boolean;
  onClose: () => void;
}

// The form state lives here, so the page remounts this component (key) each
// time the drawer opens: what the user typed before is never shown again.
const AddProductDrawer = ({ open, onClose }: AddProductDrawerProps) => {
  const queryClient = useQueryClient();
  const { values, isValid, field } = useForm(
    {
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
          !hasNulCharacter(note) &&
          note.trim().length <= PRODUCT_NOTE_MAX_LENGTH,
        error: `Note must be at most ${PRODUCT_NOTE_MAX_LENGTH} characters`,
      },
    },
    { category: 'makeup', status: 'new' },
  );
  const { isSubmitting, errorReason, handleSubmit } = useSubmit({
    isValid,
    action: async (): Promise<CreateProductResult> => {
      const { category, status } = values;
      // The selects only offer valid values and isValid requires them, so this
      // only narrows the types for the API.
      if (!isCategory(category) || !isProductStatus(status)) {
        return { ok: false, reason: 'failed' };
      }
      return createProduct({ ...values, category, status });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      onClose();
    },
  });

  const noteField = field('note');

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
      <ValidatedInput
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
        value={values.category}
        onChange={field('category').onChange}
        required
      >
        <option value="makeup">Makeup</option>
        <option value="skincare">Skincare</option>
      </Select>
      <Select
        label="Status*"
        value={values.status}
        onChange={field('status').onChange}
        required
      >
        <option value="new">New</option>
        <option value="used">Used</option>
        <option value="finished">Finished</option>
      </Select>
      <Textarea
        label="Note"
        placeholder="Enter notes…"
        value={noteField.value}
        onChange={noteField.onChange}
        onBlur={noteField.onBlur}
        status={noteField.hasError ? 'error' : 'default'}
        helperText={noteField.error}
      />
    </FormDrawer>
  );
};

export default AddProductDrawer;
