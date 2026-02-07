import { type Component, For } from 'solid-js';

interface CardListProps<TItem, TProps extends Record<string, any>> {
  items: TItem[];
  CardComponent: Component<TProps>;
  getCardProps: (item: TItem, index: number) => TProps;
  class?: string;
  animate?: boolean;
  staggerDelay?: number;
}

export default function CardList<TItem, TProps extends Record<string, any>>(
  props: CardListProps<TItem, TProps>,
) {
  const animate = () => props.animate ?? true;
  const staggerDelay = () => props.staggerDelay ?? 50;

  return (
    <div class={props.class ?? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
      <For each={props.items}>
        {(item, index) => {
          const style = animate()
            ? {
                'animation-delay': `${index() * staggerDelay()}ms`,
              }
            : undefined;

          return (
            <div class={animate() ? 'animate-fade-in-up' : ''} style={style}>
              <props.CardComponent {...props.getCardProps(item, index())} />
            </div>
          );
        }}
      </For>
    </div>
  );
}
