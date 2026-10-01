import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Producto, Recompensa } from '../../models/models';
import { CandyService } from '../../services/candy-service';
import { FidelizacionService } from '../../services/fidelizacion-service';
import { ToastService } from '../../services/toast-service';

@Component({
  selector: 'app-admin-recompensas',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-recompensas.html',
  styleUrl: './admin-recompensas.scss',
})
export class AdminRecompensas implements OnInit {
  private fidelizacion = inject(FidelizacionService);
  private candy = inject(CandyService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  recompensas = signal<Recompensa[]>([]);
  productos = signal<Producto[]>([]);
  cargando = signal(true);

  mostrarForm = signal(false);
  editando = signal<Recompensa | null>(null);
  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(40)]],
    tipo: ['entrada' as 'entrada' | 'producto'],
    producto_id: [null as number | null],
    costo_puntos: [500, [Validators.required, Validators.min(1)]],
    activa: [true],
  });

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      const [recompensas, productos] = await Promise.all([this.fidelizacion.recompensas(), this.candy.productos()]);
      this.recompensas.set(recompensas);
      this.productos.set(productos);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  nombreProducto(id: number | null) {
    return this.productos().find((p) => p.id === id)?.nombre ?? 'Producto borrado';
  }

  nueva() {
    this.editando.set(null);
    this.form.reset({ nombre: '', tipo: 'entrada', producto_id: null, costo_puntos: 500, activa: true });
    this.mostrarForm.set(true);
  }

  editar(r: Recompensa) {
    this.editando.set(r);
    this.form.setValue({ nombre: r.nombre, tipo: r.tipo, producto_id: r.producto_id, costo_puntos: r.costo_puntos, activa: r.activa });
    this.mostrarForm.set(true);
  }

  cancelar() {
    this.mostrarForm.set(false);
    this.editando.set(null);
  }

  async guardar() {
    // El producto solo es obligatorio si la recompensa es de tipo producto
    if (this.form.controls.tipo.value === 'producto' && !this.form.controls.producto_id.value) {
      this.form.controls.producto_id.setErrors({ required: true });
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre!.trim(),
      tipo: v.tipo!,
      producto_id: v.tipo === 'producto' ? v.producto_id : null,
      costo_puntos: Number(v.costo_puntos),
      activa: !!v.activa,
    };
    try {
      await this.fidelizacion.guardar(datos, this.editando() ?? undefined);
      this.toast.ok('Recompensa guardada.');
      this.cancelar();
      this.recompensas.set(await this.fidelizacion.recompensas());
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  async eliminar(r: Recompensa) {
    if (!confirm(`¿Borrar "${r.nombre}"?`)) return;
    try {
      await this.fidelizacion.eliminar(r);
      this.toast.ok('Recompensa borrada.');
      this.recompensas.set(await this.fidelizacion.recompensas());
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
}
