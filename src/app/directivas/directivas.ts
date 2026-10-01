import { Directive, ElementRef, HostListener, OnInit, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { Rol } from '../models/models';
import { AuthService } from '../services/auth-service';

/**
 * Directiva de atributo: máscara para escribir fechas sin calendario.
 * Se tipean solo números y las barras se agregan solas. Formatos: "dd/mm/aaaa" (por defecto) o "mm/aa".
 */
@Directive({ selector: 'input[appMascaraFecha]' })
export class MascaraFechaDirective {
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  appMascaraFecha = input<'dd/mm/aaaa' | 'mm/aa' | ''>('');

  @HostListener('input')
  alEscribir() {
    const input = this.el.nativeElement;
    const formato = this.appMascaraFecha() || 'dd/mm/aaaa';
    const d = input.value.replace(/\D/g, '').slice(0, formato === 'mm/aa' ? 4 : 8);
    let valor = d;
    if (formato === 'mm/aa') valor = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
    else if (d.length > 4) valor = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    else if (d.length > 2) valor = `${d.slice(0, 2)}/${d.slice(2)}`;

    if (valor !== input.value) {
      input.value = valor;
      // Se vuelve a disparar "input" para que el formulario reciba el valor con barras
      input.dispatchEvent(new Event('input'));
    }
  }
}

/**
 * Directiva estructural: muestra el contenido solo si el usuario logueado tiene alguno de los roles.
 * Uso: <a *appSiRol="['admin']">Administración</a>
 * El effect() vuelve a evaluar cuando cambia el usuario (login / logout).
 */
@Directive({ selector: '[appSiRol]' })
export class SiRolDirective {
  private tpl = inject(TemplateRef<unknown>);
  private vcr = inject(ViewContainerRef);
  private auth = inject(AuthService);
  private visible = false;
  appSiRol = input<Rol[]>([]);

  constructor() {
    effect(() => {
      const u = this.auth.usuario();
      const mostrar = !!u && this.appSiRol().includes(u.rol);
      if (mostrar && !this.visible) this.vcr.createEmbeddedView(this.tpl);
      if (!mostrar && this.visible) this.vcr.clear();
      this.visible = mostrar;
    });
  }
}

/** Directiva de atributo: si la imagen no carga, muestra un póster genérico. */
@Directive({ selector: 'img[appImagenRespaldo]' })
export class ImagenRespaldoDirective {
  private el = inject<ElementRef<HTMLImageElement>>(ElementRef);

  @HostListener('error')
  alFallar() {
    const img = this.el.nativeElement;
    if (!img.src.endsWith('posters/sin-poster.svg')) img.src = 'posters/sin-poster.svg';
  }
}

/** Directiva de atributo: pone el foco en el elemento al aparecer (validador de QR). */
@Directive({ selector: '[appAutofoco]' })
export class AutofocoDirective implements OnInit {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  ngOnInit() {
    setTimeout(() => this.el.nativeElement.focus(), 0);
  }
}
