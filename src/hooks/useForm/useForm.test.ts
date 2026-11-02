import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { useForm } from './useForm';

const rules = {
  name: { validate: (value: string) => value.length > 0, error: 'Required' },
  password: { validate: (value: string) => value.length >= 3 },
  confirm: {
    validate: (value: string, values: Record<string, string>) =>
      value === values.password,
  },
};

const changeEvent = (value: string) =>
  ({ target: { value } }) as ChangeEvent<HTMLInputElement>;

describe('useForm', () => {
  it('starts with empty values and an invalid form', () => {
    const { result } = renderHook(() => useForm(rules));
    expect(result.current.values).toEqual({
      name: '',
      password: '',
      confirm: '',
    });
    expect(result.current.isValid).toBe(false);
  });

  it('starts a field from its initial value when one is given', () => {
    const { result } = renderHook(() => useForm(rules, { name: 'Jane' }));
    expect(result.current.values).toEqual({
      name: 'Jane',
      password: '',
      confirm: '',
    });
  });

  it('accepts a change event from a select or a textarea', () => {
    const { result } = renderHook(() => useForm(rules));
    const selectEvent = {
      target: { value: 'makeup' },
    } as ChangeEvent<HTMLSelectElement>;
    const textareaEvent = {
      target: { value: 'a note' },
    } as ChangeEvent<HTMLTextAreaElement>;

    act(() => result.current.field('name').onChange(selectEvent));
    act(() => result.current.field('password').onChange(textareaEvent));

    expect(result.current.values.name).toBe('makeup');
    expect(result.current.values.password).toBe('a note');
  });

  it('updates a single value on change', () => {
    const { result } = renderHook(() => useForm(rules));
    act(() => result.current.field('name').onChange(changeEvent('Jane')));
    expect(result.current.field('name').value).toBe('Jane');
    expect(result.current.field('password').value).toBe('');
  });

  it('shows the error only after the field is blurred', () => {
    const { result } = renderHook(() => useForm(rules));
    expect(result.current.field('name').hasError).toBe(false);

    act(() => result.current.field('name').onBlur());

    expect(result.current.field('name').hasError).toBe(true);
    expect(result.current.field('name').error).toBe('Required');
  });

  it('has no error message when the rule defines none', () => {
    const { result } = renderHook(() => useForm(rules));
    act(() => result.current.field('password').onBlur());
    expect(result.current.field('password').hasError).toBe(true);
    expect(result.current.field('password').error).toBeUndefined();
  });

  it('clears the error once the value becomes valid', () => {
    const { result } = renderHook(() => useForm(rules));
    act(() => result.current.field('name').onBlur());
    act(() => result.current.field('name').onChange(changeEvent('Jane')));
    expect(result.current.field('name').hasError).toBe(false);
  });

  it('validates a field against the other values', () => {
    const { result } = renderHook(() => useForm(rules));
    act(() => result.current.field('password').onChange(changeEvent('abc')));
    act(() => result.current.field('confirm').onChange(changeEvent('abd')));
    act(() => result.current.field('confirm').onBlur());
    expect(result.current.field('confirm').hasError).toBe(true);

    act(() => result.current.field('confirm').onChange(changeEvent('abc')));
    expect(result.current.field('confirm').hasError).toBe(false);
  });

  it('is valid only when every field passes', () => {
    const { result } = renderHook(() => useForm(rules));
    act(() => result.current.field('name').onChange(changeEvent('Jane')));
    act(() => result.current.field('password').onChange(changeEvent('abc')));
    expect(result.current.isValid).toBe(false);

    act(() => result.current.field('confirm').onChange(changeEvent('abc')));
    expect(result.current.isValid).toBe(true);
  });
  describe('isDirty', () => {
    it('is false until a value differs from the initial one', () => {
      const { result } = renderHook(() => useForm(rules, { name: 'Jane' }));
      expect(result.current.isDirty).toBe(false);

      act(() => result.current.field('name').onChange(changeEvent('Janet')));
      expect(result.current.isDirty).toBe(true);
    });

    it('goes back to false when the initial value is typed again', () => {
      const { result } = renderHook(() => useForm(rules, { name: 'Jane' }));
      act(() => result.current.field('name').onChange(changeEvent('Janet')));
      act(() => result.current.field('name').onChange(changeEvent('Jane')));
      expect(result.current.isDirty).toBe(false);
    });

    it('ignores the spaces around a value', () => {
      const { result } = renderHook(() => useForm(rules, { name: 'Jane' }));
      act(() => result.current.field('name').onChange(changeEvent(' Jane  ')));
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('reset', () => {
    it('starts over from the given values, with nothing dirty or touched', () => {
      const { result } = renderHook(() => useForm(rules));
      act(() => result.current.field('name').onBlur());
      act(() => result.current.field('password').onChange(changeEvent('abc')));

      act(() => result.current.reset({ name: 'Jane', password: 'xyz' }));

      expect(result.current.values).toEqual({
        name: 'Jane',
        password: 'xyz',
        confirm: '',
      });
      expect(result.current.isDirty).toBe(false);
      expect(result.current.field('confirm').hasError).toBe(false);
    });

    it('goes back to the last baseline when called with no values', () => {
      const { result } = renderHook(() => useForm(rules, { name: 'Jane' }));
      act(() => result.current.field('name').onChange(changeEvent('Janet')));

      act(() => result.current.reset());

      expect(result.current.values.name).toBe('Jane');
      expect(result.current.isDirty).toBe(false);
    });

    it('takes the new values as the baseline for isDirty', () => {
      const { result } = renderHook(() => useForm(rules, { name: 'Jane' }));
      act(() => result.current.reset({ name: 'Mary' }));
      act(() => result.current.field('name').onChange(changeEvent('Jane')));
      expect(result.current.isDirty).toBe(true);
    });
  });
});
