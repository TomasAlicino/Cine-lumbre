import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Validador } from '../../componentes/validador/validador';
import { AutofocoDirective } from '../../directivas/directivas';
import { DiaPipe, HoraPipe } from '../../pipes/pipes';
import { StaffRoutingModule } from './staff-routing-module';

/**
 * Módulo del área de empleados (validación de QR en la sala y en el candy bar).
 * Se carga con lazy loading desde app.routes.ts (loadChildren) y solo lo descarga
 * quien tiene rol empleado o admin (rolGuard).
 * Validador no es standalone: se declara acá. Las pipes y directivas standalone se importan.
 */
@NgModule({
  declarations: [Validador],
  imports: [FormsModule, StaffRoutingModule, AutofocoDirective, DiaPipe, HoraPipe],
})
export class StaffModule {}
