import * as core from '@actions/core';
import { context } from '@actions/github';

// Mock core module
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  setFailed: jest.fn(),
  debug: jest.fn(),
  info: jest.fn()
}));

// Use fake timers to prevent real timers from running
jest.useFakeTimers();

// Define a variable to store mocked approval response
let mockedApprovalStatus = "pending";

// Mock the interval timers 
let mockInterval: NodeJS.Timeout;

// Mock the src/index module
jest.mock('../src/index', () => {
  const originalModule = jest.requireActual('../src/index');
  
  // Mock the setInterval function
  global.setInterval = jest.fn((callback, ms) => {
    mockInterval = setImmediate(() => callback()) as unknown as NodeJS.Timeout;
    return mockInterval;
  }) as unknown as typeof setInterval;
  
  // Mock clearInterval to actually clear our mocked intervals
  global.clearInterval = jest.fn((interval) => {
    if (interval === mockInterval) {
      clearImmediate(mockInterval as unknown as NodeJS.Immediate);
    }
  }) as unknown as typeof clearInterval;
  
  return {
    ...originalModule,
    // Mock the GitHub client creation
    newGithubClient: jest.fn().mockImplementation(() => {
      return {
        issues: {
          create: jest.fn().mockResolvedValue({ 
            data: { 
              number: 123, 
              html_url: 'https://github.com/owner/repo/issues/123' 
            } 
          }),
          update: jest.fn().mockResolvedValue({}),
          createComment: jest.fn().mockResolvedValue({}),
          listComments: jest.fn().mockResolvedValue({ data: [] })
        },
        rest: {
          issues: {
            create: jest.fn().mockResolvedValue({ 
              data: { 
                number: 123, 
                html_url: 'https://github.com/owner/repo/issues/123' 
              } 
            }),
            update: jest.fn().mockResolvedValue({}),
            createComment: jest.fn().mockResolvedValue({}),
            listComments: jest.fn().mockResolvedValue({ data: [] })
          }
        },
        paginate: jest.fn().mockResolvedValue([]),
        request: jest.fn().mockResolvedValue({}),
      };
    }),
    // Mock the approval function to return controlled responses
    approvalFromComments: jest.fn().mockImplementation(() => Promise.resolve(mockedApprovalStatus)),
    // Replace the polling interval with a shorter one for tests
    config: {
      ...originalModule.config,
      pollingInterval: 100 // Make this shorter for tests
    }
  };
});

describe('Main Workflow', () => {
  let originalConsoleLog;
  let originalConsoleError;

  beforeEach(() => {
    jest.resetAllMocks();
    
    // Mock console.log and console.error to prevent test output pollution
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Setup environment variables
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_RUN_ID = '12345';
    process.env.GITHUB_REPOSITORY_OWNER = 'owner';
    process.env.GITHUB_ACTOR = 'user1';
    
    // Configure core mock implementations
    (core.getInput as jest.Mock).mockImplementation((name) => {
      switch(name) {
        case 'secret': return 'test-token';
        case 'approvers': return 'user1,user2';
        case 'MINIMUM_APPROVALS': return '1';
        case 'issue_title': return 'Approval for {run_id}';
        case 'issue_body': return 'Please approve {run_id}';
        case 'TARGET_REPO': return '';
        case 'TARGET_REPO_OWNER': return '';
        default: return '';
      }
    });
    
    (core.getBooleanInput as jest.Mock).mockReturnValue(false);
    
    // Set up a mock GitHub context
    Object.defineProperty(context, 'repo', {
      value: {
        owner: 'owner',
        repo: 'repo'
      },
      configurable: true
    });
  });
  
  afterEach(() => {
    // Restore original console functions
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    // Clear any remaining intervals
    if (mockInterval) {
      clearInterval(mockInterval);
      mockInterval = undefined;
    }
    
    // Run any pending timers
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should validate inputs without error', async () => {
    const { validateInput } = require('../src/index');
    await validateInput();
    expect(core.setFailed).not.toHaveBeenCalled();
  });
  
  it('should create an approval issue successfully', async () => {
    // Import the functions we want to test directly
    const { validateInput, createApprovalIssue } = require('../src/index');
    
    // Create a mock client
    const mockClient = {
      issues: {
        create: jest.fn().mockResolvedValue({ 
          data: { 
            number: 123,
            html_url: 'https://github.com/owner/repo/issues/123' 
          } 
        }),
        update: jest.fn().mockResolvedValue({}),
        createComment: jest.fn().mockResolvedValue({}),
        listComments: jest.fn().mockResolvedValue({ data: [] })
      },
      rest: {
        issues: {
          create: jest.fn().mockResolvedValue({ 
            data: { 
              number: 123, 
              html_url: 'https://github.com/owner/repo/issues/123' 
            } 
          }),
          update: jest.fn().mockResolvedValue({}),
          createComment: jest.fn().mockResolvedValue({}),
          listComments: jest.fn().mockResolvedValue({ data: [] })
        }
      },
      paginate: jest.fn().mockResolvedValue([]),
      request: {
        endpoint: {
          DEFAULTS: { baseUrl: 'https://api.github.com' }
        }
      }
    };

    // Create context for first parameter
    const ctx = { 
      repo: { 
        owner: 'owner', 
        repo: 'repo' 
      } 
    };
    
    // Create approval environment for second parameter
    const approvalEnv = {
      client: mockClient,
      repoFullName: 'owner/repo',
      repo: 'repo',
      repoOwner: 'owner',
      runID: 12345,
      approvalIssueNumber: 0,
      issueTitle: 'Approval for {run_id}',
      issueBody: 'Please approve {run_id}',
      issueApprovers: ['user1', 'user2'],
      minimumApprovals: 1,
      targetRepoOwner: 'owner',
      targetRepoName: 'repo',
      failOnDenial: false
    };
    
    // Call the function we're testing
    await createApprovalIssue(ctx, approvalEnv);
    
    // Check that the issue was created with the right parameters
    expect(mockClient.issues.create).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      title: expect.stringContaining('12345'), // Should contain the run ID
      body: expect.any(String)
    });
    
    // Check that the approval issue number was updated
    expect(approvalEnv.approvalIssueNumber).toBe(123);
  });
  
  // Modified test that handles async operations properly
  it('should run the entire approval flow successfully', async () => {
    // Import the module with the mocked functions
    const index = require('../src/index');
    
    // Mock out the newCommentLoopChannel to return a controllable interval
    const mockClearInterval = jest.fn();
    
    index.newCommentLoopChannel = jest.fn().mockImplementation(() => {
      const interval = {} as NodeJS.Timeout;
      // Store the interval so we can clear it
      mockInterval = interval;
      return interval;
    });
    
    // Run the main function
    await index.main();
    
    // Validate that the correct functions were called
    expect(core.setFailed).not.toHaveBeenCalled();
    
    // Make sure the test completes by manually clearing the interval
    if (mockInterval) {
      clearInterval(mockInterval);
    }
  });
});