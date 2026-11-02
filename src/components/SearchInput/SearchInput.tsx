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
  disabled,
  ...rest
}: SearchInputProps) => {
  const id = useId();

  return (
    <FormField
      id={id}
      status={status}
      disabled={disabled}
      // An error appears after the user presses Enter, while the focus stays
      // on the input: the alert announces it at once.
      helper={
        status === 'error' && helperText ? (
          <span role="alert">{helperText}</span>
        ) : (
          helperText
        )
      }
    >
      <img src={searchIcon} alt="" className={styles.icon} />
      <input
        placeholder="Search..."
        {...rest}
        id={id}
        disabled={disabled}
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
