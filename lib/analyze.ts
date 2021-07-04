import fs from 'fs';
import { join } from 'path';
import { table } from 'table';
import { getDirectories, getFiles, PACKAGE_ROOT } from './utils';
import { RepositoryType, PAGE_SIZE } from './download';

const PAGE_ROOT = join(PACKAGE_ROOT, 'output', 'cloned-repositories');
const GITHUB_SEARCH_RESULTS_ROOT = join(
  PACKAGE_ROOT,
  'output',
  'github-search-results'
);
const PAGES_FOUND = getDirectories(PAGE_ROOT).length;

export function run(): void {
  const dataFirstPage = analyze('Top 100 Plugins', 1);

  const dataAllPagesUpdatedWithinOneYear = analyze(
    'Top ' + PAGES_FOUND * PAGE_SIZE + ' Plugins, Updated Last 1 Year',
    PAGES_FOUND,
    isRepositoryUpdatedWithin(1)
  );

  const dataAllPagesUpdatedWithinTwoYears = analyze(
    'Top ' + PAGES_FOUND * PAGE_SIZE + ' Plugins, Updated Last 2 Years',
    PAGES_FOUND,
    isRepositoryUpdatedWithin(2)
  );

  const dataAllPages = analyze(
    'Top ' + PAGES_FOUND * PAGE_SIZE + ' Plugins',
    PAGES_FOUND
  );

  printMetrics(
    dataFirstPage,
    dataAllPagesUpdatedWithinOneYear,
    dataAllPagesUpdatedWithinTwoYears,
    dataAllPages
  );
}

function analyze(
  title: string,
  pageCount: number,
  shouldIncludeRepository: (repository: RepositoryType) => boolean = () => true
) {
  const counts = {
    pluginsWithSomeRules: 0,
    ruleMentionsOptions: 0,
    ruleMentionsOptionsButNotSchema: 0,
    ruleTypeFunction: 0,
    ruleTypeObject: 0,
    title,
    totalPlugins: 0,
    totalRules: 0,
  };

  for (let page = 1; page <= pageCount; page++) {
    const pathPage = join(PAGE_ROOT, String(page));
    const pathPageInfo = join(
      GITHUB_SEARCH_RESULTS_ROOT,
      String(page) + '.json'
    );
    const repositories = getDirectories(pathPage);
    const pageInfo: RepositoryType[] = JSON.parse(
      fs.readFileSync(pathPageInfo, 'utf-8')
    );
    for (const repository of repositories) {
      const pathRepository = join(pathPage, repository);
      const repositoryInfo = pageInfo.find(
        (repositoryInfo) =>
          repositoryInfo.full_name === repository.replace('__', '/')
      ) as RepositoryType;
      if (!shouldIncludeRepository(repositoryInfo)) {
        continue;
      }

      counts.totalPlugins++;

      const pathRules = findRulesPath(pathRepository);
      if (pathRules) {
        const rules = findRules(pathRules);

        counts.totalRules += rules.length;
        counts.pluginsWithSomeRules += rules.length > 0 ? 1 : 0;

        for (const rule of rules) {
          const pathRule = join(pathRules, rule);
          const ruleContents = fs.readFileSync(pathRule, 'utf-8');

          const mentionsOptions = ruleContents.includes('context.options');
          const mentionsSchema = ruleContents.includes('schema');
          const isFunctionRuleType = isFunctionRule(ruleContents);
          const isObjectRuleType = isObjectRule(ruleContents);

          counts.ruleMentionsOptionsButNotSchema +=
            mentionsOptions && !mentionsSchema ? 1 : 0;
          counts.ruleMentionsOptions += mentionsOptions ? 1 : 0;
          counts.ruleTypeFunction += isFunctionRuleType ? 1 : 0;
          counts.ruleTypeObject += isObjectRuleType ? 1 : 0;
        }
      }
    }
  }

  return counts;
}

function findRulesPath(pathRepository: string) {
  const pathLibRules = join(pathRepository, 'lib', 'rules');
  const pathSrcRules = join(pathRepository, 'src', 'rules');
  const pathRules = join(pathRepository, 'rules');
  if (fs.existsSync(pathLibRules)) {
    return pathLibRules;
  } else if (fs.existsSync(pathSrcRules)) {
    return pathSrcRules;
  } else if (fs.existsSync(pathRules)) {
    return pathRules;
  } else {
    // We'll have to ignore plugins that do not put their rules in a `rules` folder.
    return undefined;
  }
}

