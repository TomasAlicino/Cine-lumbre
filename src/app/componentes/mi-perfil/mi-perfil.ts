import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { COLORES_OJOS, TIPOS_SANGRE } from '../../models/models';
import { FechaARPipe, PesosPipe } from '../../pipes/pipes';
import { AuthService } from '../../services/auth-service';
import { ComprasService } from '../../services/compras-service';
import { ConfiguracionService } from '../../services/configuracion-service';
import { NotificacionesService } from '../../services/notificaciones-service';
import { ToastService } from '../../services/toast-service';

@Component({
  selector: 'app-mi-perfil',
  imports: [ReactiveFormsModule, RouterLink, FechaARPipe, PesosPipe],
  templateUrl: './mi-perfil.html',
  styleUrl: './mi-perfil.scss',
})
export class MiPerfil implements OnInit {
  private fb = inject(FormBuilder);
  private compras = inject(ComprasService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  config = inject(ConfiguracionService);
  notis = inject(NotificacionesService);

  tiposSangre = TIPOS_SANGRE;
  coloresOjos = COLORES_OJOS;

  bienvenida = signal(false);
  editando = signal(false);
  guardando = signal(false);

  // El mail y la fecha de nacimiento no se editan (la edad define qué películas puede ver)
  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(40)]],
    apellido: ['', [Validators.required, Validators.maxLength(40)]],
    tipo_sangre: ['', Validators.required],
    color_ojos: ['', Validators.required],
    dias_vacaciones: [0, [Validators.required, Validators.min(0), Validators.max(365)]],
  });

  async ngOnInit() {
    const u = this.auth.usuario();
    if (!u) return;
    try {
      this.bienvenida.set(await this.compras.esPrimeraCompra(u.id));
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  editar() {
    const u = this.auth.usuario();
    if (!u) return;
    this.form.reset({
      nombre: u.nombre,
      apellido: u.apellido,
      tipo_sangre: u.tipo_sangre,
      color_ojos: u.color_ojos,
      dias_vacaciones: u.dias_vacaciones,
    });
    this.editando.set(true);
  }

  async guardar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.guardando.set(true);
    try {
      const datos = this.form.getRawValue();
      await this.auth.actualizarPerfil({ ...datos, dias_vacaciones: Number(datos.dias_vacaciones) });
      this.toast.ok('Tus datos se guardaron.');
      this.editando.set(false);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }

  async marcarLeidas() {
    try {
      await this.notis.marcarTodasLeidas();
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
}
