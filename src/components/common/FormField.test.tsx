import { render } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import FormField from './FormField';

describe('FormField', () => {
  it('renders label and children', () => {
    const { getByText, getByTestId } = render(() => (
      <FormField label="Field Label">
        <input data-testid="input" />
      </FormField>
    ));

    expect(getByText('Field Label')).toBeInTheDocument();
    expect(getByTestId('input')).toBeInTheDocument();
  });

  it('shows required indicator', () => {
    const { container } = render(() => (
      <FormField label="Required Field" required>
        <input />
      </FormField>
    ));

    expect(container.textContent).toContain('*');
  });

  it('displays error message', () => {
    const { getByText } = render(() => (
      <FormField label="Field" error="This field is required">
        <input />
      </FormField>
    ));

    expect(getByText('This field is required')).toBeInTheDocument();
    expect(getByText('This field is required')).toHaveClass('text-error');
  });

  it('displays help text when no error', () => {
    const { getByText } = render(() => (
      <FormField label="Field" help="Enter your name here">
        <input />
      </FormField>
    ));

    expect(getByText('Enter your name here')).toBeInTheDocument();
  });

  it('shows error over help text', () => {
    const { getByText, queryByText } = render(() => (
      <FormField label="Field" error="Error!" help="Help text">
        <input />
      </FormField>
    ));

    expect(getByText('Error!')).toBeInTheDocument();
    expect(queryByText('Help text')).not.toBeInTheDocument();
  });

  it('applies custom class', () => {
    const { container } = render(() => (
      <FormField label="Field" class="custom-class">
        <input />
      </FormField>
    ));

    expect(container.firstElementChild).toHaveClass('custom-class');
  });

  it('has correct label styling', () => {
    const { container } = render(() => (
      <FormField label="Field Label">
        <input />
      </FormField>
    ));

    const label = container.querySelector('label span');
    expect(label).toHaveClass('font-semibold');
  });
});
