import type { RouteDefinition } from '@solidjs/router';
import { lazy } from 'solid-js';
import Layout from '../components/layout/Layout';

export const routes: RouteDefinition[] = [
  {
    path: '/',
    component: Layout,
    children: [
      {
        path: '/',
        component: lazy(() => import('./home.tsx')),
      },
      {
        path: '/trackers',
        component: lazy(() => import('./trackers-new.tsx')),
      },
      {
        path: '/goals',
        component: lazy(() => import('./goals.tsx')),
      },
      {
        path: '/history',
        component: lazy(() => import('./history.tsx')),
      },
      {
        path: '/sessions/:id',
        component: lazy(() => import('./session.tsx')),
      },
      {
        path: '/settings',
        component: lazy(() => import('./settings.tsx')),
      },
    ],
  },
];
