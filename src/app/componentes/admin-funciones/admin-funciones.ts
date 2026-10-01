import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectorDias } from '../selector-dias/selector-dias';
import { SelectorHorarios } from '../selector-horarios/selector-horarios';
import { MascaraFechaDirective } from '../../directivas/directivas';
import { FORMATOS, Formato, FuncionCompleta, Idioma, Pelicula } from '../../models/models';
import { DiaPipe, FechaARPipe, HoraPipe, PesosPipe } from '../../pipes/pipes';
import { FuncionesService, ResultadoProgramacion } from '../../services/funciones-service';
import { PeliculasService } from '../../services/peliculas-service';
import { ToastService } from '../../services/toast-service';
import { aISOFecha, formatearFechaAR, parsearFechaAR, sumarDias } from '../../utils/fechas';
import { fechaARValida } from '../../utils/validadores';

/** Programación de funciones con asignación automática de sala y agenda de las próximas. */
@Component({
  selector: 'app-admin-funciones',
  imports: [ReactiveFormsModule, FormsModule, SelectorDias, SelectorHorarios, MascaraFechaDirective, PesosPipe, FechaARPipe, HoraPipe, DiaPipe],
  templateUrl: './admin-funciones.html',
  styleUrl: './admin-funciones.scss',
})
export class AdminFunciones implements OnInit {
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  formatos = FORMATOS;
  peliculas = signal<Pelicula[]>([]);

  // Días y horarios van en signals porque los manejan los selectores con [(valores)]
  dias = signal<number[]>([1, 2, 5]);
  horarios = signal<string[]>(['18:00']);

  programando = signal(false);
  errorForm = signal('');
  resultado = signal<ResultadoProgramacion | null>(null);

  form = this.fb.nonNullable.group({
    pelicula_id: [null as number | null, Validators.required],
    desde: [formatearFechaAR(aISOFecha(new Date())), [Validators.required, fechaARValida]],
    hasta: [formatearFechaAR(aISOFecha(sumarDias(new Date(), 13))), [Validators.required, fechaARValida]],
    formato: ['2D' as Formato],
    idioma: ['castellano' as Idioma],
    precio: [7000, [Validators.required, Validators.min(0)]],
    precio_vip: [10000, [Validators.required, Validators.min(0)]],
  });


  // ── Agenda de los próximos 14 días ──
  cargando = signal(true);
  funciones = signal<FuncionCompleta[]>([]);
  diasAgenda = Array.from({ length: 14 }, (_, i) => aISOFecha(sumarDias(new Date(), i)));
  diaSel = signal(''); // '' = todos los días
  agenda = computed(() => {
    const dia = this.diaSel();
    return dia ? this.funciones().filter((f) => aISOFecha(new Date(f.inicio)) === dia) : this.funciones();
  });

  editandoId = signal<number | null>(null);
  precioEdit = signal(0);
  vipEdit = signal(0);

  ngOnInit() {
    this.cargarPeliculas();
    this.cargarAgenda();
  }

  async cargarPeliculas() {
    try {
      const lista = await this.peliculasService.listar();
      this.peliculas.set(lista.filter((p) => p.estado !== 'inactiva'));
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  async cargarAgenda() {
    this.cargando.set(true);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    try {
      this.funciones.set(await this.funcionesService.entre(hoy, sumarDias(hoy, 14)));
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  rapido(dias: number) {
    this.form.patchValue({
      desde: formatearFechaAR(aISOFecha(new Date())),
      hasta: formatearFechaAR(aISOFecha(sumarDias(new Date(), dias - 1))),
    });
  }

  async programar() {
    this.form.markAllAsTouched();
    this.errorForm.set('');
    const error = this.validarProgramacion();
    if (error) {
      this.errorForm.set(error);
      return;
    }
    const v = this.form.getRawValue();
    const desde = parsearFechaAR(v.desde)!;
    const hasta = parsearFechaAR(v.hasta)!;

    this.programando.set(true);
    this.resultado.set(null);
    try {
      const r = await this.funcionesService.programar({
        pelicula_id: v.pelicula_id!,
        desde,
        hasta,
        dias: this.dias(),
        horarios: this.horarios(),
        formato: v.formato,
        idioma: v.idioma,
        precio: Number(v.precio),
        precio_vip: Number(v.precio_vip),
      });
      this.resultado.set(r);
      if (r.creadas) {
        this.toast.ok(`Se crearon ${r.creadas} funciones.`);
        await this.cargarAgenda();
      }
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.programando.set(false);
    }
  }

  /** Devuelve el primer error del formulario de programación, o '' si está todo bien. */
  private validarProgramacion(): string {
    const v = this.form.getRawValue();
    const desde = parsearFechaAR(v.desde);
    const hasta = parsearFechaAR(v.hasta);
    if (!v.pelicula_id) return 'Elegí una película.';
    if (!desde || !hasta) return 'Revisá las fechas (dd/mm/aaaa).';
    if (desde > hasta) return '"Desde" tiene que ser anterior a "hasta".';
    if (!this.dias().length) return 'Elegí al menos un día de la semana.';
    if (!this.horarios().length) return 'Agregá al menos un horario.';
    if (this.form.invalid) return 'Revisá los precios.';
    if (Number(v.precio_vip) < Number(v.precio)) return 'El precio VIP no puede ser menor que el normal.';
    return '';
  }

  // ── Edición de precios y baja ──

  editarPrecio(f: FuncionCompleta) {
    this.editandoId.set(f.id);
    this.precioEdit.set(f.precio);
    this.vipEdit.set(f.precio_vip);
  }

  async guardarPrecio(f: FuncionCompleta) {
    const precio = Number(this.precioEdit());
    const vip = Number(this.vipEdit());
    if (precio < 0 || vip < precio) {
      this.toast.error('El VIP debe ser mayor o igual al precio normal.');
      return;
    }
    try {
      await this.funcionesService.actualizarPrecios(f, precio, vip);
      this.editandoId.set(null);
      this.toast.ok('Precio actualizado.');
      await this.cargarAgenda();
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  async eliminar(f: FuncionCompleta) {
    if (!confirm(`¿Eliminar la función de "${f.peliculas.titulo}"?`)) return;
    try {
      await this.funcionesService.eliminar(f);
      this.toast.ok('Función eliminada.');
      await this.cargarAgenda();
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  /** "2026-10-03" → Date local, para el pipe dia en los botones de la agenda. */
  fechaDe(iso: string): Date {
    return new Date(iso + 'T12:00:00');
  }
}
