import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VisuallyHiddenStatus from './VisuallyHiddenStatus';

describe('VisuallyHiddenStatus', () => {
  it('is a status region with the given text', () => {
    render(<VisuallyHiddenStatus>Saved</VisuallyHiddenStatus>);

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('is in the page even without text', () => {
    render(<VisuallyHiddenStatus />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
