class MockOctokit {
    constructor() {
      this.issues = {
        create: jest.fn().mockResolvedValue({ data: { number: 123, html_url: 'https://github.com/owner/repo/issues/123' } }),
        update: jest.fn().mockResolvedValue({}),
        createComment: jest.fn().mockResolvedValue({}),
        listComments: jest.fn().mockResolvedValue({ data: [] })
      };
      this.rest = {
        issues: this.issues
      };

      // Fix the request structure
      this.request = jest.fn().mockResolvedValue({});
      
      // Make endpoint a property of request with DEFAULTS capitalized
      Object.defineProperty(this.request, 'endpoint', {
        get: () => ({
          DEFAULTS: { baseUrl: 'https://api.github.com' },
          defaults: jest.fn().mockReturnThis(),
          merge: jest.fn().mockReturnValue({})
        })
      });

      this.paginate = jest.fn().mockResolvedValue([]);
    }
  
    // Also define endpoint at the top level for completeness
    get endpoint() {
      return {
        DEFAULTS: { baseUrl: 'https://api.github.com' },
        defaults: jest.fn().mockReturnThis(),
        merge: jest.fn().mockReturnValue({})
      };
    }
  }
  
  const Octokit = jest.fn().mockImplementation(() => new MockOctokit());
  
  module.exports = { 
    Octokit,
    RestEndpointMethodTypes: {}
  };