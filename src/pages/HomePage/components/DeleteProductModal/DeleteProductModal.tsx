import Feedback from '../../../../components/Feedback/Feedback';
import Modal from '../../../../components/Modal/Modal';
import { useDeleteProduct } from '../../../../hooks/useDeleteProduct/useDeleteProduct';
import type { ProductListItem } from '../../../../lib/productsApi';

const ERROR_DESCRIPTIONS = {
  failed: 'We couldn’t delete the product. Please try again.',
  'rate-limited': 'Too many attempts. Please wait a moment and try again.',
};

interface DeleteProductModalProps {
  // The product to delete: the modal is open while there is one.
  product: ProductListItem | null;
  onCancel: () => void;
  onDeleted: () => void;
}

// Confirmation before deleting. A failure keeps it open, so "Try again" asks
// the API again, from the list as well as from the detail drawer.
const DeleteProductModal = ({
  product,
  onCancel,
  onDeleted,
}: DeleteProductModalProps) => {
  const { remove, isDeleting, errorReason, reset } =
    useDeleteProduct(onDeleted);

  // The last failure must not show up the next time the modal opens.
  const cancel = () => {
    reset();
    onCancel();
  };

  return (
    <Modal
      open={product !== null}
      title="Delete product"
      description="Are you sure you want to remove this product?"
      confirmLabel={
        isDeleting ? 'Deleting…' : errorReason ? 'Try again' : 'Delete'
      }
      variant="error"
      isConfirming={isDeleting}
      feedback={
        errorReason && (
          <Feedback
            status="error"
            title="Something went wrong"
            description={ERROR_DESCRIPTIONS[errorReason]}
          />
        )
      }
      onConfirm={() => {
        if (product) {
          remove(product.id);
        }
      }}
      onCancel={cancel}
    />
  );
};

export default DeleteProductModal;
