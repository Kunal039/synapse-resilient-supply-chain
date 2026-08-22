(() => {
  const STAGE_DELAY_MS = 700;

  let cy = null;
  let busy = false;
  let currentScenarioKey = null;
  let stats = { total: 0, auto: 0, escalated: 0 };

  const el = (id) => document.getElementById(id);
  const consoleEl = el('console');
  const scenarioListEl = el('scenario-list');
  const overlayEl = el('approval-overlay');
  const toastEl = el('toast');

  // Hand-placed layout: nodes are laid out in columns by pipeline stage (raw
  // material -> component -> assembler -> logistics -> warehouse -> SKU ->
  // customer) and rows by product lane (electronics / textile / auto), so
  // each product's chain reads as its own clean line left-to-right instead
  // of an auto-layout scattering nodes and sending edges through unrelated
  // node icons.
  const NODE_POSITIONS = {
    // tier-3 raw materials
    'sup-t3-rareearth': { x: 40, y: 40 },
    'sup-t3-silica': { x: 40, y: 150 },
    'sup-t3-cotton-raw': { x: 40, y: 380 },
    // tier-2 components
    'sup-t2-chip': { x: 250, y: 30 },
    'sup-t2-chip-backup': { x: 250, y: 110 },
    'sup-t2-resin': { x: 250, y: 190 },
    'sup-t2-cotton': { x: 250, y: 380 },
    'sup-t2-steel': { x: 250, y: 610 },
    'sup-t2-alt-unqualified': { x: 250, y: 690 },
    // tier-1 assemblers
    'sup-t1-electro': { x: 460, y: 110 },
    'sup-t1-textile': { x: 460, y: 380 },
    'sup-t1-auto': { x: 460, y: 650 },
    // logistics — first hop out of the assembler
    'route-cape': { x: 670, y: 60 },
    'route-suez': { x: 670, y: 160 },
    'port-la': { x: 670, y: 320 },
    // logistics — second hop / regional hub
    'port-rotterdam': { x: 880, y: 110 },
    'dc-la': { x: 880, y: 490 },
    // regional warehouse
    'dc-rotterdam': { x: 1090, y: 110 },
    // SKUs, one per product lane
    'sku-phone': { x: 1300, y: 40 },
    'sku-jacket': { x: 1300, y: 380 },
    'sku-auto-part': { x: 1300, y: 650 },
    // customers
    'cust-eu': { x: 1510, y: 200 },
    'cust-na': { x: 1510, y: 560 },
  };

  function typeStyle(node) {
    switch (node.type) {
      case 'customer': return { shape: 'diamond', color: '#f4a226', width: 46, height: 46 };
      case 'warehouse': return { shape: 'round-rectangle', color: '#0b1f3a', width: 130, height: 40 };
      case 'port': return { shape: 'round-rectangle', color: '#1c7293', width: 120, height: 36 };
      case 'route': return { shape: 'hexagon', color: '#1c7293', width: 60, height: 60 };
      case 'sku': return { shape: 'ellipse', color: '#f4a226', width: 52, height: 52 };
      case 'supplier':
        if (node.tier === 1) return { shape: 'ellipse', color: '#0b1f3a', width: 56, height: 56 };
        if (node.tier === 2) return { shape: 'ellipse', color: '#365478', width: 48, height: 48 };
        return { shape: 'ellipse', color: '#6f8bab', width: 42, height: 42 };
      default: return { shape: 'ellipse', color: '#9fb3c8', width: 40, height: 40 };
    }
  }

  async function init() {
    const [graph, scenarios] = await Promise.all([
      fetch('/api/graph').then((r) => r.json()),
      fetch('/api/scenarios').then((r) => r.json()),
    ]);
    buildGraph(graph);
    buildScenarioButtons(scenarios);
    wireApprovalButtons();
  }

  function buildGraph(graph) {
    const elements = [
      ...graph.nodes.map((n) => ({ data: { id: n.id, label: n.label, type: n.type, tier: n.tier, node: n } })),
      ...graph.edges.map((e, i) => ({ data: { id: 'e' + i, source: e.from, target: e.to } })),
    ];

    cy = cytoscape({
      container: el('cy'),
      elements,
      wheelSensitivity: 0.25,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (n) => typeStyle(n.data('node')).color,
            'shape': (n) => typeStyle(n.data('node')).shape,
            'width': (n) => typeStyle(n.data('node')).width,
            'height': (n) => typeStyle(n.data('node')).height,
            'label': 'data(label)',
            'font-size': 8.5,
            'color': '#16213a',
            'text-wrap': 'wrap',
            'text-max-width': '90px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'border-width': 2,
            'border-color': '#ffffff',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.6,
            'line-color': '#c3ccd6',
            'target-arrow-color': '#c3ccd6',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
          },
        },
        {
          selector: 'node.affected',
          style: { 'background-color': '#d9534f', 'border-color': '#d9534f', 'border-width': 4 },
        },
        {
          selector: 'node.resolved',
          style: { 'background-color': '#1c9c73', 'border-color': '#1c9c73', 'border-width': 4 },
        },
        {
          selector: 'edge.affected',
          style: { 'line-color': '#d9534f', 'target-arrow-color': '#d9534f', width: 3 },
        },
        {
          selector: 'edge.resolved',
          style: { 'line-color': '#1c9c73', 'target-arrow-color': '#1c9c73', width: 3 },
        },
        {
          selector: 'node.rerouted',
          style: { 'background-color': '#2f9bd6', 'border-color': '#2f9bd6', 'border-width': 4, 'border-style': 'dashed' },
        },
        {
          selector: 'edge.rerouted',
          style: { 'line-color': '#2f9bd6', 'target-arrow-color': '#2f9bd6', width: 3.5, 'line-style': 'dashed' },
        },
      ],
      layout: {
        name: 'preset',
        positions: (n) => NODE_POSITIONS[n.id()] || { x: 0, y: 0 },
        fit: true,
        padding: 30,
      },
    });
  }

  function buildScenarioButtons(scenarios) {
    scenarioListEl.innerHTML = '';
    scenarios.forEach((s) => {
      const btn = document.createElement('button');
      btn.className = 'scenario-btn';
      btn.innerHTML = `<div class="s-title">${s.label}</div><div class="s-desc">${s.description}</div>`;
      btn.addEventListener('click', () => runScenario(s.key, s));
      btn.dataset.key = s.key;
      scenarioListEl.appendChild(btn);
    });
  }

  function setButtonsEnabled(enabled) {
    document.querySelectorAll('.scenario-btn').forEach((b) => { b.disabled = !enabled; });
  }

  function clearGraphHighlights() {
    cy.nodes().removeClass('affected resolved rerouted');
    cy.edges().removeClass('affected resolved rerouted');
  }

  function highlightAffected(nodeIds, edgeKeys) {
    nodeIds.forEach((id) => { const n = cy.getElementById(id); if (n) n.addClass('affected'); });
    cy.edges().forEach((e) => {
      const key = `${e.data('source')}->${e.data('target')}`;
      if (edgeKeys.includes(key)) e.addClass('affected');
    });
  }

  function resolveAffected(nodeIds, edgeKeys) {
    nodeIds.forEach((id) => { const n = cy.getElementById(id); if (n) { n.removeClass('affected'); n.addClass('resolved'); } });
    cy.edges().forEach((e) => {
      const key = `${e.data('source')}->${e.data('target')}`;
      if (edgeKeys.includes(key)) { e.removeClass('affected'); e.addClass('resolved'); }
    });
  }

  // The part that was actually missing: turning the original path green only
  // shows "the problem went away," not *how*. This highlights the fallback
  // node the action actually routed traffic to (the backup route, the
  // second-source fab, the alternate supplier) plus its real connecting
  // edge(s), in a distinct color, so the reroute itself is visible on the map.
  function highlightReroute(backupNode) {
    if (!backupNode) return;
    const n = cy.getElementById(backupNode.id);
    if (n && n.length) n.addClass('rerouted');
    cy.edges().forEach((e) => {
      if (e.data('source') === backupNode.id || e.data('target') === backupNode.id) {
        e.addClass('rerouted');
      }
    });
  }

  function resetConsole() {
    consoleEl.innerHTML = '';
  }

  function appendConsoleLine(tagClass, tagText, message) {
    return new Promise((resolve) => {
      const line = document.createElement('div');
      line.className = 'console-line';
      line.innerHTML = `<span class="tag ${tagClass}">${tagText}</span>${message}`;
      consoleEl.appendChild(line);
      consoleEl.scrollTop = consoleEl.scrollHeight;
      setTimeout(resolve, STAGE_DELAY_MS);
    });
  }

  function showToast(message, type) {
    toastEl.textContent = message;
    toastEl.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => { toastEl.className = 'toast'; }, 3200);
  }

  function updateStats() {
    el('stat-total').textContent = stats.total;
    el('stat-auto').textContent = stats.auto;
    el('stat-escalated').textContent = stats.escalated;
  }

  async function runScenario(key, scenarioMeta) {
    if (busy) return;
    busy = true;
    currentScenarioKey = key;
    setButtonsEnabled(false);
    resetConsole();
    clearGraphHighlights();

    let result;
    try {
      const resp = await fetch(`/api/disrupt/${key}`, { method: 'POST' });
      result = await resp.json();
      if (result.error) throw new Error(result.error);
    } catch (err) {
      await appendConsoleLine('tag-sense', 'ERROR', `Could not reach the Synapse backend: ${err.message}`);
      setButtonsEnabled(true);
      busy = false;
      return;
    }

    const { scenario, targetNode, backupNode, affected, impact, gate, action, reasoning } = result;

    // Stage 1 — Sensing
    const targetNodeEl = cy.getElementById(targetNode.id);
    if (targetNodeEl) targetNodeEl.addClass('affected');
    await appendConsoleLine('tag-sense', 'SENSING', `Disruption detected — <strong>${scenario.label}</strong>. ${scenario.description}`);

    // Stage 2 — Simulation / graph propagation
    highlightAffected(affected.nodeIds, affected.edgeKeys);
    const regions = impact.customerRegionsAffected.length ? impact.customerRegionsAffected.join(', ') : 'none directly';
    await appendConsoleLine('tag-sim', 'SIMULATE', `Propagated through the multi-tier supply graph → <strong>${affected.nodeCount} nodes</strong> affected, <strong>${impact.unitsAtRisk.toLocaleString()} units</strong> across ${impact.skuCount} SKU line(s) at risk. Customer regions touched: ${regions}.`);

    // Stage 3 — Decision
    await appendConsoleLine('tag-decide', 'DECIDE', `Proposed action → <strong>${action.title}</strong>. ${action.detail}`);

    // Stage 4 — Autonomy Gate
    const gateTag = gate.decision === 'auto' ? 'tag-gate-auto' : 'tag-gate-escalate';
    const gateVerdict = gate.decision === 'auto' ? 'AUTO-EXECUTE' : 'ESCALATE TO HUMAN';
    await appendConsoleLine(gateTag, 'GATE', `Blast-radius score <strong>${gate.score}/100</strong> (threshold ${gate.threshold}) → <strong>${gateVerdict}</strong>.`);

    // Stage 5 — Explainability
    const sourceNote = reasoning.source === 'llm' ? ' <em>(reasoning generated live)</em>' : '';
    await appendConsoleLine('tag-explain', 'EXPLAIN', `${reasoning.text}${sourceNote}`);

    stats.total += 1;

    if (gate.decision === 'auto') {
      stats.auto += 1;
      updateStats();
      setTimeout(async () => {
        resolveAffected(affected.nodeIds, affected.edgeKeys);
        highlightReroute(backupNode);
        const routedNote = backupNode ? ` Traffic now flows through <strong>${backupNode.label}</strong> (highlighted in blue on the map).` : '';
        await appendConsoleLine('tag-exec', 'EXECUTED', `${action.title} is now live.${routedNote}`);
        showToast(`Auto-executed: ${action.title}`, 'success');
        setButtonsEnabled(true);
        busy = false;
      }, 500);
    } else {
      updateStats();
      openApprovalCard(result);
    }
  }

  function openApprovalCard(result) {
    const { action, gate, impact } = result;
    el('approval-title').textContent = action.title;
    el('approval-detail').textContent = action.detail;
    el('approval-meta').innerHTML = `
      <div><strong>Score:</strong> ${gate.score}/100 (threshold ${gate.threshold})</div>
      <div><strong>Units at risk:</strong> ${impact.unitsAtRisk.toLocaleString()}</div>
    `;
    overlayEl.classList.add('show');
  }

  function closeApprovalCard() {
    overlayEl.classList.remove('show');
  }

  function wireApprovalButtons() {
    el('btn-approve').addEventListener('click', async () => {
      const key = currentScenarioKey;
      closeApprovalCard();
      try {
        const resp = await fetch(`/api/approve/${key}`, { method: 'POST' });
        const data = await resp.json();
        await appendConsoleLine('tag-exec', 'EXECUTED', data.message);
        const last = await fetch(`/api/disrupt/${key}`, { method: 'POST' }).then((r) => r.json());
        resolveAffected(last.affected.nodeIds, last.affected.edgeKeys);
        highlightReroute(last.backupNode);
        if (last.backupNode) {
          await appendConsoleLine('tag-exec', 'ROUTED', `Traffic now flows through <strong>${last.backupNode.label}</strong> (highlighted in blue on the map).`);
        }
        stats.escalated += 1;
        updateStats();
        showToast('Approved — action executed.', 'success');
      } catch (err) {
        showToast('Approval failed: ' + err.message, 'escalate');
      }
      setButtonsEnabled(true);
      busy = false;
    });

    el('btn-reject').addEventListener('click', async () => {
      closeApprovalCard();
      await appendConsoleLine('tag-gate-escalate', 'REJECTED', 'Human operator rejected the proposed action. Risk remains open and flagged for manual follow-up.');
      stats.escalated += 1;
      updateStats();
      showToast('Escalation rejected — risk remains open.', 'escalate');
      setButtonsEnabled(true);
      busy = false;
    });
  }

  init();
})();
