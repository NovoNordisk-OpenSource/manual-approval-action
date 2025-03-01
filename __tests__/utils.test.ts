import * as core from '@actions/core';
import { approvalFromComments, readAdditionalWords } from '../src/index';

// Mock core
jest.mock('@actions/core');

describe('Utility Functions', () => {
  describe('readAdditionalWords', () => {
    it('should return empty array for empty input', () => {
      process.env.TEST_ENV = '';
      const result = readAdditionalWords('TEST_ENV');
      expect(result).toEqual([]);
    });

    it('should parse comma-separated words properly', () => {
      process.env.TEST_ENV = 'word1,word2, word3';
      const result = readAdditionalWords('TEST_ENV');
      expect(result).toEqual(['word1', 'word2', 'word3']);
    });
  });
  
  describe('approvalFromComments', () => {
    it('should return approved status when comment contains approval word', async () => {
      const comments = [
        {
          user: { login: 'approver1' },
          body: 'I approve this change'
        }
      ];
      
      const result = await approvalFromComments(comments as any, ['approver1'], 1);
      expect(result).toBe('approved');
    });
    
    it('should return denied status when comment contains denial word', async () => {
      const comments = [
        {
          user: { login: 'approver1' },
          body: 'I deny this change'
        }
      ];
      
      const result = await approvalFromComments(comments as any, ['approver1'], 1);
      expect(result).toBe('denied');
    });
    
    it('should return pending when no approval/denial comments', async () => {
      const comments = [
        {
          user: { login: 'approver1' },
          body: 'Just looking at this'
        }
      ];
      
      const result = await approvalFromComments(comments as any, ['approver1'], 1);
      expect(result).toBe('pending');
    });
  });
});