import { type JSX, children } from 'solid-js';

interface FormGridProps {
  children: JSX.Element;
  class?: string;
  cols?: 1 | 2 | 3 | 4;
}

export default function FormGrid(props: FormGridProps) {
  const resolvedChildren = children(() => props.children);
  const cols = () => props.cols ?? 2;

  const gridClasses = () => {
    switch (cols()) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-1 sm:grid-cols-2';
      case 3:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 4:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
      default:
        return 'grid-cols-1 sm:grid-cols-2';
    }
  };

  return <div class={`grid gap-4 ${gridClasses()} ${props.class || ''}`}>{resolvedChildren()}</div>;
}
