import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast-service';

@Component({
  selector: 'app-toasts',
  templateUrl: './toasts.html',
  styleUrl: './toasts.scss',
})
export class Toasts {
  toast = inject(ToastService);
}
