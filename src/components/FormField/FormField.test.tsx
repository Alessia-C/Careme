import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FormField from './FormField';

const renderField = (props: Partial<Parameters<typeof FormField>[0]> = {}) =>
  render(
    <FormField id="email" label="Email" {...props}>
      <input id="email" />
    </FormField>,
  );

describe('FormField', () => {
  it('associates the label with the control through id', () => {
    renderField();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders the children inside the field', () => {
    renderField();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders no label element when label is omitted', () => {
    render(
      <FormField id="email">
        <input id="email" />
      </FormField>,
    );
    expect(document.querySelector('label')).toBeNull();
  });

  it('renders the helper with the id the control points to', () => {
    renderField({ helper: 'We never share it' });
    const helper = document.getElementById('email-helper');
    expect(helper).toHaveTextContent('We never share it');
  });

  it('renders no helper when helper is omitted', () => {
    renderField();
    expect(document.getElementById('email-helper')).toBeNull();
  });

  it('defaults to the default status', () => {
    const { container } = renderField();
    expect(container.firstChild).toHaveAttribute('data-status', 'default');
  });

  it.each(['error', 'success'] as const)(
    'exposes the %s status to the styles',
    (status) => {
      const { container } = renderField({ status });
      expect(container.firstChild).toHaveAttribute('data-status', status);
    },
  );

  it('exposes the disabled state only when disabled', () => {
    const { container, unmount } = renderField({ disabled: true });
    expect(container.firstChild).toHaveAttribute('data-disabled');
    unmount();

    const { container: enabled } = renderField();
    expect(enabled.firstChild).not.toHaveAttribute('data-disabled');
  });
});
