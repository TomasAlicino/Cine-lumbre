import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { Cupon, Recompensa, Rol, Usuario } from '../../core/models/models';
import { CuponesService } from '../../core/services/cupones.service';
import { FidelizacionService } from '../../core/services/fidelizacion.service';
import { CandyService } from '../../core/services/candy.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { ActividadService } from '../../core/services/actividad.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { AuthService } from '../../core/services/auth.service';
import { DemoService } from '../../core/services/demo.service';
import { ToastService } from '../../core/services/toast.service';
import { edad } from '../../core/utils/fechas';
import { PesosPipe } from '../../shared/pipes/pipes';

type Borrador<T> = Omit<T, 'id'> & { id?: string };

const ESTILOS_BASE = `
  :host { display: grid; gap: 20px; }
  h2 { margin: 0 0 14px; font-size: var(--t-xl); }
  .titulo-fila { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
  .titulo-fila h2 { margin: 0; }
  .pie { display: flex; gap: 10px; margin-top: 18px; }
`;

// ─────────────────────────────── Cupones ───────────────────────────────

@Component({
  selector: 'app-cupones-admin',
  imports: [AsyncPipe, FormsModule],
  template: `
    <header class="cabecera-pagina">
      <div><h1>Cupones</h1><p>Descuentos por código. Podés limitarlos a clientes registrados de más de cierta edad (por ejemplo, mayores de 50).</p></div>
    </header>
    @if (editando) {
      <form class="panel" (ngSubmit)="guardar()">
        <h2>{{ editando.id ? 'Editar cupón' : 'Nuevo cupón' }}</h2>
        <div class="form-grilla">
          <div class="campo"><label for="cc">Código</label><input id="cc" [(ngModel)]="editando.codigo" name="cc" maxlength="20" style="text-transform: uppercase" /></div>
          <div class="campo"><label for="cp">Descuento (%)</label><input id="cp" type="number" min="1" max="100" [(ngModel)]="editando.porcentaje" name="cp" /></div>
          <div class="campo">
            <span class="etiqueta-campo">¿Quién lo puede usar?</span>
            <div class="chips">
              <button type="button" class="chip" [class.activo]="editando.soloMayoresDe === null" (click)="editando.soloMayoresDe = null">Todos</button>
              <button type="button" class="chip" [class.activo]="editando.soloMayoresDe !== null" (click)="editando.soloMayoresDe = editando.soloMayoresDe ?? 50">Solo mayores de…</button>
            </div>
          </div>
          @if (editando.soloMayoresDe !== null) {
            <div class="campo"><label for="ce">Más de (años)</label><input id="ce" type="number" min="1" max="100" [(ngModel)]="editando.soloMayoresDe" name="ce" /></div>
          }
          <label class="check campo"><input type="checkbox" [(ngModel)]="editando.activo" name="ca" /> Vigente</label>
        </div>
        <div class="pie"><button type="submit" class="btn btn-primario">Guardar</button><button type="button" class="btn" (click)="editando = null">Cancelar</button></div>
      </form>
    }
    <section class="panel">
      <div class="titulo-fila"><h2>Cupones</h2><button type="button" class="btn btn-chico btn-primario" (click)="nuevo()">Nuevo cupón</button></div>
      <p class="suave chico">El cupón de bienvenida (primera compra) se configura en <strong>Configuración</strong>. Se aplica un solo cupón por compra.</p>
      <div class="tabla-scroll">
        <table class="tabla">
          <thead><tr><th>Código</th><th class="num">Descuento</th><th>Restricción</th><th class="num">Usos</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (c of cupones.cupones$ | async; track c.id) {
              <tr>
                <td><code>{{ c.codigo }}</code></td>
                <td class="num">{{ c.porcentaje }}%</td>
                <td>{{ c.soloMayoresDe !== null ? 'Más de ' + c.soloMayoresDe + ' años' : 'Todos' }}</td>
                <td class="num">{{ c.usos }}</td>
                <td>@if (c.activo) { <span class="etiqueta ok">Vigente</span> } @else { <span class="etiqueta">Pausado</span> }</td>
                <td><div class="acciones">
                  <button type="button" class="btn btn-chico" (click)="editando = { ...c }">Editar</button>
                  <button type="button" class="btn btn-chico btn-peligro" (click)="eliminar(c)">Borrar</button>
                </div></td>
              </tr>
            } @empty { <tr><td colspan="6" class="suave">No hay cupones.</td></tr> }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: ESTILOS_BASE,
})
export class CuponesAdminComponent {
  readonly cupones = inject(CuponesService);
  private readonly toast = inject(ToastService);
  editando: Borrador<Cupon> | null = null;

  nuevo() {
    this.editando = { codigo: '', porcentaje: 10, soloMayoresDe: null, activo: true, usos: 0 };
  }

  guardar() {
    const c = this.editando;
    if (!c || !/^[A-Za-z0-9]{3,20}$/.test(c.codigo.trim())) { this.toast.error('El código debe tener de 3 a 20 letras o números, sin espacios.'); return; }
    if (c.porcentaje < 1 || c.porcentaje > 100) { this.toast.error('El descuento debe estar entre 1 y 100%.'); return; }
    this.cupones.guardar({ ...c, porcentaje: Number(c.porcentaje), soloMayoresDe: c.soloMayoresDe === null ? null : Number(c.soloMayoresDe) }).subscribe({
      next: () => { this.toast.ok('Cupón guardado.'); this.editando = null; },
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  eliminar(c: Cupon) {
    if (confirm(`¿Borrar el cupón ${c.codigo}?`)) this.cupones.eliminar(c.id).subscribe(() => this.toast.ok('Cupón borrado.'));
  }
}

// ─────────────────────────────── Fidelización ───────────────────────────────

@Component({
  selector: 'app-recompensas-admin',
  imports: [AsyncPipe, FormsModule],
  template: `
    <header class="cabecera-pagina">
      <div><h1>Fidelización</h1><p>Los clientes registrados suman 1 punto por cada peso pagado. Acá definís cuántos puntos cuesta cada recompensa.</p></div>
    </header>
    @if (editando) {
      <form class="panel" (ngSubmit)="guardar()">
        <h2>{{ editando.id ? 'Editar recompensa' : 'Nueva recompensa' }}</h2>
        <div class="form-grilla">
          <div class="campo"><label for="rn">Nombre</label><input id="rn" [(ngModel)]="editando.nombre" name="rn" maxlength="40" /></div>
          <div class="campo">
            <span class="etiqueta-campo">Tipo</span>
            <div class="chips">
              <button type="button" class="chip" [class.activo]="editando.tipo === 'entrada'" (click)="editando.tipo = 'entrada'; editando.productoId = null">Entrada gratis</button>
              <button type="button" class="chip" [class.activo]="editando.tipo === 'producto'" (click)="editando.tipo = 'producto'">Producto del candy</button>
            </div>
          </div>
          @if (editando.tipo === 'producto') {
            <div class="campo">
              <label for="rp">Producto</label>
              <select id="rp" [(ngModel)]="editando.productoId" name="rp">
                @for (p of candy.productos$ | async; track p.id) { <option [value]="p.id">{{ p.nombre }}</option> }
              </select>
            </div>
          }
          <div class="campo"><label for="rc">Costo en puntos</label><input id="rc" type="number" min="1" [(ngModel)]="editando.costoPuntos" name="rc" /></div>
          <label class="check campo"><input type="checkbox" [(ngModel)]="editando.activa" name="ra" /> Disponible</label>
        </div>
        <div class="pie"><button type="submit" class="btn btn-primario">Guardar</button><button type="button" class="btn" (click)="editando = null">Cancelar</button></div>
      </form>
    }
    <section class="panel">
      <div class="titulo-fila"><h2>Recompensas</h2><button type="button" class="btn btn-chico btn-primario" (click)="nueva()">Nueva recompensa</button></div>
      <div class="tabla-scroll">
        <table class="tabla">
          <thead><tr><th>Recompensa</th><th>Tipo</th><th class="num">Puntos</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (r of fide.recompensas$ | async; track r.id) {
              <tr>
                <td>{{ r.nombre }}</td>
                <td>{{ r.tipo === 'entrada' ? 'Entrada (cualquier butaca)' : candy.nombreProducto(r.productoId ?? '') }}</td>
                <td class="num">{{ r.costoPuntos.toLocaleString('es-AR') }}</td>
                <td>@if (r.activa) { <span class="etiqueta ok">Disponible</span> } @else { <span class="etiqueta">Pausada</span> }</td>
                <td><div class="acciones">
                  <button type="button" class="btn btn-chico" (click)="editando = { ...r }">Editar</button>
                  <button type="button" class="btn btn-chico btn-peligro" (click)="eliminar(r)">Borrar</button>
                </div></td>
              </tr>
            } @empty { <tr><td colspan="5" class="suave">No hay recompensas.</td></tr> }
          </tbody>
        </table>
      </div>
      <p class="suave chico">Los puntos son personales: no se pueden transferir entre usuarios. Si un cliente cancela una compra, recupera los puntos canjeados y se le descuentan los ganados.</p>
    </section>
  `,
  styles: ESTILOS_BASE,
})
export class RecompensasAdminComponent {
  readonly fide = inject(FidelizacionService);
  readonly candy = inject(CandyService);
  private readonly toast = inject(ToastService);
  editando: Borrador<Recompensa> | null = null;

  nueva() {
    this.editando = { nombre: '', tipo: 'entrada', productoId: null, costoPuntos: 500, activa: true };
  }

  guardar() {
    const r = this.editando;
    if (!r || !r.nombre.trim() || r.costoPuntos < 1 || (r.tipo === 'producto' && !r.productoId)) {
      this.toast.error('Completá nombre, costo en puntos y el producto si corresponde.');
      return;
    }
    this.fide.guardar({ ...r, nombre: r.nombre.trim(), costoPuntos: Number(r.costoPuntos) }).subscribe(() => {
      this.toast.ok('Recompensa guardada.');
      this.editando = null;
    });
  }

  eliminar(r: Recompensa) {
    if (confirm(`¿Borrar "${r.nombre}"?`)) this.fide.eliminar(r.id).subscribe(() => this.toast.ok('Recompensa borrada.'));
  }
}

// ─────────────────────────────── Usuarios ───────────────────────────────

@Component({
  selector: 'app-usuarios-admin',
  imports: [AsyncPipe, FormsModule, PesosPipe],
  template: `
    <header class="cabecera-pagina">
      <div><h1>Usuarios</h1><p>Asigná el rol de empleado a quienes validan entradas en la puerta y en el candy bar.</p></div>
    </header>
    <section class="panel">
      <div class="titulo-fila">
        <input type="search" [ngModel]="texto$.value" (ngModelChange)="texto$.next($event)" placeholder="Buscar por nombre o mail…" aria-label="Buscar usuario" class="buscar" />
        <div class="chips">
          @for (r of filtrosRol; track r.valor) {
            <button type="button" class="chip" [class.activo]="rol$.value === r.valor" (click)="rol$.next(r.valor)">{{ r.texto }}</button>
          }
        </div>
      </div>
      <div class="tabla-scroll">
        <table class="tabla">
          <thead><tr><th>Nombre</th><th>Mail</th><th class="num">Edad</th><th class="num">Puntos</th><th class="num">Crédito</th><th>Rol</th></tr></thead>
          <tbody>
            @for (u of lista$ | async; track u.id) {
              <tr>
                <td>{{ u.apellido }}, {{ u.nombre }}</td>
                <td>{{ u.email }}</td>
                <td class="num">{{ edadDe(u) }}</td>
                <td class="num">{{ u.puntos.toLocaleString('es-AR') }}</td>
                <td class="num">{{ u.credito | pesos }}</td>
                <td>
                  <select [ngModel]="u.rol" (ngModelChange)="cambiarRol(u, $event)" [disabled]="u.id === yo" [attr.aria-label]="'Rol de ' + u.nombre" class="rol">
                    <option value="cliente">Cliente</option>
                    <option value="empleado">Empleado</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            } @empty { <tr><td colspan="6" class="suave">Sin resultados.</td></tr> }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: ESTILOS_BASE + `
    .buscar { max-width: 300px; }
    .rol { min-height: 34px; padding: 4px 8px; width: auto; }
  `,
})
export class UsuariosAdminComponent {
  private readonly usuarios = inject(UsuariosService);
  private readonly toast = inject(ToastService);
  readonly yo = inject(AuthService).usuario?.id;
  readonly texto$ = new BehaviorSubject('');
  readonly rol$ = new BehaviorSubject<Rol | ''>('');
  readonly filtrosRol: { valor: Rol | ''; texto: string }[] = [
    { valor: '', texto: 'Todos' },
    { valor: 'cliente', texto: 'Clientes' },
    { valor: 'empleado', texto: 'Empleados' },
    { valor: 'admin', texto: 'Admins' },
  ];

