import { render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import AuthLayout from './AuthLayout';

describe('AuthLayout', () => {
  it('renders its children inside the main landmark', () => {
    render(
      <AuthLayout>
        <p>Page content</p>
      </AuthLayout>,
    );
    expect(screen.getByRole('main')).toContainElement(
      screen.getByText('Page content'),
    );
  });

  it('keeps the photo decorative with an empty alt', () => {
    const { container } = render(<AuthLayout>content</AuthLayout>);
    expect(container.querySelector('aside img')).toHaveAttribute('alt', '');
  });

  it('renders the logo, heading and description from info', () => {
    render(
      <AuthLayout
        info={{
          title: 'Page – Careme',
          heading: 'Page heading',
          description: 'Page description',
        }}
      />,
    );
    expect(screen.getByRole('img', { name: 'Careme' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Page heading' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Page description')).toBeInTheDocument();
  });

  it('sets the document title from info', async () => {
    render(
      <AuthLayout info={{ title: 'Page – Careme', heading: 'Heading' }} />,
    );
    await waitFor(() => expect(document.title).toBe('Page – Careme'));
  });

  it('renders no brand block when info is missing', () => {
    render(<AuthLayout>content</AuthLayout>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Careme' }),
    ).not.toBeInTheDocument();
  });

  it('attaches headingRef to the heading so it can receive focus', () => {
    const headingRef = createRef<HTMLHeadingElement>();
    render(
      <AuthLayout
        headingRef={headingRef}
        info={{ title: 'T', heading: 'H' }}
      />,
    );

    expect(headingRef.current).toBe(screen.getByRole('heading', { name: 'H' }));
    headingRef.current?.focus();
    expect(headingRef.current).toHaveFocus();
  });
});
