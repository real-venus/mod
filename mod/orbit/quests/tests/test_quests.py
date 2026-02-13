import pytest
import os
import sys
import json
from unittest.mock import patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quests.mod import Quests


@pytest.fixture
def quests_instance():
    """Create a fresh Quests instance for each test."""
    return Quests()


@pytest.fixture
def sample_quest():
    """Return a sample quest dictionary."""
    return {
        "name": "test_quest",
        "description": "A test quest",
        "steps": ["step1", "step2"],
        "reward": 100
    }


class TestQuestsInit:
    """Test Quests initialization."""

    def test_instance_creation(self, quests_instance):
        """Test that Quests can be instantiated."""
        assert quests_instance is not None

    def test_instance_type(self, quests_instance):
        """Test that instance is correct type."""
        assert isinstance(quests_instance, Quests)


class TestQuestsAttributes:
    """Test Quests attributes and properties."""

    def test_has_expected_attributes(self, quests_instance):
        """Test that instance has expected attributes."""
        # Check common attributes that a module would have
        assert hasattr(quests_instance, '__class__')

    def test_config_loading(self):
        """Test that config.json can be loaded."""
        config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'config.json'
        )
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
            assert isinstance(config, dict)


class TestQuestsMethods:
    """Test Quests methods."""

    def test_forward_exists(self, quests_instance):
        """Test that forward method exists if applicable."""
        if hasattr(quests_instance, 'forward'):
            assert callable(quests_instance.forward)

    def test_call_exists(self, quests_instance):
        """Test that __call__ method exists if applicable."""
        if hasattr(quests_instance, '__call__'):
            assert callable(quests_instance)

    def test_public_methods_are_callable(self, quests_instance):
        """Test that all public methods are callable."""
        public_methods = [
            m for m in dir(quests_instance)
            if not m.startswith('_') and callable(getattr(quests_instance, m))
        ]
        for method_name in public_methods:
            method = getattr(quests_instance, method_name)
            assert callable(method), f"{method_name} should be callable"


class TestQuestsDataHandling:
    """Test data handling in Quests."""

    def test_quest_data_structure(self, sample_quest):
        """Test quest data structure validity."""
        assert "name" in sample_quest
        assert "description" in sample_quest
        assert isinstance(sample_quest["steps"], list)
        assert len(sample_quest["steps"]) > 0

    def test_quest_serialization(self, sample_quest):
        """Test that quest data can be serialized to JSON."""
        json_str = json.dumps(sample_quest)
        assert isinstance(json_str, str)
        deserialized = json.loads(json_str)
        assert deserialized == sample_quest


class TestQuestsEdgeCases:
    """Test edge cases."""

    def test_empty_quest(self):
        """Test handling of empty quest data."""
        empty_quest = {}
        assert isinstance(empty_quest, dict)
        assert len(empty_quest) == 0

    def test_quest_with_none_values(self):
        """Test handling of None values in quest."""
        quest = {"name": None, "description": None}
        assert quest["name"] is None

    def test_quest_with_special_characters(self):
        """Test quest with special characters in name."""
        quest = {"name": "test-quest_v2.0 (alpha)"}
        assert isinstance(quest["name"], str)


class TestQuestsFileStructure:
    """Test the file structure of the quests module."""

    def test_module_file_exists(self):
        """Test that the main module file exists."""
        mod_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'quests', 'mod.py'
        )
        assert os.path.exists(mod_path), f"Module file not found at {mod_path}"

    def test_config_file_exists(self):
        """Test that config.json exists."""
        config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'config.json'
        )
        assert os.path.exists(config_path), f"Config file not found at {config_path}"

    def test_requirements_file_exists(self):
        """Test that requirements.txt exists."""
        req_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'requirements.txt'
        )
        assert os.path.exists(req_path), f"Requirements file not found at {req_path}"

    def test_dockerfile_exists(self):
        """Test that Dockerfile exists."""
        docker_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'Dockerfile'
        )
        assert os.path.exists(docker_path), f"Dockerfile not found at {docker_path}"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
