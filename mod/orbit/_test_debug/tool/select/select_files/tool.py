
import mod as c
import json
import os
from typing import List, Dict, Union, Optional, Any

print = c.print
class SelectFiles:

    def __init__(self,  model='model.openrouter'):
        self.model = c.mod(model)()

    def forward(self,  
              path: Union[List[str], Dict[Any, str]] = './', 
              query: str = 'most relevant', 
              files = None, 
              n: int = 10, 
              trials = 3,
              number_lines = True,
              mod=None,
              max_chars_pre_split = 100_000,
              content: bool = True,
              model='anthropic/claude-opus-4.5',
              avoid_paths: List[str] = ['.git', '__pycache__', 'node_modules', '.venv', 'venv', '.env', 'private', 'tmp', 'env'],
              depth=8,
               **kwargs) -> List[str]:
        if files == None:
            if path == None and mod:
                path = c.dirpath(mod)
            files = c.files(path, depth=depth)
        print(f"Total files found: {len(files)} in {path}", color="blue")
        if len(str(files)) > max_chars_pre_split:
            print(f"Total characters in file list exceed {max_chars_pre_split}. Splitting into batches...")
            num_batches = (len(str(files)) // max_chars_pre_split) + 1
            print(f"Splitting file selection into {num_batches} batches due to size...")
            all_selected_files = set()
            batch_size = len(files) // num_batches
            for i in range(num_batches):
                batch_files = files[i*batch_size : (i+1)*batch_size] if i < num_batches - 1 else files[i*batch_size :]
                selected_files = self.forward(
                    query=query,
                    files=batch_files,
                    n=n,
                    trials=trials,
                    number_lines=number_lines,
                    content=content,
                    model=model,
                    avoid_paths=avoid_paths,
                    depth=depth,
                    max_chars_pre_split=max_chars_pre_split,
                    **kwargs
                )
                all_selected_files.update(selected_files)
            return list(all_selected_files)
        if len(files) > 1:
            # make the files relative to the path
            for trial in range(trials):
                try:
                    files = c.fn('select_options/')(
                        query=query,
                        options= files,
                        n=n,
                        model=model,
                        **kwargs
                    )
                    break
                except Exception as e: 
                    print(f"Trial {trial+1} failed with error: {e}", color="red")
                    continue
        if content:
            results = {}
            for f in files:
                try:
                    results[f] = self.get_text(f)
                except Exception as e:
                    print(f"Failed to read file {f}: {e}", color="red")
                    continue
        else: 
            results = files
        if number_lines:
            for f in results:
                results[f] =  [f"{i+1}   {line}" for i, line in enumerate(results[f].split('\n'))]
        return results

    def get_text(self, path: str) -> str:
        path = os.path.abspath(os.path.expanduser(path))
        with open(path, 'r') as f:
            text = f.read()
        return text

    def test(self):
        dirpath = os.path.dirname(__file__)
        query = f'i want to find the {__file__} file'
        results = self.forward(path=dirpath, query=query, n=1)
        result_files = [os.path.abspath(os.path.expanduser(f)) for f in results]
        assert __file__ in result_files, f"Expected {dirpath} in results, got {result_files}"
        print(f"Test results: {results}", color="green")
        return {
            "success": True,
            "message": f"Tesst with query '{query}' and wanted file '{__file__}'"
            
        }

        



    