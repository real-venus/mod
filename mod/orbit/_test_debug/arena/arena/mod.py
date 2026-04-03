
import subprocess
import json
import os


class Mod:
    description = """
    Arena - Agent competition framework

    Create games, define scoring functions, and run agent competitions.
    Results are recorded locally or on IPFS.
    """

    def __init__(self):
        self.arena_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def forward(self, **kwargs) -> dict:
        """
        Run arena CLI commands.

        Examples:
            forward(command='list-games')
            forward(command='match', game='tic_tac_toe', agents='random_bot,python_bot')
            forward(command='tournament', game='tic_tac_toe', agents='random_bot,python_bot', num_matches=10)
        """
        command = kwargs.get('command', 'list-games')

        cmd = ['cargo', 'run', '--release', '--', command]

        # Add arguments based on command
        if command == 'match':
            game = kwargs.get('game', 'tic_tac_toe')
            agents = kwargs.get('agents', 'random_bot,python_bot')
            evaluator = kwargs.get('evaluator', 'win_loss')

            cmd.extend(['--game', game, '--agents', agents, '--evaluator', evaluator])

        elif command == 'tournament':
            game = kwargs.get('game', 'tic_tac_toe')
            agents = kwargs.get('agents', 'random_bot,python_bot')
            num_matches = kwargs.get('num_matches', 10)
            evaluator = kwargs.get('evaluator', 'win_loss')

            cmd.extend([
                '--game', game,
                '--agents', agents,
                '--num-matches', str(num_matches),
                '--evaluator', evaluator
            ])

        elif command == 'results':
            limit = kwargs.get('limit', 10)
            cmd.extend(['--limit', str(limit)])

        # Run command
        result = subprocess.run(cmd, cwd=self.arena_path, capture_output=True, text=True)

        return {
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode
        }

    def match(self, game='tic_tac_toe', agents='random_bot,python_bot', evaluator='win_loss'):
        """Run a single match."""
        return self.forward(command='match', game=game, agents=agents, evaluator=evaluator)

    def tournament(self, game='tic_tac_toe', agents='random_bot,python_bot', num_matches=10, evaluator='win_loss'):
        """Run a tournament (multiple matches)."""
        return self.forward(command='tournament', game=game, agents=agents, num_matches=num_matches, evaluator=evaluator)

    def list_games(self):
        """List available games."""
        return self.forward(command='list-games')

    def list_agents(self):
        """List available agents."""
        return self.forward(command='list-agents')

    def results(self, limit=10):
        """View recent match results."""
        return self.forward(command='results', limit=limit)
