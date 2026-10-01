import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AutofocoDirective, MascaraFechaDirective } from '../../directivas/directivas';
import { COLORES_OJOS, TIPOS_SANGRE } from '../../models/models';
import { AuthService } from '../../services/auth-service';
import { ConfiguracionService } from '../../services/configuracion-service';
import { NotificacionesService } from '../../services/notificaciones-service';
import { ToastService } from '../../services/toast-service';
import { parsearFechaAR } from '../../utils/fechas';
import { coincideCon, edadEntre, fechaARValida } from '../../utils/validadores';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, MascaraFechaDirective, AutofocoDirective],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
})
export class Registro {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private notificaciones = inject(NotificacionesService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  config = inject(ConfiguracionService);

  volver = this.route.snapshot.queryParamMap.get('volver') ?? '';
  tiposSangre = TIPOS_SANGRE;
  coloresOjos = COLORES_OJOS;

  error = signal('');
  enviando = signal(false);

  // Los nombres de los controles son los de las columnas de "perfiles"
  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(40)]],
    apellido: ['', [Validators.required, Validators.maxLength(40)]],
    email: ['', [Validators.required, Validators.email]],
    fecha_nacimiento: ['', [Validators.required, fechaARValida, edadEntre(5, 110)]],
    dias_vacaciones: [14, [Validators.required, Validators.min(0), Validators.max(365)]],
    tipo_sangre: ['', Validators.required],
    color_ojos: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
    password2: ['', [Validators.required, coincideCon('password')]],
  });

  /** true si el campo tiene error y el usuario ya lo tocó. */
  err(campo: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  elegir(campo: 'tipo_sangre' | 'color_ojos', valor: string) {
    this.form.controls[campo].setValue(valor);
    this.form.controls[campo].markAsTouched();
  }

  async registrar() {
    // Si cambió la primera contraseña hay que revalidar la repetición
    this.form.controls.password2.updateValueAndValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.enviando.set(true);
    this.error.set('');
    try {
      const { password2: _repetida, fecha_nacimiento, dias_vacaciones, ...resto } = this.form.getRawValue();
      const u = await this.auth.registrar({
        ...resto,
        fecha_nacimiento: parsearFechaAR(fecha_nacimiento)!,
        dias_vacaciones: Number(dias_vacaciones),
      });
      const porcentaje = this.config.config().porcentaje_primera_compra;
      this.toast.ok(`¡Bienvenido/a, ${u.nombre}! Tenés un cupón del ${porcentaje}% para tu primera compra.`);
      this.notificaciones.cargar().catch((e) => console.error('No se pudieron cargar los avisos', e));
      this.router.navigateByUrl(this.volver || '/cartelera');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.enviando.set(false);
    }
  }
}
