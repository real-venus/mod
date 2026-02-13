import zstandard as zstd
import os
from typing import Optional, Union, BinaryIO


class Zstd:
    """
    Reusable Zstandard compression/decompression helper class.
    
    Advantages:
      - Reuses compressor/decompressor contexts for better performance
      - Simple high-level API for bytes ↔ bytes or file ↔ file
      - Context manager support for file operations
      - Easy level / threads control at creation time
    """
    
    def __init__(
        self,
        level: int = 3,               # -5..22 (negative = faster, positive higher ratio)
        threads: int = -1,            # -1 = auto-detect cores, 0 = single-thread
        compression_params: Optional[dict] = None,  # extra params e.g. {'checksum': True}
    ):
        """
        Create a reusable Zstd handler.
        
        Args:
            level: Compression level (-5 to 22). Default 3 is a good speed/ratio balance.
            threads: Number of threads for compression (-1 = auto, 0 = no threads).
            compression_params: Dict of extra ZstdCompressor params (e.g. dict_id, checksum).
        """
        self.level = level
        self.threads = threads
        
        compressor_kwargs = {"level": level, "threads": threads}
        if compression_params:
            compressor_kwargs.update(compression_params)
        
        self._compressor = zstd.ZstdCompressor(**compressor_kwargs)
        self._decompressor = zstd.ZstdDecompressor()
    
    # ────────────────────────────────────────────────
    #   In-memory (bytes ↔ bytes) operations
    # ────────────────────────────────────────────────
    
    def compress(self, data: bytes) -> bytes:
        """Compress bytes in one shot."""
        return self._compressor.compress(data)
    
    def decompress(self, compressed: bytes) -> bytes:
        """Decompress bytes in one shot."""
        return self._decompressor.decompress(compressed)
    
    # ────────────────────────────────────────────────
    #   Streaming compression / decompression
    # ────────────────────────────────────────────────
    
    def compress_stream(self, data: bytes, chunk_size: int = 8192) -> bytes:
        """Streaming compress (useful for very large data)."""
        chunks = []
        c_stream = self._compressor.compressobj()
        for i in range(0, len(data), chunk_size):
            chunk = data[i:i + chunk_size]
            chunks.append(c_stream.compress(chunk))
        chunks.append(c_stream.flush())
        return b"".join(chunks)
    
    def decompress_stream(self, compressed: bytes, max_size: Optional[int] = None) -> bytes:
        """Streaming decompress with optional size limit."""
        d_stream = self._decompressor.decompressobj()
        result = d_stream.decompress(compressed, max_output_size=max_size or zstd.DECOMPRESSION_RECOMMENDED_OUTPUT_SIZE)
        if d_stream.eof:
            return result
        raise zstd.ZstdError("Incomplete compressed stream (not at EOF)")
    
    # ────────────────────────────────────────────────
    #   File compression / decompression with context manager
    # ────────────────────────────────────────────────
    
    def compress_file(self, input_path: str, output_path: str, level: Optional[int] = None):
        """Compress one file → .zst file (one-shot in memory)."""
        with open(input_path, "rb") as f:
            data = f.read()
        compressed = self.compress(data)
        with open(output_path, "wb") as f:
            f.write(compressed)
    
    def decompress_file(self, input_path: str, output_path: str):
        """Decompress .zst → original file."""
        with open(input_path, "rb") as f:
            compressed = f.read()
        data = self.decompress(compressed)
        with open(output_path, "wb") as f:
            f.write(data)
    
    # ────────────────────────────────────────────────
    #   Context managers for streaming file I/O
    # ────────────────────────────────────────────────
    
    def open_compressed(
        self,
        filename: str,
        mode: str = "wb",
        level: Optional[int] = None,
        buffering: int = -1
    ):
        """
        Context manager: write compressed data to file.
        Usage:
            with zstd.open_compressed("data.zst", "wb") as f:
                f.write(b"hello")
        """
        raw_f = open(filename, mode, buffering=buffering)
        try:
            writer = self._compressor.stream_writer(raw_f)
            yield writer
        finally:
            writer.flush(zstd.COMPRESSOBJ_FLUSH_FRAME)  # ensure valid frame
            raw_f.close()
    
    def open_decompressed(
        self,
        filename: str,
        mode: str = "rb",
        buffering: int = -1
    ):
        """
        Context manager: read decompressed data from .zst file.
        Usage:
            with zstd.open_decompressed("data.zst", "rb") as f:
                print(f.read())
        """
        raw_f = open(filename, mode, buffering=buffering)
        try:
            reader = self._decompressor.stream_reader(raw_f)
            yield reader
        finally:
            raw_f.close()