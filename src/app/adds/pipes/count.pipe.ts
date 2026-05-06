// stat-count.pipe.ts
// ضعه في نفس مجلد chalet component وأضفه في imports بتاع الـ component

import { Pipe, PipeTransform } from '@angular/core';
import { Chalet } from '../../service/chalet-service';

@Pipe({ name: 'statCount', standalone: true })
export class StatCountPipe implements PipeTransform {
  transform(chalets: Chalet[], status: string): number {
    return chalets.filter(c => c.status === status).length;
  }
}

// ====================================================================
// ملاحظات الاستخدام
// ====================================================================
//
// 1. في chalet.component.ts أضف StatCountPipe في الـ imports array:
//    imports: [CommonModule, FormsModule, StatCountPipe]
//
// 2. في app.config.ts أو AppModule أضف:
//    provideHttpClient()
//
// 3. Bootstrap Icons موجودة كـ CDN في الـ CSS عبر:
//    @import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css');
//    أو أضفها في angular.json > styles
//
// 4. Cairo Font بيتحمل من Google Fonts تلقائياً من الـ CSS
//
// 5. الـ API URL موجود في chalet.service.ts:
//    private apiUrl = 'https://localhost:7262/api/Chalet';
//    غيّره حسب بيئتك