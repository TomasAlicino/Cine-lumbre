import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Perfil, Rol } from '../../models/models';
import { AuthService } from '../../services/auth-service';
import { ToastService } from '../../services/toast-service';
import { UsuariosService } from '../../services/usuarios-service';
import { PesosPipe } from '../../pipes/pipes';
import { edad } from '../../utils/fechas';

@Component({
  selector: 'app-admin-usuarios',
  imports: [FormsModule, PesosPipe],
  templateUrl: './admin-usuarios.html',
  styleUrl: './admin-usuarios.scss',
})
export class AdminUsuarios implements OnInit {
  private usuariosService = inject(UsuariosService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  usuarios = signal<Perfil[]>([]);
  cargando = signal(true);
  texto = signal('');
  filtroRol = signal<Rol | ''>('');

  // Id del admin logueado: no puede cambiarse el rol a sí mismo
  yo = computed(() => this.auth.usuario()?.id);

  readonly filtrosRol: { valor: Rol | ''; texto: string }[] = [
    { valor: '', texto: 'Todos' },
    { valor: 'cliente', texto: 'Clientes' },
    { valor: 'empleado', texto: 'Empleados' },
    { valor: 'admin', texto: 'Admins' },
  ];

  filtrados = computed(() => {
    const q = this.texto().trim().toLowerCase();
    const rol = this.filtroRol();
    return this.usuarios().filter(
      (u) => (!rol || u.rol === rol) && (!q || `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(q)),
    );
  });

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      this.usuarios.set(await this.usuariosService.listar());
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  edadDe(u: Perfil) {
    return edad(u.fecha_nacimiento);
  }

  // Recibe el <select> para poder volverlo al rol anterior si se cancela o falla
  async cambiarRol(u: Perfil, select: HTMLSelectElement) {
    const rol = select.value as Rol;
    if (u.id === this.yo()) {
      select.value = u.rol;
      return;
    }
    if (!confirm(`¿Cambiar el rol de ${u.nombre} ${u.apellido} a ${rol}?`)) {
      select.value = u.rol;
      return;
    }
    try {
      await this.usuariosService.cambiarRol(u, rol);
      this.usuarios.update((lista) => lista.map((x) => (x.id === u.id ? { ...x, rol } : x)));
      this.toast.ok('Rol actualizado.');
    } catch (e) {
      select.value = u.rol;
      this.toast.error((e as Error).message);
    }
  }
}
