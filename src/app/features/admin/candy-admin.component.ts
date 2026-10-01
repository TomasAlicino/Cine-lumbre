import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Categoria, Combo, Producto } from '../../core/models/models';
import { CandyService } from '../../core/services/candy.service';
import { ToastService } from '../../core/services/toast.service';
import { PesosPipe } from '../../shared/pipes/pipes';

type Borrador<T> = Omit<T, 'id'> & { id?: string };

@Component({
  selector: 'app-candy-admin',
  imports: [AsyncPipe, FormsModule, PesosPipe],
  template: `
    <header class="cabecera-pagina">
      <div><h1>Candy bar</h1><p>Productos por categoría y combos (entrada + pochoclos + bebida) que aparecen destacados al comprar.</p></div>
    </header>

    <nav class="chips" aria-label="Secciones del candy">
      <button type="button" class="chip" [class.activo]="tab === 'productos'" (click)="tab = 'productos'">Productos</button>
      <button type="button" class="chip" [class.activo]="tab === 'categorias'" (click)="tab = 'categorias'">Categorías</button>
      <button type="button" class="chip" [class.activo]="tab === 'combos'" (click)="tab = 'combos'">Combos</button>
    </nav>

    @switch (tab) {
      @case ('categorias') {
        <section class="panel">
          <form class="en-linea" (ngSubmit)="guardarCategoria()">
            <input [(ngModel)]="categoria.nombre" name="cat" placeholder="Nombre de la categoría" maxlength="30" aria-label="Nombre de la categoría" />
            <button type="submit" class="btn btn-primario">{{ categoria.id ? 'Guardar' : 'Agregar' }}</button>
            @if (categoria.id) { <button type="button" class="btn" (click)="categoria = { nombre: '' }">Cancelar</button> }
          </form>
          <table class="tabla">
            <tbody>
              @for (c of candy.categorias$ | async; track c.id) {
                <tr><td>{{ c.nombre }}</td><td><div class="acciones">
                  <button type="button" class="btn btn-chico" (click)="categoria = { id: c.id, nombre: c.nombre }">Editar</button>
                  <button type="button" class="btn btn-chico btn-peligro" (click)="eliminarCategoria(c)">Borrar</button>
                </div></td></tr>
              }
            </tbody>
          </table>
        </section>
      }

      @case ('productos') {
        @if (producto) {
          <form class="panel" (ngSubmit)="guardarProducto()">
            <h2>{{ producto.id ? 'Editar producto' : 'Nuevo producto' }}</h2>
            <div class="form-grilla">
              <div class="campo"><label for="pn">Nombre</label><input id="pn" [(ngModel)]="producto.nombre" name="pn" maxlength="40" /></div>
              <div class="campo">
                <label for="pc">Categoría</label>
                <select id="pc" [(ngModel)]="producto.categoriaId" name="pc">
                  @for (c of candy.categorias$ | async; track c.id) { <option [value]="c.id">{{ c.nombre }}</option> }
                </select>
              </div>
              <div class="campo"><label for="pp">Precio</label><input id="pp" type="number" min="0" [(ngModel)]="producto.precio" name="pp" /></div>
              <label class="check campo"><input type="checkbox" [(ngModel)]="producto.activo" name="pa" /> A la venta</label>
            </div>
            <div class="pie"><button type="submit" class="btn btn-primario">Guardar</button><button type="button" class="btn" (click)="producto = null">Cancelar</button></div>
          </form>
        }
        <section class="panel">
          <div class="titulo-fila"><h2>Productos</h2><button type="button" class="btn btn-chico btn-primario" (click)="nuevoProducto()">Nuevo producto</button></div>
          @if (candy.categorias$ | async; as cats) {
            <div class="tabla-scroll">
              <table class="tabla">
                <thead><tr><th>Producto</th><th>Categoría</th><th class="num">Precio</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  @for (p of candy.productos$ | async; track p.id) {
                    <tr>
                      <td>{{ p.nombre }}</td>
                      <td>{{ nombreCategoria(cats, p.categoriaId) }}</td>
                      <td class="num">{{ p.precio | pesos }}</td>
                      <td>@if (p.activo) { <span class="etiqueta ok">A la venta</span> } @else { <span class="etiqueta">Pausado</span> }</td>
                      <td><div class="acciones">
                        <button type="button" class="btn btn-chico" (click)="producto = { ...p }">Editar</button>
                        <button type="button" class="btn btn-chico btn-peligro" (click)="eliminarProducto(p)">Borrar</button>
                      </div></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }

      @case ('combos') {
        @if (combo) {
          <form class="panel" (ngSubmit)="guardarCombo()">
            <h2>{{ combo.id ? 'Editar combo' : 'Nuevo combo' }}</h2>
            <div class="form-grilla">
              <div class="campo"><label for="cn">Nombre</label><input id="cn" [(ngModel)]="combo.nombre" name="cn" maxlength="40" /></div>
              <div class="campo"><label for="cp">Precio fijo (incluye 1 entrada)</label><input id="cp" type="number" min="0" [(ngModel)]="combo.precio" name="cp" /></div>
              <div class="campo ancho"><label for="cd">Descripción</label><input id="cd" [(ngModel)]="combo.descripcion" name="cd" maxlength="120" /></div>
              <div class="campo ancho">
                <span class="etiqueta-campo">Productos incluidos (además de la entrada)</span>
                <div class="incluidos">
                  @for (p of candy.productosActivos$ | async; track p.id) {
                    <div class="incluido" [class.con]="cantidadEnCombo(p.id) > 0">
                      <span>{{ p.nombre }}</span>
                      <div class="contador">
                        <button type="button" (click)="cambiarCantidad(p.id, -1)" [attr.aria-label]="'Quitar ' + p.nombre">−</button>
                        <strong>{{ cantidadEnCombo(p.id) }}</strong>
                        <button type="button" (click)="cambiarCantidad(p.id, 1)" [attr.aria-label]="'Agregar ' + p.nombre">+</button>
                      </div>
                    </div>
                  }
                </div>
              </div>
              <label class="check campo"><input type="checkbox" [(ngModel)]="combo.destacado" name="cdes" /> Destacado en la compra</label>
              <label class="check campo"><input type="checkbox" [(ngModel)]="combo.activo" name="cact" /> A la venta</label>
            </div>
            <div class="pie"><button type="submit" class="btn btn-primario">Guardar</button><button type="button" class="btn" (click)="combo = null">Cancelar</button></div>
          </form>
        }
        <section class="panel">
          <div class="titulo-fila"><h2>Combos</h2><button type="button" class="btn btn-chico btn-primario" (click)="nuevoCombo()">Nuevo combo</button></div>
          <div class="combos">
            @for (c of candy.combos$ | async; track c.id) {
              <article class="combo" [class.pausado]="!c.activo">
                @if (c.destacado) { <span class="etiqueta laton">Destacado</span> }
                <h3>{{ c.nombre }}</h3>
                <p class="suave chico">1 entrada · {{ detalleCombo(c) }}</p>
                <strong class="precio">{{ c.precio | pesos }}</strong>
                <div class="acciones">
                  <button type="button" class="btn btn-chico" (click)="editarCombo(c)">Editar</button>
                  <button type="button" class="btn btn-chico btn-peligro" (click)="eliminarCombo(c)">Borrar</button>
                </div>
              </article>
            } @empty {
              <p class="suave">Todavía no hay combos.</p>
            }
          </div>
        </section>
      }
    }
  `,
  styles: `
    :host { display: grid; gap: 20px; }
    h2 { margin: 0 0 14px; font-size: var(--t-xl); }
    .titulo-fila { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; }
    .titulo-fila h2 { margin: 0; }
    .en-linea { display: flex; gap: 10px; margin-bottom: 16px; max-width: 520px; }
    .pie { display: flex; gap: 10px; margin-top: 18px; }
    .incluidos { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
    .incluido { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid var(--linea); border-radius: var(--r-s); font-size: var(--t-s); }
    .incluido.con { border-color: var(--laton); }
    .contador { display: flex; align-items: center; gap: 8px; }
    .contador button { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--linea); background: var(--noche); color: var(--pantalla); cursor: pointer; font-size: 16px; }
    .contador strong { min-width: 16px; text-align: center; }
    .combos { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
    .combo { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; padding: 16px; border: 1px solid var(--linea); border-radius: var(--r-m); background: var(--noche); }
    .combo.pausado { opacity: .55; }
    .combo h3 { margin: 0; font-size: var(--t-l); }
    .combo p { margin: 0; }
    .precio { font: 800 var(--t-2xl) / 1 var(--f-display); color: var(--laton); }
    .acciones { display: flex; gap: 6px; margin-top: 6px; }
  `,
})
export class CandyAdminComponent {
  readonly candy = inject(CandyService);
  private readonly toast = inject(ToastService);

