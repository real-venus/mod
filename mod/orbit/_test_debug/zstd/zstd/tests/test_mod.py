import unittest
import mod as m
import os
import tempfile
Zstd = m.mod('zstd')


class TestZstd(unittest.TestCase):
    """Test suite for Zstd compression class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.zstd = Zstd(level=3, threads=1)
        self.test_data = b"Hello World! This is a test string for compression."
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up test files."""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_compress_decompress(self):
        """Test basic compression and decompression."""
        compressed = self.zstd.compress(self.test_data)
        self.assertIsInstance(compressed, bytes)
        self.assertLess(len(compressed), len(self.test_data))
        
        decompressed = self.zstd.decompress(compressed)
        self.assertEqual(decompressed, self.test_data)
    
    def test_compress_stream(self):
        """Test streaming compression."""
        compressed = self.zstd.compress_stream(self.test_data, chunk_size=10)
        decompressed = self.zstd.decompress(compressed)
        self.assertEqual(decompressed, self.test_data)
    
    def test_file_compression(self):
        """Test file compression and decompression."""
        input_file = os.path.join(self.temp_dir, "test.txt")
        compressed_file = os.path.join(self.temp_dir, "test.txt.zst")
        output_file = os.path.join(self.temp_dir, "test_out.txt")
        
        # Write test data
        with open(input_file, "wb") as f:
            f.write(self.test_data)
        
        # Compress
        self.zstd.compress_file(input_file, compressed_file)
        self.assertTrue(os.path.exists(compressed_file))
        
        # Decompress
        self.zstd.decompress_file(compressed_file, output_file)
        
        # Verify
        with open(output_file, "rb") as f:
            result = f.read()
        self.assertEqual(result, self.test_data)
    
    def test_context_manager_write(self):
        """Test context manager for writing compressed data."""
        output_file = os.path.join(self.temp_dir, "context_test.zst")
        
        with self.zstd.open_compressed(output_file, "wb") as f:
            f.write(self.test_data)
        
        self.assertTrue(os.path.exists(output_file))
        
        # Verify by decompressing
        with self.zstd.open_decompressed(output_file, "rb") as f:
            result = f.read()
        self.assertEqual(result, self.test_data)
    
    def test_different_compression_levels(self):
        """Test different compression levels."""
        zstd_fast = Zstd(level=1)
        zstd_slow = Zstd(level=10)
        
        compressed_fast = zstd_fast.compress(self.test_data * 100)
        compressed_slow = zstd_slow.compress(self.test_data * 100)
        
        # Higher level should compress better
        self.assertLessEqual(len(compressed_slow), len(compressed_fast))
        
        # Both should decompress correctly
        self.assertEqual(zstd_fast.decompress(compressed_fast), self.test_data * 100)
        self.assertEqual(zstd_slow.decompress(compressed_slow), self.test_data * 100)


if __name__ == "__main__":
    unittest.main()
