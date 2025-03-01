import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import { RestEndpointMethodTypes } from '@octokit/rest';
import { context } from '@actions/github';
// import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const pollingInterval: number = 10 * 1000; // 10 seconds in milliseconds

const FAIL_ON_DENIAL:boolean = true;
const envVarRepoFullName: string = 'GITHUB_REPOSITORY';
const envVarRunID: string = 'GITHUB_RUN_ID';
const envVarRepoOwner: string = 'GITHUB_REPOSITORY_OWNER';
const envVarWorkflowInitiator: string = 'GITHUB_ACTOR';
const envVarToken: string = 'INPUT_SECRET';
const envVarApprovers: string = 'INPUT_APPROVERS';
const envVarMinimumApprovals: string = 'INPUT_MINIMUM-APPROVALS';
const envVarIssueTitle: string = 'INPUT_ISSUE-TITLE';
const envVarIssueBody: string = 'INPUT_ISSUE-BODY';
const envVarExcludeWorkflowInitiatorAsApprover: string = 'INPUT_EXCLUDE-WORKFLOW-INITIATOR-AS-APPROVER';
const envVarAdditionalApprovedWords: string = 'INPUT_ADDITIONAL-APPROVED-WORDS';
const envVarAdditionalDeniedWords: string = 'INPUT_ADDITIONAL-DENIED-WORDS';
const envVarFailOnDenial: string = 'INPUT_FAIL-ON-DENIAL';
const envVarTargetRepoOwner: string = 'INPUT_TARGET-REPOSITORY-OWNER';
const envVarTargetRepo: string = 'INPUT_TARGET-REPOSITORY';

function readAdditionalWords(envVar: string): string[] {
  const rawValue = process.env[envVar]?.trim() || '';
  if (rawValue.length === 0) {
    return [];
  }
  return rawValue.split(',').map(word => word.trim());
}

const additionalApprovedWords: string[] = readAdditionalWords(envVarAdditionalApprovedWords);
const additionalDeniedWords: string[] = readAdditionalWords(envVarAdditionalDeniedWords);

const approvedWords: string[] = ['approved', 'approve', 'lgtm', 'yes', ...additionalApprovedWords];
const deniedWords: string[] = ['denied', 'deny', 'no', ...additionalDeniedWords];

// Approval Status Types
type ApprovalStatus = 'approved' | 'denied' | 'pending';
const ApprovalStatusApproved: ApprovalStatus = 'approved';
const ApprovalStatusDenied: ApprovalStatus = 'denied';
const ApprovalStatusPending: ApprovalStatus = 'pending';

// Interfaces
interface ApprovalEnvironment {
  client: Octokit;
  repoFullName: string;
  repo: string;
  repoOwner: string;
  runID: number;
  approvalIssue?: RestEndpointMethodTypes["issues"]["get"]["response"]["data"];
  approvalIssueNumber: number;
  issueTitle: string;
  issueBody: string;
  issueApprovers: string[];
  minimumApprovals: number;
  targetRepoOwner: string;
  targetRepoName: string;
  failOnDenial: boolean;
}

// Approval functions
async function newApprovalEnvironment(
  client: Octokit,
  repoFullName: string,
  repoOwner: string,
  runID: number,
  approvers: string[],
  minimumApprovals: number,
  issueTitle: string,
  issueBody: string,
  targetRepoOwner: string,
  targetRepoName: string,
  failOnDenial: boolean
): Promise<ApprovalEnvironment> {
  const repoOwnerAndName = repoFullName.split('/');
  if (repoOwnerAndName.length !== 2) {
    throw new Error(`repo owner and name in unexpected format: ${repoFullName}`);
  }
  const repo = repoOwnerAndName[1];

  return {
    client,
    repoFullName,
    repo,
    repoOwner,
    runID,
    issueApprovers: approvers,
    minimumApprovals,
    issueTitle,
    issueBody,
    targetRepoOwner,
    targetRepoName,
    failOnDenial,
    approvalIssueNumber: 0,
  };
}

function runURL(a: ApprovalEnvironment): string {
  let baseUrl = a.client.request.endpoint.DEFAULTS.baseUrl;
  if (baseUrl.includes('github.com')) {
    baseUrl = 'https://github.com/';
  }
  return `${baseUrl}${a.repoFullName}/actions/runs/${a.runID}`;
}

