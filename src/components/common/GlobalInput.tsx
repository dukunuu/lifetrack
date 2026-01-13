import { createEffect, splitProps, type JSX } from 'solid-js';
import { useMediaQuery } from '../../lib/hooks/useMediaQuery';

interface GlobalInputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  rows?: number;
  mode?: 'input' | 'textarea' | 'auto';
  placeholderMaxLength?: number;
}

export default function GlobalInput(props: GlobalInputProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [local, others] = splitProps(props, [
    'class',
    'onInput',
    'type',
    'value',
    'ref',
    'mode',
    'onKeyDown',
    'placeholder',
    'placeholderMaxLength',
  ]);

  let textareaRef: HTMLTextAreaElement | undefined;

  const shouldRenderInput = () => {
    if (local.mode === 'input') return true;
    if (local.mode === 'textarea') return false;
    return isDesktop();
  };

  const truncatedPlaceholder = () => {
    if (!local.placeholder) return undefined;
    if (isDesktop()) return local.placeholder;
    const maxLength = local.placeholderMaxLength ?? 60;
    return local.placeholder.length > maxLength
      ? `${local.placeholder.substring(0, maxLength)}...`
      : local.placeholder;
  };

  const adjustHeight = () => {
    if (textareaRef) {
      textareaRef.style.height = 'auto';
      textareaRef.style.height = `${textareaRef.scrollHeight}px`;
    }
  };

  createEffect(() => {
    if (!shouldRenderInput() && local.value !== undefined) {
      adjustHeight();
    }
  });

  const handleTextareaInput = (
    e: InputEvent & { currentTarget: HTMLTextAreaElement; target: Element },
  ) => {
    adjustHeight();
    if (typeof local.onInput === 'function') {
      local.onInput(e as any);
    } else if (local.onInput) {
      (local.onInput as any)(e);
    }
  };

  const handleKeyDown = (e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) => {
    if (e.isComposing) return;

    if (e.key === 'Enter') {
      if (e.ctrlKey) {
        e.preventDefault();
        const el = e.currentTarget;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;

        const newVal = val.substring(0, start) + '\n' + val.substring(end);
        el.value = newVal;
        el.selectionStart = el.selectionEnd = start + 1;

        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        e.preventDefault();
        e.currentTarget.form?.requestSubmit();
      }
    }

    if (typeof local.onKeyDown === 'function') {
      local.onKeyDown(e as any);
    }
  };

  const mergeRefs = (el: HTMLTextAreaElement) => {
    textareaRef = el;
    // Initial adjustment when ref is attached
    adjustHeight();
    if (typeof local.ref === 'function') {
      local.ref(el as any);
    }
  };

  return (
    <>
      {shouldRenderInput() ? (
        <input
          ref={local.ref}
          type={local.type || 'text'}
          class={`input input-bordered w-full ${local.class || ''}`}
          onInput={local.onInput}
          value={local.value}
          onKeyDown={local.onKeyDown}
          placeholder={truncatedPlaceholder()}
          {...others}
        />
      ) : (
        <textarea
          ref={mergeRefs}
          class={`textarea textarea-bordered w-full resize-none overflow-hidden leading-normal ${
            local.class || ''
          }`}
          rows={1}
          style={{ 'max-height': '8rem', 'min-height': '2.5rem' }}
          onInput={handleTextareaInput}
          onKeyDown={handleKeyDown}
          value={(local.value as string) || ''}
          placeholder={truncatedPlaceholder()}
          {...(others as any)}
        />
      )}
    </>
  );
}
