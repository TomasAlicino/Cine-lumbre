import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StaffRoutingModule } from './staff-routing.module';
import { ValidadorComponent } from './validador.component';

/**
 * Módulo del área de empleados (validación de QR del cine y del candy bar).
 * Se carga con lazy loading desde app.routes.ts (loadChildren) y solo lo descarga
 * quien tiene rol empleado o admin (rolGuard).
 */
@NgModule({
  imports: [CommonModule, StaffRoutingModule, ValidadorComponent],
})
export class StaffModule {}