async function createApprovalIssue(ctx: any, a: ApprovalEnvironment): Promise<void> {
  let issueTitle = `Manual approval required for workflow run ${a.runID}`;

  if (a.issueTitle) {
    issueTitle = a.issueTitle.replace('{run_id}', `${a.runID}`);
  }

  let approversBody = '';
  for (const approver of a.issueApprovers) {
    approversBody += `* @${approver}\n`;
  }

  let bodyMessage = `
## Manual Approval
Workflow is pending manual approval before proceeding.

### Approvers
The following people can approve this workflow:
${approversBody}

### Workflow
* **Repository:** ${a.repoFullName}
* **Workflow Run:** [${a.runID}](${runURL(a)})

### Instructions
* Comment \`approve\` or \`approved\` to approve this workflow.
* Comment \`deny\` or \`denied\` to deny this workflow.
* If denied, the workflow will continue unless the \`fail-on-denial\` input is set to true.
* A minimum of ${a.minimumApprovals} ${a.minimumApprovals > 1 ? 'approvals are' : 'approval is'} required.
`;

  if (a.issueBody) {
    bodyMessage = a.issueBody
      .replace('{run_id}', `${a.runID}`)
      .replace('{run_url}', runURL(a))
      .replace('{repo}', a.repoFullName)
      .replace('{approvers}', approversBody)
      .replace('{minimum_approvals}', `${a.minimumApprovals}`);
  }

  const { data: issue } = await a.client.issues.create({
    owner: a.targetRepoOwner,
    repo: a.targetRepoName,
    title: issueTitle,
    body: bodyMessage,
  });

  a.approvalIssue = issue;
  a.approvalIssueNumber = issue.number;

  console.log(`Approval issue created: ${issue.html_url}`);
}

async function approvalFromComments(
  comments: RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"],
  approvers: string[],
  minimumApprovals: number
): Promise<ApprovalStatus> {
  const approverSet = new Set(approvers.map(a => a.toLowerCase()));
  const approvedBy = new Set<string>();
  const deniedBy = new Set<string>();

  for (const comment of comments) {
    const commentUser = comment.user?.login?.toLowerCase();
    console.log(`Comment by ${commentUser}: ${comment.body}`);
    if (!commentUser || !approverSet.has(commentUser)) {
      continue;
    }

    const commentBody = comment.body?.toLowerCase() || '';
    
    const isApproval = approvedWords.some(word => commentBody.includes(word.toLowerCase()));
    const isDenial = deniedWords.some(word => commentBody.includes(word.toLowerCase()));

    console.log(`Checking comment: "${commentBody}"`);
    console.log(`Approved words: ${approvedWords.join(', ')}`);
    console.log(`Denied words: ${deniedWords.join(', ')}`);
    console.log(`Is approval: ${isApproval}, Is denial: ${isDenial}`);

    if (isApproval) {
      approvedBy.add(commentUser);
      console.log(`User ${commentUser} approved`);
      return ApprovalStatusApproved;
    } else if (isDenial) {
      deniedBy.add(commentUser);
      console.log(`User ${commentUser} denied`);
      return ApprovalStatusDenied;
    }
  }

  if (deniedBy.size > 0) {
    return ApprovalStatusDenied;
  }

  if (approvedBy.size >= minimumApprovals) {
    return ApprovalStatusApproved;
  }

  return ApprovalStatusPending;
}

// Retrieves the list of approvers
async function retrieveApprovers(client: Octokit, repoOwner: string): Promise<string[]> {
  const approversInput = core.getInput('APPROVERS');
  if (!approversInput) {
    throw new Error('No approvers specified');
  }

  return approversInput.split(',').map(approver => approver.trim());
}

// Action Output
async function setActionOutput(name: string, value: string): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error('GITHUB_OUTPUT environment variable is not set');
  }

  await fs.promises.appendFile(outputPath, `${name}=${value}\n`);
}

// Handle interrupt
async function handleInterrupt(client: Octokit, apprv: ApprovalEnvironment): Promise<void> {
  const newState = 'closed';
  const closeComment = 'Workflow cancelled, closing issue.';
  console.log(closeComment);

  try {
    await client.issues.createComment({
      owner: apprv.targetRepoOwner,
      repo: apprv.targetRepoName,
      issue_number: apprv.approvalIssueNumber,
      body: closeComment,
    });

    await client.issues.update({
      owner: apprv.targetRepoOwner,
      repo: apprv.targetRepoName,
      issue_number: apprv.approvalIssueNumber,
      state: newState,
    });
  } catch (err) {
    console.error(`Error handling interrupt: ${err}`);
  }
}

