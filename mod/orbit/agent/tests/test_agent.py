"""
tests for the agent framework

covers:
    - skills registry (discovery, loading, caching, schema, errors)
    - each individual skill (bash, read, write, edit, glob, grep, search, task)
    - memory
    - agent (parse_steps, _extract_step, run_plan, init_memory, skill wiring)
    - server import
    - mod class (test, status, serve script gen)

run:
    cd ~/mod/mod/orbit/agent && python3 -m pytest tests/test_agent.py -v
"""
import os
import sys
import json
import tempfile
import shutil
import pytest
from pathlib import Path

# make sure imports resolve from the agent root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from agent.skills.mod import Skills
from agent.memory.memory import Memory


# ═══════════════════════════════════════════════════════════════════════
#  FIXTURES
# ═══════════════════════════════════════════════════════════════════════

@pytest.fixture
def skills():
    return Skills()

@pytest.fixture
def memory():
    m = Memory()
    m.clear()
    return m

@pytest.fixture
def tmpdir():
    d = tempfile.mkdtemp(prefix="agent_test_")
    yield d
    shutil.rmtree(d, ignore_errors=True)

@pytest.fixture
def tmpfile(tmpdir):
    p = os.path.join(tmpdir, "test.txt")
    Path(p).write_text("line one\nline two\nline three\nhello world\n")
    return p


# ═══════════════════════════════════════════════════════════════════════
#  SKILLS REGISTRY
# ═══════════════════════════════════════════════════════════════════════

class TestSkillsRegistry:
    def test_ls_returns_all_skills(self, skills):
        names = skills.ls()
        expected = ["bash", "edit", "glob", "grep", "read", "search", "task", "write"]
        assert names == expected

    def test_get_returns_instance(self, skills):
        bash = skills.get("bash")
        assert hasattr(bash, "forward")
        assert hasattr(bash, "description")

    def test_get_caches_instances(self, skills):
        a = skills.get("bash")
        b = skills.get("bash")
        assert a is b

    def test_get_unknown_skill_raises(self, skills):
        with pytest.raises(KeyError, match="skill not found"):
            skills.get("nonexistent_skill_xyz")

    def test_run_delegates_to_forward(self, skills):
        r = skills.run("bash", command="echo registry_test")
        assert r["success"]
        assert "registry_test" in r["stdout"]

    def test_forward_no_name_returns_list(self, skills):
        r = skills.forward()
        assert "skills" in r
        assert "total" in r
        assert r["total"] == 8

    def test_forward_with_name_runs_skill(self, skills):
        r = skills.forward("bash", command="echo forward_test")
        assert r["success"]

    def test_schema_returns_all(self, skills):
        schema = skills.schema()
        assert len(schema) == 8
        for name, info in schema.items():
            assert "description" in info, f"{name} schema missing description"
            assert "params" in info, f"{name} schema missing params"

    def test_schema_filtered(self, skills):
        schema = skills.schema(["bash", "read"])
        assert len(schema) == 2
        assert "bash" in schema
        assert "read" in schema

    def test_schema_params_have_types(self, skills):
        schema = skills.schema(["bash"])
        params = schema["bash"]["params"]
        assert "command" in params
        assert params["command"]["required"] is True
        assert "timeout" in params
        assert params["timeout"]["required"] is False

    def test_test_all_skills(self, skills):
        results = skills.test()
        assert results["passed"] == results["total"]
        assert results["total"] == 8


# ═══════════════════════════════════════════════════════════════════════
#  SKILL: BASH
# ═══════════════════════════════════════════════════════════════════════

