import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Loader from './Loader';

describe('Loader', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<Loader />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
