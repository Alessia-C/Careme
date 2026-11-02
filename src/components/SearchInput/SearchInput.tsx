import { useId, type ComponentProps } from 'react';
import FormField, { type FieldStatus } from '../FormField/FormField';
import fieldStyles from '../FormField/FormField.module.css';
import searchIcon from '../../assets/icons/search.svg';
import styles from './SearchInput.module.css';

interface SearchInputProps extends Omit<
  ComponentProps<'input'>,
  'id' | 'type'
> {
  // An empty string hides the helper (the product list design has none).
  helperText?: string;
  status?: FieldStatus;
}

// No visible label in the design: the input is named through aria-label.
const SearchInput = ({
  helperText = 'Type and press Enter to search',
  status = 'default',
  ...rest
}: SearchInputProps) => {
  const id = useId();

  return (
    <FormField id={id} status={status} helper={helperText}>
      <img src={searchIcon} alt="" className={styles.icon} />
      <input
        placeholder="Search..."
        {...rest}
        id={id}
        type="search"
        aria-label="Search"
        className={fieldStyles.control}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={helperText ? `${id}-helper` : undefined}
      />
    </FormField>
  );
};

export default SearchInput;
