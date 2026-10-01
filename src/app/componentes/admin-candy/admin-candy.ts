import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Categoria, Combo, ItemCombo, Producto } from '../../models/models';
import { CandyService } from '../../services/candy-service';
import { ToastService } from '../../services/toast-service';
import { PesosPipe } from '../../pipes/pipes';

type Pestania = 'productos' | 'categorias' | 'combos';

@Component({
  selector: 'app-admin-candy',
  imports: [ReactiveFormsModule, PesosPipe],
  templateUrl: './admin-candy.html',
  styleUrl: './admin-candy.scss',
})
export class AdminCandy implements OnInit {
  private candy = inject(CandyService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  pestania = signal<Pestania>('productos');
  cargando = signal(true);

  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);
  combos = signal<Combo[]>([]);

  // Productos agrupados por categoría para el listado
  productosPorCategoria = computed(() =>
    this.categorias().map((c) => ({ categoria: c, productos: this.productos().filter((p) => p.categoria_id === c.id) })),
  );

  // En los combos solo se pueden incluir productos a la venta
  productosActivos = computed(() => this.productos().filter((p) => p.activo));

  // ─────────── Formularios ───────────

  categoriaEditando = signal<Categoria | null>(null);
  formCategoria = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(30)]],
  });

  mostrarFormProducto = signal(false);
  productoEditando = signal<Producto | null>(null);
  formProducto = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(40)]],
    categoria_id: [null as number | null, Validators.required],
    precio: [0, [Validators.required, Validators.min(1)]],
    activo: [true],
  });

  mostrarFormCombo = signal(false);
  comboEditando = signal<Combo | null>(null);
  formCombo = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(40)]],
    descripcion: ['', Validators.maxLength(120)],
    precio: [0, [Validators.required, Validators.min(1)]],
    destacado: [true],
    activo: [true],
  });
  // Los items del combo no son un campo simple: se manejan con una señal aparte
  items = signal<ItemCombo[]>([]);

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      const [categorias, productos, combos] = await Promise.all([this.candy.categorias(), this.candy.productos(), this.candy.combos()]);
      this.categorias.set(categorias);
      this.productos.set(productos);
      this.combos.set(combos);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  nombreProducto(id: number) {
    return this.productos().find((p) => p.id === id)?.nombre ?? 'Producto borrado';
  }

  // ─────────── Categorías ───────────

  editarCategoria(c: Categoria) {
    this.categoriaEditando.set(c);
    this.formCategoria.setValue({ nombre: c.nombre });
  }

  cancelarCategoria() {
    this.categoriaEditando.set(null);
    this.formCategoria.reset({ nombre: '' });
  }

  async guardarCategoria() {
    if (this.formCategoria.invalid) {
      this.formCategoria.markAllAsTouched();
      return;
    }
    const nombre = this.formCategoria.value.nombre!.trim();
    try {
      await this.candy.guardarCategoria(nombre, this.categoriaEditando()?.id);
      this.toast.ok('Categoría guardada.');
      this.cancelarCategoria();
      this.categorias.set(await this.candy.categorias());
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  async eliminarCategoria(c: Categoria) {
    if (!confirm(`¿Borrar la categoría ${c.nombre}?`)) return;
    try {
      await this.candy.eliminarCategoria(c);
      this.toast.ok('Categoría borrada.');
      this.categorias.set(await this.candy.categorias());
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  // ─────────── Productos ───────────

  nuevoProducto() {
    this.productoEditando.set(null);
    this.formProducto.reset({ nombre: '', categoria_id: null, precio: 0, activo: true });
    this.mostrarFormProducto.set(true);
  }

  editarProducto(p: Producto) {
    this.productoEditando.set(p);
    this.formProducto.setValue({ nombre: p.nombre, categoria_id: p.categoria_id, precio: p.precio, activo: p.activo });
    this.mostrarFormProducto.set(true);
  }

  cancelarProducto() {
    this.mostrarFormProducto.set(false);
    this.productoEditando.set(null);
  }

  async guardarProducto() {
    if (this.formProducto.invalid) {
      this.formProducto.markAllAsTouched();
      return;
    }
    const v = this.formProducto.getRawValue();
    const datos = { nombre: v.nombre!.trim(), categoria_id: v.categoria_id!, precio: Number(v.precio), activo: !!v.activo };
    try {
      await this.candy.guardarProducto(datos, this.productoEditando() ?? undefined);
      this.toast.ok('Producto guardado.');
      this.cancelarProducto();
      this.productos.set(await this.candy.productos());
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  async eliminarProducto(p: Producto) {
    if (!confirm(`¿Borrar ${p.nombre}?`)) return;
    try {
      await this.candy.eliminarProducto(p);
      this.toast.ok('Producto borrado.');
      this.productos.set(await this.candy.productos());
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  // ─────────── Combos ───────────

  nuevoCombo() {
    this.comboEditando.set(null);
    this.formCombo.reset({ nombre: '', descripcion: '', precio: 0, destacado: true, activo: true });
    this.items.set([]);
    this.mostrarFormCombo.set(true);
  }

  editarCombo(c: Combo) {
    this.comboEditando.set(c);
    this.formCombo.setValue({ nombre: c.nombre, descripcion: c.descripcion, precio: c.precio, destacado: c.destacado, activo: c.activo });
    // Copia de los items para no modificar el combo original hasta guardar
    this.items.set(c.items.map((i) => ({ ...i })));
    this.mostrarFormCombo.set(true);
  }

  cancelarCombo() {
    this.mostrarFormCombo.set(false);
    this.comboEditando.set(null);
  }

  cantidadEnCombo(productoId: number) {
    return this.items().find((i) => i.producto_id === productoId)?.cantidad ?? 0;
  }

  agregarItem(productoId: number) {
    const actual = this.cantidadEnCombo(productoId);
    if (actual >= 10) return;
    if (actual === 0) {
      this.items.update((lista) => [...lista, { producto_id: productoId, cantidad: 1 }]);
    } else {
      this.items.update((lista) => lista.map((i) => (i.producto_id === productoId ? { ...i, cantidad: i.cantidad + 1 } : i)));
    }
  }

  quitarItem(productoId: number) {
    const actual = this.cantidadEnCombo(productoId);
    if (actual <= 1) {
      this.items.update((lista) => lista.filter((i) => i.producto_id !== productoId));
    } else {
      this.items.update((lista) => lista.map((i) => (i.producto_id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i)));
    }
  }

  async guardarCombo() {
    if (this.formCombo.invalid) {
      this.formCombo.markAllAsTouched();
      return;
    }
    if (this.items().length === 0) {
      this.toast.error('El combo necesita al menos un producto.');
      return;
    }
    const v = this.formCombo.getRawValue();
    const datos = {
      nombre: v.nombre!.trim(),
      descripcion: (v.descripcion ?? '').trim(),
      precio: Number(v.precio),
      items: this.items(),
      destacado: !!v.destacado,
      activo: !!v.activo,
    };
    try {
      await this.candy.guardarCombo(datos, this.comboEditando() ?? undefined);
      this.toast.ok('Combo guardado.');
      this.cancelarCombo();
      this.combos.set(await this.candy.combos());
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  async eliminarCombo(c: Combo) {
    if (!confirm(`¿Borrar el combo ${c.nombre}?`)) return;
    try {
      await this.candy.eliminarCombo(c);
      this.toast.ok('Combo borrado.');
      this.combos.set(await this.candy.combos());
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  detalleCombo(c: Combo) {
    return c.items.map((i) => `${i.cantidad}× ${this.nombreProducto(i.producto_id)}`).join(' · ');
  }
}
