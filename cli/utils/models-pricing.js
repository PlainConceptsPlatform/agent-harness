// Providers considered "canonical" for reference pricing, in priority order.
// When a model's own provider has no cost (e.g. github-copilot shows $0),
// we look up the same model name in these providers and attach canonicalCost.
export const CANONICAL_PROVIDERS = ['anthropic', 'openai', 'google', 'mistral', 'meta', 'cohere'];

export function parseModels(data) {
  // Build name → canonical cost lookup from authoritative providers first
  const canonicalCostByName = new Map();
  for (const providerId of CANONICAL_PROVIDERS) {
    const provider = data[providerId];
    if (!provider?.models) continue;
    for (const model of Object.values(provider.models)) {
      if (!model.tool_call) continue;
      const name = model.name;
      if (name && model.cost?.input !== undefined && !canonicalCostByName.has(name)) {
        canonicalCostByName.set(name, model.cost.input);
      }
    }
  }

  const models = [];
  for (const [providerId, provider] of Object.entries(data)) {
    if (!provider.models) continue;
    for (const [modelId, model] of Object.entries(provider.models)) {
      if (!model.tool_call) continue;
      const name = model.name || modelId;
      const cost = model.cost?.input;
      const canonicalCost = canonicalCostByName.get(name);
      models.push({
        id: `${providerId}/${modelId}`,
        name,
        cost,
        // canonicalCost: cost from the authoritative provider for this model name.
        // Defined when cost !== canonicalCost (different provider, reseller, or $0 subscription).
        canonicalCost: canonicalCost !== undefined && canonicalCost !== cost ? canonicalCost : undefined,
        context: model.limit?.context,
      });
    }
  }
  models.sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity));
  return models;
}
