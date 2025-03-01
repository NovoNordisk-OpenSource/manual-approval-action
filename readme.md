# Manual Approval Action

A GitHub Action that creates an approval request issue and waits for approvals from designated reviewers before proceeding with your workflow.

## Overview

This action helps implement manual approval gates in your GitHub Actions workflows. When triggered, it:

1. Creates a new GitHub issue requesting approval
2. Pauses the workflow execution
3. Monitors the issue comments for approval or denial messages
4. Continues or cancels the workflow based on the approvers' decisions

## Features
- ✅ Customizable approval request titles and messages
- ✅ Support for multiple approvers
- ✅ Configurable minimum number of approvals
- ✅ Cross-repository issue creation
- ✅ Timeout functionality
- ✅ Automatic issue closing after workflow completion

## Installation

This action is available in the GitHub Actions Marketplace. Simply reference it in your workflow file:

```yaml
- name: Manual Approval Step
  uses: showoffninja/manual-approval-action-ts@v1
  with:
    secret: ${{ secrets.GITHUB_TOKEN }}
    approvers: user1,user2,user3
```

## Example Workflow

Here is an example of a workflow that uses this action to implement a manual approval gate:

```yaml
name: Workflow with Approval Gate

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Build and test
        run: |
          npm ci
          npm test
          
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Request manual approval
        uses: your-username/manual-approval-action-ts@v1
        with:
          secret: ${{ secrets.GITHUB_TOKEN }}
          approvers: user1,user2,user3
          MINIMUM_APPROVALS: 2
          
      - name: Deploy to production
        run: |
          echo "Deploying to production..."
       # Your deployment commands here
```

## Input Parameters
| Parameter | Description | Required | Default |
|-----------|-------------|----------|---------|
| `secret` | GitHub token for authentication | Yes | N/A |
| `approvers` | Comma-separated list of GitHub usernames who can approve the request | Yes | N/A |
| `MINIMUM_APPROVALS` | Minimum number of approvals required | No | 1 |
| `issue_title` | Title of the created issue. Use {run_id} placeholder to include the run ID | No | "Manual approval required for workflow run {run_id}" |
| `issue_body` | Body of the created issue. Use {run_id} placeholder to include the run ID | No | "Please approve workflow run {run_id}" |
| `TARGET_REPO` | Repository name where the approval issue should be created | No | Current repository |
| `TARGET_REPO_OWNER` | Owner name where the approval issue should be created | No | Current owner |

## How Manual Approval Works

1. When the action runs, it creates a new issue in the specified repository
2. The workflow `pauses` and waits for comments
3. Designated approvers can comment on the issue:
  - To approve: Comment with `"approved"`, `"approve"`, `"lgtm"`, or `"yes"`
  - To deny: Comment with `"denied"`, `"deny"`, or `"no"`
4. Once the required number of approvals is reached, the workflow continues
5. If the request is denied and `fail-on-denial` is enabled, the workflow will fail; otherwise, denial of approval will cause the workflow to be `cancelled`
6. After completion, the issue is automatically closed

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License
This project is licenced under the MIT License - see the 