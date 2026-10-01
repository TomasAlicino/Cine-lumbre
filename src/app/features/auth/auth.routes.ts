import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, Routes } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { COLORES_OJOS, TIPOS_SANGRE } from '../../core/models/models';
import { parsearFechaAR } from '../../core/utils/fechas';
import { coincideCon, edadEntre, fechaARValida } from '../../core/utils/validadores';
import { AutofocoDirective, MascaraFechaDirective } from '../../shared/directives/directivas';
import { AsyncPipe } from '@angular/common';

const ESTILOS = `
  .acceso { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 40px; align-items: start; }
  .marquesina { padding: 32px 0; }
  .marquesina h1 { font-size: clamp(2.4rem, 6vw, 4.2rem); line-height: .95; margin: 0 0 16px; }
  .marquesina h1 span { color: var(--laton); display: block; }
  .marquesina ul { padding-left: 18px; color: var(--humo); }
  .marquesina li { margin-bottom: 6px; }
  form h2 { margin: 0 0 18px; font-size: var(--t-2xl); }
  .pie { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-top: 22px; }
  .demo { margin-top: 18px; font-size: var(--t-xs); color: var(--humo); }
  .demo button { margin-right: 10px; }
  @media (max-width: 820px) { .acceso { grid-template-columns: 1fr; gap: 8px; } .marquesina { padding: 0; } }
`;

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AutofocoDirective],
  template: `
    <div class="contenedor pagina acceso">
      <section class="marquesina">
        <h1>Hola de nuevo <span>a la función.</span></h1>
        <p class="suave">Ingresá para usar tus puntos, tu crédito y ver tus entradas.</p>
      </section>
      <form class="panel" [formGroup]="form" (ngSubmit)="ingresar()" novalidate>
        <h2>Ingresar</h2>
        <div class="form-grilla">
          <div class="campo ancho">
            <label for="email">Mail</label>
            <input id="email" type="email" formControlName="email" autocomplete="email" appAutofoco />
            @if (form.controls.email.touched && form.controls.email.invalid) { <span class="error">Escribí un mail válido.</span> }
          </div>
          <div class="campo ancho">
            <label for="pass">Contraseña</label>
            <input id="pass" type="password" formControlName="password" autocomplete="current-password" />
          </div>
        </div>
        @if (error) { <p class="aviso error" role="alert">{{ error }}</p> }
        <div class="pie">
          <button class="btn btn-primario" type="submit" [disabled]="enviando">Ingresar</button>
          <span class="chico">¿No tenés cuenta? <a routerLink="/registro" [queryParams]="{ volver: volver }">Registrate</a></span>
        </div>
        <p class="demo">
          Usuarios de prueba:
          <button type="button" class="btn-texto" (click)="demo('admin@lumbre.com', 'admin123')">admin</button>
          <button type="button" class="btn-texto" (click)="demo('empleado@lumbre.com', 'empleado123')">empleado</button>
          <button type="button" class="btn-texto" (click)="demo('cliente@lumbre.com', 'cliente123')">cliente</button>
        </p>
      </form>
    </div>
  `,
  styles: ESTILOS,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly volver: string = inject(ActivatedRoute).snapshot.queryParamMap.get('volver') ?? '';

  error = '';
  enviando = false;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  demo(email: string, password: string) {
    this.form.setValue({ email, password });
  }

  ingresar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.enviando = true;
    this.error = '';
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (u) => {
        this.toast.ok(`¡Hola, ${u.nombre}!`);
        const destino = this.volver || (u.rol === 'admin' ? '/admin' : u.rol === 'empleado' ? '/validar' : '/');
        this.router.navigateByUrl(destino);
      },
      error: (e: Error) => {
        this.error = e.message;
        this.enviando = false;
      },
    });
  }
}

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, AsyncPipe, MascaraFechaDirective, AutofocoDirective],
  template: `
    <div class="contenedor pagina acceso">
      <section class="marquesina">
        <h1>Tu butaca <span>te espera.</span></h1>
        <ul>
          <li>Cupón de <strong>{{ (config.config$ | async)?.porcentajePrimeraCompra }}% en tu primera compra</strong>.</li>
          <li>Sumás 1 punto por cada peso y lo canjeás por entradas o candy.</li>
          <li>Guardás tus entradas y tu historial en "Mis películas".</li>
          <li>Alertas de estrenos y crédito si cancelás.</li>
        </ul>
      </section>
      <form class="panel" [formGroup]="form" (ngSubmit)="registrar()" novalidate>
        <h2>Crear cuenta</h2>
        <div class="form-grilla">
          <div class="campo">
            <label for="nombre">Nombre</label>
            <input id="nombre" formControlName="nombre" autocomplete="given-name" appAutofoco />
            @if (err('nombre')) { <span class="error">Completá tu nombre.</span> }
          </div>
          <div class="campo">
            <label for="apellido">Apellido</label>
            <input id="apellido" formControlName="apellido" autocomplete="family-name" />
            @if (err('apellido')) { <span class="error">Completá tu apellido.</span> }
          </div>
          <div class="campo ancho">
            <label for="email">Mail</label>
            <input id="email" type="email" formControlName="email" autocomplete="email" />
            @if (err('email')) { <span class="error">Escribí un mail válido.</span> }
          </div>
          <div class="campo">
            <label for="nac">Fecha de nacimiento</label>
            <input id="nac" formControlName="fechaNacimiento" appMascaraFecha="dd/mm/aaaa" inputmode="numeric" placeholder="dd/mm/aaaa" />
            <span class="ayuda">Escribí solo los números, las barras se ponen solas.</span>
            @if (err('fechaNacimiento')) {
              <span class="error">{{ form.controls.fechaNacimiento.hasError('edad') ? 'La edad debe estar entre 5 y 110 años.' : 'Fecha inválida.' }}</span>
            }
          </div>
          <div class="campo">
            <label for="vac">Días de vacaciones por año</label>
            <input id="vac" type="number" min="0" max="365" formControlName="diasVacaciones" inputmode="numeric" />
            @if (err('diasVacaciones')) { <span class="error">Entre 0 y 365.</span> }
          </div>
          <div class="campo">
            <span class="etiqueta-campo">Tipo de sangre</span>
            <div class="chips" role="radiogroup" aria-label="Tipo de sangre">
              @for (t of tiposSangre; track t) {
                <button type="button" class="chip" role="radio" [attr.aria-checked]="form.value.tipoSangre === t" [class.activo]="form.value.tipoSangre === t" (click)="form.controls.tipoSangre.setValue(t)">{{ t }}</button>
              }
            </div>
            @if (err('tipoSangre')) { <span class="error">Elegí una opción.</span> }
          </div>
          <div class="campo">
            <span class="etiqueta-campo">Color de ojos</span>
            <div class="chips" role="radiogroup" aria-label="Color de ojos">
              @for (c of coloresOjos; track c) {
                <button type="button" class="chip" role="radio" [attr.aria-checked]="form.value.colorOjos === c" [class.activo]="form.value.colorOjos === c" (click)="form.controls.colorOjos.setValue(c)">{{ c }}</button>
              }
            </div>
            @if (err('colorOjos')) { <span class="error">Elegí una opción.</span> }
          </div>
          <div class="campo">
            <label for="pass">Contraseña</label>
            <input id="pass" type="password" formControlName="password" autocomplete="new-password" />
            @if (err('password')) { <span class="error">Mínimo 6 caracteres.</span> }
          </div>
          <div class="campo">
            <label for="pass2">Repetir contraseña</label>
            <input id="pass2" type="password" formControlName="password2" autocomplete="new-password" />
            @if (err('password2')) { <span class="error">Las contraseñas no coinciden.</span> }
          </div>
        </div>
        @if (error) { <p class="aviso error" role="alert">{{ error }}</p> }
        <div class="pie">
          <button class="btn btn-primario" type="submit" [disabled]="enviando">Crear cuenta</button>
          <span class="chico">¿Ya tenés cuenta? <a routerLink="/ingresar" [queryParams]="{ volver: volver }">Ingresá</a></span>
        </div>
      </form>
    </div>
  `,
  styles: ESTILOS,
})
export class RegistroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly config = inject(ConfiguracionService);
  readonly volver: string = inject(ActivatedRoute).snapshot.queryParamMap.get('volver') ?? '';
  readonly tiposSangre = TIPOS_SANGRE;
  readonly coloresOjos = COLORES_OJOS;

  error = '';
  enviando = false;

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(40)]],
    apellido: ['', [Validators.required, Validators.maxLength(40)]],
    email: ['', [Validators.required, Validators.email]],
    fechaNacimiento: ['', [Validators.required, fechaARValida, edadEntre(5, 110)]],
    diasVacaciones: [14, [Validators.required, Validators.min(0), Validators.max(365)]],
    tipoSangre: ['', Validators.required],
    colorOjos: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
    password2: ['', [Validators.required, coincideCon('password')]],
  });

  err(campo: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  registrar() {
    this.form.controls.password2.updateValueAndValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.enviando = true;
    this.error = '';
    const { password2: _p, fechaNacimiento, ...resto } = this.form.getRawValue();
    this.auth.registrar({ ...resto, fechaNacimiento: parsearFechaAR(fechaNacimiento)!, diasVacaciones: Number(resto.diasVacaciones) }).subscribe({
      next: (u) => {
        this.toast.ok(`¡Bienvenido/a, ${u.nombre}! Tu cupón de bienvenida ya está disponible.`);
        this.router.navigateByUrl(this.volver || '/cartelera');
      },
      error: (e: Error) => {
        this.error = e.message;
        this.enviando = false;
      },
    });
  }
}

export const AUTH_ROUTES: Routes = [
  { path: 'ingresar', component: LoginComponent, title: 'Ingresar · Cine Lumbre' },
  { path: 'registro', component: RegistroComponent, title: 'Registro · Cine Lumbre' },
];
