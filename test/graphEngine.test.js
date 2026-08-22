const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/graphEngine');

test('getGraph returns all nodes and edges from the data file', () => {
  const graph = engine.getGraph();
  assert.ok(Array.isArray(graph.nodes));
  assert.ok(Array.isArray(graph.edges));
  assert.ok(graph.nodes.length > 0);
  assert.ok(graph.edges.length > 0);
});

test('getScenarios returns the three known scenarios with key/label/description', () => {
  const scenarios = engine.getScenarios();
  const keys = scenarios.map((s) => s.key);
  assert.deepEqual(keys.sort(), ['port-closure', 'supplier-outage', 'tariff-spike']);
  for (const s of scenarios) {
    assert.equal(typeof s.label, 'string');
    assert.equal(typeof s.description, 'string');
  }
});

test('computeImpact throws on an unknown scenario key', () => {
  assert.throws(() => engine.computeImpact('does-not-exist'), /Unknown scenario/);
});

test('port-closure: shared route/DC hub fans out to every product line routed through it', () => {
  const result = engine.computeImpact('port-closure');
  assert.equal(result.impact.skuCount, 2);
  assert.equal(result.affected.nodeIds.includes('sku-phone'), true);
  assert.equal(result.affected.nodeIds.includes('sku-jacket'), true);
  assert.equal(result.affected.nodeIds.includes('sku-auto-part'), false);
});

test('supplier-outage: single-source supplier disruption does not leak into unrelated product lines', () => {
  const result = engine.computeImpact('supplier-outage');
  assert.equal(result.affected.nodeIds.includes('sku-phone'), true);
  assert.equal(result.affected.nodeIds.includes('sku-jacket'), false);
  assert.equal(result.affected.nodeIds.includes('sku-auto-part'), false);
});

test('supplier-outage: single-source flag pushes the score at/above the escalation threshold', () => {
  const result = engine.computeImpact('supplier-outage');
  assert.equal(result.gate.decision, 'escalate');
  assert.ok(result.gate.score >= result.gate.threshold);
  assert.ok(result.gate.reasons.some((r) => r.includes('single-source dependency')));
});

test('tariff-spike: unqualified, flagged backup adds both penalty components', () => {
  const result = engine.computeImpact('tariff-spike');
  assert.equal(result.gate.backupQualified, false);
  assert.equal(result.gate.backupRiskFlag, 'compliance-unreviewed');
  assert.ok(result.gate.reasons.some((r) => r.includes('not yet a qualified supplier')));
  assert.ok(result.gate.reasons.some((r) => r.includes('compliance-unreviewed')));
});

test('gate score is always clamped between 0 and 100', () => {
  for (const key of ['port-closure', 'supplier-outage', 'tariff-spike']) {
    const result = engine.computeImpact(key);
    assert.ok(result.gate.score >= 0 && result.gate.score <= 100);
  }
});

test('buildMitigationAction proposes a reroute when a backup node exists', () => {
  const impact = engine.computeImpact('port-closure');
  const action = engine.buildMitigationAction(impact);
  assert.match(action.title, /Reroute via Cape of Good Hope Route/);
});

test('buildMitigationAction falls back to hold-and-monitor when there is no backup node', () => {
  const impact = engine.computeImpact('port-closure');
  impact.backupNode = null;
  const action = engine.buildMitigationAction(impact);
  assert.equal(action.title, 'Hold and monitor');
});

test('generateReasoning falls back to the deterministic template when no API key is set', async () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const impact = engine.computeImpact('supplier-outage');
    const action = engine.buildMitigationAction(impact);
    const reasoning = await engine.generateReasoning(impact, action);
    assert.equal(reasoning.source, 'template');
    assert.ok(reasoning.text.includes(`Blast-radius score ${impact.gate.score}/100`));
  } finally {
    if (previousKey !== undefined) process.env.ANTHROPIC_API_KEY = previousKey;
  }
});
