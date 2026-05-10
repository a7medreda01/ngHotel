import { Routes } from '@angular/router';
import { Booking } from './features/booking/booking';
import { Chalet } from './features/chalet/chalet';
import { Waitinglist } from './features/waitinglist/waitinglist';
import { Layout } from './layout/layout/layout';
import { ExtrasComponent } from './features/extras-component/extras-component';
import { Maintenance } from './features/maintenance/maintenance';
import { LoginComponent } from './features/login-component/login-component';
import { AuthGuard, ManagerGuard } from './Guards/AuthGuard';
import { CreateUserComponent } from './features/create-user-component/create-user-component';
import { ForgetPasswordComponent } from './features/forget-password-component/forget-password-component';
import { ResetPasswordComponent } from './features/reset-password-component/reset-password-component';
import { ProfileComponent } from './features/profile-component/profile-component';
import { Dashboard } from './features/dashboard/dashboard';
import { BookingOverviewComponent } from './features/booking-overview-component/booking-overview';

export const routes: Routes = [
  // 🔓 Public
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'forget-password', component: ForgetPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'create-user', component: CreateUserComponent, canActivate: [ManagerGuard] },


  // 🔐 Protected
  {
    path: '',
    component: Layout,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'booking', component: Booking },
      { path: 'chalet', component: Chalet },
      { path: 'waitinglist', component: Waitinglist },
      { path: 'extras', component: ExtrasComponent },
      { path: 'maintenance', component: Maintenance },
      { path: 'overview', component: BookingOverviewComponent },
      { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
      {path: 'booking/new',component: Booking }

    ]
  },

  // ❌ fallback
  { path: '**', redirectTo: 'login' }
];