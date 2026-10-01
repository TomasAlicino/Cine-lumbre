import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MapaButacas } from '../mapa-butacas/mapa-butacas';
import { Sala } from '../../models/models';
import { SalasService } from '../../services/salas-service';
import { ToastService } from '../../services/toast-service';
import { ButacaDef, TOTAL_BUTACAS } from '../../utils/sala-layout';

/** Salas: activarlas, renombrarlas y marcar butacas fuera de servicio. */
@Component({
  selector: 'app-admin-salas',
  imports: [ReactiveFormsModule, MapaButacas],
  templateUrl: './admin-salas.html',
  styleUrl: './admin-salas.scss',
})
export class AdminSalas implements OnInit {
  private salasService = inject(SalasService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  total = TOTAL_BUTACAS;
  salas = signal<Sala[]>([]);
  cargando = signal(true);
  guardando = signal(false);

  // Editor: sel() es la sala original (null = sala nueva) y abierto() indica si se muestra
  abierto = signal(false);
  sel = signal<Sala | null>(null);
  // Copia local de las butacas fuera de servicio: recién se guarda al tocar "Guardar"
  fueraDeServicio = signal<string[]>([]);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(30)]],
    activa: [true],
  });

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      this.salas.set(await this.salasService.listar());
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  elegir(s: Sala) {
    this.sel.set(s);
    this.form.setValue({ nombre: s.nombre, activa: s.activa });
    this.fueraDeServicio.set([...s.butacas_deshabilitadas]);
    this.abierto.set(true);
  }

  nueva() {
    this.sel.set(null);
    this.form.reset();
    this.fueraDeServicio.set([]);
    this.abierto.set(true);
  }

  /** Cada clic en el mapa pone o saca la butaca de servicio (solo en la copia local). */
  alternar(b: ButacaDef) {
    this.fueraDeServicio.update((l) => (l.includes(b.id) ? l.filter((x) => x !== b.id) : [...l, b.id]));
  }

  habilitarTodas() {
    this.fueraDeServicio.set([]);
  }

  async guardar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const cambios = {
      nombre: this.form.controls.nombre.value.trim(),
      activa: this.form.controls.activa.value,
      butacas_deshabilitadas: this.fueraDeServicio(),
    };

    this.guardando.set(true);
    try {
      let sala = this.sel();
      if (!sala) {
        // Alta: primero se crea y, si hace falta, se guardan las butacas y el estado
        sala = await this.salasService.crear(cambios.nombre);
        if (cambios.butacas_deshabilitadas.length || !cambios.activa) {
          sala = await this.salasService.actualizar(sala, cambios);
        }
      } else {
        // El servicio rechaza butacas ya vendidas y desactivar salas con funciones
        sala = await this.salasService.actualizar(sala, cambios);
      }
      this.toast.ok(`${sala.nombre} guardada.`);
      await this.cargar();
      this.elegir(sala);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar() {
    const sala = this.sel();
    if (!sala || !confirm(`¿Eliminar ${sala.nombre}?`)) return;
    try {
      await this.salasService.eliminar(sala);
      this.toast.ok('Sala eliminada.');
      this.sel.set(null);
      this.abierto.set(false);
      await this.cargar();
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
}
