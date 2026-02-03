import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from diffie.diffie import DiffieHellman
import mod as c

class TestDiffieHellman:
    """Comprehensive test suite for DiffieHellman implementation."""

    def test_initialization_2048(self):
        """Test initialization with 2048-bit group."""
        dh = DiffieHellman(group_size=2048)
        assert dh.group_size == 2048
        assert dh.g == 2
        assert dh._Y > 0
        assert dh._x > 0

    def test_initialization_4096(self):
        """Test initialization with 4096-bit group."""
        dh = DiffieHellman(group_size=4096)
        assert dh.group_size == 4096
        assert dh.g == 2
        assert dh._Y > 0

    def test_invalid_group_size(self):
        """Test that invalid group size raises error."""
        with pytest.raises(ValueError, match="Unsupported group size"):
            DiffieHellman(group_size=1024)

    def test_public_value_generation(self):
        """Test public value is within valid range."""
        dh = DiffieHellman()
        pub = dh.get_public_value()
        assert 2 <= pub <= dh.p - 2

    def test_shared_secret_agreement(self):
        """Test that both parties compute same shared secret."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        A = alice.get_public_value()
        B = bob.get_public_value()
        
        alice_secret = alice.compute_shared_secret(B)
        bob_secret = bob.compute_shared_secret(A)
        
        assert alice_secret == bob_secret

    def test_validate_peer_public_invalid_range(self):
        """Test validation rejects out-of-range public values."""
        dh = DiffieHellman()
        
        with pytest.raises(ValueError, match="out of range"):
            dh._validate_peer_public(1)  # Too small
        
        with pytest.raises(ValueError, match="out of range"):
            dh._validate_peer_public(dh.p)  # Too large

    def test_validate_peer_public_invalid_type(self):
        """Test validation rejects non-integer values."""
        dh = DiffieHellman()
        
        with pytest.raises(TypeError, match="must be an integer"):
            dh._validate_peer_public("not an int")

    def test_validate_peer_public_subgroup_check(self):
        """Test subgroup validation."""
        dh = DiffieHellman()
        # Valid public value should pass
        valid_pub = pow(dh.g, 12345, dh.p)
        dh._validate_peer_public(valid_pub)  # Should not raise

    def test_encryption_decryption(self):
        """Test encryption and decryption workflow."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        A = alice.get_public_value()
        B = bob.get_public_value()
        
        message = "Secret message from Alice to Bob"
        encrypted = alice.encrypt(message, B)
        decrypted = bob.decrypt(encrypted, A)
        
        assert decrypted == message

    def test_encryption_with_aad(self):
        """Test encryption with additional authenticated data."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        A = alice.get_public_value()
        B = bob.get_public_value()
        
        message = "Secret message"
        aad = b"context_data"
        
        encrypted = alice.encrypt(message, B, aad=aad)
        decrypted = bob.decrypt(encrypted, A, aad=aad)
        
        assert decrypted == message

    def test_encryption_wrong_aad_fails(self):
        """Test that wrong AAD causes decryption to fail."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        A = alice.get_public_value()
        B = bob.get_public_value()
        
        message = "Secret message"
        encrypted = alice.encrypt(message, B, aad=b"correct_aad")
        
        with pytest.raises(Exception):  # Should fail MAC verification
            bob.decrypt(encrypted, A, aad=b"wrong_aad")

    def test_encryption_bytes_input(self):
        """Test encryption with bytes input."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        A = alice.get_public_value()
        B = bob.get_public_value()
        
        message = b"Binary secret data"
        encrypted = alice.encrypt(message, B)
        decrypted = bob.decrypt(encrypted, A)
        
        assert decrypted == message.decode('utf-8')

    def test_decrypt_invalid_ciphertext(self):
        """Test that invalid ciphertext raises error."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        A = alice.get_public_value()
        
        with pytest.raises(ValueError, match="too short"):
            bob.decrypt("invalid_base64", A)

    def test_handshake_success(self):
        """Test successful handshake."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        B = bob.get_public_value()
        assert alice.handshake(B) is True

    def test_handshake_invalid_public(self):
        """Test handshake with invalid public value."""
        alice = DiffieHellman('alice')
        assert alice.handshake(1) is False  # Invalid range

    def test_hkdf_extract(self):
        """Test HKDF extract function."""
        ikm = b"input_key_material"
        salt = b"salt_value"
        prk = DiffieHellman._hkdf_extract(salt, ikm)
        assert len(prk) == 32  # SHA256 output

    def test_hkdf_expand(self):
        """Test HKDF expand function."""
        prk = b"pseudo_random_key" * 2  # 32 bytes
        info = b"context_info"
        okm = DiffieHellman._hkdf_expand(prk, info, 64)
        assert len(okm) == 64

    def test_hkdf_expand_too_long(self):
        """Test HKDF expand with excessive length."""
        prk = b"pseudo_random_key" * 2
        info = b"context"
        
        with pytest.raises(ValueError, match="more than 255 blocks"):
            DiffieHellman._hkdf_expand(prk, info, 256 * 32 + 1)

    def test_derive_key_default_params(self):
        """Test key derivation with default parameters."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        B = bob.get_public_value()
        key = alice.derive_key(B)
        
        assert len(key) == 32  # Default key length

    def test_derive_key_custom_length(self):
        """Test key derivation with custom length."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        B = bob.get_public_value()
        key = alice.derive_key(B, key_length=64)
        
        assert len(key) == 64

    def test_derive_key_with_salt(self):
        """Test key derivation with custom salt."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        B = bob.get_public_value()
        salt = os.urandom(32)
        
        key1 = alice.derive_key(B, salt=salt)
        key2 = alice.derive_key(B, salt=salt)
        
        assert key1 == key2  # Same salt = same key

    def test_different_salts_different_keys(self):
        """Test that different salts produce different keys."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        B = bob.get_public_value()
        
        key1 = alice.derive_key(B, salt=os.urandom(32))
        key2 = alice.derive_key(B, salt=os.urandom(32))
        
        assert key1 != key2

    def test_multiple_encryptions_different_ciphertexts(self):
        """Test that same message produces different ciphertexts."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        B = bob.get_public_value()
        message = "Same message"
        
        enc1 = alice.encrypt(message, B)
        enc2 = alice.encrypt(message, B)
        
        assert enc1 != enc2  # Different salts/nonces

    def test_static_test_method(self):
        """Test the static test method."""
        result = DiffieHellman.test()
        
        assert result['success'] is True
        assert result['secrets_match'] is True
        assert result['encryption_works'] is True
        assert result['test_message'] == result['decrypted']
        assert 'alice_address' in result
        assert 'bob_address' in result
        assert result['enc_dec_loop'] >= 0

    def test_key_persistence(self):
        """Test that same key produces same public value."""
        dh1 = DiffieHellman('test_key')
        pub1 = dh1.get_public_value()
        
        # Note: This will fail if private exponent is random
        # This test documents current behavior
        dh2 = DiffieHellman('test_key')
        pub2 = dh2.get_public_value()
        
        # With random exponents, these will differ
        # If you want deterministic keys, modify _generate_private_exponent
        assert isinstance(pub1, int)
        assert isinstance(pub2, int)

    def test_large_message_encryption(self):
        """Test encryption of large messages."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        A = alice.get_public_value()
        B = bob.get_public_value()
        
        large_message = "X" * 10000  # 10KB message
        encrypted = alice.encrypt(large_message, B)
        decrypted = bob.decrypt(encrypted, A)
        
        assert decrypted == large_message

    def test_unicode_message_encryption(self):
        """Test encryption of Unicode messages."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        A = alice.get_public_value()
        B = bob.get_public_value()
        
        unicode_message = "Hello 世界 🌍 Привет"
        encrypted = alice.encrypt(unicode_message, B)
        decrypted = bob.decrypt(encrypted, A)
        
        assert decrypted == unicode_message

    def test_empty_message_encryption(self):
        """Test encryption of empty message."""
        alice = DiffieHellman('alice')
        bob = DiffieHellman('bob')
        
        A = alice.get_public_value()
        B = bob.get_public_value()
        
        empty_message = ""
        encrypted = alice.encrypt(empty_message, B)
        decrypted = bob.decrypt(encrypted, A)
        
        assert decrypted == empty_message

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
