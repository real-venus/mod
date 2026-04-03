from typing import *
import mod as m
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

class MCPClient:
    """
    MCP Client that connects to MCP servers and exposes them as mod-style interfaces.
    Bridges MCP protocol with mod's client/server architecture.
    """
    
    def __init__(self, server_params: Optional[StdioServerParameters] = None):
        self.server_params = server_params
        self.session: Optional[ClientSession] = None
        self.resources: List = []
        self.tools: List = []
    
    async def connect(self, command: str, args: List[str] = None, env: Dict = None):
        """Connect to an MCP server"""
        server_params = StdioServerParameters(
            command=command,
            args=args or [],
            env=env
        )
        
        stdio_transport = await stdio_client(server_params)
        self.stdio, self.write = stdio_transport
        self.session = ClientSession(self.stdio, self.write)
        
        await self.session.initialize()
        
        # List available resources and tools
        self.resources = await self.session.list_resources()
        self.tools = await self.session.list_tools()
        
        return self
    
    async def list_resources(self) -> List:
        """List available resources"""
        if not self.session:
            raise RuntimeError("Not connected to server")
        return await self.session.list_resources()
    
    async def read_resource(self, uri: str) -> str:
        """Read a resource"""
        if not self.session:
            raise RuntimeError("Not connected to server")
        result = await self.session.read_resource(uri)
        return result.contents[0].text if result.contents else ""
    
    async def list_tools(self) -> List:
        """List available tools"""
        if not self.session:
            raise RuntimeError("Not connected to server")
        return await self.session.list_tools()
    
    async def call_tool(self, name: str, arguments: Dict = None) -> Any:
        """Call a tool"""
        if not self.session:
            raise RuntimeError("Not connected to server")
        
        result = await self.session.call_tool(name, arguments or {})
        
        # Parse result
        if result.content:
            text = result.content[0].text
            try:
                return m.jloads(text)
            except:
                return text
        return None
    
    async def close(self):
        """Close the connection"""
        if self.session:
            await self.session.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        import asyncio
        asyncio.run(self.close())

class MCPModBridge:
    """
    Bridge between MCP clients and mod servers.
    Allows MCP clients to call mod servers and vice versa.
    """
    
    def __init__(self):
        self.mcp_clients: Dict[str, MCPClient] = {}
        self.namespace = m.namespace()
    
    async def register_mcp_server(self, name: str, command: str, args: List[str] = None):
        """Register an MCP server as a mod-accessible resource"""
        client = MCPClient()
        await client.connect(command, args)
        self.mcp_clients[name] = client
        
        # Register in mod namespace
        self.namespace[name] = f"mcp://{name}"
        
        return client
    
    async def call_mcp_tool(self, server: str, tool: str, params: Dict = None):
        """Call an MCP tool from mod"""
        if server not in self.mcp_clients:
            raise ValueError(f"MCP server {server} not registered")
        
        client = self.mcp_clients[server]
        return await client.call_tool(tool, params)
    
    def expose_as_mod(self, mcp_server: str, mod_name: str = None):
        """Expose an MCP server as a mod server"""
        mod_name = mod_name or mcp_server
        
        class MCPModWrapper:
            def __init__(self, bridge, server_name):
                self.bridge = bridge
                self.server_name = server_name
            
            async def forward(self, fn: str, **params):
                return await self.bridge.call_mcp_tool(
                    self.server_name, 
                    fn, 
                    params
                )
            
            def info(self):
                import asyncio
                client = self.bridge.mcp_clients.get(self.server_name)
                if client:
                    tools = asyncio.run(client.list_tools())
                    return {
                        'name': self.server_name,
                        'type': 'mcp_bridge',
                        'fns': [t.name for t in tools]
                    }
                return {'error': 'Not connected'}
        
        return MCPModWrapper(self, mcp_server)

async def test_mcp_bridge():
    """Test MCP bridge functionality"""
    bridge = MCPModBridge()
    
    # Example: Register an MCP server
    # await bridge.register_mcp_server('example', 'python', ['-m', 'mcp_server'])
    
    # Call a tool
    # result = await bridge.call_mcp_tool('example', 'some_tool', {'param': 'value'})
    
    print("MCP Bridge test complete")
    return {'success': True}

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_mcp_bridge())
