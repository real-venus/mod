#!/usr/bin/env python3
"""Weather example using MCP"""

import asyncio
import sys
from pathlib import Path
from typing import Dict, Any
import random

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from mcp.client import MCPClient


class WeatherService:
    """Simple weather service with mock data"""
    
    def get_weather(self, city: str) -> Dict[str, Any]:
        """Get weather for a city (mock data)"""
        # Mock weather data
        conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Stormy"]
        temp = random.randint(10, 35)
        
        return {
            "city": city,
            "temperature": f"{temp}°C",
            "condition": random.choice(conditions),
            "humidity": f"{random.randint(30, 90)}%",
            "wind_speed": f"{random.randint(5, 30)} km/h"
        }
    
    def get_forecast(self, city: str, days: int = 3) -> Dict[str, Any]:
        """Get weather forecast for multiple days"""
        forecast = []
        for i in range(days):
            day_weather = self.get_weather(city)
            day_weather["day"] = f"Day {i+1}"
            forecast.append(day_weather)
        
        return {
            "city": city,
            "forecast": forecast
        }


async def main():
    # Start server with WeatherService class
    server_cmd = [
        sys.executable, "-m", "mcp.server",
        "--name", "weather",
        "--target", "examples.weather:WeatherService"
    ]
    
    async with MCPClient(server_cmd=server_cmd) as client:
        # Initialize
        await client.initialize()
        print("✓ Weather MCP server initialized")
        
        # List available tools
        tools = await client.list_tools()
        print(f"\nAvailable tools: {[t['name'] for t in tools]}")
        
        # Get current weather
        print("\n" + "="*50)
        print("Current Weather")
        print("="*50)
        result = await client.call("get_weather", city="New York")
        print(result[0]['text'])
        
        # Get weather forecast
        print("\n" + "="*50)
        print("3-Day Forecast")
        print("="*50)
        result = await client.call("get_forecast", city="London", days=3)
        print(result[0]['text'])
        
        # Get weather for multiple cities
        print("\n" + "="*50)
        print("Multiple Cities")
        print("="*50)
        cities = ["Tokyo", "Paris", "Sydney"]
        for city in cities:
            result = await client.call("get_weather", city=city)
            print(f"\n{city}: {result[0]['text']}")


if __name__ == "__main__":
    print("="*50)
    print("MCP Weather Service Example")
    print("="*50)
    asyncio.run(main())
    print("\n✓ Example completed successfully!")