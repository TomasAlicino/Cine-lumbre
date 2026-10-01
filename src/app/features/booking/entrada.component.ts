import { Component, Input, OnChanges, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, combineLatest, from, map, of, switchMap } from 'rxjs';
import { DbService } from '../../core/services/db.service';
import { EntradaPdfService } from '../../core/services/entrada-pdf.service';
import { Funcion, Pedido, Pelicula, Sala } from '../../core/models/models';
import { tipoDeButaca } from '../../core/utils/sala-layout';
import { PesosPipe } from '../../shared/pipes/pipes';

interface Vista {
  pedido: Pedido;
  funcion: Funcion;
  pelicula: Pelicula;
  sala: Sala | undefined;
  qr: string;
}

@Component({
  selector: 'app-entrada',
  imports: [AsyncPipe, RouterLink, PesosPipe],
  template: `
    @if (vista$ | async; as v) {
      <div class="contenedor pagina">
        <div class="cabecera-pagina">
          <div>
            <h1>{{ v.pedido.estado === 'cancelada' ? 'Compra cancelada' : 'Tu entrada' }}</h1>
            <p>{{ v.pedido.estado === 'cancelada' ? 'El importe se acreditó en tu cuenta.' : 'Mostrá el QR en la puerta de la sala y en el candy bar. También te la podés descargar en PDF.' }}</p>
          </div>
        </div>
        <article class="ticket" [class.anulada]="v.pedido.estado === 'cancelada'">
          <div class="cuerpo">
            <h2>{{ v.pelicula.titulo }}</h2>
            <dl>
              <div><dt>Día</dt><dd class="cap">{{ dia(v.funcion.inicio) }}</dd></div>
              <div><dt>Hora</dt><dd>{{ hora(v.funcion.inicio) }} h</dd></div>
              <div><dt>Sala</dt><dd>{{ v.sala?.nombre }}</dd></div>
              <div><dt>Formato</dt><dd>{{ v.funcion.formato }} {{ v.funcion.idioma === 'castellano' ? 'castellano' : 'subtitulada' }}</dd></div>
              <div class="ancho"><dt>Butacas</dt><dd class="butacas">
                @for (b of v.pedido.butacas; track b) {
                  <span [class]="'b ' + tipo(b)">{{ b }}@if (tipo(b) === 'vip') { <small>VIP</small> }</span>
                }
              </dd></div>
              @if (v.pedido.items.length) {
                <div class="ancho"><dt>Candy</dt><dd>@for (i of v.pedido.items; track $index; let last = $last) {{{ i.cantidad }}× {{ i.nombre }}{{ last ? '' : ', ' }}}</dd></div>
              }
              <div><dt>Titular</dt><dd>{{ v.pedido.comprador.nombre }}</dd></div>
              <div><dt>Pagaste</dt><dd>{{ v.pedido.total | pesos }}@if (v.pedido.creditoUsado) { + {{ v.pedido.creditoUsado | pesos }} de crédito }</dd></div>
            </dl>
            @if (v.pedido.requiereAdulto) {
              <p class="adulto">Película {{ v.pelicula.clasificacion }}: debe asistir un adulto.</p>
            }
          </div>
          <div class="qr">
            <img [src]="v.qr" [alt]="'Código QR de la entrada ' + v.pedido.codigo" width="200" height="200" />
            <code>{{ v.pedido.codigo }}</code>
            <p class="estado">
              <span [class.usado]="v.pedido.entradaValidada">Sala: {{ v.pedido.entradaValidada ? 'ingresó' : 'sin usar' }}</span>
              @if (v.pedido.items.length) { <span [class.usado]="v.pedido.candyEntregado">Candy: {{ v.pedido.candyEntregado ? 'retirado' : 'sin retirar' }}</span> }
            </p>
          </div>
        </article>
        <div class="acciones">
          <button type="button" class="btn btn-primario" (click)="pdf.descargar(v.pedido)" [disabled]="v.pedido.estado === 'cancelada'">Descargar PDF</button>
          @if (v.pedido.usuarioId) { <a routerLink="/mi-cuenta/compras" class="btn">Ver mis compras</a> }
          <a routerLink="/cartelera" class="btn">Volver a la cartelera</a>
        </div>
        @if (!v.pedido.usuarioId) {
          <p class="suave chico">Compraste sin cuenta: guardá el PDF o esta página, porque es tu comprobante.</p>
        }
      </div>
    } @else {
      <div class="contenedor pagina vacio"><p>No encontramos esa entrada.</p><a routerLink="/" class="btn">Ir al inicio</a></div>
    }
  `,
  styles: `
    .ticket { display: grid; grid-template-columns: 1fr 260px; max-width: 880px; background: var(--pantalla); color: var(--noche); border-radius: var(--r-m); overflow: hidden; }
    .ticket.anulada { opacity: .55; filter: grayscale(1); }
    .cuerpo { padding: 28px; }
    .cuerpo h2 { font-size: var(--t-3xl); font-weight: 900; margin-bottom: 18px; }
    dl { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px 20px; margin: 0; }
    dl .ancho { grid-column: 1 / -1; }
    dt { font-size: var(--t-xs); color: #5a6380; font-weight: 600; }
    dd { margin: 2px 0 0; font-weight: 600; }
    .cap { text-transform: capitalize; }
    .butacas { display: flex; flex-wrap: wrap; gap: 6px; }
    .b { padding: 2px 8px; border: 1.5px solid var(--noche); border-radius: 6px 6px 3px 3px; font: 700 var(--t-m) / 1.3 var(--f-display); }
    .b.vip { border-color: var(--terciopelo); color: var(--terciopelo); }
    .b.accesible { border-color: var(--acceso); }
    .b small { font-size: 10px; margin-left: 3px; }
    .adulto { margin: 20px 0 0; padding: 10px 14px; background: var(--terciopelo); color: #fff; font-weight: 700; border-radius: var(--r-s); max-width: none; }
    .qr { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; border-left: 2px dashed rgba(20,27,46,.3); }
    .qr::before, .qr::after { content: ''; position: absolute; left: -12px; width: 22px; height: 22px; border-radius: 50%; background: var(--noche); }
    .qr::before { top: -11px; } .qr::after { bottom: -11px; }
    .qr img { width: 200px; height: 200px; }
    code { font: 700 var(--t-l) / 1 ui-monospace, 'Cascadia Mono', Menlo, monospace; letter-spacing: .04em; }
    .estado { display: flex; flex-direction: column; align-items: center; gap: 2px; margin: 0; font-size: var(--t-xs); color: #1f7a4f; font-weight: 600; }
    .estado .usado { color: #5a6380; text-decoration: line-through; }
    .acciones { display: flex; flex-wrap: wrap; gap: 10px; margin: 24px 0 12px; }
    @media (max-width: 720px) { .ticket { grid-template-columns: 1fr; } .qr { border-left: 0; border-top: 2px dashed rgba(20,27,46,.3); } .qr::before, .qr::after { display: none; } }
  `,
})
export class EntradaComponent implements OnChanges {
  private readonly db = inject(DbService);
  readonly pdf = inject(EntradaPdfService);
  @Input() pedidoId = '';
  vista$!: Observable<Vista | null>;

  ngOnChanges() {
    this.vista$ = combineLatest([this.db.lista$('pedidos'), this.db.lista$('funciones'), this.db.lista$('peliculas'), this.db.lista$('salas')]).pipe(
      switchMap(([pedidos, funciones, pelis, salas]) => {
        const pedido = pedidos.find((p) => p.id === this.pedidoId);
        const funcion = pedido && funciones.find((f) => f.id === pedido.funcionId);
        const pelicula = funcion && pelis.find((p) => p.id === funcion.peliculaId);
        if (!pedido || !funcion || !pelicula) return of(null);
        const sala = salas.find((s) => s.id === funcion.salaId);
        return from(this.pdf.qrDataUrl(pedido.codigo)).pipe(map((qr) => ({ pedido, funcion, pelicula, sala, qr })));
      }),
    );
  }

  tipo(b: string) {
    return tipoDeButaca(b);
  }

  dia(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  hora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
}
