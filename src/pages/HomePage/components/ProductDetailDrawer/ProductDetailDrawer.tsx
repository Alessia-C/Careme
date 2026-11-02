import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import Button from '../../../../components/Button/Button';
import ContentState from '../../../../components/ContentState/ContentState';
import Drawer from '../../../../components/Drawer/Drawer';
import Feedback from '../../../../components/Feedback/Feedback';
import UnsavedChangesModal from '../../../../components/UnsavedChangesModal/UnsavedChangesModal';
import VisuallyHiddenStatus from '../../../../components/VisuallyHiddenStatus/VisuallyHiddenStatus';
import { useForm } from '../../../../hooks/useForm/useForm';
import { useProduct } from '../../../../hooks/useProduct/useProduct';
import { useSubmit } from '../../../../hooks/useSubmit/useSubmit';
import { useUnsavedChangesGuard } from '../../../../hooks/useUnsavedChangesGuard/useUnsavedChangesGuard';
import {
  PRODUCT_FORM_RULES,
  productToFormValues,
  toProductInput,
} from '../../../../lib/productForm';
import {
  cacheUpdatedProduct,
  PRODUCTS_QUERY_KEY,
  updateProduct,
  type ProductListItem,
  type UpdateProductResult,
} from '../../../../lib/productsApi';
import ProductDetailView from './components/ProductDetailView/ProductDetailView';
import ProductEditForm from './components/ProductEditForm/ProductEditForm';
import styles from './ProductDetailDrawer.module.css';

const SERVER_ERROR = {
  title: 'Server Error',
  description:
    'Something went wrong — We couldn’t save your product. Please try again.',
};

// A product that is gone (not-found) is shown like any other failure: the
// detail is asked again, so the drawer then says it is not available.
const ERROR_FEEDBACK = {
  failed: SERVER_ERROR,
  'not-found': SERVER_ERROR,
  'rate-limited': {
    title: 'Too many attempts',
    description: 'Please wait a moment and try again.',
  },
};

// The fields that show an error of their own: the others are selects.
const VALIDATED_FIELDS = ['name', 'brand', 'note'] as const;

// What asked to leave the edit with changes, so Discard knows where to go.
type LeaveRequest = 'cancel' | 'close';

interface ProductDetailDrawerProps {
  open: boolean;
  // The product as the list shows it: its name and brand are the title and
  // the subtitle from the first moment, and what is loaded takes over.
  selected: ProductListItem | null;
  onClose: () => void;
}

// Fills the focus on the field as soon as it is on screen, so the user who
// pressed Update can start typing. Outside the component: a new function on
// every render would ask for the focus again each time.
const focusOnMount = (element: HTMLInputElement | null) => {
  element?.focus();
};

