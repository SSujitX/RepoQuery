import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from 'octokit';
import { SettingsService } from '../settings/settings.service';

/**
 * Calendar REST version (send on every request). GitHub lists supported versions here:
 * https://docs.github.com/en/rest/about-the-rest-api/api-versions
 * Before bumping, read: https://docs.github.com/en/rest/overview/breaking-changes
 */
const GITHUB_REST_API_VERSION = '2026-03-10';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(private readonly settingsService: SettingsService) {}

  /** Token from Settings (DB) only; unauthenticated requests if unset. */
  private async getOctokit(): Promise<Octokit> {
    let token: string | undefined;
    try {
      const settings = await this.settingsService.getSettings();
      const fromDb = settings?.githubToken?.trim();
      if (fromDb) {
        token = fromDb;
      }
    } catch {
      // ignore settings read errors
    }
    const requestDefaults = {
      headers: {
        'X-GitHub-Api-Version': GITHUB_REST_API_VERSION,
      },
    };
    return token
      ? new Octokit({ auth: token, request: requestDefaults })
      : new Octokit({ request: requestDefaults });
  }

  async fetchRepoMetadata(owner: string, repo: string) {
    const client = await this.getOctokit();
    const { data } = await client.rest.repos.get({ owner, repo });
    return data;
  }

  async fetchRepoBranches(owner: string, repo: string) {
    const client = await this.getOctokit();
    const { data } = await client.rest.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });
    return data.map((item) => item.name);
  }

  async fetchRepoTree(owner: string, repo: string, branch: string) {
    const client = await this.getOctokit();
    const commit = await client.rest.repos.getBranch({ owner, repo, branch });
    const treeSha = commit.data.commit.commit.tree.sha;
    const { data } = await client.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: 'true',
    });
    return data.tree;
  }

  async fetchFileContent(owner: string, repo: string, path: string, ref: string) {
    const client = await this.getOctokit();
    try {
      const { data } = await client.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
        request: {
          signal: AbortSignal.timeout(8000),
        },
      });

      if ('content' in data) {
        return Buffer.from(data.content, 'base64').toString('utf8');
      }
    } catch (error) {
      this.logger.warn(`Unable to fetch content for ${path}: ${String(error)}`);
    }
    return null;
  }

  /**
   * Preferred file download method.
   * Uses the Git Data API (blob SHA from the repo tree) to avoid deprecated contents calls.
   */
  async fetchBlobContent(owner: string, repo: string, sha: string) {
    const client = await this.getOctokit();
    try {
      const { data } = await client.rest.git.getBlob({
        owner,
        repo,
        file_sha: sha,
        request: {
          signal: AbortSignal.timeout(8000),
        },
      });
      if (typeof data?.content === 'string' && typeof data?.encoding === 'string') {
        if (data.encoding === 'base64') {
          return Buffer.from(data.content, 'base64').toString('utf8');
        }
        // Fall back: best-effort decode if GitHub ever changes encoding.
        return data.content;
      }
    } catch (error) {
      this.logger.warn(`Unable to fetch blob ${sha}: ${String(error)}`);
    }
    return null;
  }

  async fetchIssues(owner: string, repo: string) {
    const client = await this.getOctokit();
    const { data } = await client.rest.issues.listForRepo({
      owner,
      repo,
      state: 'all',
      per_page: 100,
    });
    return data.filter((item) => !('pull_request' in item));
  }

  async fetchPullRequests(owner: string, repo: string) {
    const client = await this.getOctokit();
    const { data } = await client.rest.pulls.list({
      owner,
      repo,
      state: 'all',
      per_page: 100,
    });
    return data;
  }

  async fetchDiscussions(owner: string, repo: string) {
    const client = await this.getOctokit();
    const query = `
      query RepoDiscussions($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          discussions(first: 100) {
            nodes {
              number
              title
              body
              updatedAt
              category {
                name
              }
            }
          }
        }
      }
    `;
    try {
      const response = (await Promise.race([
        client.graphql<{
          repository?: { discussions?: { nodes: Array<any> } };
        }>(query, { owner, repo }),
        new Promise<{
          repository?: { discussions?: { nodes: Array<any> } };
        }>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Discussions request timed out'));
          }, 12000);
        }),
      ])) as {
        repository?: { discussions?: { nodes: Array<any> } };
      };
      return response.repository?.discussions?.nodes ?? [];
    } catch (error) {
      this.logger.warn(`Unable to fetch discussions: ${String(error)}`);
      return [];
    }
  }

  async fetchCommits(owner: string, repo: string, branch: string) {
    const client = await this.getOctokit();
    const { data } = await client.rest.repos.listCommits({
      owner,
      repo,
      sha: branch,
      per_page: 100,
    });
    return data;
  }
}
