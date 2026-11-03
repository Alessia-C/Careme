import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ContentState from './ContentState';

describe('ContentState', () => {
  it('shows the title as a heading and the text', () => {
    render(<ContentState title="Add your product" text="Start here" />);
    expect(
      screen.getByRole('heading', { name: 'Add your product' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Start here')).toBeInTheDocument();
  });

  it('is a region named by its title', () => {
    render(<ContentState title="Add your product" />);
    expect(
      screen.getByRole('region', { name: 'Add your product' }),
    ).toBeInTheDocument();
  });

  it('has no text paragraph when none is given', () => {
    render(<ContentState title="Add your product" />);
    expect(document.querySelector('p')).toBeNull();
  });

  it('renders the icon and the actions it receives', () => {
    render(
      <ContentState title="Add your product" icon={<span data-testid="icon" />}>
        <button>Add product</button>
      </ContentState>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add product' }),
    ).toBeInTheDocument();
  });

  describe('loading', () => {
    it('announces the title as a status next to the loader', () => {
      render(<ContentState status="loading" title="Loading products…" />);
      expect(screen.getByRole('status')).toHaveTextContent('Loading products…');
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });
  });

  describe('error', () => {
    it('announces the error and renders the actions', () => {
      render(
        <ContentState
          status="error"
          title="We couldn’t load your products"
          text="Please try again."
        >
          <button>Try again</button>
        </ContentState>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        'We couldn’t load your products',
      );
      expect(screen.getByText('Please try again.')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Try again' }),
      ).toBeInTheDocument();
    });
  });
});
