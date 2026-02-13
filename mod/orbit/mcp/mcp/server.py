from typing import *
import mod as m
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

class MCPServer:
    """
    MCP Server implementation that interfaces with mod's client/server architecture.
    Exposes mod tools as MCP resources and tools.
    """
    
    def __init__(self, mod_name: str = 'mcp', namespace: Optional[Dict] = None):
        self.mod_name = mod_name
        self.namespace = namespace or m.namespace()
        self.server = Server(mod_name)
        self.setup_handlers()
    
    def setup_handlers(self):
        """Setup MCP protocol handlers"""
        
        @self.server.list_resources()
        async def list_resources() -> list[types.Resource]:
            """List available mod servers as resources"""
            resources = []
            for name, url in self.namespace.items():
                resources.append(
                    types.Resource(
                        uri=f"mod://{name}",
                        name=name,
                        mimeType="application/json",
                        description=f"Mod server: {name} at {url}"
                    )
                )
            return resources
        
        @self.server.read_resource()
        async def read_resource(uri: str) -> str:
            """Read resource (call mod server info)"""
            if uri.startswith("mod://"):
                mod_name = uri.replace("mod://", "")
                try:
                    info = m.call(f"{mod_name}/info")
                    return m.jdumps(info)
                except Exception as e:
                    return m.jdumps({"error": str(e)})
            raise ValueError(f"Unknown URI: {uri}")
        
        @self.server.list_tools()
        async def list_tools() -> list[types.Tool]:
            """List available mod functions as tools"""
            tools = []
            
            # Get all mods and their functions
            for mod_name in self.namespace.keys():
                try:
                    info = m.call(f"{mod_name}/info")
                    fns = info.get('fns', [])
                    
                    for fn in fns:
                        tools.append(
                            types.Tool(
                                name=f"{mod_name}/{fn}",
                                description=f"Call {fn} on {mod_name} server",
                                inputSchema={
                                    "type": "object",
                                    "properties": {
                                        "params": {
                                            "type": "object",
                                            "description": "Parameters to pass to the function"
                                        }
                                    }
                                }
                            )
                        )
                except Exception as e:
                    m.print(f"Error listing tools for {mod_name}: {e}", color='red')
            
            return tools
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
            """Execute a mod function"""
            try:
                params = arguments.get('params', {})
                result = m.call(name, **params)
                
                return [
                    types.TextContent(
                        type="text",
                        text=m.jdumps(result)
                    )
                ]
            except Exception as e:
                return [
                    types.TextContent(
                        type="text",
                        text=m.jdumps({"error": str(e), "traceback": m.detailed_error(e)})
                    )
                ]
    
    async def run(self):
        """Run the MCP server"""
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )

def main():
    """Entry point for MCP server"""
    import asyncio
    server = MCPServer()
    asyncio.run(server.run())

if __name__ == "__main__":
    main()
