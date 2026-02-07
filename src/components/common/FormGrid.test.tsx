import { render } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import FormGrid from './FormGrid';

describe('FormGrid', () => {
  it('renders children in grid', () => {
    const { getByText } = render(() => (
      <FormGrid>
        <div>Item 1</div>
        <div>Item 2</div>
      </FormGrid>
    ));

    expect(getByText('Item 1')).toBeInTheDocument();
    expect(getByText('Item 2')).toBeInTheDocument();
  });

  it('has default 2-column responsive grid classes', () => {
    const { container } = render(() => (
      <FormGrid>
        <div>Item</div>
      </FormGrid>
    ));

    expect(container.firstElementChild).toHaveClass('grid-cols-1');
    expect(container.firstElementChild).toHaveClass('sm:grid-cols-2');
  });

  it('applies custom class', () => {
    const { container } = render(() => (
      <FormGrid class="custom-class">
        <div>Item</div>
      </FormGrid>
    ));

    expect(container.firstElementChild).toHaveClass('custom-class');
  });

  it('supports 1 column', () => {
    const { container } = render(() => (
      <FormGrid cols={1}>
        <div>Item</div>
      </FormGrid>
    ));

    expect(container.firstElementChild).toHaveClass('grid-cols-1');
  });

  it('supports 3 columns', () => {
    const { container } = render(() => (
      <FormGrid cols={3}>
        <div>Item</div>
      </FormGrid>
    ));

    expect(container.firstElementChild).toHaveClass('lg:grid-cols-3');
  });

  it('supports 4 columns', () => {
    const { container } = render(() => (
      <FormGrid cols={4}>
        <div>Item</div>
      </FormGrid>
    ));

    expect(container.firstElementChild).toHaveClass('lg:grid-cols-4');
  });

  it('has gap classes', () => {
    const { container } = render(() => (
      <FormGrid>
        <div>Item</div>
      </FormGrid>
    ));

    expect(container.firstElementChild).toHaveClass('gap-4');
  });
});
