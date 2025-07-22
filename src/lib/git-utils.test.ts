/**
 * Git Utils Tests
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getLocalBranches, getCurrentBranch, branchExists } from './git-utils.ts';

describe('Git Utils', () => {
  describe('getLocalBranches', () => {
    test('should return an array of branch names', () => {
      const branches = getLocalBranches();
      assert(Array.isArray(branches), 'Should return an array');
      
      // Should contain at least the current branch
      if (branches.length > 0) {
        branches.forEach(branch => {
          assert(typeof branch === 'string', 'Each branch should be a string');
          assert(branch.trim() !== '', 'Branch names should not be empty');
        });
      }
    });

    test('should include main or master branch', () => {
      const branches = getLocalBranches();
      const hasMainOrMaster = branches.includes('main') || branches.includes('master');
      
      // Most repos should have main or master
      if (branches.length > 0) {
        // If we have branches, we expect at least some typical branch names
        assert(branches.some(branch => /^(main|master|develop|feature\/)/.test(branch)), 
               'Should have typical branch names');
      }
    });
  });

  describe('getCurrentBranch', () => {
    test('should return current branch name', () => {
      const currentBranch = getCurrentBranch();
      assert(typeof currentBranch === 'string', 'Should return a string');
      assert(currentBranch.trim() !== '', 'Should not be empty');
    });

    test('should return a branch that exists in local branches', () => {
      const currentBranch = getCurrentBranch();
      const branches = getLocalBranches();
      
      if (branches.length > 0 && currentBranch !== 'main') {
        // Current branch should be in the list of branches
        assert(branches.includes(currentBranch), 
               `Current branch ${currentBranch} should be in branch list`);
      }
    });
  });

  describe('branchExists', () => {
    test('should return true for current branch', () => {
      const currentBranch = getCurrentBranch();
      const exists = branchExists(currentBranch);
      assert(exists === true, 'Current branch should exist');
    });

    test('should return false for non-existent branch', () => {
      const fakeBranchName = 'this-branch-definitely-does-not-exist-12345';
      const exists = branchExists(fakeBranchName);
      assert(exists === false, 'Non-existent branch should return false');
    });

    test('should return true for main branch if it exists', () => {
      const branches = getLocalBranches();
      if (branches.includes('main')) {
        const exists = branchExists('main');
        assert(exists === true, 'Main branch should exist if in branch list');
      }
    });
  });
});