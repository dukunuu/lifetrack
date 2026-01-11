/* @refresh reload */
import { render } from 'solid-js/web';
import './index.css';
import { Router } from '@solidjs/router';
import { routes } from './routes';
import { registerSW } from 'virtual:pwa-register';

const root = document.getElementById('root');

registerSW({ immediate: true });

render(() => <Router>{routes}</Router>, root!);
