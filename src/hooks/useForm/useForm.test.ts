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
});
