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
- ✅ Exclude workflow initiator as an approver
- ✅ Additional approved and denied words
- ✅ Fail workflow on denial
- ✅ Customizable issue title and body
- ✅ Customizable labelling
- ✅ Automatic issue closing after workflow completion
- ✅ Lock issue as resolved, when approved or denied

## Installation

This action is available in the GitHub Actions Marketplace. Simply reference it in your workflow file:

```yaml
- name: Manual Approval Step
  uses: showoffninja/manual-approval-action-ts@v1
  with:
    secret: ${{ secrets.GITHUB_TOKEN }}
    approvers: user1,user2,user3
    minimum-approvals: 2
    exclude-workflow-initiator-as-approver: false
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
        uses: showoffninja/manual-approval-action-ts@main
        with:
          secret: ${{ secrets.GITHUB_TOKEN }}
          approvers: some_approver # This must be Github Users
          minimum-approvals: 1
          issue-body: |
            ## Deployment Request

            We're requesting approval to deploy **version v1.3.5** to production.

            ### Changes in this release

            - ✨ Added new feature for user authentication
            - 🐛 Fixed critical bug in payment processing
            - 🔒 Improved security for API endpoints

            ### Links

            - [View Release Notes](https://github.com/some-repository/manual-approval-action-ts/releases/tag/v1.3.5)
            - [Compare with previous version](https://github.com/some-repository/manual-approval-action-ts/compare/v1.3.4...v1.3.5)
            - [Deployment Documentation](https://github.com/some-repository/manual-approval-action-ts/wiki/Deployment)

            ### Impact Assessment

            - **Risk Level**: Low
            - **Services Affected**: Authentication, Payment
            - **Downtime Required**: None

            Please review and approve this deployment request. The workflow run ID is {run_id}.
          exclude-workflow-initiator-as-approver: false
          additional-approved-words: "approved-word-1, approved-word-2"
          additional-denied-words: "debnied-word-1, denied-word-2"
          issue-labels: "My Custom Label"

      # Your workflow commands goes here
```

## Input Parameters

| Parameter                                | Description                                                                     | Required | Default                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------- | -------- | ---------------------------------------------------- |
| `secret`                                 | GitHub token for authentication                                                 | Yes      | N/A                                                  |
| `approvers`                              | Comma-separated list of GitHub usernames who can approve the request            | Yes      | N/A                                                  |
| `minimum-approvals`                      | Minimum number of approvals required                                            | No       | 1                                                    |
| `issue_title`                            | Title of the created issue. Use {run_id} placeholder to include the run ID      | No       | "Manual approval required for workflow run {run_id}" |
| `issue_body`                             | Body of the created issue. Use {run_id} placeholder to include the run ID       | No       | "Please approve workflow run {run_id}....."          |
| `exclude-workflow-initiator-as-approver` | Exclude the workflow initiator as an approver                                   | Yes      | false                                                |
| `additional-approved-words`              | Comma separated list of additional words that can be used to approve the issue  | No       | ""                                                   |
| `additional-denied-words`                | Comma separated list of additional words that can be used to deny the issue     | No       | ""                                                   |
| `TARGET_REPO`                            | Repository name where the approval issue should be created                      | No       | Current repository                                   |
| `TARGET_REPO_OWNER`                      | Owner name where the approval issue should be created                           | No       | Current owner                                        |
| `issue-labels`                           | Label issues with custom labels for manual steps. Provide comma-separated input | No       | Current owner                                        |

## How Manual Approval Works

1. When the action runs, it creates a new issue in the specified repository
2. The workflow `pauses` and waits for comments
3. Designated approvers can comment on the issue:

- To approve: Comment with `"approved"`, `"approve"`, `"lgtm"`, or `"yes"`
- To deny: Comment with `"denied"`, `"deny"`, or `"no"`

4. The action monitors the issue comments and look for the specified keywords. The logic filters out comments and sentences that are more than 1 word to avoid false positives.
5. Once the required number of approvals is reached, the workflow continues
6. If the request is denied and `fail-on-denial` is enabled, the workflow will fail; otherwise, denial of approval will cause the workflow to be `cancelled`
7. After completion, the issue is automatically closed

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licenced under the MIT License - see the LICENSE file

```

```
