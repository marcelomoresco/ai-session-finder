import { describe, it, expect } from 'vitest';
import { SilentLogger } from '../observability/Logger';
import { UpdateService, type AutoUpdaterLike, type UpdateInfo } from './UpdateService';

function fakeUpdater(over: Partial<AutoUpdaterLike> = {}): AutoUpdaterLike {
  return {
    checkForUpdates: () => Promise.resolve(null),
    downloadUpdate: () => Promise.resolve(undefined),
    quitAndInstall: () => {},
    ...over,
  };
}

describe('UpdateService', () => {
  it('returns updateInfo when an update is available', async () => {
    const info: UpdateInfo = { version: '0.2.0' };
    const service = new UpdateService(
      fakeUpdater({ checkForUpdates: () => Promise.resolve({ updateInfo: info }) }),
      new SilentLogger(),
    );
    expect(await service.checkForUpdates()).toEqual(info);
  });

  it('returns null when there is no update', async () => {
    const service = new UpdateService(fakeUpdater(), new SilentLogger());
    expect(await service.checkForUpdates()).toBeNull();
  });

  it('degrades gracefully to null when the update check throws (offline server)', async () => {
    const service = new UpdateService(
      fakeUpdater({ checkForUpdates: () => Promise.reject(new Error('offline')) }),
      new SilentLogger(),
    );
    expect(await service.checkForUpdates()).toBeNull();
  });

  it('downloads then quits-and-installs, in that order', async () => {
    const calls: string[] = [];
    const service = new UpdateService(
      fakeUpdater({
        downloadUpdate: () => {
          calls.push('download');
          return Promise.resolve(undefined);
        },
        quitAndInstall: () => {
          calls.push('install');
        },
      }),
      new SilentLogger(),
    );
    await service.downloadAndInstall();
    expect(calls).toEqual(['download', 'install']);
  });
});
