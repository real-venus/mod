import os
import requests
from typing import Optional, List
from pathlib import Path


class ImageSearch:
    """
    Image search class that provides URLs and optionally saves images to a specified path.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize ImageSearch.
        
        Args:
            api_key: Optional API key for image search services
        """
        self.api_key = api_key
        self.urls: List[str] = []
    
    def search(self, query: str, num_results: int = 10, path: Optional[str] = None) -> List[str]:
        """
        Search for images and return URLs. Optionally save images to path.
        
        Args:
            query: Search query string
            num_results: Number of results to return
            path: Optional path to save images. If None, only returns URLs
            
        Returns:
            List of image URLs
        """
        # Placeholder for actual image search implementation
        # This would integrate with services like Unsplash, Pexels, Google Custom Search, etc.
        self.urls = self._fetch_image_urls(query, num_results)
        
        if path:
            self._save_images(path)
        
        return self.urls
    
    def _fetch_image_urls(self, query: str, num_results: int) -> List[str]:
        """
        Fetch image URLs from search service.
        
        Args:
            query: Search query
            num_results: Number of results
            
        Returns:
            List of image URLs
        """
        # Example implementation - replace with actual API integration
        urls = []
        
        # Placeholder: Using Unsplash API as example
        try:
            # This is a mock - implement actual API call
            for i in range(num_results):
                urls.append(f"https://example.com/image_{query}_{i}.jpg")
        except Exception as e:
            print(f"Error fetching images: {e}")
        
        return urls
    
    def _save_images(self, path: str) -> None:
        """
        Save images from URLs to specified path.
        
        Args:
            path: Directory path to save images
        """
        # Create directory if it doesn't exist
        Path(path).mkdir(parents=True, exist_ok=True)
        
        for idx, url in enumerate(self.urls):
            try:
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                
                # Extract file extension from URL or default to jpg
                ext = url.split('.')[-1].split('?')[0] or 'jpg'
                filename = f"image_{idx}.{ext}"
                filepath = os.path.join(path, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                
                print(f"Saved: {filepath}")
            except Exception as e:
                print(f"Error saving {url}: {e}")
    
    def get_urls(self) -> List[str]:
        """
        Get the list of image URLs from last search.
        
        Returns:
            List of image URLs
        """
        return self.urls
    
    def clear(self) -> None:
        """
        Clear stored URLs.
        """
        self.urls = []


class Mod(ImageSearch):
    """
    Mod wrapper for ImageSearch to maintain compatibility.
    """
    description = "Image search module that provides URLs and saves images"
    
    def __init__(self):
        super().__init__()
