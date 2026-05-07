import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'jordanDate'
})
export class JordanDatePipe implements PipeTransform {

  transform(value: string | Date | null | undefined): string {
  if (!value) return '';

  const date = new Date(value);

  if (isNaN(date.getTime())) return '';

  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Amman',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}
}