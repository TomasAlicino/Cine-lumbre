import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Cupon } from '../../models/models';
import { CODIGO_BIENVENIDA } from '../../services/compras-service';
import { ConfiguracionService } from '../../services/configuracion-service';
import { CuponesService } from '../../services/cupones-service';
import { ToastService } from '../../services/toast-service';

@Component({
  selector: 'app-admin-cupones',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-cupones.html',
  styleUrl: './admin-cupones.scss',
})
export class AdminCupones implements OnInit {
  private cuponesService = inject(CuponesService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  // El porcentaje del cupón de bienvenida vive en la configuración general
  config = inject(ConfiguracionService).config;
  readonly codigoBienvenida = CODIGO_BIENVENIDA;

  cupones = signal<Cupon[]>([]);
  usos = signal<Map<string, number>>(new Map());
  cargando = signal(true);

  mostrarForm = signal(false);
  editando = signal<Cupon | null>(null);
  form = this.fb.group({
    codigo: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{3,20}$/)]],
    porcentaje: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
    limitarEdad: [false],
    edad: [50, [Validators.min(1), Validators.max(100)]],
    activo: [true],
  });

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      const [cupones, usos] = await Promise.all([this.cuponesService.listar(), this.cuponesService.usos()]);
      this.cupones.set(cupones);
      this.usos.set(usos);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  usosDe(codigo: string) {
    return this.usos().get(codigo) ?? 0;
  }

  nuevo() {
    this.editando.set(null);
    this.form.reset({ codigo: '', porcentaje: 10, limitarEdad: false, edad: 50, activo: true });
    this.mostrarForm.set(true);
  }

  editar(c: Cupon) {
    this.editando.set(c);
    this.form.setValue({
      codigo: c.codigo,
      porcentaje: c.porcentaje,
      limitarEdad: c.solo_mayores_de !== null,
      edad: c.solo_mayores_de ?? 50,
      activo: c.activo,
    });
    this.mostrarForm.set(true);
  }

  cancelar() {
    this.mostrarForm.set(false);
    this.editando.set(null);
  }

  async guardar() {
    // La edad solo importa si se tildó la restricción
    if (!this.form.controls.limitarEdad.value) this.form.controls.edad.setValue(50);
    else if (!this.form.controls.edad.value) this.form.controls.edad.setErrors({ required: true });
    const v = this.form.getRawValue();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const datos = {
      codigo: v.codigo!,
      porcentaje: Number(v.porcentaje),
      solo_mayores_de: v.limitarEdad ? Number(v.edad) : null,
      activo: !!v.activo,
    };
    try {
      await this.cuponesService.guardar(datos, this.editando() ?? undefined);
      this.toast.ok('Cupón guardado.');
      this.cancelar();
      this.cupones.set(await this.cuponesService.listar());
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  async eliminar(c: Cupon) {
    if (!confirm(`¿Borrar el cupón ${c.codigo}?`)) return;
    try {
      await this.cuponesService.eliminar(c);
      this.toast.ok('Cupón borrado.');
      this.cupones.set(await this.cuponesService.listar());
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
}
