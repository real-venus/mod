import pytest
import hashlib
from merk.merk import MerkleProver


class TestMerkleProver:
    """Test suite for MerkleProver class"""

    def test_initialization_default(self):
        """Test default initialization"""
        prover = MerkleProver()
        assert prover.data == 'hey'
        assert prover.chunk_size == 1
        assert prover.root is not None

    def test_initialization_custom(self):
        """Test initialization with custom data"""
        text = "hello world"
        prover = MerkleProver(data=text, chunk_size=2)
        assert prover.data == text
        assert prover.chunk_size == 2
        assert prover.root is not None

    def test_build_tree_empty_string(self):
        """Test tree building with empty string"""
        prover = MerkleProver()
        tree = prover.build_tree("", 1)
        assert tree == []
        assert prover.root is None

    def test_build_tree_single_char(self):
        """Test tree building with single character"""
        prover = MerkleProver()
        tree = prover.build_tree("a", 1)
        assert len(tree) == 1
        assert len(tree[0]) == 1

    def test_build_tree_structure(self):
        """Test tree structure is correct"""
        prover = MerkleProver(data="abcd", chunk_size=1)
        assert len(prover.leaves) == 4
        assert len(prover.tree[0]) == 4  # 4 leaves
        assert len(prover.tree[1]) == 2  # 2 intermediate nodes
        assert len(prover.tree[2]) == 1  # 1 root

    def test_hash_function(self):
        """Test hash function produces consistent results"""
        prover = MerkleProver()
        hash1 = prover._hash("test")
        hash2 = prover._hash("test")
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA-256 produces 64 hex chars

    def test_hash_function_different_inputs(self):
        """Test hash function produces different hashes for different inputs"""
        prover = MerkleProver()
        hash1 = prover._hash("test1")
        hash2 = prover._hash("test2")
        assert hash1 != hash2

    def test_get_root(self):
        """Test getting merkle root"""
        prover = MerkleProver(data="hello", chunk_size=1)
        root = prover.get_root()
        assert root is not None
        assert isinstance(root, str)
        assert len(root) == 64

    def test_generate_proof_existing_substring(self):
        """Test proof generation for existing substring"""
        text = "hello world"
        prover = MerkleProver(data=text, chunk_size=1)
        proof = prover.generate_proof("world")
        assert proof is not None
        assert isinstance(proof, tuple)
        assert len(proof) == 2
        siblings, leaf_hashes = proof
        assert isinstance(siblings, list)
        assert isinstance(leaf_hashes, list)

    def test_generate_proof_nonexistent_substring(self):
        """Test proof generation for non-existent substring"""
        prover = MerkleProver(data="hello world", chunk_size=1)
        proof = prover.generate_proof("xyz")
        assert proof is None

    def test_generate_proof_single_char(self):
        """Test proof generation for single character"""
        prover = MerkleProver(data="hello", chunk_size=1)
        proof = prover.generate_proof("h")
        assert proof is not None

    def test_generate_proof_full_string(self):
        """Test proof generation for entire string"""
        text = "hello"
        prover = MerkleProver(data=text, chunk_size=1)
        proof = prover.generate_proof(text)
        assert proof is not None

    def test_verify_proof_valid(self):
        """Test verification of valid proof"""
        text = "hello world this is a test"
        prover = MerkleProver(data=text, chunk_size=1)
        substring = "world"
        proof = prover.generate_proof(substring)
        root = prover.get_root()
        
        assert proof is not None
        is_valid = prover.verify_proof(substring, proof, root)
        assert is_valid is True

    def test_verify_proof_invalid_root(self):
        """Test verification fails with wrong root"""
        prover = MerkleProver(data="hello world", chunk_size=1)
        substring = "world"
        proof = prover.generate_proof(substring)
        fake_root = "0" * 64
        
        assert proof is not None
        is_valid = prover.verify_proof(substring, proof, fake_root)
        assert is_valid is False

    def test_verify_proof_none(self):
        """Test verification with None proof"""
        prover = MerkleProver(data="hello", chunk_size=1)
        is_valid = prover.verify_proof("test", None, prover.get_root())
        assert is_valid is False

    def test_verify_proof_empty_proof(self):
        """Test verification with empty proof"""
        prover = MerkleProver(data="hello", chunk_size=1)
        empty_proof = ([], [])
        is_valid = prover.verify_proof("test", empty_proof, prover.get_root())
        assert is_valid is False

    def test_chunk_size_variations(self):
        """Test different chunk sizes"""
        text = "hello world test"
        for chunk_size in [1, 2, 3, 5]:
            prover = MerkleProver(data=text, chunk_size=chunk_size)
            assert prover.root is not None
            assert len(prover.leaves) == (len(text) + chunk_size - 1) // chunk_size

    def test_multiple_occurrences(self):
        """Test substring with multiple occurrences"""
        text = "hello hello world"
        prover = MerkleProver(data=text, chunk_size=1)
        proof = prover.generate_proof("hello")
        assert proof is not None
        is_valid = prover.verify_proof("hello", proof, prover.get_root())
        assert is_valid is True

    def test_case_sensitivity(self):
        """Test that proofs are case sensitive"""
        prover = MerkleProver(data="Hello World", chunk_size=1)
        proof_lower = prover.generate_proof("hello")
        proof_upper = prover.generate_proof("Hello")
        assert proof_lower is None
        assert proof_upper is not None

    def test_special_characters(self):
        """Test with special characters"""
        text = "hello@world#test$123"
        prover = MerkleProver(data=text, chunk_size=1)
        proof = prover.generate_proof("@world#")
        assert proof is not None
        is_valid = prover.verify_proof("@world#", proof, prover.get_root())
        assert is_valid is True

    def test_unicode_characters(self):
        """Test with unicode characters"""
        text = "hello 世界 test"
        prover = MerkleProver(data=text, chunk_size=1)
        proof = prover.generate_proof("世界")
        assert proof is not None
        is_valid = prover.verify_proof("世界", proof, prover.get_root())
        assert is_valid is True

    def test_long_text(self):
        """Test with longer text"""
        text = "a" * 1000
        prover = MerkleProver(data=text, chunk_size=1)
        assert prover.root is not None
        proof = prover.generate_proof("aaa")
        assert proof is not None

    def test_proof_size_logarithmic(self):
        """Test that proof size grows logarithmically"""
        text1 = "a" * 16
        text2 = "a" * 256
        
        prover1 = MerkleProver(data=text1, chunk_size=1)
        prover2 = MerkleProver(data=text2, chunk_size=1)
        
        proof1 = prover1.generate_proof("a")
        proof2 = prover2.generate_proof("a")
        
        assert proof1 is not None
        assert proof2 is not None
        
        # Proof size should grow logarithmically, not linearly
        size1 = len(proof1[0])
        size2 = len(proof2[0])
        assert size2 < size1 * 16  # Much less than linear growth

    def test_built_in_test_method(self):
        """Test the built-in test method"""
        prover = MerkleProver()
        result = prover.test()
        assert isinstance(result, dict)
        assert "root" in result
        assert "proof" in result
        assert "is_valid" in result
        assert result["is_valid"] is True

    def test_rebuild_tree(self):
        """Test rebuilding tree with new data"""
        prover = MerkleProver(data="hello", chunk_size=1)
        root1 = prover.get_root()
        
        prover.build_tree("world", 1)
        root2 = prover.get_root()
        
        assert root1 != root2
        assert prover.data == "world"

    def test_edge_case_substring_at_start(self):
        """Test substring at the start of text"""
        prover = MerkleProver(data="hello world", chunk_size=1)
        proof = prover.generate_proof("hello")
        assert proof is not None
        is_valid = prover.verify_proof("hello", proof, prover.get_root())
        assert is_valid is True

    def test_edge_case_substring_at_end(self):
        """Test substring at the end of text"""
        prover = MerkleProver(data="hello world", chunk_size=1)
        proof = prover.generate_proof("world")
        assert proof is not None
        is_valid = prover.verify_proof("world", proof, prover.get_root())
        assert is_valid is True

    def test_whitespace_handling(self):
        """Test handling of whitespace"""
        prover = MerkleProver(data="hello   world", chunk_size=1)
        proof = prover.generate_proof("   ")
        assert proof is not None
        is_valid = prover.verify_proof("   ", proof, prover.get_root())
        assert is_valid is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