  tab: 'productos' | 'categorias' | 'combos' = 'productos';
  categoria: Borrador<Categoria> = { nombre: '' };
  producto: Borrador<Producto> | null = null;
  combo: Borrador<Combo> | null = null;

  nombreCategoria(cats: Categoria[], id: string) {
    return cats.find((c) => c.id === id)?.nombre ?? '—';
  }

  guardarCategoria() {
    if (!this.categoria.nombre.trim()) return;
    this.candy.guardarCategoria({ ...this.categoria, nombre: this.categoria.nombre.trim() }).subscribe(() => {
      this.toast.ok('Categoría guardada.');
      this.categoria = { nombre: '' };
    });
  }

  eliminarCategoria(c: Categoria) {
    if (!confirm(`¿Borrar la categoría ${c.nombre}?`)) return;
    this.candy.eliminarCategoria(c.id).subscribe({ next: () => this.toast.ok('Categoría borrada.'), error: (e: Error) => this.toast.error(e.message) });
  }

  nuevoProducto() {
    this.producto = { nombre: '', categoriaId: '', precio: 0, activo: true };
  }

  guardarProducto() {
    const p = this.producto;
    if (!p || !p.nombre.trim() || !p.categoriaId || p.precio <= 0) {
      this.toast.error('Completá nombre, categoría y un precio mayor a 0.');
      return;
    }
    this.candy.guardarProducto({ ...p, nombre: p.nombre.trim(), precio: Number(p.precio) }).subscribe(() => {
      this.toast.ok('Producto guardado.');
      this.producto = null;
    });
  }

