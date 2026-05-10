import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'jordanDate',
  standalone: true
})
export class JordanDatePipe implements PipeTransform {

  transform(value: string | Date | null | undefined): string {
    if (!value) return '';

    let date: Date;

    if (typeof value === 'string') {
      const normalized = value.endsWith('Z') ? value : value + 'Z';
      date = new Date(normalized);
    } else {
      date = value;
    }

    if (isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Amman',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }
}