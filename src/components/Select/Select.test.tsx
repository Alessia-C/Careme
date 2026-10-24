import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import Select from './Select';

const renderSelect = (props: { status?: 'default' | 'error' } = {}) =>
  render(
    <Select label="Skin type" defaultValue="" {...props}>
      <option value="" disabled>
        Choose one
      </option>
      <option value="dry">Dry</option>
      <option value="oily">Oily</option>
    </Select>,
  );

describe('Select', () => {
  it('names the select with its label', () => {
    renderSelect();
    expect(screen.getByLabelText('Skin type')).toBeInTheDocument();
  });

  it('renders the options passed as children', () => {
    renderSelect();
    expect(screen.getByRole('option', { name: 'Dry' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Oily' })).toBeInTheDocument();
  });

  it('changes the value when the user picks an option', async () => {
    renderSelect();
    await userEvent.selectOptions(screen.getByLabelText('Skin type'), 'oily');
    expect(screen.getByLabelText('Skin type')).toHaveValue('oily');
  });

  it('links the helper text as the accessible description', () => {
    render(
      <Select label="Skin type" helperText="Pick the closest match">
        <option value="dry">Dry</option>
      </Select>,
    );
    expect(screen.getByLabelText('Skin type')).toHaveAccessibleDescription(
      'Pick the closest match',
    );
  });

  it('marks the select as invalid only with error status', () => {
    const { unmount } = renderSelect({ status: 'error' });
    expect(screen.getByLabelText('Skin type')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    unmount();

    renderSelect();
    expect(screen.getByLabelText('Skin type')).not.toHaveAttribute(
      'aria-invalid',
    );
  });
});