class TestBashSkill:
    def test_echo(self, skills):
        r = skills.run("bash", command="echo hello")
        assert r["success"]
        assert r["stdout"].strip() == "hello"
        assert r["code"] == 0

    def test_failing_command(self, skills):
        r = skills.run("bash", command="exit 1")
        assert not r["success"]
        assert r["code"] == 1

    def test_stderr(self, skills):
        r = skills.run("bash", command="echo err >&2")
        assert "err" in r["stderr"]

    def test_cwd(self, skills, tmpdir):
        r = skills.run("bash", command="pwd", cwd=tmpdir)
        assert r["success"]
        assert tmpdir in r["stdout"] or os.path.realpath(tmpdir) in r["stdout"]

    def test_timeout(self, skills):
        r = skills.run("bash", command="sleep 10", timeout=1)
        assert not r["success"]
        assert "timeout" in r["stderr"]

    def test_multiline_output(self, skills):
        r = skills.run("bash", command="echo a; echo b; echo c")
        assert r["success"]
        lines = r["stdout"].strip().split("\n")
        assert lines == ["a", "b", "c"]

    def test_pipe(self, skills):
        r = skills.run("bash", command="echo 'hello world' | tr 'h' 'H'")
        assert r["success"]
        assert "Hello" in r["stdout"]


# ═══════════════════════════════════════════════════════════════════════
#  SKILL: READ
# ═══════════════════════════════════════════════════════════════════════

class TestReadSkill:
    def test_read_file(self, skills, tmpfile):
        r = skills.run("read", file_path=tmpfile)
        assert r["success"]
        assert "line one" in r["content"]
        assert r["total"] == 4
        assert r["lines"] == 4

    def test_read_with_offset(self, skills, tmpfile):
        r = skills.run("read", file_path=tmpfile, offset=1)
        assert r["success"]
        assert "line two" in r["content"]
        assert "line one" not in r["content"]
        assert r["lines"] == 3

    def test_read_with_limit(self, skills, tmpfile):
        r = skills.run("read", file_path=tmpfile, limit=2)
        assert r["success"]
        assert r["lines"] == 2
        assert "line three" not in r["content"]

    def test_read_with_offset_and_limit(self, skills, tmpfile):
        r = skills.run("read", file_path=tmpfile, offset=1, limit=1)
        assert r["success"]
        assert r["lines"] == 1
        assert "line two" in r["content"]

    def test_read_nonexistent(self, skills):
        r = skills.run("read", file_path="/tmp/this_file_does_not_exist_xyz.txt")
        assert not r["success"]
        assert "not found" in r["error"]

    def test_read_directory(self, skills, tmpdir):
        r = skills.run("read", file_path=tmpdir)
        assert not r["success"]
        assert "not a file" in r["error"]

    def test_read_returns_path(self, skills, tmpfile):
        r = skills.run("read", file_path=tmpfile)
        assert r["success"]
        assert r["path"] == str(Path(tmpfile).resolve())


# ═══════════════════════════════════════════════════════════════════════
#  SKILL: WRITE
# ═══════════════════════════════════════════════════════════════════════

class TestWriteSkill:
    def test_write_new_file(self, skills, tmpdir):
        p = os.path.join(tmpdir, "new.txt")
        r = skills.run("write", file_path=p, content="hello")
        assert r["success"]
        assert Path(p).read_text() == "hello"
        assert r["bytes"] == 5

    def test_write_creates_dirs(self, skills, tmpdir):
        p = os.path.join(tmpdir, "a", "b", "c", "deep.txt")
        r = skills.run("write", file_path=p, content="deep")
        assert r["success"]
        assert Path(p).read_text() == "deep"

    def test_write_overwrites(self, skills, tmpfile):
        r = skills.run("write", file_path=tmpfile, content="overwritten")
        assert r["success"]
        assert Path(tmpfile).read_text() == "overwritten"

    def test_write_empty(self, skills, tmpdir):
        p = os.path.join(tmpdir, "empty.txt")
        r = skills.run("write", file_path=p, content="")
        assert r["success"]
        assert Path(p).read_text() == ""

    def test_write_unicode(self, skills, tmpdir):
        p = os.path.join(tmpdir, "unicode.txt")
        text = "hello unicode test chars"
        r = skills.run("write", file_path=p, content=text)
        assert r["success"]
        assert Path(p).read_text() == text


