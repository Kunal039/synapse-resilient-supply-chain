const express = require('express');
const path = require('path');
const engine = require('./src/graphEngine');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/graph', (req, res) => {
  res.json(engine.getGraph());
});

app.get('/api/scenarios', (req, res) => {
  res.json(engine.getScenarios());
});

app.post('/api/disrupt/:scenarioKey', async (req, res) => {
  try {
    const impact = engine.computeImpact(req.params.scenarioKey);
    const action = engine.buildMitigationAction(impact);
    const reasoning = await engine.generateReasoning(impact, action);
    res.json({ ...impact, action, reasoning });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/approve/:scenarioKey', async (req, res) => {
  try {
    const impact = engine.computeImpact(req.params.scenarioKey);
    const action = engine.buildMitigationAction(impact);
    res.json({
      executed: true,
      timestamp: new Date().toISOString(),
      message: `Approved by human operator. "${action.title}" is now executing.`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Synapse control tower running at http://localhost:${PORT}`);
  console.log(process.env.ANTHROPIC_API_KEY ? 'LLM reasoning: ENABLED (ANTHROPIC_API_KEY found)' : 'LLM reasoning: template fallback (no ANTHROPIC_API_KEY set)');
});
