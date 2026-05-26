import { describe, it, expect } from 'vitest';
import { AutoStartService, type LoginItemController } from './AutoStartService';

class FakeLoginItem implements LoginItemController {
  open = false;
  hidden = false;
  setOpenAtLogin(settings: { openAtLogin: boolean; openAsHidden?: boolean }): void {
    this.open = settings.openAtLogin;
    this.hidden = settings.openAsHidden ?? false;
  }
  getOpenAtLogin(): boolean {
    return this.open;
  }
}

describe('AutoStartService', () => {
  it('enables open-at-login as hidden', () => {
    const item = new FakeLoginItem();
    new AutoStartService(item).enable();
    expect(item.open).toBe(true);
    expect(item.hidden).toBe(true);
  });

  it('disables open-at-login', () => {
    const item = new FakeLoginItem();
    item.open = true;
    new AutoStartService(item).disable();
    expect(item.open).toBe(false);
  });

  it('reports the current state and syncs from a boolean', () => {
    const item = new FakeLoginItem();
    const service = new AutoStartService(item);
    service.sync(true);
    expect(service.isEnabled()).toBe(true);
    service.sync(false);
    expect(service.isEnabled()).toBe(false);
  });
});
