import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { FieldBinding } from '../../../../hooks/useForm/useForm';
import type { ProductFieldName } from '../../../../lib/productForm';
import ProductFields from './ProductFields';

const binding = (overrides: Partial<FieldBinding> = {}): FieldBinding => ({
  value: '',
  onChange: vi.fn(),
  onBlur: vi.fn(),
  hasError: false,
  ...overrides,
});

const renderFields = (
  fields: Partial<Record<ProductFieldName, FieldBinding>> = {},
) => render(<ProductFields field={(name) => fields[name] ?? binding()} />);

describe('ProductFields', () => {
  it('shows the five fields', () => {
    renderFields();
    expect(screen.getByLabelText('Name*')).toBeInTheDocument();
    expect(screen.getByLabelText('Brand*')).toBeInTheDocument();
    expect(screen.getByLabelText('Category*')).toBeInTheDocument();
    expect(screen.getByLabelText('Status*')).toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
  });

  it('limits the length of name, brand and note like the API', () => {
    renderFields();
    expect(screen.getByLabelText('Name*')).toHaveAttribute('maxlength', '100');
    expect(screen.getByLabelText('Brand*')).toHaveAttribute('maxlength', '100');
    expect(screen.getByLabelText('Note')).toHaveAttribute('maxlength', '500');
  });

  it('offers the categories and the statuses of a product', () => {
    renderFields();
    const options = (label: string) =>
      Array.from(
        (screen.getByLabelText(label) as HTMLSelectElement).options,
        (option) => option.value,
      );
    expect(options('Category*')).toEqual(['makeup', 'skincare']);
    expect(options('Status*')).toEqual(['new', 'used', 'finished']);
  });

  it('shows the values it is given', () => {
    renderFields({
      name: binding({ value: 'Eye Palette' }),
      category: binding({ value: 'skincare' }),
      note: binding({ value: 'Warm neutrals' }),
    });
    expect(screen.getByLabelText('Name*')).toHaveValue('Eye Palette');
    expect(screen.getByLabelText('Category*')).toHaveValue('skincare');
    expect(screen.getByLabelText('Note')).toHaveValue('Warm neutrals');
  });

  it('sends what the user does to the field it is bound to', async () => {
    const name = binding();
    const category = binding({ value: 'makeup' });
    renderFields({ name, category });

    await userEvent.type(screen.getByLabelText('Name*'), 'a');
    await userEvent.selectOptions(
      screen.getByLabelText('Category*'),
      'skincare',
    );
    await userEvent.tab();

    expect(name.onChange).toHaveBeenCalledTimes(1);
    expect(category.onChange).toHaveBeenCalledTimes(1);
  });

  it('shows the error of a field under it', () => {
    renderFields({
      name: binding({ hasError: true, error: 'Name is required' }),
      note: binding({ hasError: true, error: 'Note is too long' }),
    });
    expect(screen.getByLabelText('Name*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Note is too long')).toBeInTheDocument();
  });

  it('gives the name field to the ref it is asked to fill', () => {
    const Wrapper = () => {
      const nameRef = useRef<HTMLInputElement>(null);
      return (
        <>
          <ProductFields field={() => binding()} nameRef={nameRef} />
          <button onClick={() => nameRef.current?.focus()}>Focus name</button>
        </>
      );
    };
    render(<Wrapper />);

    screen.getByRole('button', { name: 'Focus name' }).click();

    expect(screen.getByLabelText('Name*')).toHaveFocus();
  });
});
