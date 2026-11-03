import { useState, type ChangeEvent, type SubmitEvent } from 'react';
import SearchInput from '../../../../components/SearchInput/SearchInput';
import { getSearchError } from '../../../../lib/productSearch';
import styles from './ProductSearch.module.css';

interface ProductSearchProps {
  // Called with the trimmed term when the user presses Enter, and with an empty
  // string when the field is cleared.
  onSearch: (term: string) => void;
  disabled?: boolean;
}

const ProductSearch = ({ onSearch, disabled }: ProductSearchProps) => {
  const [term, setTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTerm = event.target.value;
    setTerm(nextTerm);
    // The error belongs to what was submitted: typing again dismisses it.
    setError(null);
    // Clearing the field restores the full list without another Enter.
    if (nextTerm === '') {
      onSearch('');
    }
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const searchError = getSearchError(term);
    setError(searchError);
    if (!searchError) {
      onSearch(term.trim());
    }
  };

  return (
    <form role="search" className={styles.search} onSubmit={handleSubmit}>
      <SearchInput
        disabled={disabled}
        value={term}
        onChange={handleChange}
        placeholder="Search by name or brand"
        autoComplete="off"
        helperText={error ?? ''}
        status={error ? 'error' : 'default'}
      />
    </form>
  );
};

export default ProductSearch;