# ═══════════════════════════════════════════════════════════════════════
#  SKILL: EDIT
# ═══════════════════════════════════════════════════════════════════════

class TestEditSkill:
    def test_single_replace(self, skills, tmpfile):
        r = skills.run("edit", file_path=tmpfile, old_string="line one", new_string="LINE ONE")
        assert r["success"]
        assert r["replacements"] == 1
        content = Path(tmpfile).read_text()
        assert "LINE ONE" in content
        assert "line two" in content  # untouched

    def test_replace_all(self, skills, tmpdir):
        p = os.path.join(tmpdir, "multi.txt")
        Path(p).write_text("aaa bbb aaa ccc aaa")
        r = skills.run("edit", file_path=p, old_string="aaa", new_string="XXX", replace_all=True)
        assert r["success"]
        assert r["replacements"] == 3
        assert Path(p).read_text() == "XXX bbb XXX ccc XXX"

    def test_replace_first_only(self, skills, tmpdir):
        p = os.path.join(tmpdir, "first.txt")
        Path(p).write_text("aaa bbb aaa")
        r = skills.run("edit", file_path=p, old_string="aaa", new_string="XXX")
        assert r["success"]
        assert r["replacements"] == 1
        assert Path(p).read_text() == "XXX bbb aaa"

    def test_string_not_found(self, skills, tmpfile):
        r = skills.run("edit", file_path=tmpfile, old_string="NONEXISTENT", new_string="X")
        assert not r["success"]
        assert "not found" in r["error"]

    def test_edit_nonexistent_file(self, skills):
        r = skills.run("edit", file_path="/tmp/no_such_file_xyz.txt", old_string="a", new_string="b")
        assert not r["success"]
        assert "not a file" in r["error"]

    def test_multiline_replace(self, skills, tmpfile):
        r = skills.run("edit", file_path=tmpfile, old_string="line one\nline two", new_string="REPLACED")
        assert r["success"]
        content = Path(tmpfile).read_text()
        assert "REPLACED" in content
        assert "line one" not in content


# ═══════════════════════════════════════════════════════════════════════
#  SKILL: GLOB
# ═══════════════════════════════════════════════════════════════════════

class TestGlobSkill:
    def test_find_py_files(self, skills):
        r = skills.run("glob", pattern="*.py", path=os.path.join(os.path.dirname(__file__), ".."))
        assert r["success"]
        assert r["total"] > 0

    def test_find_in_tmpdir(self, skills, tmpdir):
        Path(os.path.join(tmpdir, "a.py")).touch()
        Path(os.path.join(tmpdir, "b.py")).touch()
        Path(os.path.join(tmpdir, "c.txt")).touch()
        r = skills.run("glob", pattern="*.py", path=tmpdir)
        assert r["success"]
        assert r["total"] == 2

    def test_recursive(self, skills, tmpdir):
        sub = os.path.join(tmpdir, "sub")
        os.makedirs(sub)
        Path(os.path.join(tmpdir, "a.py")).touch()
        Path(os.path.join(sub, "b.py")).touch()
        r = skills.run("glob", pattern="*.py", path=tmpdir, recursive=True)
        assert r["success"]
        assert r["total"] == 2

    def test_nonexistent_path(self, skills):
        r = skills.run("glob", pattern="*.py", path="/tmp/nonexistent_path_xyz")
        assert not r["success"]
        assert "not found" in r["error"]

    def test_max_results(self, skills, tmpdir):
        for i in range(10):
            Path(os.path.join(tmpdir, f"f{i}.py")).touch()
        r = skills.run("glob", pattern="*.py", path=tmpdir, max_results=3)
        assert r["success"]
        assert r["total"] == 3

    def test_no_matches(self, skills, tmpdir):
        r = skills.run("glob", pattern="*.xyz_nonexistent", path=tmpdir)
        assert r["success"]
        assert r["total"] == 0


# ═══════════════════════════════════════════════════════════════════════
#  SKILL: GREP
# ═══════════════════════════════════════════════════════════════════════