  eliminarProducto(p: Producto) {
    if (!confirm(`¿Borrar ${p.nombre}?`)) return;
    this.candy.eliminarProducto(p.id).subscribe({ next: () => this.toast.ok('Producto borrado.'), error: (e: Error) => this.toast.error(e.message) });
  }

  nuevoCombo() {
    this.combo = { nombre: '', descripcion: '', precio: 0, items: [], destacado: true, activo: true };
  }

  editarCombo(c: Combo) {
    this.combo = { ...c, items: c.items.map((i) => ({ ...i })) };
  }

  cantidadEnCombo(productoId: string) {
    return this.combo?.items.find((i) => i.productoId === productoId)?.cantidad ?? 0;
  }

  cambiarCantidad(productoId: string, delta: number) {
    if (!this.combo) return;
    const actual = this.cantidadEnCombo(productoId);
    const nueva = Math.max(0, Math.min(10, actual + delta));
    const resto = this.combo.items.filter((i) => i.productoId !== productoId);
    this.combo.items = nueva ? [...resto, { productoId, cantidad: nueva }] : resto;
  }

  guardarCombo() {
    const c = this.combo;
    if (!c || !c.nombre.trim() || c.precio <= 0 || !c.items.length) {
      this.toast.error('El combo necesita nombre, precio y al menos un producto.');
      return;
    }
    this.candy.guardarCombo({ ...c, nombre: c.nombre.trim(), precio: Number(c.precio) }).subscribe(() => {
      this.toast.ok('Combo guardado.');
      this.combo = null;
    });
  }

  eliminarCombo(c: Combo) {
    if (!confirm(`¿Borrar el combo ${c.nombre}?`)) return;
    this.candy.eliminarCombo(c.id).subscribe(() => this.toast.ok('Combo borrado.'));
  }

  detalleCombo(c: Combo) {
    return c.items.map((i) => `${i.cantidad}× ${this.candy.nombreProducto(i.productoId)}`).join(' · ');
  }
}
