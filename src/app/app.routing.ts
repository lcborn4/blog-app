import { Routes } from '@angular/router';
import { authGuard } from './admin/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'blog' },
  {
    path: 'blog',
    loadComponent: () => import('./blog/blog.component').then((m) => m.BlogComponent)
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./blog/blog-post.component').then((m) => m.BlogPostComponent)
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./admin/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent)
  },
  { path: '**', redirectTo: 'blog' }
];
