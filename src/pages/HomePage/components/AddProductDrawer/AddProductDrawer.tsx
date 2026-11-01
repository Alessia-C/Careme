import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Feedback from '../../../../components/Feedback/Feedback';
import FormDrawer from '../../../../components/FormDrawer/FormDrawer';
import Select from '../../../../components/Select/Select';
import Textarea from '../../../../components/Textarea/Textarea';
import ValidatedInput from '../../../../components/ValidatedInput/ValidatedInput';
import { useForm } from '../../../../hooks/useForm/useForm';
import { useSubmit } from '../../../../hooks/useSubmit/useSubmit';
import { addProduct, PRODUCTS_QUERY_KEY } from '../../../../lib/productsApi';
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
  // The name and brand the server said already exist. The warning is derived
  // from them, so it goes away as soon as the user changes either one.
  const [duplicate, setDuplicate] = useState<{
    name: string;
    brand: string;
  } | null>(null);
  const duplicateWarning =
    duplicate !== null &&
    duplicate.name === values.name.trim() &&
    duplicate.brand === values.brand.trim()
      ? duplicate
      : null;
  const isDuplicate = duplicateWarning !== null;

  const { isSubmitting, errorReason, handleSubmit } = useSubmit({
    isValid,
    action: async () => {
      const { category, status } = values;
      // The selects only offer valid values and isValid requires them, so this
      // only narrows the types for the API.
      if (!isCategory(category) || !isProductStatus(status)) {
        return { ok: false as const, reason: 'failed' as const };
      }
      const result = await addProduct({ ...values, category, status });
      if (!result.ok && result.reason === 'duplicate') {
        setDuplicate({ name: values.name.trim(), brand: values.brand.trim() });
      }
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      onClose();
    },
  });

  const noteField = field('note');

  const feedback = (
    <>
      {duplicateWarning && (
        <Feedback
          status="warning"
          title="Duplicate product found"
          description={
            <>
              A product named <strong>{duplicateWarning.name}</strong> by{' '}
              <strong>{duplicateWarning.brand}</strong> already exists in your
              catalog.
            </>
          }
        />
      )}
      {errorReason && errorReason !== 'duplicate' && (
        <Feedback
          status="error"
          title="Something went wrong"
          description={ERROR_DESCRIPTIONS[errorReason]}
        />
      )}
    </>
  );

  return (
    <FormDrawer
      open={open}
      title="Add Product"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isSubmitting ? 'Adding…' : 'Add Product'}
      isSubmitDisabled={!isValid || isSubmitting || isDuplicate}
      feedback={feedback}
    >
      <ValidatedInput
        label="Name*"
        autoComplete="off"
        maxLength={PRODUCT_NAME_MAX_LENGTH}
        required
        field={field('name')}
        invalid={isDuplicate}
      />
      <ValidatedInput
        label="Brand*"
        autoComplete="off"
        maxLength={PRODUCT_BRAND_MAX_LENGTH}
        required
        field={field('brand')}
        invalid={isDuplicate}
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
