import pytest
import os
import sys
import json
import time
import shutil
from unittest.mock import patch, MagicMock, PropertyMock

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quests.mod import Quests


# ==================== FIXTURES ====================

@pytest.fixture
def mock_mod():
    """Mock the mod module to avoid real chain/auth/store calls."""
    with patch('quests.mod.m') as mock_m:
        mock_m.abspath.return_value = '/tmp/test_quests'
        mock_m.hash.side_effect = lambda x: f"hash_{abs(hash(x)) % 10**16:016d}"
        mock_m.put = MagicMock()
        mock_m.get = MagicMock(return_value=None)
        yield mock_m


@pytest.fixture
def mock_chain():
    mock = MagicMock()
    mock.balance.return_value = 1000.0
    mock.debit.return_value = '0xpaymenthash123'
    return mock


@pytest.fixture
def mock_auth():
    mock = MagicMock()
    mock.verify.return_value = {'key': '0xcreator'}
    return mock


@pytest.fixture
def quests_instance(mock_mod, mock_chain, mock_auth):
    """Create a Quests instance with mocked dependencies."""
    with patch('quests.mod.m.mod') as mock_mod_fn:
        def mod_factory(name):
            def create():
                if name == 'chain':
                    return mock_chain
                elif name == 'auth.base':
                    return mock_auth
                elif name == 'ipfs':
                    return MagicMock()
            return create
        mock_mod_fn.side_effect = mod_factory
        q = Quests()
        q.chain = mock_chain
        q.auth = mock_auth
        return q


@pytest.fixture
def sample_quest():
    """Return a sample quest dictionary with referee fields."""
    return {
        'id': 'test123',
        'title': 'Test Quest',
        'description': 'A test quest',
        'reward': 100,
        'creator': '0xcreator',
        'referee': '0xcreator',
        'referee_accepted': True,
        'referee_fee_pct': 0,
        'status': 'open',
        'tags': ['test'],
        'deadline': None,
        'created_at': time.time(),
        'updated_at': time.time(),
        'responses': [],
        'approved_response': None,
    }


@pytest.fixture
def sample_quest_with_referee():
    """Return a quest with a third-party referee."""
    return {
        'id': 'test456',
        'title': 'Referee Quest',
        'description': 'A quest with external referee',
        'reward': 200,
        'creator': '0xcreator',
        'referee': '0xreferee',
        'referee_accepted': True,
        'referee_fee_pct': 10,
        'status': 'open',
        'tags': ['referee'],
        'deadline': None,
        'created_at': time.time(),
        'updated_at': time.time(),
        'responses': [],
        'approved_response': None,
    }


@pytest.fixture
def sample_response():
    """Return a sample response dictionary."""
    return {
        'id': 'resp123',
        'quest_id': 'test456',
        'responder': '0xresponder',
        'content': 'My submission',
        'attachments': [],
        'status': 'pending',
        'created_at': time.time(),
    }


# ==================== INIT TESTS ====================

class TestQuestsInit:
    """Test Quests initialization."""

    def test_instance_creation(self, quests_instance):
        assert quests_instance is not None

    def test_instance_type(self, quests_instance):
        assert isinstance(quests_instance, Quests)

    def test_has_chain(self, quests_instance):
        assert hasattr(quests_instance, 'chain')

    def test_has_auth(self, quests_instance):
        assert hasattr(quests_instance, 'auth')

    def test_has_paths(self, quests_instance):
        assert hasattr(quests_instance, 'quests_path')
        assert hasattr(quests_instance, 'responses_path')


# ==================== CREATE QUEST TESTS ====================

class TestCreateQuest:
    """Test quest creation with referee system."""

    def test_create_quest_defaults_referee_to_creator(self, quests_instance, mock_mod):
        result = quests_instance.create_quest(
            title='Test', description='Desc', reward=50, token='tok'
        )
        assert result['referee'] == '0xcreator'
        assert result['referee_accepted'] is True
        assert result['referee_fee_pct'] == 0

    def test_create_quest_with_third_party_referee(self, quests_instance, mock_mod):
        result = quests_instance.create_quest(
            title='Test', description='Desc', reward=50,
            token='tok', referee='0xjudge'
        )
        assert result['referee'] == '0xjudge'
        assert result['referee_accepted'] is False
        assert result['referee_fee_pct'] is None

    def test_create_quest_requires_token(self, quests_instance):
        with pytest.raises(AssertionError, match="Auth token required"):
            quests_instance.create_quest(title='T', description='D', reward=10)

    def test_create_quest_requires_positive_reward(self, quests_instance):
        with pytest.raises(AssertionError, match="Reward must be greater than 0"):
            quests_instance.create_quest(title='T', description='D', reward=0, token='tok')

    def test_create_quest_requires_title(self, quests_instance):
        with pytest.raises(AssertionError, match="Title is required"):
            quests_instance.create_quest(title='', description='D', reward=10, token='tok')

    def test_create_quest_requires_description(self, quests_instance):
        with pytest.raises(AssertionError, match="Description is required"):
            quests_instance.create_quest(title='T', description='', reward=10, token='tok')

    def test_create_quest_checks_balance(self, quests_instance, mock_chain):
        mock_chain.balance.return_value = 5.0
        with pytest.raises(AssertionError, match="Insufficient balance"):
            quests_instance.create_quest(title='T', description='D', reward=100, token='tok')

    def test_create_quest_invalid_referee(self, quests_instance):
        with pytest.raises(AssertionError, match="Referee address must be a valid string"):
            quests_instance.create_quest(
                title='T', description='D', reward=10, token='tok', referee=''
            )


