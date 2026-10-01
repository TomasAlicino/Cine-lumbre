import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AutofocoDirective } from '../../directivas/directivas';
import { AuthService } from '../../services/auth-service';
import { NotificacionesService } from '../../services/notificaciones-service';
import { ToastService } from '../../services/toast-service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AutofocoDirective],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private notificaciones = inject(NotificacionesService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Página a la que se vuelve después de ingresar (la manda el guard)
  volver = this.route.snapshot.queryParamMap.get('volver') ?? '';

  error = signal('');
  enviando = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async ingresar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.enviando.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.getRawValue();
      const u = await this.auth.login(email, password);
      // Si fallan los avisos no se corta el ingreso: la sesión ya está iniciada
      this.notificaciones.cargar().catch((e) => console.error('No se pudieron cargar los avisos', e));
      this.toast.ok(`¡Hola, ${u.nombre}!`);
      this.router.navigateByUrl(this.volver || '/');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.enviando.set(false);
    }
  }
}
