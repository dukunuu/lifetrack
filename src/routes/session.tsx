import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { Bot, Send, Trash2, CheckCircle2, Image, Paperclip, X } from 'lucide-solid';
import { useChatSession } from '../lib/hooks/useChatSession';
import Markdown from '../components/common/Markdown';
import ImagePreview from '../components/common/ImagePreview';
import { useSettings } from '../lib/hooks/useSettings';
import { OPENROUTER_IMAGE_MODELS, OPENROUTER_MODELS } from '../lib/constants/ai-models';
import { readFileAsDataUrl, supportsImageModel } from '../lib/services/image-service';
import GlobalInput from '../components/common/GlobalInput';

const formatTime = (value: string) => {
  const date = new Date(value);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export default function SessionRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const { settings, setSettings } = useSettings();
  const sessionId = () => params.id ?? '';
  const [message, setMessage] = createSignal('');
  const [imageMode, setImageMode] = createSignal(false);
  const [pendingImage, setPendingImage] = createSignal<string>('');
  const {
    session,
    loading,
    sending,
    streaming,
    streamingContent,
    error,
    sendMessage,
    endChat,
    deleteSession,
  } = useChatSession(sessionId);

  const chatMessages = createMemo(() => session()?.chatMessages ?? []);
  const displayedMessages = createMemo(() => {
    const base = chatMessages();
    const currentStream = streamingContent();
    if (!currentStream) return base;
    const last = base[base.length - 1];
    if (last?.role === 'assistant' && last.content === currentStream) return base;
    return [
      ...base,
      {
        role: 'assistant' as const,
        content: currentStream,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  let chatScrollRef: HTMLDivElement | undefined;

  createEffect(() => {
    chatMessages();
    streamingContent();
    if (!chatScrollRef) return;
    requestAnimationFrame(() => {
      chatScrollRef!.scrollTop = chatScrollRef!.scrollHeight;
    });
  });

  const handleSend = async (e: Event) => {
    e.preventDefault();
    const value = message().trim();
    if (!value && !pendingImage()) return;
    await sendMessage(imageMode() ? `/image ${value}` : value, pendingImage() || undefined);
    setMessage('');
    setPendingImage('');
    if (imageMode()) setImageMode(false);
  };

  const handleDelete = async () => {
    const confirmed = confirm('Delete this chat session? This cannot be undone.');
    if (!confirmed) return;
    await deleteSession();
    navigate('/history');
  };

  const handleEndChat = async () => {
    await endChat();
    navigate('/history');
  };

  const isClosed = createMemo(() => session()?.status !== 'active');
  const currentModel = () => settings().ai.openRouterModel;
  const currentImageModel = () => settings().ai.openRouterImageModel;
  const imageSupported = createMemo(() => supportsImageModel(currentImageModel()));

  const updateChatModel = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      ai: {
        ...prev.ai,
        openRouterModel: value,
      },
    }));
  };

  const updateImageModel = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      ai: {
        ...prev.ai,
        openRouterImageModel: value,
      },
    }));
  };

  const handleImageUpload = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPendingImage(dataUrl);
    input.value = '';
  };

  const handlePaste = async (e: ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPendingImage(dataUrl);
  };

  return (
    <div class="flex h-screen flex-1 flex-col overflow-hidden">
      <div class="bg-base-200/70 border-base-300/60 px-4 py-4 shadow-lg sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold">{session()?.name || 'AI Chat'}</h1>
            <p class="text-base-content/60 hidden text-sm sm:block">
              Conversation session with the AI assistant.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square"
              onClick={handleEndChat}
              title="End chat"
              aria-label="End chat"
            >
              <CheckCircle2 class="size-4" />
            </button>
            <button
              type="button"
              class="btn btn-error btn-sm btn-square"
              onClick={handleDelete}
              title="Delete session"
              aria-label="Delete session"
            >
              <Trash2 class="size-4" />
            </button>
          </div>
        </div>

        <div class="mt-4 hidden gap-3 md:grid md:grid-cols-2">
          <label class="form-control">
            <span class="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
              Chat model
            </span>
            <select
              class="select select-bordered bg-base-100/70 mt-2 w-full"
              value={currentModel()}
              onChange={(e) => updateChatModel(e.currentTarget.value)}
            >
              <For each={OPENROUTER_MODELS}>
                {(model) => <option value={model}>{model}</option>}
              </For>
            </select>
          </label>

          <label class="form-control">
            <span class="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
              Image model
            </span>
            <select
              class="select select-bordered bg-base-100/70 mt-2 w-full"
              value={currentImageModel()}
              onChange={(e) => updateImageModel(e.currentTarget.value)}
            >
              <For each={OPENROUTER_IMAGE_MODELS}>
                {(model) => <option value={model}>{model}</option>}
              </For>
            </select>
          </label>
        </div>

        <div class="mt-4 flex items-center justify-between gap-3 md:hidden">
          <div class="text-base-content/50 text-xs">Models</div>
          <div class="dropdown dropdown-end">
            <button type="button" class="btn btn-ghost btn-sm">
              Choose
            </button>
            <div class="dropdown-content bg-base-100 border-base-300/60 z-30 mt-2 w-72 rounded-2xl border p-4 shadow-xl">
              <label class="form-control">
                <span class="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                  Chat model
                </span>
                <select
                  class="select select-bordered bg-base-100/70 mt-2 w-full"
                  value={currentModel()}
                  onChange={(e) => updateChatModel(e.currentTarget.value)}
                >
                  <For each={OPENROUTER_MODELS}>
                    {(model) => <option value={model}>{model}</option>}
                  </For>
                </select>
              </label>

              <label class="form-control mt-3">
                <span class="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                  Image model
                </span>
                <select
                  class="select select-bordered bg-base-100/70 mt-2 w-full"
                  value={currentImageModel()}
                  onChange={(e) => updateImageModel(e.currentTarget.value)}
                >
                  <For each={OPENROUTER_IMAGE_MODELS}>
                    {(model) => <option value={model}>{model}</option>}
                  </For>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      <Show
        when={!loading()}
        fallback={<div class="text-base-content/60 px-6 pt-6 lg:px-8">Loading session...</div>}
      >
        <Show
          when={session()}
          fallback={<div class="text-base-content/60 px-6 pt-6 lg:px-8">Session not found.</div>}
        >
          <div class="flex-1 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
            <div class="border-base-300/50 bg-base-100/70 relative flex h-full min-h-0 flex-col gap-4 overflow-hidden rounded-2xl border p-4 shadow-sm sm:p-6">
              <div class="bg-primary/10 pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl"></div>
              <div class="bg-secondary/10 pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full blur-3xl"></div>
              <Show
                when={displayedMessages().length > 0}
                fallback={
                  <div class="text-base-content/50 flex flex-1 items-center justify-center text-sm">
                    No messages yet. Say hello to start the chat.
                  </div>
                }
              >
                <div
                  ref={chatScrollRef}
                  class="max-h-[calc(100dvh-24rem)] flex-1 overflow-x-hidden overflow-y-auto pr-2"
                >
                  <div class="flex flex-col gap-3 pb-2">
                    <For each={displayedMessages()}>
                      {(msg) => {
                        const isUser = msg.role === 'user';
                        return (
                          <div class={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div
                              class={`border-base-300/50 max-w-[80%] rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                                isUser
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-base-200/70 text-base-content'
                              }`}
                            >
                              <div class="flex items-center gap-2 text-[10px] tracking-widest uppercase opacity-60">
                                {isUser ? 'You' : 'AI'}
                                <span>{formatTime(msg.createdAt)}</span>
                              </div>
                              <Show when={msg.content}>
                                <div class="text-base-content mt-2 wrap-break-word">
                                  <Markdown content={msg.content} />
                                </div>
                              </Show>
                              <Show when={msg.imageDataUrl}>
                                <div class="border-base-300/60 mt-3 overflow-hidden rounded-xl border">
                                  <ImagePreview
                                    src={msg.imageDataUrl!}
                                    alt={msg.imagePrompt || 'Generated image'}
                                    class="h-auto w-full"
                                    loading="lazy"
                                  />
                                </div>
                              </Show>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>

              <form onSubmit={handleSend} class="border-base-300/50 border-t pt-4">
                <div class="flex flex-wrap items-center gap-3">
                  <div class="bg-base-200/60 text-base-content/60 hidden items-center gap-2 rounded-full px-3 py-1 text-xs sm:flex">
                    <Bot class="size-3" />
                    /chat session
                  </div>
                  <Show when={isClosed()}>
                    <span class="text-base-content/50 text-xs">Chat ended</span>
                  </Show>
                  <Show when={error()}>
                    <span class="text-error text-xs">{error()!.message}</span>
                  </Show>
                  <Show when={streaming()}>
                    <span class="text-base-content/40 text-xs">Streaming...</span>
                  </Show>
                </div>
                <Show when={pendingImage()}>
                  <div class="border-base-300/60 bg-base-200/60 mt-3 flex items-center gap-3 rounded-xl border px-3 py-2">
                    <div class="border-base-300/60 relative h-16 w-16 overflow-hidden rounded-lg border">
                      <ImagePreview
                        src={pendingImage()}
                        alt="Pending upload"
                        class="h-full w-full object-cover"
                      />
                    </div>
                    <div class="text-base-content/70 text-xs">Image attached</div>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs ml-auto"
                      onClick={() => setPendingImage('')}
                      aria-label="Remove attachment"
                    >
                      <X class="size-3" />
                    </button>
                  </div>
                </Show>
                <div class="mt-3 flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <GlobalInput
                      class="w-full flex-1 py-3"
                      value={message()}
                      onInput={(e) => setMessage(e.currentTarget.value)}
                      onPaste={handlePaste}
                      maxlength={2000}
                      placeholderMaxLength={25}
                      placeholder={
                        imageMode()
                          ? 'Describe the image you want to generate...'
                          : 'Ask anything about your trackers, goals, or habits...'
                      }
                      mode="textarea"
                      disabled={sending() || isClosed()}
                    />
                    <button
                      type="submit"
                      class="btn btn-primary btn-square"
                      disabled={sending() || isClosed()}
                      aria-label={imageMode() ? 'Generate' : 'Send'}
                    >
                      <Send class="size-4" />
                    </button>
                  </div>
                  <div class="flex items-center gap-2">
                    <label
                      class={`btn btn-ghost btn-square ${pendingImage() ? 'btn-secondary' : ''}`}
                      title="Attach image"
                    >
                      <Paperclip class="size-4" />
                      <input
                        type="file"
                        accept="image/*"
                        class="hidden"
                        onChange={handleImageUpload}
                        disabled={sending() || isClosed()}
                      />
                    </label>
                    <Show when={imageSupported()}>
                      <button
                        type="button"
                        class={`btn ${imageMode() ? 'btn-secondary' : 'btn-ghost'} btn-square`}
                        onClick={() => setImageMode((prev) => !prev)}
                        title="Toggle image mode"
                        disabled={sending() || isClosed()}
                      >
                        <Image class="size-4" />
                      </button>
                    </Show>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