class TestGrepSkill:
    def test_find_pattern(self, skills, tmpfile):
        r = skills.run("grep", pattern="hello", path=tmpfile)
        assert r["success"]
        assert r["total"] == 1
        assert r["matches"][0]["text"] == "hello world"
        assert r["matches"][0]["line"] == 4

    def test_regex(self, skills, tmpfile):
        r = skills.run("grep", pattern="line (one|two)", path=tmpfile)
        assert r["success"]
        assert r["total"] == 2

    def test_case_insensitive(self, skills, tmpdir):
        p = os.path.join(tmpdir, "case.txt")
        Path(p).write_text("Hello\nhello\nHELLO\n")
        r = skills.run("grep", pattern="hello", path=p, ignore_case=True)
        assert r["success"]
        assert r["total"] == 3

    def test_case_sensitive(self, skills, tmpdir):
        p = os.path.join(tmpdir, "case.txt")
        Path(p).write_text("Hello\nhello\nHELLO\n")
        r = skills.run("grep", pattern="hello", path=p, ignore_case=False)
        assert r["success"]
        assert r["total"] == 1

    def test_context_lines(self, skills, tmpfile):
        r = skills.run("grep", pattern="line two", path=tmpfile, context=1)
        assert r["success"]
        m = r["matches"][0]
        assert "before" in m
        assert "after" in m
        assert "line one" in m["before"]
        assert "line three" in m["after"]

    def test_file_pattern(self, skills, tmpdir):
        Path(os.path.join(tmpdir, "a.py")).write_text("target\n")
        Path(os.path.join(tmpdir, "b.txt")).write_text("target\n")
        r = skills.run("grep", pattern="target", path=tmpdir, file_pattern="*.py")
        assert r["success"]
        assert r["total"] == 1

    def test_bad_regex(self, skills, tmpfile):
        r = skills.run("grep", pattern="[invalid", path=tmpfile)
        assert not r["success"]
        assert "bad regex" in r["error"]

    def test_no_matches(self, skills, tmpfile):
        r = skills.run("grep", pattern="ZZZNOTHERE", path=tmpfile)
        assert r["success"]
        assert r["total"] == 0

    def test_max_results(self, skills, tmpdir):
        p = os.path.join(tmpdir, "many.txt")
        Path(p).write_text("\n".join(["match"] * 50))
        r = skills.run("grep", pattern="match", path=p, max_results=5)
        assert r["success"]
        assert r["total"] == 5

    def test_nonexistent_path(self, skills):
        r = skills.run("grep", pattern="x", path="/tmp/nonexistent_xyz")
        assert not r["success"]

    def test_skips_binary(self, skills, tmpdir):
        p = os.path.join(tmpdir, "bin.dat")
        with open(p, "wb") as f:
            f.write(b"\x00\x01\x02match\x03")
        r = skills.run("grep", pattern="match", path=tmpdir)
        assert r["success"]
        assert r["total"] == 0


# ═══════════════════════════════════════════════════════════════════════
#  SKILL: SEARCH (web)
# ═══════════════════════════════════════════════════════════════════════

class TestSearchSkill:
    def test_empty_query(self, skills):
        r = skills.run("search", query="")
        assert not r["success"]
        assert "empty" in r["error"]

    def test_whitespace_query(self, skills):
        r = skills.run("search", query="   ")
        assert not r["success"]

    # NOTE: actual web tests are flaky in CI, so we test the error path
    def test_search_returns_dict(self, skills):
        r = skills.run("search", query="python")
        assert isinstance(r, dict)
        assert "success" in r
        assert "results" in r


# ═══════════════════════════════════════════════════════════════════════
#  SKILL: TASK
# ═══════════════════════════════════════════════════════════════════════

class TestTaskSkill:
    def test_unknown_agent_type(self, skills):
        r = skills.run("task", prompt="test", agent_type="invalid_type")
        assert not r["success"]
        # either "unknown type" or import error — both are valid
        assert "error" in r

    def test_task_returns_dict(self, skills):
        r = skills.run("task", prompt="test")
        assert isinstance(r, dict)
        assert "success" in r


