# Manual Approval Action Now Available in QMS Framework

## Overview

The Manual Approval Action provides a critical control point in CI/CD pipelines, allowing designated team members to review and approve workflow progression. This capability ensures governance, compliance, and quality control within the QMS Framework.

## Key Features

- **Human-in-the-loop workflows**: Pause execution until explicit approval
- **Flexible approver configuration**: Define single or multiple required approvers
- **Minimum approval thresholds**: Set the number of required approvals
- **Customizable messaging**: Configure issue titles and descriptions
- **Approval/denial keywords**: Use standard or define custom approval words
- **Security controls**: Option to exclude workflow initiators as approvers
- **Configurable on denial**: Choose workflow behavior when approval is denied

## Implementation Guide

### Basic Configuration

Add the following step to your workflow file:

```yaml
- name: Manual Approval Gate
  uses: novonordisk/manual-approval-action@v1
  with:
    secret: ${{ secrets.GITHUB_TOKEN }}
    approvers: qms-reviewer1,qms-reviewer2
    minimum-approvals: 1
    issue-title: "QMS Approval Required: {run_id}"
    issue-body: "Please review the following changes for compliance with QMS requirements."
```

## Approval Process

1. When the workflow reaches the approval step, it creates an issue in your repository
2. The issue notifies designated approvers who review the request
3. Approvers comment on the issue with approval keywords such as approve, lgtm, or yes
4. Once the required number of approvals is met, the workflow continues
5. If denied with keywords like deny or no, the workflow can fail or continue based on configuration

## QMS Integration examples

## Document Review Process

```yaml
name: Document Review Process
on:
  pull_request:
    paths:
      - "docs/sop/**"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Document Validation
        run: ./scripts/validate-docs.sh

      - name: QMS Manual Approval
        uses: NovoNordisk-OpenSource/manual-approval-action@latest
        with:
          secret: ${{ secrets.GITHUB_TOKEN }}
          approvers: quality-officer,compliance-manager
          minimum-approvals: 2
          issue-title: "SOP Change Approval: {run_id}"
          issue-body: "Please verify this SOP change meets quality standards."
          exclude-workflow-initiator-as-approver: true
          fail-on-denial: true

      - name: Merge if approved
        run: ./scripts/finalize-document.sh
```

## Production Deployment Gate

```yaml
name: Production Deployment
on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and Test
        run: ./scripts/build-and-test.sh

      - name: Production Approval Gate
        uses: NovoNordisk-OpenSource/manual-approval-action@latest

        with:
          secret: ${{ secrets.GITHUB_TOKEN }}
          approvers: release-manager,qa-lead
          minimum-approvals: 1
          issue-title: "Production Release Approval: {run_id}"
          issue-body: "Release candidate has passed all tests and is ready for production. Please approve."

      - name: Deploy to Production
        run: ./scripts/deploy-production.sh
```

## Best Practises

1. Clear Approver Definition: Designate specific team members responsible for approvals
2. Prevent Self-Approval: Enable exclude-workflow-initiator-as-approver for separation of duties
3. Meaningful Issue Content: Provide detailed context in the issue body to aid approver decisions
4. Set Appropriate Thresholds: Configure minimum approvals based on risk and compliance requirements
5. Custom Approval Words: Define industry-specific approval terminology when needed

## Support and resources

For more information on the Manual Approval Action, refer to:

- [Manual Approval Action](https://github.com/NovoNordisk-OpenSource/manual-approval-action)
- [QMS Framework documentation](https://qms.novonordisk.com)

For assistancewith implementation, contact the QMS Support team.
