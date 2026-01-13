/* @refresh reload */
import './lib/shims/process';
import { render } from 'solid-js/web';
import './index.css';
import { Router } from '@solidjs/router';
import { routes } from './routes';
import { registerSW } from 'virtual:pwa-register';

const root = document.getElementById('root');

registerSW({ immediate: true });

if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => undefined);
}

render(() => <Router>{routes}</Router>, root!);
