import { Pipe, PipeTransform } from '@angular/core';
import { timeAgo } from './format';

/** "agora", "há 5 min", "há 2h", "ontem", "há 3 dias", "12 de set." */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return timeAgo(value);
  }
}