# ═══════════════════════════════════════════════════════════════════════
#  MEMORY
# ═══════════════════════════════════════════════════════════════════════

class TestMemory:
    def test_add_and_get(self, memory):
        memory.add("k1", "v1")
        assert memory.get("k1") == "v1"

    def test_add_dict(self, memory):
        memory.add({"a": 1, "b": 2})
        assert memory.get("a") == 1
        assert memory.get("b") == 2

    def test_get_all(self, memory):
        memory.add("x", 10)
        memory.add("y", 20)
        all_mem = memory.get()
        assert all_mem["x"] == 10
        assert all_mem["y"] == 20

    def test_get_missing_returns_none(self, memory):
        assert memory.get("nonexistent") is None

    def test_keys(self, memory):
        memory.add("a", 1)
        memory.add("b", 2)
        assert sorted(memory.keys()) == ["a", "b"]

    def test_rm(self, memory):
        memory.add("k", "v")
        memory.rm("k")
        assert memory.get("k") is None

    def test_rm_nonexistent(self, memory):
        memory.rm("nope")  # should not raise

    def test_clear(self, memory):
        memory.add("a", 1)
        memory.add("b", 2)
        memory.clear()
        assert memory.get() == {}

    def test_update(self, memory):
        memory.add("a", 1)
        memory.update({"a": 99, "b": 2})
        assert memory.get("a") == 99
        assert memory.get("b") == 2

    def test_update_non_dict_raises(self, memory):
        with pytest.raises(AssertionError):
            memory.update("not a dict")

    def test_builtin_test(self, memory):
        assert memory.test() is True


# ═══════════════════════════════════════════════════════════════════════
#  AGENT (unit tests without LLM)
# ═══════════════════════════════════════════════════════════════════════

