import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfiguracionService } from '../../services/configuracion-service';
import { ToastService } from '../../services/toast-service';

@Component({
  selector: 'app-admin-configuracion',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-configuracion.html',
  styleUrl: './admin-configuracion.scss',
})
export class AdminConfiguracion implements OnInit {
  private configuracion = inject(ConfiguracionService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  // Valores guardados (para mostrar los actuales al lado del formulario)
  config = this.configuracion.config;
  cargando = signal(true);
  guardando = signal(false);
  readonly atajos = [10, 15, 20, 25, 30];

  form = this.fb.group({
    porcentaje_primera_compra: [20, [Validators.required, Validators.min(1), Validators.max(100)]],
    minutos_limpieza: [30, [Validators.required, Validators.min(0)]],
    horas_limite_cancelacion: [2, [Validators.required, Validators.min(0)]],
  });

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      const c = await this.configuracion.cargar();
      this.form.setValue({
        porcentaje_primera_compra: c.porcentaje_primera_compra,
        minutos_limpieza: c.minutos_limpieza,
        horas_limite_cancelacion: c.horas_limite_cancelacion,
      });
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  elegirPorcentaje(p: number) {
    this.form.controls.porcentaje_primera_compra.setValue(p);
    // setValue no marca el form como modificado; sin esto el botón Guardar seguiría deshabilitado
    this.form.markAsDirty();
  }

  async guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    try {
      await this.configuracion.guardar({
        porcentaje_primera_compra: Number(v.porcentaje_primera_compra),
        minutos_limpieza: Number(v.minutos_limpieza),
        horas_limite_cancelacion: Number(v.horas_limite_cancelacion),
      });
      this.form.markAsPristine();
      this.toast.ok('Configuración guardada.');
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}
