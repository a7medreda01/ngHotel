// total-extras.pipe.ts
// Add this pipe to your module declarations
import { Pipe, PipeTransform } from '@angular/core';
 
@Pipe({ name: 'totalExtras' })
export class TotalExtrasPipe implements PipeTransform {
  transform(extras: { total: number }[]): number {
    if (!extras) return 0;
    let sum = 0;
    for (const e of extras) { sum += e.total || 0; }
    return sum;
  }
}
 