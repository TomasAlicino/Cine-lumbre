import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-encontrado',
  imports: [RouterLink],
  template: `
    <div class="contenedor pagina centro">
      <h1>Esta sala está vacía</h1>
      <p class="suave">La página que buscás no existe o cambió de lugar.</p>
      <a routerLink="/cartelera" class="btn btn-primario">Ir a la cartelera</a>
    </div>
  `,
  styles: `.centro { text-align: center; padding-top: 96px; } .centro p { margin-inline: auto; }`,
})
export class NoEncontradoComponent {}