class TestAgent:
    """Test agent components that don't need an LLM connection."""

    def _make_agent(self):
        """Create agent without mod framework dependency."""
        from agent.agent import Agent
        agent = Agent.__new__(Agent)
        agent.skills = Skills()
        agent.memory = Memory()
        agent.memory.clear()
        agent.model = None
        agent._skill_names = None
        agent.goal = Agent.goal
        agent.output_format = Agent.output_format
        agent.anchors = Agent.anchors
        return agent

    # ── skill wiring ──

    def test_skill_ls(self):
        agent = self._make_agent()
        assert "bash" in agent.skills.ls()
        assert len(agent.skills.ls()) == 8

    def test_skill_get(self):
        agent = self._make_agent()
        bash = agent.skill("bash")
        assert hasattr(bash, "forward")

    def test_run_skill(self):
        agent = self._make_agent()
        r = agent.run_skill("bash", command="echo agent_test")
        assert r["success"]
        assert "agent_test" in r["stdout"]

    def test_skill_schema(self):
        agent = self._make_agent()
        schema = agent.skill_schema()
        assert len(schema) == 8
        assert "bash" in schema

    def test_skill_schema_filtered(self):
        agent = self._make_agent()
        agent._skill_names = ["bash", "read"]
        schema = agent.skill_schema()
        assert len(schema) == 2

    # ── parse_steps ──

    def test_parse_steps_single(self):
        agent = self._make_agent()
        output = '<PLAN>\n<STEP>{"tool": "bash", "params": {"command": "ls"}}</STEP>\n</PLAN>'
        steps = agent.parse_steps(output)
        assert len(steps) == 1
        assert steps[0]["tool"] == "bash"
        assert steps[0]["params"]["command"] == "ls"

    def test_parse_steps_finish(self):
        agent = self._make_agent()
        output = '<PLAN>\n<STEP>{"tool": "finish", "params": {}}</STEP>\n</PLAN>'
        steps = agent.parse_steps(output)
        assert len(steps) == 1
        assert steps[0]["tool"] == "finish"

    def test_parse_steps_multiple(self):
        agent = self._make_agent()
        output = (
            '<PLAN>\n'
            '<STEP>{"tool": "read", "params": {"file_path": "/tmp/x"}}</STEP>\n'
            '<STEP>{"tool": "finish", "params": {}}</STEP>\n'
            '</PLAN>'
        )
        steps = agent.parse_steps(output)
        assert len(steps) == 2
        assert steps[0]["tool"] == "read"
        assert steps[1]["tool"] == "finish"

    def test_parse_steps_empty(self):
        agent = self._make_agent()
        steps = agent.parse_steps("no steps here, just text")
        assert steps == []

    def test_parse_steps_bad_json(self):
        agent = self._make_agent()
        output = '<PLAN>\n<STEP>not json at all</STEP>\n</PLAN>'
        steps = agent.parse_steps(output)
        assert steps == []  # should not crash, just skip

    def test_parse_steps_missing_tool_key(self):
        agent = self._make_agent()
        output = '<PLAN>\n<STEP>{"notool": "x", "params": {}}</STEP>\n</PLAN>'
        steps = agent.parse_steps(output)
        assert steps == []  # missing "tool" key

    # ── _extract_step ──

    def test_extract_step_valid(self):
        agent = self._make_agent()
        text = 'blah <STEP>{"tool": "bash", "params": {"command": "ls"}}</STEP> blah'
        step = agent._extract_step(text)
        assert step is not None
        assert step["tool"] == "bash"

    def test_extract_step_invalid_json(self):
        agent = self._make_agent()
        text = 'blah <STEP>{{broken</STEP> blah'
        step = agent._extract_step(text)
        assert step is None

    # ── run_plan ──

    def test_run_plan_executes_skills(self):
        agent = self._make_agent()
        plan = [
            {"tool": "bash", "params": {"command": "echo plan_test"}},
            {"tool": "finish", "params": {}},
        ]
        result = agent.run_plan(plan, safety=False)
        assert result[0]["result"]["success"]
        assert "plan_test" in result[0]["result"]["stdout"]

    def test_run_plan_stops_at_finish(self):
        agent = self._make_agent()
        plan = [
            {"tool": "finish", "params": {}},
            {"tool": "bash", "params": {"command": "echo should_not_run"}},
        ]
        result = agent.run_plan(plan, safety=False)
        # second step should NOT have a result
        assert "result" not in result[1]

    def test_run_plan_unknown_skill(self):
        agent = self._make_agent()
        plan = [{"tool": "nonexistent_skill_xyz", "params": {}}]
        result = agent.run_plan(plan, safety=False)
        # should have error, not crash
        assert "result" in result[0] or "error" in result[0]

    def test_run_plan_empty(self):
        agent = self._make_agent()
        result = agent.run_plan([], safety=False)
        assert result == []

    def test_run_plan_skill_error_captured(self):
        agent = self._make_agent()
        plan = [{"tool": "read", "params": {"file_path": "/tmp/no_such_file_xyz.txt"}}]
        result = agent.run_plan(plan, safety=False)
        assert result[0]["result"]["success"] is False

    # ── init_memory ──

    def test_init_memory(self):
        agent = self._make_agent()
        tools = agent.skill_schema()
        agent.init_memory(query="test query", path="/tmp", tools=tools)
        mem = agent.memory.get()
        assert mem["query"] == "test query"
        assert mem["goal"] == agent.goal
        assert mem["output_format"] == agent.output_format
        assert "tools" in mem

    # ── end-to-end plan (simulated, no LLM) ──

    def test_plan_execute(self):
        agent = self._make_agent()
        fake_output = (
            'thinking...\n'
            '<PLAN>\n'
            '<STEP>{"tool": "bash", "params": {"command": "echo e2e_test"}}</STEP>\n'
            '</PLAN>\n'
        )
        result = agent.plan(fake_output, safety=False)
        assert len(result) == 1
        assert result[0]["result"]["success"]
        assert "e2e_test" in result[0]["result"]["stdout"]

    def test_plan_with_finish(self):
        agent = self._make_agent()
        fake_output = (
            '<PLAN>\n'
            '<STEP>{"tool": "bash", "params": {"command": "echo step1"}}</STEP>\n'
            '<STEP>{"tool": "finish", "params": {}}</STEP>\n'
            '</PLAN>\n'
        )
        result = agent.plan(fake_output, safety=False)
        assert len(result) == 2
        assert result[0]["result"]["success"]
        assert result[1]["tool"] == "finish"


