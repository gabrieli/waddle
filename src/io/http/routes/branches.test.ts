/**
 * Branches API Routes Tests
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createBranchesRouter } from './branches.ts';
import { getLocalBranches } from '../../../lib/git-utils.ts';
import { generateBranchName } from '../../../core/domain/work-item.ts';

describe('Branches API Routes', () => {
  describe('Git utilities integration', () => {
    test('should get local branches using git utils', () => {
      const branches = getLocalBranches();
      assert(Array.isArray(branches), 'Should return an array');
      
      if (branches.length > 0) {
        branches.forEach((branch: string) => {
          assert(typeof branch === 'string', 'Each branch should be a string');
          assert(branch.trim() !== '', 'Branch names should not be empty');
        });
      }
    });
  });

  describe('Branch name generation', () => {
    test('should generate proper branch names', () => {
      const testCases = [
        {
          workItemId: 123,
          name: 'Add user authentication',
          expected: 'feature/work-item-123-add-user-authentication'
        },
        {
          workItemId: 456,
          name: 'Fix Bug #42: Special Characters & Symbols!',
          expected: 'feature/work-item-456-fix-bug--42--special-characters---symbols-'
        },
        {
          workItemId: 789,
          name: 'Update API endpoints',
          expected: 'feature/work-item-789-update-api-endpoints'
        }
      ];

      testCases.forEach(({ workItemId, name, expected }) => {
        const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const result = generateBranchName(workItemId, slug);
        assert(result === expected, `Expected ${expected}, got ${result}`);
      });
    });

    test('should handle empty and edge case names', () => {
      const testCases = [
        {
          workItemId: 1,
          name: '',
          slug: ''
        },
        {
          workItemId: 2,
          name: '!!!',
          slug: '---'
        },
        {
          workItemId: 3,
          name: '123',
          slug: '123'
        }
      ];

      testCases.forEach(({ workItemId, slug }) => {
        const result = generateBranchName(workItemId, slug);
        assert(result.startsWith(`feature/work-item-${workItemId}-`), 'Should follow naming convention');
        assert(typeof result === 'string', 'Should return a string');
        assert(result.length > 0, 'Should not be empty');
      });
    });
  });

  describe('Router creation', () => {
    test('should create router without errors', () => {
      const router = createBranchesRouter();
      assert(router !== null, 'Should create router');
      assert(typeof router === 'function', 'Router should be a function');
    });
  });
});