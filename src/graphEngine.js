// Core "Sensing + Graph/Simulation + Decision + Autonomy Gate" logic.
// Pure, deterministic, data-driven — no fabricated numbers baked in per-scenario;
// everything is computed from data/supplyChain.json at request time.

const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'supplyChain.json'), 'utf8'));

const nodesById = new Map(raw.nodes.map((n) => [n.id, n]));
const edgesByFrom = new Map();
for (const e of raw.edges) {
  if (!edgesByFrom.has(e.from)) edgesByFrom.set(e.from, []);
  edgesByFrom.get(e.from).push(e);
}

function getGraph() {
  return { nodes: raw.nodes, edges: raw.edges };
}

function getScenarios() {
  return Object.entries(raw.scenarios).map(([key, s]) => ({ key, label: s.label, description: s.description }));
}

// Forward BFS from the disrupted node, following the direction goods actually flow
// (supplier -> ... -> customer), collecting every downstream node/edge that inherits the shock.
//
// Shared hubs (a DC, a port, a shipping route) legitimately fan out to multiple product
// lines at once — a route closure genuinely hits every SKU routed through it. But a
// disruption that STARTS at a single product-specific supplier must not "leak" into
// sibling product lines just because they happen to share a downstream warehouse.
// So: if the disrupted node itself carries a `product` tag, any node further downstream
// that carries a *different, conflicting* product tag is excluded from the blast radius.
// Shared infrastructure nodes (no product tag) are always passed through either way.
function traverseForward(startId) {
  const startNode = nodesById.get(startId);
  const product = (startNode && startNode.product) || null;

  const visitedNodes = new Set([startId]);
  const visitedEdges = [];
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift();
    const outEdges = edgesByFrom.get(cur) || [];
    for (const e of outEdges) {
      const targetNode = nodesById.get(e.to);
      const targetProduct = targetNode && targetNode.product;
      if (product && targetProduct && targetProduct !== product) {
        continue; // different, unaffected product line sharing this hub — do not propagate
      }
      visitedEdges.push(e);
      if (!visitedNodes.has(e.to)) {
        visitedNodes.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return { visitedNodes: [...visitedNodes], visitedEdges };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function computeImpact(scenarioKey) {
  const scenario = raw.scenarios[scenarioKey];
  if (!scenario) throw new Error('Unknown scenario: ' + scenarioKey);

  const { visitedNodes, visitedEdges } = traverseForward(scenario.targetNodeId);
  const affectedNodes = visitedNodes.map((id) => nodesById.get(id)).filter(Boolean);
  const skuNodes = affectedNodes.filter((n) => n.type === 'sku');
  const unitsAtRisk = skuNodes.reduce((sum, n) => sum + (n.unitsAtRisk || 0), 0);
  const customerNodes = affectedNodes.filter((n) => n.type === 'customer');
  const targetNode = nodesById.get(scenario.targetNodeId);
  const backupNode = scenario.backupNodeId ? nodesById.get(scenario.backupNodeId) : null;

  // --- Blast radius score: a transparent, additive formula over real data fields ---
  let score = 0;
  const reasons = [];

  score += affectedNodes.length * 3;
  reasons.push(`${affectedNodes.length} downstream nodes fall inside the propagation path (+${affectedNodes.length * 3}).`);

  const unitsComponent = Math.round(unitsAtRisk / 5000);
  if (unitsAtRisk > 0) {
    score += unitsComponent;
    reasons.push(`${unitsAtRisk.toLocaleString()} units across ${skuNodes.length} SKU line(s) are at risk (+${unitsComponent}).`);
  }

  if (targetNode && targetNode.singleSource) {
    score += 20;
    reasons.push(`${targetNode.label} is a single-source dependency with no qualified parallel supply (+20).`);
  }

  if (scenario.costShockPct) {
    const costComponent = Math.round(scenario.costShockPct * 0.6);
    score += costComponent;
    reasons.push(`A ${scenario.costShockPct}% cost shock changes sourcing economics overnight (+${costComponent}).`);
  }

  let backupQualified = true;
  let backupRiskFlag = null;
  if (backupNode) {
    backupQualified = backupNode.qualified !== false;
    backupRiskFlag = backupNode.riskFlag || null;
    if (!backupQualified) {
      score += 30;
      reasons.push(`The fastest fallback, ${backupNode.label}, is not yet a qualified supplier (+30).`);
    }
    if (backupRiskFlag) {
      score += 25;
      reasons.push(`${backupNode.label} carries an open compliance flag: "${backupRiskFlag}" (+25).`);
    }
  }

  score = clamp(Math.round(score), 0, 100);

  const THRESHOLD = 40;
  const gateDecision = score < THRESHOLD ? 'auto' : 'escalate';

  return {
    scenario: { key: scenarioKey, ...scenario },
    targetNode,
    backupNode,
    affected: {
      nodeIds: affectedNodes.map((n) => n.id),
      edgeKeys: visitedEdges.map((e) => `${e.from}->${e.to}`),
      nodeCount: affectedNodes.length,
    },
    impact: {
      unitsAtRisk,
      skuCount: skuNodes.length,
      customerRegionsAffected: customerNodes.map((n) => n.label),
      extraDelayDays: scenario.extraDelayDays || 0,
      costShockPct: scenario.costShockPct || 0,
    },
    gate: {
      score,
      threshold: THRESHOLD,
      decision: gateDecision,
      reasons,
      backupQualified,
      backupRiskFlag,
    },
  };
}

function buildMitigationAction(impactResult) {
  const { scenario, backupNode, gate } = impactResult;
  if (!backupNode) {
    return {
      title: 'Hold and monitor',
      detail: 'No pre-mapped fallback exists for this node — routed to a human for a first-principles response.',
    };
  }
  const verb = scenario.failureMode === 'cost-shock' ? 'Re-source' : scenario.failureMode === 'offline' ? 'Switch production' : 'Reroute';
  const extra = scenario.extraDelayDays
    ? `${scenario.extraDelayDays} additional day(s) of transit`
    : scenario.costShockPct
      ? `an estimated cost delta near ${scenario.costShockPct}%`
      : 'a modest schedule adjustment';
  return {
    title: `${verb} via ${backupNode.label}`,
    detail: `${verb} the affected flow to ${backupNode.label}, absorbing ${extra}. ${gate.backupQualified ? 'This fallback is already qualified.' : 'This fallback is NOT yet a qualified supplier.'}${gate.backupRiskFlag ? ` It also carries an open flag: ${gate.backupRiskFlag}.` : ''}`,
  };
}

function templateReasoning(impactResult, action) {
  const { scenario, gate, impact, targetNode } = impactResult;
  const verdict = gate.decision === 'auto'
    ? 'falls below the auto-execute threshold, so Synapse applies it immediately and logs the action.'
    : 'exceeds the auto-execute threshold, so Synapse holds it for human sign-off before anything changes.';
  const unitsLine = impact.unitsAtRisk
    ? ` ${impact.unitsAtRisk.toLocaleString()} units across ${impact.skuCount} SKU line(s) sit downstream of ${targetNode ? targetNode.label : 'the affected node'}.`
    : '';
  return (
    `Blast-radius score ${gate.score}/100 (threshold ${gate.threshold}) ${verdict} ` +
    `${unitsLine} Recommended action: ${action.title}. ${action.detail} ` +
    `Reasoning trail: ${gate.reasons.join(' ')}`
  );
}

async function llmReasoning(impactResult, action) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const prompt = [
      'You are the Explainability Agent inside Synapse, an autonomous supply chain resilience system.',
      'Write a crisp, 3-4 sentence plain-language reasoning trail for a control-tower dashboard, explaining:',
      '(1) what happened, (2) why the blast-radius score led to this Autonomy Gate decision, (3) the recommended action.',
      'Be concrete and reference the actual numbers given. No markdown, no bullet points, just prose.',
      '',
      `DATA: ${JSON.stringify({ scenario: impactResult.scenario.label, description: impactResult.scenario.description, gate: impactResult.gate, impact: impactResult.impact, action }, null, 0)}`,
    ].join('\n');

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data?.content?.[0]?.text;
    return text ? text.trim() : null;
  } catch (err) {
    return null;
  }
}

async function generateReasoning(impactResult, action) {
  const llm = await llmReasoning(impactResult, action);
  if (llm) return { text: llm, source: 'llm' };
  return { text: templateReasoning(impactResult, action), source: 'template' };
}

module.exports = {
  getGraph,
  getScenarios,
  computeImpact,
  buildMitigationAction,
  generateReasoning,
};
