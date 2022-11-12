import { Octokit } from '@octokit/core';
import fs from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { ThenArg, PACKAGE_ROOT, sleep } from './utils';

export const PAGE_SIZE = 100;

type ResponseType = ThenArg<ReturnType<typeof searchRepositories>>;
export type RepositoryType = ResponseType['data']['items'][number];

export async function run(): Promise<void> {
  const accessToken = process.env.GITHUB_AUTH;
  if (!accessToken) {
    throw new Error(
      'Missing `GITHUB_AUTH` environment variable containing GitHub access token with `public_repo` scope.'
    );
  }

  const pathOutput = join(PACKAGE_ROOT, 'output');
  if (!fs.existsSync(pathOutput)) {
    fs.mkdirSync(pathOutput);
  }

  const PAGE_COUNT = 10; // GitHub only allows retrieval of the first 1000 search results.

  console.log(
    `Searching and cloning the top ${
      PAGE_COUNT * PAGE_SIZE
    } "eslint-plugin" GitHub repositories to ${pathOutput}.`
  );

  const pathSearchResultsDir = join(
    PACKAGE_ROOT,
    'output',
    'github-search-results'
  );
  fs.mkdirSync(pathSearchResultsDir, { recursive: true });
  for (let page = 1; page <= PAGE_COUNT; page++) {
    console.log(`Page ${page}`);

    const pathSearchResults = join(pathSearchResultsDir, `${page}.json`);

    // Skip if already searched.
    if (fs.existsSync(pathSearchResults)) {
      console.log(
        `\tSkipping GitHub search for already-retrieved page ${page}.`
      );
      continue;
    }

    const response = await searchRepositories(page, accessToken);

    // Save the response to a file so it can be reused.
    const reposJsonFile = fs.openSync(pathSearchResults, 'w');
    fs.writeSync(reposJsonFile, JSON.stringify(response.data.items));

    await cloneRepositories(response, page);
  }
}

function searchRepositories(page: number, githubAccessToken: string) {
  const octokit = new Octokit({ auth: githubAccessToken });

  return octokit.request('GET /search/repositories', {
    q: '"eslint-plugin" in:name',
    per_page: PAGE_SIZE,
    page,
  });
}

async function cloneRepositories(
  response: ThenArg<ReturnType<typeof searchRepositories>>,
  page: number
) {
  const repositories = response.data.items;
  for (const [i, repository] of repositories.entries()) {
    const pathPageOfClonedRepositories = join(
      PACKAGE_ROOT,
      'output',
      'cloned-repositories',
      String(page)
    );
    if (!fs.existsSync(pathPageOfClonedRepositories)) {
      fs.mkdirSync(pathPageOfClonedRepositories, { recursive: true });
    }

    const repositoryFullName = repository.full_name.replace('/', '__');
    const pathClonedRepository = join(
      pathPageOfClonedRepositories,
      repositoryFullName
    );
    if (fs.existsSync(pathClonedRepository)) {
      console.log(
        `\tSkipped git clone of already-cloned page ${page} repository ${repository.full_name}`
      );
      continue;
    }

    console.log();
    console.log(
      `\tCloning repository ${i + 1} of ${
        repositories.length
      } in page ${page}: ${repository.full_name}`
    );
    console.log();
    execSync(`git clone ${repository.clone_url} ${repositoryFullName}`, {
      stdio: [0, 1, 2], // we need this so node will print the command output
      cwd: resolve(pathPageOfClonedRepositories), // path to where you want to save the file
    });
    console.log();

    // Avoid cloning too fast and overloading GitHub.
    await sleep(1000);
  }
}