// Comment loop to check for approvals
function newCommentLoopChannel(client: Octokit, apprv: ApprovalEnvironment): NodeJS.Timeout {
  let interval: NodeJS.Timeout;
  
  interval = setInterval(async () => {
    try {
      const { data: comments } = await client.issues.listComments({
        owner: apprv.targetRepoOwner,
        repo: apprv.targetRepoName,
        issue_number: apprv.approvalIssueNumber,
      });

      const approved = await approvalFromComments(comments, apprv.issueApprovers, apprv.minimumApprovals);
      console.log(`Workflow status: ${approved}`);

      if (approved === ApprovalStatusApproved) {
        const newState = 'closed';
        const closeComment = 'All approvers have approved, continuing workflow and closing this issue.';

        await client.issues.createComment({
          owner: apprv.targetRepoOwner,
          repo: apprv.targetRepoName,
          issue_number: apprv.approvalIssueNumber,
          body: closeComment,
        });

        await client.issues.update({
          owner: apprv.targetRepoOwner,
          repo: apprv.targetRepoName,
          issue_number: apprv.approvalIssueNumber,
          state: newState,
        });

        console.log('Workflow manual approval completed');
        clearInterval(interval);
      } else if (approved === ApprovalStatusDenied) {
        const newState = 'closed';
        let closeComment = 'Request denied. Closing issue ';
        closeComment += apprv.failOnDenial ? 'and failing' : 'but continuing';
        closeComment += ' workflow.';

        await client.issues.createComment({
          owner: apprv.targetRepoOwner,
          repo: apprv.targetRepoName,
          issue_number: apprv.approvalIssueNumber,
          body: closeComment,
        });

        await client.issues.update({
          owner: apprv.targetRepoOwner,
          repo: apprv.targetRepoName,
          issue_number: apprv.approvalIssueNumber,
          state: newState,
        });

        clearInterval(interval);
      }
    } catch (err) {
      console.error(`Error in comment loop: ${err}`);
      clearInterval(interval);
    }
  }, pollingInterval);
  
  return interval;
}

// GitHub client
async function newGithubClient(): Promise<Octokit> {
  const token = core.getInput('secret');
  return new Octokit({ auth: token });
}

// Input validation
async function validateInput(): Promise<void> {
  console.log('Validating required inputs...');
  
  // Check for secret/token
  const secret = core.getInput('secret');
  if (!secret) {
    throw new Error('Required input "secret" is missing. Please provide a GitHub token.');
  }
  
  // Check for approvers
  const approvers = core.getInput('approvers');
  if (!approvers) {
    throw new Error('Required input "approvers" is missing. Please provide a comma-separated list of GitHub usernames.');
  }
  
  // Validate approvers format
  const approversList = approvers.split(',').map(approver => approver.trim()).filter(Boolean);
  console.log(`Found ${approversList.length} approvers: ${approversList.join(', ')}`);
  
  if (approversList.length === 0) {
    throw new Error('No valid approvers found. Please provide at least one GitHub username.');
  }
  
  // Validate minimum approvals if provided
  const minimumApprovals = core.getInput('MINIMUM_APPROVALS');
  if (minimumApprovals) {
    const minApprovalsNum = parseInt(minimumApprovals, 10);
    if (isNaN(minApprovalsNum) || minApprovalsNum < 1) {
      throw new Error('MINIMUM_APPROVALS must be a positive number.');
    }
    if (minApprovalsNum > approversList.length) {
      throw new Error(`MINIMUM_APPROVALS (${minApprovalsNum}) is greater than the number of approvers (${approversList.length}).`);
    }
  }
  
  console.log('Input validation successful');
}

// Main function
async function main(): Promise<void> {
  try {
    await validateInput();

    const targetRepoName = core.getInput('TARGET_REPO');
    const targetRepoOwner = core.getInput('TARGET_REPO_OWNER');
    const repoFullName = process.env.GITHUB_REPOSITORY!;
    const runID = parseInt(process.env.GITHUB_RUN_ID!, 10);
    const repoOwner = process.env.GITHUB_REPOSITORY_OWNER!;

    const [owner, repo] = repoFullName.split('/');
    const finalTargetRepoOwner = targetRepoOwner || owner;
    const finalTargetRepoName = targetRepoName || repo;
    console.log('targetRepoOwner:', finalTargetRepoOwner);
    console.log('targetRepoName:', finalTargetRepoName);

    const client = await newGithubClient();

    const approvers = core.getInput('approvers').split(',');
    const failOnDenial = FAIL_ON_DENIAL;
    
    const issueTitle = core.getInput('issue_title');
    const issueBody = core.getInput('issue_body');
    const minimumApprovals = parseInt(core.getInput('MINIMUM_APPROVALS'), 10);

    const apprv: ApprovalEnvironment = await newApprovalEnvironment(
      client,
      repoFullName,
      repoOwner,
      runID,
      approvers,
      minimumApprovals,
      issueTitle,
      issueBody,
      finalTargetRepoOwner,
      finalTargetRepoName,
      failOnDenial
    );

    await createApprovalIssue(context, apprv);

    const interval = newCommentLoopChannel(client, apprv);

    process.on('SIGINT', async () => {
      await handleInterrupt(client, apprv);
      process.exit(1);
    });
  } catch (err) {
    core.setFailed(`Action failed with error: ${err}`);
  }
}

// Run the application
main();