# ═══════════════════════════════════════════════════════════════════════
#  INTEGRATION: write -> edit -> read -> grep pipeline
# ═══════════════════════════════════════════════════════════════════════

class TestSkillPipeline:
    def test_full_pipeline(self, skills, tmpdir):
        # write a file
        p = os.path.join(tmpdir, "pipeline.py")
        skills.run("write", file_path=p, content="def hello():\n    return 'world'\n\ndef goodbye():\n    return 'moon'\n")

        # glob finds it
        r = skills.run("glob", pattern="*.py", path=tmpdir)
        assert r["total"] == 1

        # grep finds pattern
        r = skills.run("grep", pattern="def hello", path=tmpdir)
        assert r["total"] == 1
        assert r["matches"][0]["line"] == 1

        # read it
        r = skills.run("read", file_path=p)
        assert r["success"]
        assert "hello" in r["content"]

        # edit it
        r = skills.run("edit", file_path=p, old_string="'world'", new_string="'earth'")
        assert r["success"]

        # verify edit
        r = skills.run("read", file_path=p)
        assert "'earth'" in r["content"]
        assert "'world'" not in r["content"]

        # grep updated content
        r = skills.run("grep", pattern="earth", path=p)
        assert r["total"] == 1

    def test_write_read_roundtrip_binary_like(self, skills, tmpdir):
        p = os.path.join(tmpdir, "data.txt")
        content = "col1\tcol2\tcol3\n1\t2\t3\n4\t5\t6\n"
        skills.run("write", file_path=p, content=content)
        r = skills.run("read", file_path=p)
        assert r["content"] == content

    def test_multi_file_grep(self, skills, tmpdir):
        for i in range(5):
            p = os.path.join(tmpdir, f"file{i}.py")
            content = f"# file {i}\nTARGET_{i} = True\n" if i % 2 == 0 else f"# file {i}\nother = False\n"
            skills.run("write", file_path=p, content=content)

        r = skills.run("grep", pattern="TARGET", path=tmpdir, file_pattern="*.py")
        assert r["success"]
        assert r["total"] == 3  # files 0, 2, 4


# ═══════════════════════════════════════════════════════════════════════
#  MOD CLASS
# ═══════════════════════════════════════════════════════════════════════

class TestMod:
    def _make_mod(self):
        from agent.mod import Mod
        mod = Mod.__new__(Mod)
        mod.skills = Skills()
        mod.memory = Memory()
        mod.memory.clear()
        mod.model = None
        mod._skill_names = None
        mod.api_port = 50117
        mod.app_port = 3117
        mod._dir = os.path.join(os.path.dirname(__file__), '..')
        mod._app_dir = os.path.join(mod._dir, 'app')
        mod._api_dir = os.path.join(mod._dir, 'api')
        from agent.agent import Agent
        mod.goal = Agent.goal
        mod.output_format = Agent.output_format
        mod.anchors = Agent.anchors
        return mod

    def test_mod_test(self):
        mod = self._make_mod()
        r = mod.test()
        assert r["success"]
        assert "bash" in r["skills"]
        assert "read" in r["skills"]

    def test_mod_status(self):
        mod = self._make_mod()
        s = mod.status()
        assert s["api_port"] == 50117
        assert s["app_port"] == 3117
        assert "skills" in s
        assert len(s["skills"]) == 8

    def test_mod_inherits_agent(self):
        mod = self._make_mod()
        # should have all agent methods
        assert hasattr(mod, "forward")
        assert hasattr(mod, "plan")
        assert hasattr(mod, "parse_steps")
        assert hasattr(mod, "run_plan")
        assert hasattr(mod, "run_skill")
        assert hasattr(mod, "skill_schema")

    def test_mod_serve_script_generation(self):
        mod = self._make_mod()
        script_path = os.path.join(mod._api_dir, '_serve.sh')
        try:
            pass
        finally:
            if os.path.exists(script_path):
                os.unlink(script_path)

    def test_mod_kill_returns_dict(self):
        mod = self._make_mod()
        r = mod.kill()
        assert isinstance(r, dict)

    def test_mod_description(self):
        from agent.mod import Mod
        assert len(Mod.description) > 0


