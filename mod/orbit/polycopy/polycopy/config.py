"""Configuration management for polycopy"""

DEFAULT_CONFIG = {
    'addresses': [],
    'private_key': None,
    'multiplier': 1.0,
    'max_position_size': 1000.0,
    'max_trade_size': 500.0,
    'min_trade_size': 1.0,
    'slippage_tolerance': 1.0,
    'dry_run': True,
    'poll_interval': 30,
    'storage_path': '~/.mod/polycopy',
    'risk_limits': {
        'max_daily_trades': 50,
        'max_daily_volume': 5000.0,
        'max_concurrent_positions': 20
    }
}


class ConfigSchema:
    """Validates and manages configuration"""

    @staticmethod
    def validate(config: dict) -> dict:
        """Validate configuration and fill defaults"""
        validated = DEFAULT_CONFIG.copy()

        # Deep merge risk_limits
        if 'risk_limits' in config:
            validated['risk_limits'] = {**DEFAULT_CONFIG['risk_limits'], **config.get('risk_limits', {})}
            config_copy = {k: v for k, v in config.items() if k != 'risk_limits'}
            validated.update(config_copy)
        else:
            validated.update(config)

        # Validations
        assert validated['multiplier'] > 0, "Multiplier must be positive"
        assert validated['poll_interval'] >= 10, "Poll interval must be >= 10 seconds"
        assert validated['min_trade_size'] > 0, "Min trade size must be positive"
        assert validated['max_trade_size'] >= validated['min_trade_size'], "Max trade size must be >= min trade size"
        assert validated['max_position_size'] >= validated['max_trade_size'], "Max position size must be >= max trade size"

        return validated
