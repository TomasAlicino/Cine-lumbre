import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ImagenRespaldoDirective, MascaraFechaDirective } from '../../directivas/directivas';
import { Clasificacion, EstadoPelicula, GENEROS, Pelicula } from '../../models/models';
import { BuscarPeliculasPipe, DuracionPipe, FechaARPipe } from '../../pipes/pipes';
import { DatosPelicula, PeliculasService } from '../../services/peliculas-service';
import { PeliculaTmdb, TmdbService } from '../../services/tmdb-service';
import { ToastService } from '../../services/toast-service';
import { formatearFechaAR, parsearFechaAR } from '../../utils/fechas';
import { estadoVenta } from '../../utils/negocio';
import { fechaARValida } from '../../utils/validadores';

/** ABM de películas: qué se proyecta, destacadas, estrenos, preventas y pósters (Supabase Storage). */
@Component({
  selector: 'app-admin-peliculas',
  imports: [ReactiveFormsModule, FormsModule, DuracionPipe, FechaARPipe, BuscarPeliculasPipe, ImagenRespaldoDirective, MascaraFechaDirective],
  templateUrl: './admin-peliculas.html',
  styleUrl: './admin-peliculas.scss',
})
export class AdminPeliculas implements OnInit, OnDestroy {
  private peliculasService = inject(PeliculasService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private tmdb = inject(TmdbService);

  generos = GENEROS;
  clasificaciones: Clasificacion[] = ['ATP', '+13', '+18'];
  estados: { valor: EstadoPelicula; texto: string }[] = [
    { valor: 'cartelera', texto: 'En cartelera' },
    { valor: 'proximamente', texto: 'Próximamente' },
    { valor: 'inactiva', texto: 'Inactiva' },
  ];

  peliculas = signal<Pelicula[]>([]);
  cargando = signal(true);
  guardando = signal(false);

  // Filtros del listado
  texto = signal('');
  filtroEstado = signal<EstadoPelicula | ''>('');
  filtradas = computed(() => {
    const estado = this.filtroEstado();
    return estado ? this.peliculas().filter((p) => p.estado === estado) : this.peliculas();
  });

  // Editor: null = cerrado; editando() = null y abierto() = true es alta
  abierto = signal(false);
  editando = signal<Pelicula | null>(null);

  // Póster elegido y su vista previa (URL temporal del navegador)
  archivo = signal<File | null>(null);
  vistaPrevia = signal<string | null>(null);

  // Búsqueda en TMDB (API pública por HTTP) para completar el formulario
  textoTmdb = signal('');
  resultadosTmdb = signal<PeliculaTmdb[]>([]);
  buscandoTmdb = signal(false);
  imagenTmdb = signal<string | null>(null); // póster elegido desde TMDB
  private subsTmdb: Subscription[] = [];

  form = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.maxLength(80)]],
    sinopsis: ['', [Validators.required, Validators.minLength(20)]],
    duracion_min: [110, [Validators.required, Validators.min(30), Validators.max(300)]],
    generos: [[] as string[], Validators.required], // required también falla con un array vacío
    clasificacion: ['ATP' as Clasificacion],
    estado: ['cartelera' as EstadoPelicula],
    destacada: [false],
    fecha_estreno: ['', [Validators.required, fechaARValida]],
    preventa_habilitada: [false],
    preventa_precio: [5000, [Validators.required, Validators.min(0)]],
    preventa_dias_antes: [7, [Validators.required, Validators.min(1), Validators.max(30)]],
  });

  ngOnInit() {
    this.cargar();
  }

  ngOnDestroy() {
    this.liberarVistaPrevia();
    this.subsTmdb.forEach((s) => s.unsubscribe());
  }

  async cargar() {
    this.cargando.set(true);
    try {
      this.peliculas.set(await this.peliculasService.listar());
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  nueva() {
    this.form.reset();
    this.editando.set(null);
    this.limpiarArchivo();
    this.limpiarTmdb();
    this.abierto.set(true);
  }

  editar(p: Pelicula) {
    this.form.setValue({
      titulo: p.titulo,
      sinopsis: p.sinopsis,
      duracion_min: p.duracion_min,
      generos: [...p.generos],
      clasificacion: p.clasificacion,
      estado: p.estado,
      destacada: p.destacada,
      fecha_estreno: formatearFechaAR(p.fecha_estreno),
      preventa_habilitada: p.preventa_habilitada,
      preventa_precio: p.preventa_precio,
      preventa_dias_antes: p.preventa_dias_antes,
    });
    this.editando.set(p);
    this.limpiarArchivo();
    this.limpiarTmdb();
    this.abierto.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cerrar() {
    this.limpiarArchivo();
    this.abierto.set(false);
  }

  alternarGenero(g: string) {
    const control = this.form.controls.generos;
    const lista = control.value;
    control.setValue(lista.includes(g) ? lista.filter((x) => x !== g) : [...lista, g]);
    control.markAsTouched();
  }

  // ── Búsqueda en TMDB ──

  buscarEnTmdb() {
    const texto = this.textoTmdb().trim();
    if (texto.length < 2) return;
    this.buscandoTmdb.set(true);
    const sub = this.tmdb.buscar(texto).subscribe({
      next: (lista) => {
        this.resultadosTmdb.set(lista);
        this.buscandoTmdb.set(false);
        if (!lista.length) this.toast.info('TMDB no encontró películas con ese nombre.');
      },
      error: () => {
        this.buscandoTmdb.set(false);
        this.toast.error('No se pudo consultar TMDB. Revisá la clave en environment.ts.');
      },
    });
    this.subsTmdb.push(sub);
  }

  /** Trae el detalle y completa el formulario; clasificación, estado y preventa los revisa el admin. */
  elegirDeTmdb(r: PeliculaTmdb) {
    const sub = this.tmdb.detalle(r.id).subscribe({
      next: (d) => {
        this.form.patchValue({
          titulo: d.titulo,
          sinopsis: d.sinopsis,
          duracion_min: d.duracion_min,
          generos: d.generos,
          clasificacion: d.clasificacion,
          fecha_estreno: d.fecha_estreno ? formatearFechaAR(d.fecha_estreno) : '',
        });
        this.limpiarArchivo();
        this.imagenTmdb.set(d.imagen_url);
        this.resultadosTmdb.set([]);
        this.toast.ok('Datos cargados desde TMDB. Revisalos antes de guardar.');
      },
      error: () => this.toast.error('No se pudo traer el detalle de TMDB.'),
    });
    this.subsTmdb.push(sub);
  }

  posterTmdb(r: PeliculaTmdb): string | null {
    return this.tmdb.urlPoster(r.poster_path);
  }

  private limpiarTmdb() {
    this.textoTmdb.set('');
    this.resultadosTmdb.set([]);
    this.imagenTmdb.set(null);
  }

  // ── Póster ──

  elegirArchivo(e: Event) {
    const input = e.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      this.toast.error('El archivo tiene que ser una imagen.');
      input.value = '';
      return;
    }
    // Antes de crear una URL nueva se libera la anterior para no perder memoria
    this.liberarVistaPrevia();
    this.archivo.set(archivo);
    this.vistaPrevia.set(URL.createObjectURL(archivo));
    input.value = ''; // permite volver a elegir el mismo archivo
  }

  limpiarArchivo() {
    this.liberarVistaPrevia();
    this.archivo.set(null);
  }

  private liberarVistaPrevia() {
    const url = this.vistaPrevia();
    if (url) URL.revokeObjectURL(url);
    this.vistaPrevia.set(null);
  }

  /** Lo que se ve en el recuadro: el archivo nuevo o la imagen que ya tenía la película. */
  imagenActual(): string | null {
    return this.vistaPrevia() ?? this.imagenTmdb() ?? this.editando()?.imagen_url ?? null;
  }

  // ── Guardar / eliminar ──

  async guardar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const anterior = this.editando();
    const datos: DatosPelicula = {
      titulo: v.titulo.trim(),
      sinopsis: v.sinopsis.trim(),
      duracion_min: Number(v.duracion_min),
      // Si no se sube archivo: el póster de TMDB o la imagen que ya tenía
      imagen_url: this.imagenTmdb() ?? anterior?.imagen_url ?? null,
      generos: v.generos,
      clasificacion: v.clasificacion,
      estado: v.estado,
      destacada: v.destacada,
      fecha_estreno: parsearFechaAR(v.fecha_estreno)!,
      preventa_habilitada: v.preventa_habilitada,
      preventa_precio: Number(v.preventa_precio),
      preventa_dias_antes: Number(v.preventa_dias_antes),
    };

    this.guardando.set(true);
    try {
      const p = anterior
        ? await this.peliculasService.actualizar(anterior, datos, this.archivo())
        : await this.peliculasService.crear(datos, this.archivo());
      this.toast.ok(`"${p.titulo}" guardada.`);
      this.cerrar();
      await this.cargar();
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(p: Pelicula) {
    if (!confirm(`¿Borrar "${p.titulo}" y sus funciones sin ventas?`)) return;
    try {
      await this.peliculasService.eliminar(p);
      this.toast.ok('Película borrada.');
      if (this.editando()?.id === p.id) this.cerrar();
      await this.cargar();
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  // ── Ayudas para el template ──

  textoEstado(e: EstadoPelicula): string {
    return this.estados.find((x) => x.valor === e)?.texto ?? e;
  }

  textoVenta(p: Pelicula): string {
    const ev = estadoVenta(p);
    if (ev.preventa) return `Preventa $${p.preventa_precio.toLocaleString('es-AR')}`;
    if (ev.abierta) return 'Abierta';
    if (ev.abreEl) return `Abre el ${ev.abreEl.toLocaleDateString('es-AR')}`;
    return 'Cerrada';
  }
}