// Detail of one product, which can be edited. The page gives it a new key on
// every open, so the cached product is shown at once and asked again when it
// is stale, and the view or edit state starts over.
const ProductDetailDrawer = ({
  open,
  selected,
  onClose,
}: ProductDetailDrawerProps) => {
  const queryClient = useQueryClient();
  const { product, isPending, isError, isNotFound, refetch } = useProduct(
    selected?.id ?? null,
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const updateButtonRef = useRef<HTMLButtonElement>(null);

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isUpdated, setIsUpdated] = useState(false);
  const [leaveRequest, setLeaveRequest] = useState<LeaveRequest | null>(null);
  // Without the product there is nothing to edit, even if the form is open.
  const isEditing = mode === 'edit' && product !== undefined;
  // A failed request wins over the cached product: if it was removed from
  // another tab, the drawer must not keep showing it. Except while editing:
  // a refetch that fails must not take the form, and what was typed in it,
  // away. Saving tells the user if the product is gone.
  const loaded = isError && !isEditing ? undefined : product;
  // The loaded product is the newest, if its name or brand changed elsewhere.
  const shown = loaded ?? selected;

  const endEdit = () => setMode('view');

  const { values, isValid, isDirty, reset, field } =
    useForm(PRODUCT_FORM_RULES);
  const {
    isSubmitting,
    errorReason,
    handleSubmit,
    reset: resetSubmit,
  } = useSubmit({
    isValid,
    action: async (): Promise<UpdateProductResult> => {
      const input = toProductInput(values);
      if (!loaded || !input) {
        return { ok: false, reason: 'failed' };
      }
      const result = await updateProduct(loaded.id, input);
      // The product is gone: the lists and the detail are asked again, and
      // once the edit ends the drawer says it is not available.
      if (!result.ok && result.reason === 'not-found') {
        void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      }
      return result;
    },
    onSuccess: ({ product: updated }) => {
      cacheUpdatedProduct(queryClient, updated);
      setIsUpdated(true);
      endEdit();
    },
  });
  const guard = useUnsavedChangesGuard(isEditing && isDirty);

  // The button the user pressed is gone when the form closes, and the focus
  // would fall to the dialog: it goes to the button that took its place.
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current === 'edit' && mode === 'view') {
      updateButtonRef.current?.focus();
    }
    previousMode.current = mode;
  }, [mode]);

  const startEdit = () => {
    if (!loaded) return;
    reset(productToFormValues(loaded));
    resetSubmit();
    setIsUpdated(false);
    setMode('edit');
  };

  const handleCancel = () => {
    if (isDirty) {
      setLeaveRequest('cancel');
    } else {
      endEdit();
    }
  };

  // Esc, the X and the backdrop. While it is being saved the answer is on its
  // way, so it waits.
  const handleDrawerClose = () => {
    if (isEditing && isSubmitting) return;
    if (isEditing && isDirty) {
      setLeaveRequest('close');
    } else {
      onClose();
    }
  };

  const keepEditing = () => {
    if (guard.isBlocked) guard.stay();
    setLeaveRequest(null);
  };

  const discardChanges = () => {
    const request = leaveRequest;
    setLeaveRequest(null);
    if (guard.isBlocked) {
      guard.proceed();
      return;
    }
    endEdit();
    if (request === 'close') onClose();
  };

  // "Try again" is replaced by the loader as soon as the request starts, and
  // the focus would fall to the page. It goes to the content, which stays.
  const retry = () => {
    void refetch();
    contentRef.current?.focus();
  };

  const updateFeedback = isUpdated && (
    <Feedback status="success" title="Product updated successfully" />
  );

  const hasValidationError = VALIDATED_FIELDS.some(
    (name) => field(name).hasError,
  );
  let editFeedback;
  if (hasValidationError) {
    editFeedback = (
      <Feedback
        status="error"
        title="Validation Error"
        description="Please fix the errors"
      />
    );
  } else if (errorReason) {
    editFeedback = <Feedback status="error" {...ERROR_FEEDBACK[errorReason]} />;
  }

  let content;
  if (loaded && isEditing) {
    content = (
      <ProductEditForm
        field={field}
        nameRef={focusOnMount}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitDisabled={!isValid}
        isSubmitting={isSubmitting}
        feedback={editFeedback}
      />
    );
  } else if (isError) {
    content = isNotFound ? (
      <ContentState
        status="error"
        title="Product not found"
        text="It may no longer be available."
      />
    ) : (
      <ContentState
        status="error"
        title="We couldn’t load the product"
        text="Please check your connection and try again."
      >
        <Button label="Try again" onClick={retry} size="large" fullWidth />
      </ContentState>
    );
  } else if (loaded) {
    content = <ProductDetailView product={loaded} feedback={updateFeedback} />;
  } else if (isPending) {
    content = <ContentState status="loading" title="Loading product…" />;
  }

  // Said once, when the product is there. The text comes from the list item,
  // which does not change while the drawer is open: leaving the edit or saving
  // must not say "loaded" again, and the update has its own message.
  const announcement =
    loaded && selected ? `${selected.name}, ${selected.brand}, loaded` : '';

  return (
    <>
      <Drawer
        open={open}
        title={isEditing ? 'Update Product' : (shown?.name ?? '')}
        subtitle={isEditing ? undefined : shown?.brand}
        onClose={handleDrawerClose}
        // No Cancel button here: on a phone the X is the only way to close it.
        showCloseOnMobile
        // A click outside by mistake must not close it, or lose an edit.
        closeOnBackdropClick={false}
        footer={
          loaded &&
          !isEditing && (
            <div className={styles.actions}>
              <Button
                label="Update"
                ref={updateButtonRef}
                onClick={startEdit}
              />
              {/* Disabled until deleting a product has its own issue: an
                  enabled button that does nothing would mislead. */}
              <Button
                label="Delete"
                variant="error"
                appearance="outline"
                disabled
              />
            </div>
          )
        }
      >
        <div ref={contentRef} tabIndex={-1} className={styles.content}>
          {content}
        </div>
        {/* Always in the drawer, and only its text changes: the loader and
            the error say themselves what they are, but the product appears
            without a word to a screen reader. */}
        <VisuallyHiddenStatus>{announcement}</VisuallyHiddenStatus>
      </Drawer>
      <UnsavedChangesModal
        open={leaveRequest !== null || guard.isBlocked}
        onDiscard={discardChanges}
        onContinue={keepEditing}
      />
    </>
  );
};

export default ProductDetailDrawer;