function findRules(pathRules: string) {
  return getFiles(pathRules).filter(
    (file) =>
      // Required suffix
      ['.js', '.ts'].some((suffix) => file.endsWith(suffix)) &&
      // Ignored suffixes
      !['-test.js', '-test.ts', '.d.ts', '.test.js', '.test.ts'].some(
        (suffix) => file.endsWith(suffix)
      ) &&
      // Ignored files
      ![
        'index.js',
        'index.ts',
        'util.js',
        'util.ts',
        'utils.js',
        'utils.ts',
      ].includes(file)
  );
}

function isFunctionRule(ruleContents: string) {
  return [
    'export default (context) =>',
    'export default context =>',
    'export default function',
    'module.exports = (context) =>',
    'module.exports = (context,',
    'module.exports = context =>',
    'module.exports = function',
  ].some((code) => ruleContents.includes(code));
}

function isObjectRule(ruleContents: string) {
  // Check for the many different syntaxes/helpers that plugins use to export rules.
  return [
    'const rule: Rule = {',
    'createRule', // TypeScript helper
    'export = {',
    'export default createRule', // TypeScript helper
    'export default util.createRule', // TypeScript helper
    'export default {',
    'export {',
    'meta: {',
    'module.exports = buildRule',
    'module.exports = createValidPropRule',
    'module.exports = define(',
    'module.exports = dependencyRule',
    'module.exports = utils.createCollectionMethodRule', // eslint-plugin-no-jquery
    'module.exports = utils.createCollectionOrUtilMethodRule', // eslint-plugin-no-jquery
    'module.exports = utils.createUtilMethodRule', // eslint-plugin-no-jquery
    'module.exports = utils.createUtilPropertyRule', // eslint-plugin-no-jquery
    'module.exports = wrapCoreRule', // eslint-plugin-mpx
    'module.exports = {',
    'module.exports.create =',
    'module.exports.meta = {',
  ].some((code) => ruleContents.includes(code));
}

function printMetrics(...dataSets: ReturnType<typeof analyze>[]) {
  // General.
  console.log(
    table([
      ['Metric', ...dataSets.map((dataSet) => 'Value (' + dataSet.title + ')')],
      ['Plugins Found', ...dataSets.map((dataSet) => dataSet.totalPlugins)],
      [
        'Plugins With Rules Found',
        ...dataSets.map((dataSet) => dataSet.pluginsWithSomeRules),
      ],
      [
        'Average Rules Per Plugin',
        ...dataSets.map((dataSet) =>
          round(dataSet.totalRules / dataSet.pluginsWithSomeRules)
        ),
      ],
    ])
  );

  // Rule types.
  console.log(
    table([
      ['Rule Type', ...dataSets.map((dataSet) => '% (' + dataSet.title + ')')],
      [
        'Object Rule',
        ...dataSets.map((dataSet) =>
          round((dataSet.ruleTypeObject / dataSet.totalRules) * 100)
        ),
      ],
      [
        'Function Rule',
        ...dataSets.map((dataSet) =>
          round((dataSet.ruleTypeFunction / dataSet.totalRules) * 100)
        ),
      ],
      [
        'Unknown',
        ...dataSets.map((dataSet) =>
          round(
            ((dataSet.totalRules -
              dataSet.ruleTypeFunction -
              dataSet.ruleTypeObject) /
              dataSet.totalRules) *
              100
          )
        ),
      ],
    ])
  );

  // Rule options.
  console.log(
    table([
      ['Metric', ...dataSets.map((dataSet) => '% (' + dataSet.title + ')')],
      [
        'Rules With Options',
        ...dataSets.map((dataSet) =>
          round((dataSet.ruleMentionsOptions / dataSet.totalRules) * 100)
        ),
      ],
      [
        'Rules With Options But Missing Schema, Out of Total Rules',
        ...dataSets.map((dataSet) =>
          round(
            (dataSet.ruleMentionsOptionsButNotSchema / dataSet.totalRules) * 100
          )
        ),
      ],
      [
        'Rules With Options But Missing Schema, Out of Rules With Options',
        ...dataSets.map((dataSet) =>
          round(
            (dataSet.ruleMentionsOptionsButNotSchema /
              dataSet.ruleMentionsOptions) *
              100
          )
        ),
      ],
    ])
  );
}

function round(value: number) {
  return value.toFixed(2);
}

function getDate(yearsFromNow: number) {
  return new Date(
    new Date().setFullYear(new Date().getFullYear() + yearsFromNow)
  );
}

function isRepositoryUpdatedWithin(years: number) {
  return (repository: RepositoryType) =>
    new Date(repository.updated_at) > getDate(years * -1);
}
