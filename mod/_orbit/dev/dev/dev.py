
import time
import os
import json
from pathlib import Path
from typing import Dict, List, Union, Optional, Any, Tuple
import mod as m
print=m.print
class Dev:

    tools  = ['create_file', 'rm_file', 'select_files']

    def __init__(self, model: str = 'model.openrouter',  skill = 'dev.skill', memory = 'dev.memory', **kwargs):
        self.memory = m.mod(memory)()
        self.skill = m.mod(skill)()
        self.model = m.mod(model)()


    def get_tools( self, tools = None ) -> Dict[str, str]:
        """
        Get the tools available for the agent
        """
        tools = tools or self.tools
        return {t: m.schema(t, content=1)['forward'] for t in tools}

    def forward(self, 
                query: str = 'make this like the base ', 
                mod='base',
                model: Optional[str] = 'anthropic/claude-sonnet-4.5',
                temperature: float = 0.0, 
                max_tokens: int = 1000000, 
                stream: bool = True,
                steps = 3,
                tools = None,
                path=None,
                safety=False,
                # for saving only (need the key)
                save = False,
                key=None,
                **kwargs) -> Dict[str, str]:
        
        """
        use this to run the agent with a specific text and parameters
        """
        # setup the memory and tools
        path = path or  m.dp(mod)
        self.memory.add('content', m.fn('select_files')(path=path, query=query)) if path != None else None
        def is_b_param(k):
            return k.startswith('fork') and k[1:].isdigit()
        for k,v in kwargs.items():
            if is_b_param(k):
                print(f'Adding to memory: {v}')

                self.memory.add(v, m.code(v))
        self.memory.add('path', path)
        self.memory.add('steps', steps)
        for step in range(steps):   
            self.memory.add('files', m.files(path))
            self.memory.add('step', step)
            prompt = self.skill.prepare(query=query, memory=self.memory.get(), tools=self.get_tools(tools))
            output = self.model.forward(prompt, stream=stream, model=model, max_tokens=max_tokens, temperature=temperature )
            plan = self.skill.plan(output, safety=safety)
            self.memory.add('plan', plan)
            if plan[-1]['tool'].lower() == 'finish':
                break
        if save:
            return m.fn('api/reg')(mod=mod, key=key, comment=query)
        else:
            return plan
