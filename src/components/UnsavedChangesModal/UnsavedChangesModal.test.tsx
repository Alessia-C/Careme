import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UnsavedChangesModal from './UnsavedChangesModal';

const renderModal = (open = true) => {
  const onDiscard = vi.fn();
  const onContinue = vi.fn();
  render(
    <UnsavedChangesModal
      open={open}
      onDiscard={onDiscard}
      onContinue={onContinue}
    />,
  );
  return { onDiscard, onContinue };
};

describe('UnsavedChangesModal', () => {
  it('warns that the changes will be lost', () => {
    renderModal();
    const dialog = screen.getByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    expect(dialog).toHaveAccessibleDescription(
      'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
    );
  });

  it('has the focus on Continue editing, not on Discard', () => {
    renderModal();
    expect(
      screen.getByRole('button', { name: 'Continue editing' }),
    ).toHaveFocus();
  });

  it('discards from Discard', () => {
    const { onDiscard, onContinue } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('keeps editing from Continue editing', () => {
    const { onDiscard, onContinue } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Continue editing' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('keeps editing on Esc', () => {
    const { onDiscard, onContinue } = renderModal();
    screen
      .getByRole('alertdialog')
      .dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('does not show when closed', () => {
    renderModal(false);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