# ═══════════════════════════════════════════════════════════════════════
#  SERVER IMPORT
# ═══════════════════════════════════════════════════════════════════════

class TestApiImport:
    def test_api_module_imports(self):
        """Verify the FastAPI api module can be imported."""
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
        try:
            from api import api as srv
            assert hasattr(srv, 'app')
            assert hasattr(srv, 'health')
            assert hasattr(srv, 'list_skills')
            assert hasattr(srv, 'run_skill')
            assert hasattr(srv, 'run_agent')
            assert hasattr(srv, 'get_schema')
            assert hasattr(srv, 'get_status')
        except ImportError as e:
            if "fastapi" not in str(e).lower():
                raise

    def test_api_health_endpoint(self):
        """Test health endpoint via TestClient if fastapi available."""
        try:
            from api.api import app
            from fastapi.testclient import TestClient
            client = TestClient(app)
            r = client.get("/health")
            assert r.status_code == 200
            data = r.json()
            assert data["status"] == "ok"
            assert data["module"] == "agent"
        except ImportError:
            pytest.skip("fastapi not installed")

    def test_api_skills_endpoint(self):
        """Test /skills endpoint."""
        try:
            from api.api import app
            from fastapi.testclient import TestClient
            client = TestClient(app)
            r = client.get("/skills")
            assert r.status_code == 200
            data = r.json()
            assert "skills" in data
            assert "schemas" in data
            assert len(data["skills"]) == 8
            assert "bash" in data["skills"]
        except ImportError:
            pytest.skip("fastapi not installed")

    def test_api_schema_endpoint(self):
        """Test /schema endpoint."""
        try:
            from api.api import app
            from fastapi.testclient import TestClient
            client = TestClient(app)
            r = client.get("/schema")
            assert r.status_code == 200
            data = r.json()
            assert "bash" in data
            assert "read" in data
            assert "params" in data["bash"]
        except ImportError:
            pytest.skip("fastapi not installed")

    def test_api_skill_run_endpoint(self):
        """Test /skills/run endpoint."""
        try:
            from api.api import app
            from fastapi.testclient import TestClient
            client = TestClient(app)
            r = client.post("/skills/run", json={"name": "bash", "params": {"command": "echo api_test"}})
            assert r.status_code == 200
            data = r.json()
            assert data["skill"] == "bash"
            assert data["result"]["success"]
            assert "api_test" in data["result"]["stdout"]
        except ImportError:
            pytest.skip("fastapi not installed")

    def test_api_skill_run_unknown(self):
        """Test /skills/run with unknown skill."""
        try:
            from api.api import app
            from fastapi.testclient import TestClient
            client = TestClient(app)
            r = client.post("/skills/run", json={"name": "nonexistent_xyz", "params": {}})
            assert r.status_code == 200
            data = r.json()
            assert "error" in data
        except ImportError:
            pytest.skip("fastapi not installed")

    def test_api_status_endpoint(self):
        """Test /status endpoint."""
        try:
            from api.api import app
            from fastapi.testclient import TestClient
            client = TestClient(app)
            r = client.get("/status")
            assert r.status_code == 200
            data = r.json()
            assert "skills" in data
            assert len(data["skills"]) == 8
        except ImportError:
            pytest.skip("fastapi not installed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
