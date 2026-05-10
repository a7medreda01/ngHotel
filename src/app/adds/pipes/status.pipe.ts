import { Pipe, PipeTransform } from '@angular/core';
import { UpcomingBooking } from '../../service/booking-service';
 
@Pipe({ name: 'filterStatus', pure: true })
export class FilterStatusPipe implements PipeTransform {
  transform(bookings: UpcomingBooking[], status: string): number {
    if (!Array.isArray(bookings)) return 0;
    return bookings.filter(b => b.status === status).length;
  }
}