import * as core from '@actions/core';
import { validateInput } from '../src/index';

// Mock core
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  setFailed: jest.fn()
}));

describe('Input Validation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  
  it('should throw error when secret is missing', async () => {
    (core.getInput as jest.Mock).mockImplementation((name) => {
      if (name === 'secret') return '';
      if (name === 'approvers') return 'user1,user2';
      return '';
    });
    
    await expect(validateInput()).rejects.toThrow('Required input "secret" is missing');
  });
  
  it('should throw error when approvers is missing', async () => {
    (core.getInput as jest.Mock).mockImplementation((name) => {
      if (name === 'secret') return 'token123';
      if (name === 'approvers') return '';
      return '';
    });
    
    await expect(validateInput()).rejects.toThrow('Required input "approvers" is missing');
  });
  
  it('should throw error when minimum approvals is invalid', async () => {
    (core.getInput as jest.Mock).mockImplementation((name) => {
      if (name === 'secret') return 'token123';
      if (name === 'approvers') return 'user1,user2';
      if (name === 'MINIMUM_APPROVALS') return 'invalid';
      return '';
    });
    
    await expect(validateInput()).rejects.toThrow('MINIMUM_APPROVALS must be a positive number');
  });
  
  it('should validate successfully with valid inputs', async () => {
    (core.getInput as jest.Mock).mockImplementation((name) => {
      if (name === 'secret') return 'token123';
      if (name === 'approvers') return 'user1,user2';
      if (name === 'MINIMUM_APPROVALS') return '1';
      return '';
    });
    
    await expect(validateInput()).resolves.not.toThrow();
  });
});