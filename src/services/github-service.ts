import { Octokit } from '@octokit/rest';

export interface GitHubConfig {
  auth: string;
  owner: string;
  repo: string;
}

export interface CreateIssueParams {
  title: string;
  body?: string;
  labels?: string[];
  assignee?: string;
}

export interface CreatePullRequestParams {
  title: string;
  body: string;
  head: string;
  base: string;
  issue?: number;
}

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.auth });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  async createIssue(params: CreateIssueParams): Promise<any> {
    const response = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title: params.title,
      body: params.body,
      labels: params.labels,
      assignee: params.assignee
    });

    return response.data;
  }

  async getIssue(issueNumber: number): Promise<any> {
    const response = await this.octokit.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber
    });

    return response.data;
  }

  async updateIssue(issueNumber: number, updates: any): Promise<any> {
    const response = await this.octokit.issues.update({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      ...updates
    });

    return response.data;
  }

  async listIssues(params?: { state?: 'open' | 'closed' | 'all'; labels?: string[] }): Promise<any[]> {
    const response = await this.octokit.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      state: params?.state || 'open',
      labels: params?.labels?.join(',')
    });

    return response.data;
  }

  async addLabel(issueNumber: number, label: string): Promise<void> {
    await this.octokit.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      labels: [label]
    });
  }

  async removeLabel(issueNumber: number, label: string): Promise<void> {
    try {
      await this.octokit.issues.removeLabel({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        name: label
      });
    } catch (error: any) {
      if (error.status !== 404) {
        throw error;
      }
    }
  }

  async addComment(issueNumber: number, body: string): Promise<any> {
    const response = await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body
    });

    return response.data;
  }

  async createPullRequest(params: CreatePullRequestParams): Promise<any> {
    const response = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: params.title,
      body: params.body,
      head: params.head,
      base: params.base
    });

    if (params.issue) {
      await this.addComment(
        params.issue,
        `Created pull request #${response.data.number}`
      );
    }

    return response.data;
  }

  async getPullRequest(pullNumber: number): Promise<any> {
    const response = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: pullNumber
    });

    return response.data;
  }

  async mergePullRequest(pullNumber: number, commitMessage?: string): Promise<any> {
    const response = await this.octokit.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: pullNumber,
      commit_message: commitMessage
    });

    return response.data;
  }

  async closePullRequest(pullNumber: number): Promise<any> {
    const response = await this.octokit.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: pullNumber,
      state: 'closed'
    });

    return response.data;
  }

  async createBranch(branchName: string, baseSha: string): Promise<any> {
    const response = await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });

    return response.data;
  }

  async getDefaultBranch(): Promise<string> {
    const response = await this.octokit.repos.get({
      owner: this.owner,
      repo: this.repo
    });

    return response.data.default_branch;
  }

  async getLatestCommit(branch?: string): Promise<any> {
    const defaultBranch = branch || await this.getDefaultBranch();
    
    const response = await this.octokit.repos.getCommit({
      owner: this.owner,
      repo: this.repo,
      ref: defaultBranch
    });

    return response.data;
  }
}