  readonly lista$ = combineLatest([this.usuarios.usuarios$, this.texto$, this.rol$]).pipe(
    map(([l, t, rol]) => {
      const q = t.trim().toLowerCase();
      return l.filter((u) => (!rol || u.rol === rol) && (!q || `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(q)));
    }),
  );

  edadDe(u: Usuario) {
    return edad(u.fechaNacimiento);
  }

  cambiarRol(u: Usuario, rol: Rol) {
    if (!confirm(`¿Cambiar el rol de ${u.nombre} ${u.apellido} a ${rol}?`)) {
      this.texto$.next(this.texto$.value); // refresca la tabla para volver al valor anterior
      return;
    }
    this.usuarios.cambiarRol(u.id, rol).subscribe(() => this.toast.ok('Rol actualizado.'));
  }
}

// ─────────────────────────────── Actividad ───────────────────────────────

@Component({
  selector: 'app-actividad-admin',
  imports: [AsyncPipe, FormsModule],
  template: `
    <header class="cabecera-pagina">
      <div><h1>Registro de actividad</h1><p>Quién creó funciones, cambió precios, validó QRs y más, con fecha y hora.</p></div>
    </header>
    <section class="panel">
      <div class="titulo-fila">
        <input type="search" [ngModel]="texto$.value" (ngModelChange)="texto$.next($event)" placeholder="Filtrar por usuario, acción o detalle…" aria-label="Filtrar actividad" class="buscar" />
        <span class="suave chico">{{ (lista$ | async)?.length }} registros</span>
      </div>
      <div class="tabla-scroll alto">
        <table class="tabla">
          <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            @for (r of (lista$ | async)?.slice(0, limite); track r.id) {
              <tr>
                <td class="nowrap">{{ fecha(r.fecha) }}</td>
                <td>{{ r.usuarioNombre }}</td>
                <td><span class="etiqueta" [class.laton]="r.accion.includes('precio')" [class.ok]="r.accion.includes('Validó') || r.accion.includes('Entregó')">{{ r.accion }}</span></td>
                <td>{{ r.detalle }}</td>
              </tr>
            } @empty { <tr><td colspan="4" class="suave">Sin registros.</td></tr> }
          </tbody>
        </table>
      </div>
      @if (((lista$ | async)?.length ?? 0) > limite) {
        <button type="button" class="btn btn-chico ver-mas" (click)="limite = limite + 100">Ver más</button>
      }
    </section>
  `,
  styles: ESTILOS_BASE + `
    .buscar { max-width: 360px; }
    .alto { max-height: 70vh; overflow-y: auto; }
    .nowrap { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .ver-mas { margin-top: 12px; }
  `,
})
export class ActividadAdminComponent {
  readonly texto$ = new BehaviorSubject('');
  limite = 100;
  readonly lista$ = combineLatest([inject(ActividadService).registros$, this.texto$]).pipe(
    map(([l, t]) => {
      const q = t.trim().toLowerCase();
      return q ? l.filter((r) => `${r.usuarioNombre} ${r.accion} ${r.detalle}`.toLowerCase().includes(q)) : l;
    }),
  );

  fecha(iso: string) {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

// ─────────────────────────────── Configuración ───────────────────────────────

@Component({
  selector: 'app-configuracion-admin',
  imports: [AsyncPipe, FormsModule],
  template: `
    <header class="cabecera-pagina">
      <div><h1>Configuración</h1><p>Reglas generales del cine.</p></div>
    </header>
    @if (config.config$ | async; as c) {
      <section class="panel">
        <h2>Cupón de bienvenida</h2>
        <p class="suave chico">Descuento que recibe cada cliente registrado en su primera compra.</p>
        <div class="porcentajes">
          @for (p of atajos; track p) {
            <button type="button" class="chip" [class.activo]="porcentaje === p" (click)="porcentaje = p">{{ p }}%</button>
          }
          <label class="otro">Otro <input type="number" min="0" max="100" [(ngModel)]="porcentaje" aria-label="Porcentaje del cupón de bienvenida" />%</label>
        </div>
        <div class="pie">
          <button type="button" class="btn btn-primario" (click)="guardar()" [disabled]="porcentaje === c.porcentajePrimeraCompra">Guardar</button>
          <span class="suave chico">Actual: {{ c.porcentajePrimeraCompra }}%</span>
        </div>
      </section>
      <section class="panel">
        <h2>Reglas fijas</h2>
        <ul class="reglas">
          <li><strong>{{ c.minutosLimpieza }} minutos</strong> mínimos entre el fin de una función y el comienzo de la siguiente en la misma sala.</li>
          <li>Cancelación hasta <strong>{{ c.horasLimiteCancelacion }} horas</strong> antes de la función; se devuelve como crédito.</li>
          <li>1 punto por cada peso pagado por clientes registrados.</li>
          <li>Butacas VIP: filas R, S y T. Fila accesible: reemplaza a J y K (2 · 10 · 2 butacas).</li>
        </ul>
      </section>
      <section class="panel peligro">
        <h2>Datos de demostración</h2>
        <p class="suave chico">Borra todas las compras, usuarios nuevos y cambios, y vuelve a cargar los datos de ejemplo (películas, funciones de las próximas dos semanas y ventas pasadas para los reportes).</p>
        <button type="button" class="btn btn-peligro" (click)="reiniciar()">Reiniciar datos</button>
      </section>
    }
  `,
  styles: ESTILOS_BASE + `
    .porcentajes { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .otro { display: inline-flex; align-items: center; gap: 6px; font-size: var(--t-s); margin-left: 8px; }
    .otro input { width: 80px; }
    .reglas { margin: 0; padding-left: 18px; }
    .reglas li { margin-bottom: 6px; }
    .peligro { border-color: var(--terciopelo); }
  `,
})
export class ConfiguracionAdminComponent {
  readonly config = inject(ConfiguracionService);
  private readonly demo = inject(DemoService);
  private readonly toast = inject(ToastService);
  readonly atajos = [10, 15, 20, 25, 30];
  porcentaje = this.config.config.porcentajePrimeraCompra;

  guardar() {
    const p = Number(this.porcentaje);
    if (!(p >= 0 && p <= 100)) { this.toast.error('El porcentaje debe estar entre 0 y 100.'); return; }
    this.config.guardar({ porcentajePrimeraCompra: p });
    this.toast.ok(`Cupón de bienvenida: ${p}%.`);
  }

  reiniciar() {
    if (!confirm('Se van a borrar todos los datos y se cargarán los de ejemplo. ¿Continuar?')) return;
    this.demo.reiniciar().subscribe({
      next: () => { this.toast.ok('Datos reiniciados.'); this.porcentaje = this.config.config.porcentajePrimeraCompra; },
      error: () => this.toast.error('No se pudo cargar la semilla (data/seed.json).'),
    });
  }
}
