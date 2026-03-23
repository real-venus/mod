#[cfg(feature = "python")]
use crate::{
    agent::{Agent, AgentError, MatchSummary},
    evaluator::{Evaluator, Score},
};
#[cfg(feature = "python")]
use async_trait::async_trait;
#[cfg(feature = "python")]
use pyo3::prelude::*;
#[cfg(feature = "python")]
use serde_json::Value;
#[cfg(feature = "python")]
use std::path::PathBuf;

/// Python agent wrapper
pub struct PythonAgent {
    name: String,
    py_module: String,
    py_class: String,
}

impl PythonAgent {
    pub fn new(name: String, module_path: PathBuf) -> crate::Result<Self> {
        // Extract module name from path (e.g., agents/my_agent/agent.py -> agents.my_agent.agent)
        let module_str = module_path
            .to_str()
            .ok_or_else(|| crate::ArenaError::Python("Invalid path".to_string()))?;

        let py_module = module_str
            .trim_end_matches(".py")
            .replace('/', ".");

        Ok(Self {
            name,
            py_module,
            py_class: "Agent".to_string(),
        })
    }

    fn call_python<F, R>(&self, f: F) -> Result<R, AgentError>
    where
        F: FnOnce(Python) -> PyResult<R>,
    {
        Python::with_gil(|py| f(py).map_err(|e| AgentError::Failed(format!("Python error: {}", e))))
    }
}

#[async_trait]
impl Agent for PythonAgent {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        "Python agent"
    }

    async fn forward(&mut self, state: Value) -> Result<Value, AgentError> {
        let state_str = serde_json::to_string(&state)
            .map_err(|e| AgentError::Failed(format!("JSON error: {}", e)))?;

        self.call_python(|py| {
            let module = py.import_bound(&self.py_module)?;
            let agent_class = module.getattr(&self.py_class)?;
            let agent = agent_class.call0()?;

            let result = agent.call_method1("forward", (state_str,))?;
            let result_str: String = result.extract()?;

            serde_json::from_str(&result_str)
                .map_err(|e| PyErr::new::<pyo3::exceptions::PyValueError, _>(format!("JSON error: {}", e)))
        })
    }

    async fn on_match_start(&mut self, game_name: &str, num_players: usize) -> Result<(), AgentError> {
        self.call_python(|py| {
            let module = py.import_bound(&self.py_module)?;
            let agent_class = module.getattr(&self.py_class)?;
            let agent = agent_class.call0()?;

            if let Ok(method) = agent.getattr("on_match_start") {
                method.call1((game_name, num_players))?;
            }
            Ok(())
        })
    }

    async fn on_match_end(&mut self, result: &MatchSummary) -> Result<(), AgentError> {
        let result_str = serde_json::to_string(result)
            .map_err(|e| AgentError::Failed(format!("JSON error: {}", e)))?;

        self.call_python(|py| {
            let module = py.import_bound(&self.py_module)?;
            let agent_class = module.getattr(&self.py_class)?;
            let agent = agent_class.call0()?;

            if let Ok(method) = agent.getattr("on_match_end") {
                method.call1((result_str,))?;
            }
            Ok(())
        })
    }
}

/// Python evaluator wrapper
pub struct PythonEvaluator {
    name: String,
    py_module: String,
    py_class: String,
}

impl PythonEvaluator {
    pub fn new(name: String, module_path: PathBuf) -> crate::Result<Self> {
        let module_str = module_path
            .to_str()
            .ok_or_else(|| crate::ArenaError::Python("Invalid path".to_string()))?;

        let py_module = module_str
            .trim_end_matches(".py")
            .replace('/', ".");

        Ok(Self {
            name,
            py_module,
            py_class: "Evaluator".to_string(),
        })
    }

    fn call_python<F, R>(&self, f: F) -> crate::Result<R>
    where
        F: FnOnce(Python) -> PyResult<R>,
    {
        Python::with_gil(|py| {
            f(py).map_err(|e| crate::ArenaError::Eval(format!("Python error: {}", e)))
        })
    }
}

#[async_trait]
impl Evaluator for PythonEvaluator {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        "Python evaluator"
    }

    async fn evaluate(
        &self,
        game_name: &str,
        agents: &[String],
        history: &Value,
        final_state: &Value,
    ) -> crate::Result<Vec<Score>> {
        let agents_str = serde_json::to_string(agents)?;
        let history_str = serde_json::to_string(history)?;
        let final_state_str = serde_json::to_string(final_state)?;

        self.call_python(|py| {
            let module = py.import_bound(&self.py_module)?;
            let evaluator_class = module.getattr(&self.py_class)?;
            let evaluator = evaluator_class.call0()?;

            let result = evaluator.call_method1(
                "evaluate",
                (game_name, agents_str, history_str, final_state_str),
            )?;
            let result_str: String = result.extract()?;

            serde_json::from_str(&result_str)
                .map_err(|e| PyErr::new::<pyo3::exceptions::PyValueError, _>(format!("JSON error: {}", e)))
        })
    }
}

/// Discover Python agents in a directory
pub fn discover_python_agents(path: &PathBuf) -> crate::Result<Vec<(String, PathBuf)>> {
    let mut agents = Vec::new();

    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Look for agent.py in subdirectories
            let agent_file = path.join("agent.py");
            if agent_file.exists() {
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                agents.push((name, agent_file));
            }
        }
    }

    Ok(agents)
}

/// Discover Python evaluators in a directory
pub fn discover_python_evaluators(path: &PathBuf) -> crate::Result<Vec<(String, PathBuf)>> {
    let mut evaluators = Vec::new();

    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Look for eval.py in subdirectories
            let eval_file = path.join("eval.py");
            if eval_file.exists() {
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                evaluators.push((name, eval_file));
            }
        }
    }

    Ok(evaluators)
}
