import { For, type Component } from 'solid-js';

interface CardListProps<TItem, TProps extends Record<string, any>> {
  items: TItem[];
  CardComponent: Component<TProps>;
  getCardProps: (item: TItem, index: number) => TProps;
  class?: string;
}

export default function CardList<TItem, TProps extends Record<string, any>>(
  props: CardListProps<TItem, TProps>,
) {
  return (
    <div class={props.class ?? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
      <For each={props.items}>
        {(item, index) => <props.CardComponent {...props.getCardProps(item, index())} />}
      </For>
    </div>
  );
}