# ==================== REFEREE ACCEPTANCE TESTS ====================

class TestAcceptReferee:
    """Test referee acceptance and fee setting."""

    def test_accept_referee(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'referee': '0xreferee', 'referee_accepted': False,
            'status': 'open', 'creator': '0xcreator',
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xreferee'}

        result = quests_instance.accept_referee(quest_id='q1', fee_pct=10, token='tok')
        assert result['referee_accepted'] is True
        assert result['referee_fee_pct'] == 10

    def test_accept_referee_zero_fee(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'referee': '0xreferee', 'referee_accepted': False,
            'status': 'open', 'creator': '0xcreator',
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xreferee'}

        result = quests_instance.accept_referee(quest_id='q1', fee_pct=0, token='tok')
        assert result['referee_fee_pct'] == 0

    def test_accept_referee_max_fee(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'referee': '0xreferee', 'referee_accepted': False,
            'status': 'open', 'creator': '0xcreator',
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xreferee'}

        result = quests_instance.accept_referee(quest_id='q1', fee_pct=50, token='tok')
        assert result['referee_fee_pct'] == 50

    def test_reject_fee_over_max(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'referee': '0xreferee', 'referee_accepted': False,
            'status': 'open', 'creator': '0xcreator',
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xreferee'}

        with pytest.raises(AssertionError, match="Referee fee must be between"):
            quests_instance.accept_referee(quest_id='q1', fee_pct=51, token='tok')

    def test_reject_negative_fee(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'referee': '0xreferee', 'referee_accepted': False,
            'status': 'open', 'creator': '0xcreator',
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xreferee'}

        with pytest.raises(AssertionError, match="Referee fee must be between"):
            quests_instance.accept_referee(quest_id='q1', fee_pct=-5, token='tok')

    def test_only_designated_referee_can_accept(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'referee': '0xreferee', 'referee_accepted': False,
            'status': 'open', 'creator': '0xcreator',
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xrandom'}

        with pytest.raises(AssertionError, match="Only the designated referee"):
            quests_instance.accept_referee(quest_id='q1', fee_pct=10, token='tok')

    def test_cannot_accept_twice(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'referee': '0xreferee', 'referee_accepted': True,
            'referee_fee_pct': 10, 'status': 'open', 'creator': '0xcreator',
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xreferee'}

        with pytest.raises(AssertionError, match="already accepted"):
            quests_instance.accept_referee(quest_id='q1', fee_pct=5, token='tok')


# ==================== DECLINE REFEREE TESTS ====================

class TestDeclineReferee:
    """Test referee declining."""

    def test_decline_referee_resets_to_creator(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'referee': '0xreferee', 'referee_accepted': False,
            'status': 'open', 'creator': '0xcreator',
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xreferee'}

        result = quests_instance.decline_referee(quest_id='q1', token='tok')
        assert result['referee'] == '0xcreator'
        assert result['referee_accepted'] is True
        assert result['referee_fee_pct'] == 0

    def test_creator_referee_cannot_decline(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'referee': '0xcreator', 'referee_accepted': True,
            'status': 'open', 'creator': '0xcreator',
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xcreator'}

        with pytest.raises(AssertionError, match="Creator-referee cannot decline"):
            quests_instance.decline_referee(quest_id='q1', token='tok')


# ==================== RESPOND TESTS ====================

class TestRespond:
    """Test response submission."""

    def test_respond_requires_referee_accepted(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'status': 'open', 'referee': '0xreferee',
            'referee_accepted': False, 'responses': [], 'deadline': None,
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xresponder'}

        with pytest.raises(AssertionError, match="Referee has not yet accepted"):
            quests_instance.respond(quest_id='q1', content='My work', token='tok')

    def test_respond_succeeds_when_referee_accepted(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'status': 'open', 'referee': '0xreferee',
            'referee_accepted': True, 'responses': [], 'deadline': None,
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xresponder'}

        result = quests_instance.respond(quest_id='q1', content='My work', token='tok')
        assert result['responder'] == '0xresponder'
        assert result['status'] == 'pending'

    def test_respond_prevents_duplicate(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'status': 'open', 'referee': '0xreferee',
            'referee_accepted': True,
            'responses': [{'responder': '0xresponder', 'id': 'r1', 'status': 'pending'}],
            'deadline': None,
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xresponder'}

        with pytest.raises(AssertionError, match="already responded"):
            quests_instance.respond(quest_id='q1', content='Again', token='tok')


# ==================== APPROVE TESTS ====================

class TestApprove:
    """Test response approval with referee fee split."""

    def test_only_referee_can_approve(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'status': 'open', 'creator': '0xcreator',
            'referee': '0xreferee', 'referee_accepted': True,
            'referee_fee_pct': 10, 'reward': 100,
            'responses': [{'id': 'r1', 'responder': '0xresponder', 'status': 'pending'}],
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xcreator'}  # creator, not referee

        with pytest.raises(AssertionError, match="Only the quest referee"):
            quests_instance.approve(quest_id='q1', response_id='r1', token='tok')

    def test_approve_with_referee_fee(self, quests_instance, mock_mod, mock_auth, mock_chain):
        quest = {
            'id': 'q1', 'status': 'open', 'creator': '0xcreator',
            'referee': '0xreferee', 'referee_accepted': True,
            'referee_fee_pct': 10, 'reward': 100,
            'responses': [{'id': 'r1', 'responder': '0xresponder', 'status': 'pending'}],
        }
        response = {
            'id': 'r1', 'quest_id': 'q1', 'responder': '0xresponder',
            'content': 'Work', 'status': 'pending',
        }

        def get_side_effect(path, default=None):
            if 'q1' in str(path) and 'quest' in str(path):
                return quest
            if 'r1' in str(path):
                return response
            return default

        mock_mod.get.side_effect = get_side_effect
        mock_auth.verify.return_value = {'key': '0xreferee'}

        result = quests_instance.approve(quest_id='q1', response_id='r1', token='tok')

        assert result['referee_fee'] == 10.0
        assert result['treasury_fee'] == 5.0
        assert result['responder_receives'] == 85.0
        assert result['referee'] == '0xreferee'
        # chain.debit called twice: once for responder, once for referee
        assert mock_chain.debit.call_count == 2

    def test_approve_creator_referee_no_extra_payment(self, quests_instance, mock_mod, mock_auth, mock_chain):
        quest = {
            'id': 'q1', 'status': 'open', 'creator': '0xcreator',
            'referee': '0xcreator', 'referee_accepted': True,
            'referee_fee_pct': 0, 'reward': 100,
            'responses': [{'id': 'r1', 'responder': '0xresponder', 'status': 'pending'}],
        }
        response = {
            'id': 'r1', 'quest_id': 'q1', 'responder': '0xresponder',
            'content': 'Work', 'status': 'pending',
        }

        def get_side_effect(path, default=None):
            if 'q1' in str(path) and 'quest' in str(path):
                return quest
            if 'r1' in str(path):
                return response
            return default

        mock_mod.get.side_effect = get_side_effect
        mock_auth.verify.return_value = {'key': '0xcreator'}

        result = quests_instance.approve(quest_id='q1', response_id='r1', token='tok')

        assert result['referee_fee'] == 0
        assert result['responder_receives'] == 95.0
        assert result['referee_payment_hash'] is None
        # chain.debit called only once (no referee payment)
        assert mock_chain.debit.call_count == 1

    def test_referee_cannot_approve_own_response(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'status': 'open', 'creator': '0xcreator',
            'referee': '0xreferee', 'referee_accepted': True,
            'referee_fee_pct': 10, 'reward': 100,
            'responses': [{'id': 'r1', 'responder': '0xreferee', 'status': 'pending'}],
        }
        response = {
            'id': 'r1', 'quest_id': 'q1', 'responder': '0xreferee',
            'content': 'Work', 'status': 'pending',
        }

        def get_side_effect(path, default=None):
            if 'q1' in str(path) and 'quest' in str(path):
                return quest
            if 'r1' in str(path):
                return response
            return default

        mock_mod.get.side_effect = get_side_effect
        mock_auth.verify.return_value = {'key': '0xreferee'}

        with pytest.raises(AssertionError, match="Referee cannot approve their own response"):
            quests_instance.approve(quest_id='q1', response_id='r1', token='tok')

    def test_approve_requires_referee_accepted(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'status': 'open', 'creator': '0xcreator',
            'referee': '0xreferee', 'referee_accepted': False,
            'referee_fee_pct': None, 'reward': 100,
            'responses': [{'id': 'r1', 'responder': '0xresponder', 'status': 'pending'}],
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xreferee'}

        with pytest.raises(AssertionError, match="Referee has not accepted"):
            quests_instance.approve(quest_id='q1', response_id='r1', token='tok')


# ==================== REJECT TESTS ====================

class TestReject:
    """Test response rejection by referee."""

    def test_only_referee_can_reject(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'status': 'open', 'creator': '0xcreator',
            'referee': '0xreferee', 'referee_accepted': True,
            'responses': [{'id': 'r1', 'status': 'pending'}],
        }
        response = {
            'id': 'r1', 'quest_id': 'q1', 'responder': '0xresponder',
            'status': 'pending',
        }

        def get_side_effect(path, default=None):
            if 'q1' in str(path):
                return quest
            if 'r1' in str(path):
                return response
            return default

        mock_mod.get.side_effect = get_side_effect
        mock_auth.verify.return_value = {'key': '0xcreator'}  # not referee

        with pytest.raises(AssertionError, match="Only the quest referee"):
            quests_instance.reject(quest_id='q1', response_id='r1', token='tok')

    def test_reject_requires_referee_accepted(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'status': 'open', 'creator': '0xcreator',
            'referee': '0xreferee', 'referee_accepted': False,
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xreferee'}

        with pytest.raises(AssertionError, match="Referee has not accepted"):
            quests_instance.reject(quest_id='q1', response_id='r1', token='tok')


# ==================== CANCEL TESTS ====================

class TestCancelQuest:
    """Test quest cancellation (still creator-only)."""

    def test_only_creator_can_cancel(self, quests_instance, mock_mod, mock_auth):
        quest = {
            'id': 'q1', 'status': 'open', 'creator': '0xcreator',
            'referee': '0xreferee',
        }
        mock_mod.get.return_value = quest
        mock_auth.verify.return_value = {'key': '0xreferee'}  # referee, not creator

        with pytest.raises(AssertionError, match="Only the quest creator can cancel"):
            quests_instance.cancel_quest(quest_id='q1', token='tok')


# ==================== DATA STRUCTURE TESTS ====================

class TestQuestsDataHandling:
    """Test data handling with referee fields."""

    def test_quest_has_referee_fields(self, sample_quest):
        assert 'referee' in sample_quest
        assert 'referee_accepted' in sample_quest
        assert 'referee_fee_pct' in sample_quest

    def test_quest_serialization(self, sample_quest):
        json_str = json.dumps(sample_quest)
        deserialized = json.loads(json_str)
        assert deserialized == sample_quest

    def test_quest_with_third_party_referee(self, sample_quest_with_referee):
        assert sample_quest_with_referee['referee'] != sample_quest_with_referee['creator']
        assert sample_quest_with_referee['referee_fee_pct'] == 10


# ==================== EDGE CASES ====================

class TestEdgeCases:
    """Test edge cases."""

    def test_max_referee_fee_constant(self):
        assert Quests.MAX_REFEREE_FEE_PCT == 50

    def test_empty_quest(self):
        empty_quest = {}
        assert isinstance(empty_quest, dict)
        assert len(empty_quest) == 0

    def test_quest_with_none_values(self):
        quest = {'name': None, 'description': None}
        assert quest['name'] is None


# ==================== FILE STRUCTURE TESTS ====================

class TestQuestsFileStructure:
    """Test the file structure of the quests module."""

    def test_module_file_exists(self):
        mod_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'quests', 'mod.py'
        )
        assert os.path.exists(mod_path)

    def test_config_file_exists(self):
        config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'config.json'
        )
        assert os.path.exists(config_path)

    def test_config_has_referee_functions(self):
        config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'config.json'
        )
        with open(config_path, 'r') as f:
            config = json.load(f)
        assert 'accept_referee' in config['fns']
        assert 'decline_referee' in config['fns']

    def test_requirements_file_exists(self):
        req_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'requirements.txt'
        )
        assert os.path.exists(req_path)

    def test_dockerfile_exists(self):
        docker_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'Dockerfile'
        )
        assert os.path.exists(docker_path)


# ==================== METHODS TESTS ====================

class TestQuestsMethods:
    """Test that all expected methods exist."""

    def test_public_methods_are_callable(self, quests_instance):
        expected = [
            'create_quest', 'quests', 'get_quest', 'respond',
            'get_response', 'get_responses', 'edit_quest', 'edit_response',
            'approve', 'reject', 'cancel_quest', 'my_quests', 'my_responses',
            'stats', 'leaderboard', 'info',
            'accept_referee', 'decline_referee',
        ]
        for name in expected:
            assert hasattr(quests_instance, name), f"Missing method: {name}"
            assert callable(getattr(quests_instance, name))


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
