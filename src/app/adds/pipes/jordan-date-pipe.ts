import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'jordanDate',
  standalone: true
})
export class JordanDatePipe implements PipeTransform {

// jordan-date-pipe.ts
transform(value: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  // ✅ normalize: أضف Z لو مفيش
  const normalized = !value.endsWith('Z')
    ? value.replace(' ', 'T').split('.')[0] + 'Z'
    : value;
  
  return new Date(normalized);
}
}