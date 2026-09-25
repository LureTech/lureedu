import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'redefinir-senha',
    title: 'Redefinir senha',
    loadComponent: () => import('./pages/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'certificado/:code',
    title: 'Verificar certificado',
    loadComponent: () =>
      import('./pages/certificate-verify/certificate-verify.page').then((m) => m.CertificateVerifyPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'secao/:id',
        title: 'Seção',
        loadComponent: () => import('./pages/section/section.page').then((m) => m.SectionPage),
      },
      {
        path: 'curso/:slug',
        title: 'Curso',
        data: { bare: true },
        loadComponent: () => import('./pages/course/course.page').then((m) => m.CoursePage),
      },
      {
        path: 'meus-cursos',
        title: 'Meus cursos',
        loadComponent: () => import('./pages/my-courses/my-courses.page').then((m) => m.MyCoursesPage),
      },
      {
        path: 'comunidade',
        title: 'Comunidade',
        loadComponent: () => import('./pages/community/community.page').then((m) => m.CommunityPage),
      },
      {
        path: 'diagnostico',
        title: 'Diagnóstico de Maturidade',
        loadComponent: () => import('./pages/diagnostic/diagnostic.page').then((m) => m.DiagnosticPage),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Administração — Contas',
            loadComponent: () => import('./pages/admin/accounts.page').then((m) => m.AccountsPage),
          },
          {
            path: 'modulos',
            title: 'Administração — Módulos',
            loadComponent: () => import('./pages/admin/modules.page').then((m) => m.ModulesPage),
          },
          {
            path: 'modulos/:id',
            title: 'Editar módulo',
            loadComponent: () => import('./pages/admin/module-editor.page').then((m) => m.ModuleEditorPage),
          },
        ],
      },
      {
        path: '**',
        title: 'Página não encontrada',
        loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
