import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Validador } from '../../componentes/validador/validador';

const routes: Routes = [{ path: '', title: 'Validar QR · Cine Lumbre', component: Validador }];

/** Rutas hijas del área de empleados (se montan bajo /validar). */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StaffRoutingModule {}
