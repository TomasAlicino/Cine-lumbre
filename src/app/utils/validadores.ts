import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { edad, parsearFechaAR } from './fechas';

/** Valida "dd/mm/aaaa" y que sea una fecha real. */
export const fechaARValida: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  if (!c.value) return null;
  return parsearFechaAR(c.value) ? null : { fecha: true };
};

export function edadEntre(min: number, max: number): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const iso = parsearFechaAR(c.value);
    if (!iso) return null;
    const e = edad(iso);
    return e < min || e > max ? { edad: { min, max, actual: e } } : null;
  };
}

export function coincideCon(otro: string): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const padre = c.parent;
    if (!padre) return null;
    return padre.get(otro)?.value === c.value ? null : { noCoincide: true };
  };
}

export const tarjetaValida: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const digitos = String(c.value ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.length < 15 || digitos.length > 16) return { tarjeta: true };
  // Algoritmo de Luhn
  let suma = 0;
  let doble = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let n = +digitos[i];
    if (doble) { n *= 2; if (n > 9) n -= 9; }
    suma += n;
    doble = !doble;
  }
  return suma % 10 === 0 ? null : { tarjeta: true };
};

export const vencimientoValido: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const m = /^(\d{2})\/(\d{2})$/.exec(c.value ?? '');
  if (!c.value) return null;
  if (!m) return { vencimiento: true };
  const mes = +m[1];
  const anio = 2000 + +m[2];
  if (mes < 1 || mes > 12) return { vencimiento: true };
  const fin = new Date(anio, mes, 0, 23, 59);
  return fin < new Date() ? { vencida: true } : null;
};
