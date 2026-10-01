import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Clasificacion, EstadoPelicula, GENEROS, Pelicula } from '../../core/models/models';
import { PeliculasService } from '../../core/services/peliculas.service';
import { ToastService } from '../../core/services/toast.service';
import { formatearFechaAR, parsearFechaAR } from '../../core/utils/fechas';
import { estadoVenta } from '../../core/utils/negocio';
import { fechaARValida } from '../../core/utils/validadores';
import { BuscarPeliculasPipe, DuracionPipe, FechaARPipe, PesosPipe } from '../../shared/pipes/pipes';
import { ImagenRespaldoDirective, MascaraFechaDirective } from '../../shared/directives/directivas';

@Component({
  selector: 'app-peliculas-admin',
  imports: [AsyncPipe, ReactiveFormsModule, FormsModule, DuracionPipe, FechaARPipe, BuscarPeliculasPipe, ImagenRespaldoDirective, MascaraFechaDirective],
  template: `
    <header class="cabecera-pagina">
      <div><h1>Películas</h1><p>Qué se proyecta, qué aparece destacado en la portada, estrenos y preventas.</p></div>
      @if (!abierto) { <button type="button" class="btn btn-primario" (click)="nueva()">Nueva película</button> }
    </header>

    @if (abierto) {
      <form class="panel editor" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <h2>{{ form.value.id ? 'Editar película' : 'Nueva película' }}</h2>
        <div class="con-poster">
          <div class="poster">
            <img [src]="form.value.imagenUrl || 'posters/sin-poster.svg'" alt="Vista previa del póster" appImagenRespaldo />
            <label class="btn btn-chico btn-bloque">Subir imagen<input type="file" accept="image/*" (change)="subirImagen($event)" hidden /></label>
          </div>
          <div class="form-grilla">
            <div class="campo ancho">
              <label for="titulo">Nombre</label>
              <input id="titulo" formControlName="titulo" />
              @if (form.controls.titulo.touched && form.controls.titulo.invalid) { <span class="error">Obligatorio.</span> }
            </div>
            <div class="campo ancho">
              <label for="sinopsis">Sinopsis</label>
              <textarea id="sinopsis" formControlName="sinopsis" rows="4" maxlength="600"></textarea>
              @if (form.controls.sinopsis.touched && form.controls.sinopsis.invalid) { <span class="error">Escribí una sinopsis (mín. 20 caracteres).</span> }
            </div>
            <div class="campo">
              <label for="duracion">Duración (minutos)</label>
              <input id="duracion" type="number" min="30" max="300" formControlName="duracionMin" inputmode="numeric" />
              <span class="ayuda">{{ form.value.duracionMin | duracion }} · define el fin de cada función</span>
            </div>
            <div class="campo">
              <label for="estreno">Fecha de estreno</label>
              <input id="estreno" formControlName="fechaEstreno" appMascaraFecha="dd/mm/aaaa" inputmode="numeric" placeholder="dd/mm/aaaa" />
              @if (form.controls.fechaEstreno.touched && form.controls.fechaEstreno.invalid) { <span class="error">Fecha inválida.</span> }
            </div>
            <div class="campo ancho">
              <label for="img">URL de la imagen</label>
              <input id="img" formControlName="imagenUrl" placeholder="posters/mi-pelicula.svg o https://…" />
            </div>
            <div class="campo ancho">
              <span class="etiqueta-campo">Géneros (podés elegir varios)</span>
              <div class="chips">
                @for (g of generos; track g) {
                  <button type="button" class="chip" [class.activo]="generosElegidos.includes(g)" [attr.aria-pressed]="generosElegidos.includes(g)" (click)="alternarGenero(g)">{{ g }}</button>
                }
              </div>
              @if (intentoGuardar && !generosElegidos.length) { <span class="error">Elegí al menos un género.</span> }
            </div>
            <div class="campo">
              <span class="etiqueta-campo">Clasificación</span>
              <div class="chips">
                @for (c of clasificaciones; track c) {
                  <button type="button" class="chip" [class.activo]="form.value.clasificacion === c" (click)="form.controls.clasificacion.setValue(c)">{{ c }}</button>
                }
              </div>
            </div>
            <div class="campo">
              <span class="etiqueta-campo">Estado</span>
              <div class="chips">
                @for (e of estados; track e.valor) {
                  <button type="button" class="chip" [class.activo]="form.value.estado === e.valor" (click)="form.controls.estado.setValue(e.valor)">{{ e.texto }}</button>
                }
              </div>
            </div>
            <label class="check ancho campo"><input type="checkbox" formControlName="destacada" /> Destacada en la página principal (además del top 3 de ventas)</label>

            <fieldset class="ancho preventa">
              <legend><label class="check"><input type="checkbox" formControlName="preventaHabilitada" /> Preventa</label></legend>
              <p class="suave chico">Abre la venta antes del estreno con un precio especial por entrada. Al llegar el estreno vuelve el precio normal de cada función.</p>
              <div class="form-grilla">
                <div class="campo">
                  <label for="pvprecio">Precio de preventa</label>
                  <input id="pvprecio" type="number" min="0" formControlName="preventaPrecio" />
                </div>
                <div class="campo">
                  <label for="pvdias">Días antes del estreno</label>
                  <input id="pvdias" type="number" min="1" max="30" formControlName="preventaDias" />
                </div>
              </div>
            </fieldset>
          </div>
        </div>
        <div class="pie">
          <button type="submit" class="btn btn-primario">Guardar</button>
          <button type="button" class="btn" (click)="cerrar()">Cancelar</button>
        </div>
      </form>
    }

    <section class="panel">
      <div class="filtros">
        <input type="search" [(ngModel)]="texto" placeholder="Buscar por nombre…" aria-label="Buscar película" />
        <div class="chips">
          <button type="button" class="chip" [class.activo]="filtroEstado === ''" (click)="filtroEstado = ''">Todas</button>
          @for (e of estados; track e.valor) {
            <button type="button" class="chip" [class.activo]="filtroEstado === e.valor" (click)="filtroEstado = e.valor">{{ e.texto }}</button>
          }
        </div>
      </div>
      @if (peliculas.peliculas$ | async; as lista) {
        <div class="tabla-scroll">
          <table class="tabla">
            <thead><tr><th></th><th>Película</th><th>Estreno</th><th>Estado</th><th>Venta</th><th></th></tr></thead>
            <tbody>
              @for (p of filtrar(lista) | buscarPeliculas: texto : []; track p.id) {
                <tr>
                  <td><img class="mini" [src]="p.imagenUrl" alt="" appImagenRespaldo loading="lazy" /></td>
                  <td>
                    <strong>{{ p.titulo }}</strong>
                    @if (p.destacada) { <span class="etiqueta laton">Destacada</span> }
                    <div class="suave chico">{{ p.duracionMin | duracion }} · {{ p.clasificacion }} · {{ p.generos.join(', ') }}</div>
                  </td>
                  <td>{{ p.fechaEstreno | fechaAR }}</td>
                  <td><span class="etiqueta" [class.ok]="p.estado === 'cartelera'" [class.acceso]="p.estado === 'proximamente'">{{ textoEstado(p.estado) }}</span></td>
                  <td class="chico">{{ textoVenta(p) }}</td>
                  <td><div class="acciones">
                    <button type="button" class="btn btn-chico" (click)="editar(p)">Editar</button>
                    <button type="button" class="btn btn-chico btn-peligro" (click)="eliminar(p)">Borrar</button>
                  </div></td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="suave">No hay películas con ese filtro.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: grid; gap: 20px; }
    h2 { margin: 0 0 16px; font-size: var(--t-xl); }
    .con-poster { display: grid; grid-template-columns: 180px 1fr; gap: 24px; }
    .poster { display: flex; flex-direction: column; gap: 10px; }
    .poster img { aspect-ratio: 2 / 3; object-fit: cover; border-radius: var(--r-s); border: 1px solid var(--linea); }
    .poster label { cursor: pointer; }
    .preventa { border: 1px solid var(--linea); border-radius: var(--r-m); padding: 12px 16px 16px; }
    .preventa legend { padding: 0 6px; font-weight: 700; }
    .pie { display: flex; gap: 10px; margin-top: 22px; }
    .filtros { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 14px; }
    .filtros input { max-width: 280px; }
    .mini { width: 40px; height: 60px; object-fit: cover; border-radius: 3px; }
    td strong { margin-right: 6px; }
    @media (max-width: 720px) { .con-poster { grid-template-columns: 1fr; } .poster { max-width: 180px; } }
  `,
})
export class PeliculasAdminComponent {
  readonly peliculas = inject(PeliculasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly generos = GENEROS;
  readonly clasificaciones: Clasificacion[] = ['ATP', '+13', '+18'];
  readonly estados: { valor: EstadoPelicula; texto: string }[] = [
    { valor: 'cartelera', texto: 'En cartelera' },
    { valor: 'proximamente', texto: 'Próximamente' },
    { valor: 'inactiva', texto: 'Inactiva' },
  ];

  abierto = false;
  intentoGuardar = false;
  generosElegidos: string[] = [];
  texto = '';
  filtroEstado: EstadoPelicula | '' = '';

  readonly form = this.fb.nonNullable.group({
    id: [''],
    titulo: ['', [Validators.required, Validators.maxLength(80)]],
    sinopsis: ['', [Validators.required, Validators.minLength(20)]],
    duracionMin: [110, [Validators.required, Validators.min(30), Validators.max(300)]],
    imagenUrl: [''],
    fechaEstreno: ['', [Validators.required, fechaARValida]],
    clasificacion: ['ATP' as Clasificacion],
    estado: ['cartelera' as EstadoPelicula],
    destacada: [false],
    preventaHabilitada: [false],
    preventaPrecio: [5000, [Validators.min(0)]],
    preventaDias: [7, [Validators.min(1), Validators.max(30)]],
  });

  filtrar(l: Pelicula[]) {
    return this.filtroEstado ? l.filter((p) => p.estado === this.filtroEstado) : l;
  }

  nueva() {
    this.form.reset();
    this.generosElegidos = [];
    this.intentoGuardar = false;
    this.abierto = true;
  }

  editar(p: Pelicula) {
    this.form.setValue({
      id: p.id,
      titulo: p.titulo,
      sinopsis: p.sinopsis,
      duracionMin: p.duracionMin,
      imagenUrl: p.imagenUrl,
      fechaEstreno: formatearFechaAR(p.fechaEstreno),
      clasificacion: p.clasificacion,
      estado: p.estado,
      destacada: p.destacada,
      preventaHabilitada: p.preventa.habilitada,
      preventaPrecio: p.preventa.precio,
      preventaDias: p.preventa.diasAntes,
    });
    this.generosElegidos = [...p.generos];
    this.intentoGuardar = false;
    this.abierto = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cerrar() {
    this.abierto = false;
  }

  alternarGenero(g: string) {
    this.generosElegidos = this.generosElegidos.includes(g) ? this.generosElegidos.filter((x) => x !== g) : [...this.generosElegidos, g];
  }

  subirImagen(e: Event) {
    const archivo = (e.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    if (archivo.size > 700_000) {
      this.toast.error('La imagen supera los 700 KB. Usá una más liviana o pegá una URL.');
      return;
    }
    const lector = new FileReader();
    lector.onload = () => this.form.controls.imagenUrl.setValue(String(lector.result));
    lector.readAsDataURL(archivo);
  }

  guardar() {
    this.intentoGuardar = true;
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.generosElegidos.length) return;
    const v = this.form.getRawValue();
    this.peliculas
      .guardar({
        ...(v.id ? { id: v.id } : {}),
        titulo: v.titulo.trim(),
        sinopsis: v.sinopsis.trim(),
        duracionMin: Number(v.duracionMin),
        imagenUrl: v.imagenUrl.trim() || 'posters/sin-poster.svg',
        generos: this.generosElegidos,
        clasificacion: v.clasificacion,
        estado: v.estado,
        destacada: v.destacada,
        fechaEstreno: parsearFechaAR(v.fechaEstreno)!,
        preventa: { habilitada: v.preventaHabilitada, precio: Number(v.preventaPrecio), diasAntes: Number(v.preventaDias) },
      })
      .subscribe((p) => {
        this.toast.ok(`"${p.titulo}" guardada.`);
        this.abierto = false;
      });
  }

  eliminar(p: Pelicula) {
    if (!confirm(`¿Borrar "${p.titulo}" y sus funciones sin ventas?`)) return;
    this.peliculas.eliminar(p.id).subscribe({ next: () => this.toast.ok('Película borrada.'), error: (e: Error) => this.toast.error(e.message) });
  }

  textoEstado(e: EstadoPelicula) {
    return this.estados.find((x) => x.valor === e)?.texto ?? e;
  }

  textoVenta(p: Pelicula) {
    const ev = estadoVenta(p);
    if (ev.preventa) return `Preventa $${p.preventa.precio.toLocaleString('es-AR')}`;
    if (ev.abierta) return 'Abierta';
    if (ev.abreEl) return `Abre el ${ev.abreEl.toLocaleDateString('es-AR')}`;
    return 'Cerrada';
  }
}
