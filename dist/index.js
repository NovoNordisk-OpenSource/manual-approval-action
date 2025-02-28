"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const rest_1 = require("@octokit/rest");
const github_1 = require("@actions/github");
const process = __importStar(require("process"));
const fs = __importStar(require("fs"));
// Constants
const pollingInterval = 10 * 1000; // 10 seconds in milliseconds
const envVarRepoFullName = 'GITHUB_REPOSITORY';
const envVarRunID = 'GITHUB_RUN_ID';
const envVarRepoOwner = 'GITHUB_REPOSITORY_OWNER';
const envVarWorkflowInitiator = 'GITHUB_ACTOR';
const envVarToken = 'INPUT_SECRET';
const envVarApprovers = 'INPUT_APPROVERS';
const envVarMinimumApprovals = 'INPUT_MINIMUM-APPROVALS';
const envVarIssueTitle = 'INPUT_ISSUE-TITLE';
const envVarIssueBody = 'INPUT_ISSUE-BODY';
const envVarExcludeWorkflowInitiatorAsApprover = 'INPUT_EXCLUDE-WORKFLOW-INITIATOR-AS-APPROVER';
const envVarAdditionalApprovedWords = 'INPUT_ADDITIONAL-APPROVED-WORDS';
const envVarAdditionalDeniedWords = 'INPUT_ADDITIONAL-DENIED-WORDS';
const envVarFailOnDenial = 'INPUT_FAIL-ON-DENIAL';
const envVarTargetRepoOwner = 'INPUT_TARGET-REPOSITORY-OWNER';
const envVarTargetRepo = 'INPUT_TARGET-REPOSITORY';
function readAdditionalWords(envVar) {
    var _a;
    const rawValue = ((_a = process.env[envVar]) === null || _a === void 0 ? void 0 : _a.trim()) || '';
    if (rawValue.length === 0) {
        return [];
    }
    return rawValue.split(',').map(word => word.trim());
}
const additionalApprovedWords = readAdditionalWords(envVarAdditionalApprovedWords);
const additionalDeniedWords = readAdditionalWords(envVarAdditionalDeniedWords);
const approvedWords = ['approved', 'approve', 'lgtm', 'yes', ...additionalApprovedWords];
const deniedWords = ['denied', 'deny', 'no', ...additionalDeniedWords];
const ApprovalStatusApproved = 'approved';
const ApprovalStatusDenied = 'denied';
const ApprovalStatusPending = 'pending';
// Approval functions
function newApprovalEnvironment(client, repoFullName, repoOwner, runID, approvers, minimumApprovals, issueTitle, issueBody, targetRepoOwner, targetRepoName, failOnDenial) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
function runURL(a) {
    let baseUrl = a.client.request.endpoint.DEFAULTS.baseUrl;
    if (baseUrl.includes('github.com')) {
        baseUrl = 'https://github.com/';
    }
    return `${baseUrl}${a.repoFullName}/actions/runs/${a.runID}`;
}
function createApprovalIssue(ctx, a) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const { data: issue } = yield a.client.issues.create({
            owner: a.targetRepoOwner,
            repo: a.targetRepoName,
            title: issueTitle,
            body: bodyMessage,
        });
        a.approvalIssue = issue;
        a.approvalIssueNumber = issue.number;
        console.log(`Approval issue created: ${issue.html_url}`);
    });
}
function approvalFromComments(comments, approvers, minimumApprovals) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const approverSet = new Set(approvers.map(a => a.toLowerCase()));
        const approvedBy = new Set();
        const deniedBy = new Set();
        for (const comment of comments) {
            const commentUser = (_b = (_a = comment.user) === null || _a === void 0 ? void 0 : _a.login) === null || _b === void 0 ? void 0 : _b.toLowerCase();
            if (!commentUser || !approverSet.has(commentUser)) {
                continue;
            }
            const commentBody = ((_c = comment.body) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || '';
            const isApproval = approvedWords.some(word => commentBody.includes(word.toLowerCase()));
            const isDenial = deniedWords.some(word => commentBody.includes(word.toLowerCase()));
            if (isApproval) {
                approvedBy.add(commentUser);
            }
            else if (isDenial) {
                deniedBy.add(commentUser);
            }
        }
        if (deniedBy.size > 0) {
            return ApprovalStatusDenied;
        }
        if (approvedBy.size >= minimumApprovals) {
            return ApprovalStatusApproved;
        }
        return ApprovalStatusPending;
    });
}
// Retrieves the list of approvers
function retrieveApprovers(client, repoOwner) {
    return __awaiter(this, void 0, void 0, function* () {
        const approversInput = core.getInput('APPROVERS');
        if (!approversInput) {
            throw new Error('No approvers specified');
        }
        return approversInput.split(',').map(approver => approver.trim());
    });
}
// Action Output
function setActionOutput(name, value) {
    return __awaiter(this, void 0, void 0, function* () {
        const outputPath = process.env.GITHUB_OUTPUT;
        if (!outputPath) {
            throw new Error('GITHUB_OUTPUT environment variable is not set');
        }
        yield fs.promises.appendFile(outputPath, `${name}=${value}\n`);
    });
}
// Handle interrupt
function handleInterrupt(client, apprv) {
    return __awaiter(this, void 0, void 0, function* () {
        const newState = 'closed';
        const closeComment = 'Workflow cancelled, closing issue.';
        console.log(closeComment);
        try {
            yield client.issues.createComment({
                owner: apprv.targetRepoOwner,
                repo: apprv.targetRepoName,
                issue_number: apprv.approvalIssueNumber,
                body: closeComment,
            });
            yield client.issues.update({
                owner: apprv.targetRepoOwner,
                repo: apprv.targetRepoName,
                issue_number: apprv.approvalIssueNumber,
                state: newState,
            });
        }
        catch (err) {
            console.error(`Error handling interrupt: ${err}`);
        }
    });
}
// Comment loop to check for approvals
function newCommentLoopChannel(client, apprv) {
    let interval;
    interval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
        try {
            const { data: comments } = yield client.issues.listComments({
                owner: apprv.targetRepoOwner,
                repo: apprv.targetRepoName,
                issue_number: apprv.approvalIssueNumber,
            });
            const approved = yield approvalFromComments(comments, apprv.issueApprovers, apprv.minimumApprovals);
            console.log(`Workflow status: ${approved}`);
            if (approved === ApprovalStatusApproved) {
                const newState = 'closed';
                const closeComment = 'All approvers have approved, continuing workflow and closing this issue.';
                yield client.issues.createComment({
                    owner: apprv.targetRepoOwner,
                    repo: apprv.targetRepoName,
                    issue_number: apprv.approvalIssueNumber,
                    body: closeComment,
                });
                yield client.issues.update({
                    owner: apprv.targetRepoOwner,
                    repo: apprv.targetRepoName,
                    issue_number: apprv.approvalIssueNumber,
                    state: newState,
                });
                console.log('Workflow manual approval completed');
                clearInterval(interval);
            }
            else if (approved === ApprovalStatusDenied) {
                const newState = 'closed';
                let closeComment = 'Request denied. Closing issue ';
                closeComment += apprv.failOnDenial ? 'and failing' : 'but continuing';
                closeComment += ' workflow.';
                yield client.issues.createComment({
                    owner: apprv.targetRepoOwner,
                    repo: apprv.targetRepoName,
                    issue_number: apprv.approvalIssueNumber,
                    body: closeComment,
                });
                yield client.issues.update({
                    owner: apprv.targetRepoOwner,
                    repo: apprv.targetRepoName,
                    issue_number: apprv.approvalIssueNumber,
                    state: newState,
                });
                clearInterval(interval);
            }
        }
        catch (err) {
            console.error(`Error in comment loop: ${err}`);
            clearInterval(interval);
        }
    }), pollingInterval);
    return interval;
}
// GitHub client
function newGithubClient() {
    return __awaiter(this, void 0, void 0, function* () {
        const token = core.getInput('GITHUB_TOKEN');
        return new rest_1.Octokit({ auth: token });
    });
}
// Input validation
function validateInput() {
    return __awaiter(this, void 0, void 0, function* () {
        const requiredEnvVars = [
            'GITHUB_REPOSITORY',
            'GITHUB_RUN_ID',
            'GITHUB_REPOSITORY_OWNER',
            'GITHUB_TOKEN',
            'APPROVERS',
        ];
        const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
        if (missingEnvVars.length > 0) {
            throw new Error(`Missing env vars: ${missingEnvVars.join(', ')}`);
        }
    });
}
// Main function
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield validateInput();
            const targetRepoName = core.getInput('TARGET_REPO');
            const targetRepoOwner = core.getInput('TARGET_REPO_OWNER');
            const repoFullName = process.env.GITHUB_REPOSITORY;
            const runID = parseInt(process.env.GITHUB_RUN_ID, 10);
            const repoOwner = process.env.GITHUB_REPOSITORY_OWNER;
            const [owner, repo] = repoFullName.split('/');
            const finalTargetRepoOwner = targetRepoOwner || owner;
            const finalTargetRepoName = targetRepoName || repo;
            const client = yield newGithubClient();
            const approvers = core.getInput('APPROVERS').split(',');
            const failOnDenial = core.getBooleanInput('FAIL_ON_DENIAL');
            const issueTitle = core.getInput('ISSUE_TITLE');
            const issueBody = core.getInput('ISSUE_BODY');
            const minimumApprovals = parseInt(core.getInput('MINIMUM_APPROVALS'), 10);
            const apprv = yield newApprovalEnvironment(client, repoFullName, repoOwner, runID, approvers, minimumApprovals, issueTitle, issueBody, finalTargetRepoOwner, finalTargetRepoName, failOnDenial);
            yield createApprovalIssue(github_1.context, apprv);
            const interval = newCommentLoopChannel(client, apprv);
            process.on('SIGINT', () => __awaiter(this, void 0, void 0, function* () {
                yield handleInterrupt(client, apprv);
                process.exit(1);
            }));
        }
        catch (err) {
            core.setFailed(`Action failed with error: ${err}`);
        }
    });
}
// Run the application
main();
