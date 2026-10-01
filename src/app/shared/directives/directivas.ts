import { AfterViewInit, Directive, ElementRef, HostListener, Input, OnDestroy, OnInit, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Rol } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';

/**
 * Máscara para escribir fechas sin calendario: el usuario tipea solo números
 * y la barra se agrega sola. Formatos: "dd/mm/aaaa" (por defecto) o "mm/aa".
 */
@Directive({ selector: 'input[appMascaraFecha]' })
export class MascaraFechaDirective {
  private readonly control = inject(NgControl, { optional: true, self: true });
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  @Input() appMascaraFecha: 'dd/mm/aaaa' | 'mm/aa' | '' = '';

  @HostListener('input')
  alEscribir() {
    const formato = this.appMascaraFecha || 'dd/mm/aaaa';
    const max = formato === 'mm/aa' ? 4 : 8;
    const d = this.el.nativeElement.value.replace(/\D/g, '').slice(0, max);
    let r = d;
    if (formato === 'mm/aa') r = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
    else if (d.length > 4) r = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    else if (d.length > 2) r = `${d.slice(0, 2)}/${d.slice(2)}`;
    this.el.nativeElement.value = r;
    this.control?.control?.setValue(r, { emitEvent: true });
  }
}

/** Directiva estructural: muestra el contenido solo si el usuario tiene alguno de los roles. */
@Directive({ selector: '[appSiRol]' })
export class SiRolDirective implements OnInit, OnDestroy {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);
  private sub?: Subscription;
  private visible = false;
  @Input() appSiRol: Rol[] = [];

  ngOnInit() {
    this.sub = this.auth.usuario$.subscribe((u) => {
      const mostrar = !!u && this.appSiRol.includes(u.rol);
      if (mostrar && !this.visible) this.vcr.createEmbeddedView(this.tpl);
      if (!mostrar && this.visible) this.vcr.clear();
      this.visible = mostrar;
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}

/** Si la imagen no carga, muestra un póster genérico. */
@Directive({ selector: 'img[appImagenRespaldo]' })
export class ImagenRespaldoDirective {
  private readonly el = inject<ElementRef<HTMLImageElement>>(ElementRef);
  @HostListener('error')
  alFallar() {
    const img = this.el.nativeElement;
    if (!img.src.endsWith('posters/sin-poster.svg')) img.src = 'posters/sin-poster.svg';
  }
}

/** Pone el foco en el elemento al aparecer (útil en el validador de QR). */
@Directive({ selector: '[appAutofoco]' })
export class AutofocoDirective implements AfterViewInit {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  ngAfterViewInit() {
    setTimeout(() => this.el.nativeElement.focus(), 0);
  }
}

export const DIRECTIVAS = [MascaraFechaDirective, SiRolDirective, ImagenRespaldoDirective, AutofocoDirective] as const;
