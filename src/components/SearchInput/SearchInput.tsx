import { useId, type ComponentProps } from 'react';
import FormField from '../FormField/FormField';
import fieldStyles from '../FormField/FormField.module.css';
import searchIcon from '../../assets/icons/search.svg';
import styles from './SearchInput.module.css';

interface SearchInputProps extends Omit<
  ComponentProps<'input'>,
  'id' | 'type'
> {
  helperText?: string;
}

// No visible label in the design: the input is named through aria-label.
const SearchInput = ({
  helperText = 'Scrivi e premi Invio per cercare',
  ...rest
}: SearchInputProps) => {
  const id = useId();

  return (
    <FormField id={id} helper={helperText}>
      <img src={searchIcon} alt="" className={styles.icon} />
      <input
        placeholder="Cerca..."
        {...rest}
        id={id}
        type="search"
        aria-label="Cerca"
        className={fieldStyles.control}
        aria-describedby={`${id}-helper`}
      />
    </FormField>
  );
};

export default SearchInput;
