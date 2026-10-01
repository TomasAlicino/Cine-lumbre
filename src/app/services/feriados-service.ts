import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** Respuesta de la API Nager.Date (https://date.nager.at), de la lista public-apis. */
export interface Feriado {
  date: string; // yyyy-mm-dd
  localName: string; // nombre en castellano
}

/**
 * Feriados nacionales de Argentina por HTTP (API pública, no pide clave).
 * Se usan para marcar los días feriados en las funciones y al programarlas.
 */
@Injectable({ providedIn: 'root' })
export class FeriadosService {
  private http = inject(HttpClient);
  private url = 'https://date.nager.at/api/v3/PublicHolidays';

  traerFeriados(anio: number): Observable<Feriado[]> {
    return this.http.get<Feriado[]>(`${this.url}/${anio}/AR`);
  }
}
