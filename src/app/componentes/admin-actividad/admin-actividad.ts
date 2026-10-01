import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Actividad } from '../../models/models';
import { ActividadService } from '../../services/actividad-service';
import { ToastService } from '../../services/toast-service';

@Component({
  selector: 'app-admin-actividad',
  imports: [FormsModule],
  templateUrl: './admin-actividad.html',
  styleUrl: './admin-actividad.scss',
})
export class AdminActividad implements OnInit {
  private actividad = inject(ActividadService);
  private toast = inject(ToastService);

  registros = signal<Actividad[]>([]);
  cargando = signal(true);
  texto = signal('');
  accion = signal('');
  // Se muestran de a 100 filas para no dibujar una tabla enorme de entrada
  limite = signal(100);

  // Acciones distintas que aparecen en el log, para el filtro
  acciones = computed(() => [...new Set(this.registros().map((r) => r.accion))].sort());

  filtrados = computed(() => {
    const q = this.texto().trim().toLowerCase();
    const accion = this.accion();
    return this.registros().filter(
      (r) => (!accion || r.accion === accion) && (!q || `${r.usuario_nombre} ${r.accion} ${r.detalle}`.toLowerCase().includes(q)),
    );
  });

  visibles = computed(() => this.filtrados().slice(0, this.limite()));

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      this.registros.set(await this.actividad.listar());
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  verMas() {
    this.limite.update((l) => l + 100);
  }

  fecha(iso: string) {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
