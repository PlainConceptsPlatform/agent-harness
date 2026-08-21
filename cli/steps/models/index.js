import { header, info, prompt, success, warn } from '../../utils/exec.js'
import { fetchModels } from '../../utils/models-cache.js'
import { buildDisplayModels, filterModelsByProvider, modelsPreset, pickModel, pickProvider } from './format.js'
import { writeModelsToConfigs } from './write.js'

async function pickRoleModel(role, allModels) {
  const rolePreset = modelsPreset.roles[role]
  const [first, ...rest] = rolePreset.info
  prompt(first)
  for (const line of rest) info(line)
  console.log()

  while (true) {
    const provider = await pickProvider('Provider:')
    const filtered = filterModelsByProvider(allModels, provider)
    const available = filtered.length > 0 ? filtered : allModels

    const suggestion = rolePreset.suggestions?.[provider]
    if (suggestion) info(`  Suggested: ${suggestion}`)
    if (filtered.length === 0 && provider) warn(`  No ${provider} models found: showing all`)

    const model = await pickModel(rolePreset.prompt, available)
    if (model !== '__back__') return model
  }
}

export async function chooseModels() {
  header('Step 7, Choose models');

  info('Fetching available models from models.dev...');
  const { models: rawModels, source } = await fetchModels();

  if (!rawModels) {
    warn('Could not fetch models (offline and no cache). Skipping model selection.');
    warn('Set models later in opencode.jsonc');
    return;
  }

  if (source === 'stale-cache') {
    warn('Network unavailable, using cached model list (may be outdated).');
  } else if (source === 'cache') {
    info('Using cached model list (refreshes weekly).');
  }

  const models = buildDisplayModels(rawModels);
  success(`${models.length} models available`);
  console.log();
  info('Three models: main session, engineers, and light commands.');
  info('Cost indicators: [$] cheap  [$$] mid  [$$$] expensive');
  info('Pick provider first, then search by name. Change later in opencode.jsonc');
  console.log();

  const planModel  = await pickRoleModel('plan',  models); console.log();
  const buildModel = await pickRoleModel('build', models); console.log();
  const fastModel  = await pickRoleModel('fast',  models); console.log();

  await writeModelsToConfigs({ planModel, buildModel, fastModel });

  console.log();
  warn('Make sure you have API access to the selected models.');
  warn('Change them anytime in opencode.jsonc');

  return { planModel, buildModel, fastModel };
}
