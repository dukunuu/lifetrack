import { A } from '@solidjs/router';
import { Show } from 'solid-js';
import type { Session } from '../../lib/db/types';

interface SessionDetailModalProps {
  session: Session | null;
  onClose: () => void;
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDuration = (session: Session): string => {
  if (!session.endTime) return 'In progress';
  const start = new Date(session.startTime).getTime();
  const end = new Date(session.endTime).getTime();
  const diff = Math.floor((end - start) / 1000 / 60);
  if (diff < 60) return `${diff} min`;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export default function SessionDetailModal(props: SessionDetailModalProps) {
  return (
    <Show when={props.session}>
      <div class="modal modal-open" onClick={props.onClose}>
        <div class="modal-box" onClick={(e) => e.stopPropagation()}>
          <h3 class="text-lg font-bold">{props.session!.name || props.session!.type}</h3>
          <p class="text-base-content/60 mt-1 text-sm">
            {formatTime(props.session!.startTime)} -{' '}
            {props.session!.endTime ? formatTime(props.session!.endTime) : 'Ongoing'}
            {' • '}
            {formatDuration(props.session!)}
          </p>

          <div class="space-y-3 py-4">
            <Show when={props.session!.notes}>
              <div class="bg-base-200 rounded-lg p-3">
                <div class="text-base-content/60 mb-1 text-sm">Notes</div>
                <div class="text-sm">{props.session!.notes}</div>
              </div>
            </Show>

            <Show when={props.session!.summary}>
              <div class="bg-base-200 rounded-lg p-3">
                <div class="text-base-content/60 mb-1 text-sm">Summary</div>
                <div class="text-sm">
                  <div>
                    Duration: {Math.round((props.session!.summary?.duration || 0) / 60)} min
                  </div>
                  <div>Entries: {props.session!.summary?.entryCount || 0}</div>
                </div>
              </div>
            </Show>

            <Show when={props.session!.type === 'ai' && props.session!.chatMessages?.length}>
              <div class="bg-base-200 rounded-lg p-3">
                <div class="text-base-content/60 mb-1 text-sm">Chat History</div>
                <div class="text-sm">{props.session!.chatMessages?.length} messages</div>
                <A href={`/sessions/${props.session!._id}`} class="btn btn-sm btn-primary mt-2">
                  Open Chat
                </A>
              </div>
            </Show>
          </div>

          <div class="modal-action">
            <A href={`/sessions/${props.session!._id}`} class="btn btn-ghost">
              View Full Details
            </A>
            <button type="button" class="btn btn-ghost" onClick={props.onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
