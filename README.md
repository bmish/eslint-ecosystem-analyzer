# eslint-ecosystem-analyzer

This repository contains scripts for downloading and analyzing ESLint plugin repositories in order to understand the state of the ecosystem.

## Prerequisites

Clone this repository.

```sh
git clone ...
```

You'll need a GitHub access token with `public_repo` scope.

```sh
export GITHUB_AUTH=...
```

## Usage

### Download

Retrieve the list of the [top-1,000 ESLint repositories from GitHub](https://github.com/search?q=%22eslint-plugin%22+in%3Aname) and clone them to the `output/` folder in this repository. This takes about one second per repository.

```sh
yarn download
```

About the results:

* 1,000 is the [maximum](https://docs.github.com/en/rest/reference/search) number of search results returned by GitHub
* Results are ordered by [best match](https://docs.github.com/en/rest/reference/search#ranking-search-results) (higher-quality, better-maintained repositories first)

### Analyze

Generate statistics about the downloaded repositories.

```sh
yarn analyze
```

Current statistics:

* Average number of rules per plugin
* Rule type breakdown (object vs. function rule)
* Rule option breakdown (% of rules that have options and % that are missing a schema)

The statistic are provided for different segmentations of the data:

* Top 100 Plugins
* Top 1000 Plugins, Updated Last 1 Year
* Top 1000 Plugins, Updated Last 2 Years
* Top 1000 Plugins
