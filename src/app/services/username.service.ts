import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UsernameService {
  public userName: string = '';

  constructor() {}

  public setName(event: Event, name: string) {
    event.preventDefault();
    this.userName = name;
  }

  public getName(): string {
    return this.userName;
  }
}
