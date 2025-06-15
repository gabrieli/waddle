import { WaddleManager } from './index';

describe('WaddleManager', () => {
  let manager: WaddleManager;

  beforeEach(() => {
    manager = new WaddleManager();
  });

  describe('start', () => {
    it('should start the manager', async () => {
      await manager.start();
      expect(manager.isRunning()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop the manager', async () => {
      await manager.start();
      await manager.stop();
      expect(manager.isRunning()).toBe(false);
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      expect(manager.isRunning()).toBe(false);
    });

    it('should return true after start', async () => {
      await manager.start();
      expect(manager.isRunning()).toBe(true);
    });
  });
});