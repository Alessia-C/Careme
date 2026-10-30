import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import PasswordInput from './PasswordInput';

const getPasswordField = () => screen.getByLabelText('Password');

// The checklist item is the <li>; data-met is set only when the rule passes.
const getRequirement = (label: string) => screen.getByText(label);

describe('PasswordInput', () => {
  it('hides the password by default', () => {
    render(<PasswordInput />);
    expect(getPasswordField()).toHaveAttribute('type', 'password');
  });

  it('toggles the password visibility with the button', async () => {
    render(<PasswordInput />);
    const toggle = screen.getByRole('button', { name: 'Show password' });

    await userEvent.click(toggle);
    expect(getPasswordField()).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(toggle);
    expect(getPasswordField()).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts with no requirement met when empty', () => {
    render(<PasswordInput />);
    expect(getRequirement('Minimum 8 characters')).not.toHaveAttribute(
      'data-met',
    );
    expect(getRequirement('Maximum 20 characters')).not.toHaveAttribute(
      'data-met',
    );
  });

  it('marks each requirement as met while the user types', async () => {
    render(<PasswordInput />);

    await userEvent.type(getPasswordField(), 'abc');
    expect(getRequirement('Minimum 8 characters')).not.toHaveAttribute(
      'data-met',
    );
    expect(getRequirement('Maximum 20 characters')).toHaveAttribute('data-met');
    expect(getRequirement('1 lowercase letter')).toHaveAttribute('data-met');
    expect(getRequirement('1 number')).not.toHaveAttribute('data-met');

    await userEvent.type(getPasswordField(), 'DEF1234!');
    expect(getRequirement('Minimum 8 characters')).toHaveAttribute('data-met');
    expect(getRequirement('1 uppercase letter')).toHaveAttribute('data-met');
    expect(getRequirement('1 number')).toHaveAttribute('data-met');
    expect(getRequirement('1 special character')).toHaveAttribute('data-met');
  });

  it('turns the maximum rule off above 20 characters', () => {
    render(<PasswordInput defaultValue={'a'.repeat(21)} />);
    expect(getRequirement('Maximum 20 characters')).not.toHaveAttribute(
      'data-met',
    );
  });

  it('checks the initial defaultValue', () => {
    render(<PasswordInput defaultValue="Password1!" />);
    expect(getRequirement('Minimum 8 characters')).toHaveAttribute('data-met');
    expect(getRequirement('1 special character')).toHaveAttribute('data-met');
  });

  it('follows a controlled value prop', () => {
    const { rerender } = render(<PasswordInput value="" onChange={() => {}} />);
    expect(getRequirement('1 number')).not.toHaveAttribute('data-met');

    rerender(<PasswordInput value="Abc1!xyz" onChange={() => {}} />);
    expect(getRequirement('1 number')).toHaveAttribute('data-met');
  });

  it('hides the requirements list when requirements is empty', () => {
    render(<PasswordInput requirements={[]} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders custom requirements', () => {
    render(
      <PasswordInput
        requirements={[
          { label: 'No spaces', isMet: (pw) => !pw.includes(' ') },
        ]}
        defaultValue="nospaces"
      />,
    );
    expect(getRequirement('No spaces')).toHaveAttribute('data-met');
  });
});
