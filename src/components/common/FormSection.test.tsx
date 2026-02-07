import { render } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import FormSection from './FormSection';

describe('FormSection', () => {
  it('renders with title', () => {
    const { getByText } = render(() => (
      <FormSection title="Test Section">
        <div>Content</div>
      </FormSection>
    ));

    expect(getByText('Test Section')).toBeInTheDocument();
    expect(getByText('Content')).toBeInTheDocument();
  });

  it('renders with icon', () => {
    const { container } = render(() => (
      <FormSection title="With Icon" icon={<span data-testid="icon">🔧</span>}>
        <div>Content</div>
      </FormSection>
    ));

    expect(container.querySelector('[data-testid="icon"]')).toBeInTheDocument();
  });

  it('applies custom class', () => {
    const { container } = render(() => (
      <FormSection title="Test" class="custom-class">
        <div>Content</div>
      </FormSection>
    ));

    expect(container.firstElementChild).toHaveClass('custom-class');
  });

  it('has correct structure with heading', () => {
    const { container } = render(() => (
      <FormSection title="Section Title">
        <div>Content</div>
      </FormSection>
    ));

    const heading = container.querySelector('h3');
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('font-bold');
    expect(heading).toHaveClass('border-b');
  });
});
